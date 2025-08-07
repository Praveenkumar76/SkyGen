import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import ConversationOptions from '../components/ConversationOptions';
import UserAvatar from '../components/UserAvatar';
import './ChatPage.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function ChatPage({ session, profile }) {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentActivity, setAgentActivity] = useState(null); // New state for agent's thoughts
  const chatboxRef = useRef(null);
  const navigate = useNavigate();
  const { user } = session;

  // --- EFFECT 1: Fetch all conversations and listen for changes ---
  useEffect(() => {
    const fetchConversations = async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) console.error('Error fetching conversations:', error);
      else setConversations(data || []);
    };
    fetchConversations();

    const conversationChannel = supabase
      .channel('public:conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `user_id=eq.${user.id}` }, 
      (payload) => {
        if (payload.eventType === 'INSERT') setConversations((prev) => [payload.new, ...prev]);
        if (payload.eventType === 'UPDATE') setConversations((prev) => prev.map((conv) => (conv.id === payload.new.id ? payload.new : conv)));
        if (payload.eventType === 'DELETE') {
          setConversations((prev) => prev.filter((conv) => conv.id !== payload.old.id));
          if (activeConversationId === payload.old.id) setActiveConversationId(null);
        }
      })
      .subscribe();
      
    return () => supabase.removeChannel(conversationChannel);
  }, [user.id, activeConversationId]); // Added activeConversationId to refetch if needed


  // --- EFFECT 2: Fetch messages for the ACTIVE conversation and listen for changes ---
  // This hook is now cleaned up and consolidated.
  useEffect(() => {
    // No need to fetch if no conversation is selected
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, role, content: message')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true });
      
      if (error) console.error('Error fetching messages:', error);
      else setMessages(data || []);
    };
    fetchMessages();

    // Set up a unique channel for the active conversation
    const messageChannel = supabase
      .channel(`chat_messages:${activeConversationId}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${activeConversationId}` },
        (payload) => {
          const newMessage = { id: payload.new.id, role: payload.new.role, content: payload.new.message };
          setMessages((prev) => 
             prev.find(msg => msg.id === newMessage.id) ? prev : [...prev, newMessage]
          );
        }
      )
      .subscribe();
      
    // Cleanup function to remove the channel when the component unmounts or the active chat changes
    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [activeConversationId]); // This effect ONLY runs when activeConversationId changes.


  // --- EFFECT 3: Auto-scrolling ---
  useEffect(() => {
    if (chatboxRef.current) chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
  }, [messages, agentActivity]); // Also scroll on new agent activity


  // --- Handler Functions (Unchanged) ---
  const handleNewChat = () => setActiveConversationId(null);
  const handleRename = async (conversationId) => { /* ...your existing code... */ };
  const handleDeleteConversation = async (conversationId) => { /* ...your existing code... */ };
  const handleShare = async (conversationId) => { /* ...your existing code... */ };


  // --- MAIN LOGIC: Handle Form Submission ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const tempInput = input;
    const userMessage = { role: 'user', content: tempInput };
    setInput('');
    setMessages(prev => [...prev, userMessage]);
    
    let currentConversationId = activeConversationId;
    
    // --- New Conversation Logic (No more /generate-title) ---
    if (!currentConversationId) {
      try {
        const tempTitle = tempInput.substring(0, 40); // Use the first part of the message as a temp title
        const { data, error } = await supabase.from('conversations').insert({ user_id: user.id, title: tempTitle }).select('id').single();
        if (error) throw error;
        currentConversationId = data.id;
        setActiveConversationId(currentConversationId); // This will trigger the useEffect to fetch history
      } catch (err) {
        console.error("Error creating new conversation:", err);
        setMessages(prev => prev.slice(0,-1)); // Remove the user's message if creation failed
        return;
      }
    }

    // Save the user's message to the database
    await supabase.from('chat_messages').insert({ user_id: user.id, conversation_id: currentConversationId, role: 'user', message: tempInput });
    
    setIsLoading(true);
    setAgentActivity("Thinking..."); // Set initial agent activity

    // --- NEW AGENT API CALL ---
    try {
      const messagesForApi = [...messages, userMessage].map(({ role, content }) => ({ role, content }));
      
      const response = await fetch(`${BACKEND_URL}/agent-chat`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        // The new endpoint needs the user_id
        body: JSON.stringify({ messages: messagesForApi, user_id: user.id }) 
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      setMessages(currentMessages => [...currentMessages, { id: crypto.randomUUID(), role: 'assistant', content: '' }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          setAgentActivity(null); // Clear activity when done
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        const eventLines = chunk.split('\n\n').filter(line => line.length > 0);

        for (const line of eventLines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              // --- New Logic to Handle Different Event Types ---
              if (data.type === 'thought' || data.type === 'tool_call' || data.type === 'tool_output') {
                setAgentActivity(data.content || `Using tool: ${data.tool_name}`);
              } else if (data.type === 'token') {
                accumulatedContent += data.content;
                setMessages(currentMessages => {
                  const lastMessage = { ...currentMessages[currentMessages.length - 1], content: accumulatedContent };
                  return [...currentMessages.slice(0, -1), lastMessage];
                });
              } else if (data.type === 'final_answer') {
                  setMessages(currentMessages => {
                    const lastMessage = { ...currentMessages[currentMessages.length - 1], content: data.content };
                    return [...currentMessages.slice(0, -1), lastMessage];
                  });
              } else if (data.type === 'agent_action' && data.action === 'sign_out') {
                await supabase.auth.signOut();
                navigate('/login');
              } else if (data.done) {
                 // The 'done' signal is the final indicator
              }
            } catch (err) { console.error('Error parsing SSE message:', err, line); }
          }
        }
      }
      // Save the final accumulated message to the database
      if (accumulatedContent.trim()) {
        await supabase.from('chat_messages').insert({ user_id: user.id, conversation_id: currentConversationId, role: 'assistant', message: accumulatedContent });
      }

    } catch (error) {
      console.error('Streaming error:', error);
      const errorMessage = { role: 'assistant', content: `Error: ${error.message}. Please try again.` };
      setMessages(currentMessages => [...currentMessages.slice(0,-1), errorMessage]); // Replace loading state with error
    } finally {
      setIsLoading(false);
      setAgentActivity(null);
    }
  };

  return (
    <div className="chat-layout">
      {/* Sidebar JSX is unchanged */}
      <div className="sidebar">
       {/* ... your existing sidebar JSX code ... */}
      </div>

      <div className="chat-window-container">
        <div className="chat-box" ref={chatboxRef}>
          {/* ... your existing message mapping code ... */}
          {/* Add a display for the agent's activity */}
          {agentActivity && (
            <div className="chat-message assistant">
              <div className="message-content agent-activity">
                <em>{agentActivity}</em>
              </div>
            </div>
          )}
        </div>
        <form onSubmit={handleSubmit} className="chat-input-form">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question or give a command..." disabled={isLoading} />
          <button type="submit" disabled={isLoading}>Send</button>
        </form>
      </div>
    </div>
  );
}