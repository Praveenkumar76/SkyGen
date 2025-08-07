import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import ConversationOptions from '../components/ConversationOptions';
import UserAvatar from '../components/UserAvatar';
import './ChatPage.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function ChatPage({ session, profile }) {
  // State variables
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentActivity, setAgentActivity] = useState(null);
  const chatboxRef = useRef(null);
  const navigate = useNavigate();

  // --- CRITICAL FIX: Add a loading state if session or profile are not ready ---
  if (!session || !profile) {
    return <div>Loading user session...</div>;
  }
  
  // Now we can safely destructure the user
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
  }, [user.id]);

  // --- EFFECT 2: Fetch messages for the ACTIVE conversation ---
  useEffect(() => {
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
    // Note: The realtime listener for messages was removed to simplify. 
    // The UI will still feel real-time as new messages are added instantly from the handleSubmit function.
    // Re-adding the message listener can sometimes cause duplicate messages depending on the setup.
  }, [activeConversationId]);

  // --- EFFECT 3: Auto-scrolling ---
  useEffect(() => {
    if (chatboxRef.current) chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
  }, [messages, agentActivity]);

  // --- Handler Functions ---
  const handleNewChat = () => setActiveConversationId(null);
  const handleRename = async (conversationId) => { /* Your existing code */ };
  const handleDeleteConversation = async (conversationId) => { /* Your existing code */ };
  const handleShare = async (conversationId) => { /* Your existing code */ };
  const handleDeleteMessage = async (messageId) => { /* Your existing code */ };

  // --- MAIN LOGIC: Handle Form Submission ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const tempInput = input;
    const userMessage = { role: 'user', content: tempInput };
    setInput('');
    setMessages(prev => [...prev, userMessage]);
    
    let currentConversationId = activeConversationId;
    
    // Create new conversation if none is active
    if (!currentConversationId) {
      try {
        const tempTitle = tempInput.substring(0, 40) + '...';
        const { data, error } = await supabase.from('conversations').insert({ user_id: user.id, title: tempTitle }).select('id').single();
        if (error) throw error;
        currentConversationId = data.id;
        setActiveConversationId(currentConversationId);
      } catch (err) {
        console.error("Error creating new conversation:", err);
        setMessages(prev => prev.slice(0,-1));
        return;
      }
    }

    await supabase.from('chat_messages').insert({ user_id: user.id, conversation_id: currentConversationId, role: 'user', message: tempInput });
    
    setIsLoading(true);
    setAgentActivity("Thinking...");

    try {
      const messagesForApi = [...messages, userMessage].map(({ role, content }) => ({ role, content }));
      
      const response = await fetch(`${BACKEND_URL}/agent-chat`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ messages: messagesForApi, user_id: user.id }) 
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      
      // Add a placeholder for the assistant's response
      const assistantMessageId = crypto.randomUUID();
      setMessages(currentMessages => [...currentMessages, { id: assistantMessageId, role: 'assistant', content: '' }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const eventLines = chunk.split('\n\n').filter(line => line.length > 0);

        for (const line of eventLines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'thought' || data.type === 'tool_call' || data.type === 'tool_output') {
                setAgentActivity(data.content || `Using tool: ${data.tool_name}`);
              } else if (data.type === 'token' || data.type === 'final_answer') {
                accumulatedContent += data.content;
                setMessages(currentMessages => currentMessages.map(msg => 
                  msg.id === assistantMessageId ? { ...msg, content: accumulatedContent } : msg
                ));
              } else if (data.type === 'agent_action' && data.action === 'sign_out') {
                await supabase.auth.signOut();
                navigate('/login');
              }
            } catch (err) { console.error('Error parsing SSE message:', err); }
          }
        }
      }
      
      if (accumulatedContent.trim()) {
        await supabase.from('chat_messages').update({ message: accumulatedContent }).eq('id', assistantMessageId);
      } else {
        await supabase.from('chat_messages').delete().eq('id', assistantMessageId);
      }

    } catch (error) {
      console.error('Streaming error:', error);
      setMessages(currentMessages => [...currentMessages, { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
      setAgentActivity(null);
    }
  };

  return (
    <div className="chat-layout">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Conversations</h2>
          <button onClick={handleNewChat} className="new-chat-button">+ New Chat</button>
        </div>
        <div className="conversation-list">
          {conversations.map(conv => (
            <div key={conv.id} className={`conversation-item ${activeConversationId === conv.id ? 'active' : ''}`}>
              <span className="conversation-title" onClick={() => setActiveConversationId(conv.id)}>
                {conv.title}
              </span>
              <ConversationOptions
                onRename={() => handleRename(conv.id)}
                onDelete={() => handleDeleteConversation(conv.id)}
                onShare={() => handleShare(conv.id)}
              />
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="user-profile-link" onClick={() => navigate('/profile')}>
            <UserAvatar username={profile.username} />
            <span>{profile.username}</span>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="logout-button">Sign Out</button>
        </div>
      </div>

      <div className="chat-window-container">
        <div className="chat-box" ref={chatboxRef}>
          {messages.length === 0 && (
            <div className="empty-chat-placeholder">
              <h1>SkyGen</h1>
              <p>Select a conversation or start a new one.</p>
            </div>
          )}
          {messages.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.role}`}>
              <div className="message-content" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            </div>
          ))}
          {agentActivity && (
            <div className="chat-message assistant">
              <div className="message-content agent-activity">
                <em>{agentActivity}</em>
              </div>
            </div>
          )}
          {isLoading && !agentActivity && ( <div className="loading-indicator">Loading...</div> )}
        </div>
        <form onSubmit={handleSubmit} className="chat-input-form">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question or give a command..." disabled={isLoading} />
          <button type="submit" disabled={isLoading}>Send</button>
        </form>
      </div>
    </div>
  );
}