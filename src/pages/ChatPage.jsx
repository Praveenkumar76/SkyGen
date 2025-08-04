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
  const chatboxRef = useRef(null);
  const navigate = useNavigate();
  const { user } = session;

  // Effect to fetch conversations and set up realtime listener
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

  // In src/pages/ChatPage.jsx

// --- Effect to fetch messages and listen for new ones in the active chat ---
useEffect(() => {
  let messageChannel;

  const setupConversation = async () => {
    // Unsubscribe from any previous channel
    await supabase.removeAllChannels();

    // 1. Fetch initial messages for the selected conversation
    if (activeConversationId) {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, role, content: message')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        setMessages(data || []);
      }
    } else {
      setMessages([]); // Clear messages if no chat is active
    }

    // 2. Now, set up the realtime subscription
    messageChannel = supabase
      .channel(`public:chat_messages:${activeConversationId || 'all'}`)
      .on('postgres_changes', 
        { 
          event: '*',
          schema: 'public', 
          table: 'chat_messages', 
          filter: `conversation_id=eq.${activeConversationId}` 
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMessage = { id: payload.new.id, role: payload.new.role, content: payload.new.message };
            // Add the new message only if it's not already in the state (prevents duplicates)
            setMessages((prev) => 
              prev.find(msg => msg.id === newMessage.id) ? prev : [...prev, newMessage]
            );
          }
          if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
          }
        }
      )
      .subscribe();
  };

  setupConversation();

  // 3. Cleanup function
  return () => {
    if (messageChannel) {
      supabase.removeChannel(messageChannel);
    }
  };
}, [activeConversationId]); // Dependency: run this effect only when the active chat changes

  // Effect to fetch messages and listen for new ones in the active chat
  useEffect(() => {
    if (activeConversationId) {
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
    } else {
        setMessages([]);
    }

    const messageChannel = supabase
      .channel(`public:chat_messages:${activeConversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${activeConversationId}` },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMessage = { id: payload.new.id, role: payload.new.role, content: payload.new.message };
          setMessages((prev) => [...prev, newMessage]);
        }
        if (payload.eventType === 'DELETE') {
          setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(messageChannel);
  }, [activeConversationId]);

  // Effect for auto-scrolling
  useEffect(() => {
    if (chatboxRef.current) chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
  }, [messages]);
  
  const handleNewChat = () => setActiveConversationId(null);

  const handleDeleteMessage = async (messageId) => {
    if (window.confirm("Are you sure you want to delete this message?")) {
      await supabase.from('chat_messages').delete().eq('id', messageId);
    }
  };

  const handleRename = async (conversationId) => {
    const newTitle = prompt("Enter a new name for the chat:");
    if (newTitle && newTitle.trim() !== '') {
      await supabase.from('conversations').update({ title: newTitle }).eq('id', conversationId);
    }
  };

  const handleDeleteConversation = async (conversationId) => {
    if (window.confirm("Are you sure you want to delete this chat?")) {
      await supabase.from('conversations').delete().eq('id', conversationId);
    }
  };

  const handleShare = async (conversationId) => {
    const { data } = await supabase.from('conversations').select('share_id').eq('id', conversationId).single();
    let shareId = data?.share_id;
    if (!shareId) {
      const newShareId = crypto.randomUUID();
      const { data: updatedData, error } = await supabase.from('conversations').update({ share_id: newShareId, is_shared: true }).eq('id', conversationId).select('share_id').single();
      if (error) return alert("Could not create share link.");
      shareId = updatedData.share_id;
    }
    const shareUrl = `${window.location.origin}/share/${shareId}`;
    navigator.clipboard.writeText(shareUrl);
    alert(`Share link copied to clipboard!\n${shareUrl}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const tempInput = input;
    const userMessage = { id: crypto.randomUUID(), role: 'user', content: tempInput };
  setInput('');
  setMessages(prev => [...prev, userMessage]);
    
    let currentConversationId = activeConversationId;
    if (!currentConversationId) {
      try {
        const titleResponse = await fetch(`${BACKEND_URL}/generate-title`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstMessage: tempInput }),
        });
        if (!titleResponse.ok) throw new Error('Failed to generate title');
        const { title: generatedTitle } = await titleResponse.json();

        const { data, error } = await supabase.from('conversations').insert({ user_id: user.id, title: generatedTitle }).select('id').single();
        if (error) throw error;
        currentConversationId = data.id;
        setActiveConversationId(currentConversationId);
      } catch (err) {
        console.error("Error creating new conversation:", err);
        return;
      }
    }
    
    await supabase.from('chat_messages').insert({ user_id: user.id, conversation_id: currentConversationId, role: 'user', message: tempInput });
    
    setIsLoading(true);
    
    try {
      const messagesForApi = messages.map(({ role, content }) => ({ role, content }));
      messagesForApi.push(userMessage); // Add the latest user message
      const response = await fetch(`${BACKEND_URL}/generate-stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: messagesForApi }) });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      setMessages(currentMessages => [...currentMessages, { id: crypto.randomUUID(), role: 'assistant', content: '' }]);
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const eventLines = chunk.split('\n\n').filter(line => line.length > 0);
        for (const line of eventLines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token) {
                accumulatedContent += data.token;
                setMessages(currentMessages => {
                  const lastMessage = { ...currentMessages[currentMessages.length - 1], content: accumulatedContent };
                  return [...currentMessages.slice(0, -1), lastMessage];
                });
              }
            } catch (err) { console.error('Error parsing SSE message:', err, line); }
          }
        }
      }
      if (accumulatedContent.trim()) {
        await supabase.from('chat_messages').insert({ user_id: user.id, conversation_id: currentConversationId, role: 'assistant', message: accumulatedContent });
      }
    } catch (error) {
      console.error('Streaming error:', error);
      const errorMessage = { role: 'assistant', content: `Error: ${error.message}.` };
      setMessages(currentMessages => [...currentMessages.slice(0,-1), errorMessage]);
    } finally {
      setIsLoading(false);
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
            <img src="/logo.svg" alt="Logo" className="sidebar-logo" />
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
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.role}`}>
              <div className="message-content">{msg.content}</div>
              {(msg.role === 'user' || msg.role === 'assistant') && (
                <button onClick={() => handleDeleteMessage(msg.id)} className="delete-message-button">🗑️</button>
              )}
            </div>
          ))}
          {isLoading && ( <div>Loading...</div> )}
        </div>
        <form onSubmit={handleSubmit} className="chat-input-form">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question..." disabled={isLoading} />
          <button type="submit" disabled={isLoading}>Send</button>
        </form>
      </div>
    </div>
  );
}