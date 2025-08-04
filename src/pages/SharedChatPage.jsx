import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './ChatPage.css'; // Reuse chat styles

export default function SharedChatPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const { shareId } = useParams();

  useEffect(() => {
    if (!shareId) {
        setError("No share ID provided.");
        setLoading(false);
        return;
    };

    const fetchSharedChat = async () => {
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('id, title')
        .eq('share_id', shareId)
        .eq('is_shared', true)
        .single();

      if (convError || !convData) {
        setError('This chat is not shared or does not exist.');
        setLoading(false);
        return;
      }
      setConversation(convData);

      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select('role, content: message')
        .eq('conversation_id', convData.id)
        .order('created_at', { ascending: true });
      
      if (messagesError) setError('Could not load messages.');
      else setMessages(messagesData || []);
      setLoading(false);
    };

    fetchSharedChat();
  }, [shareId]);

  if (loading) return <div className="loading-container">Loading Conversation...</div>;
  if (error) return <div className="loading-container">{error}</div>;

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>{conversation.title}</h1>
        <p>A shared conversation from SkyGen</p>
      </div>
      <div className="chat-box">
        {messages.map((msg, index) => (
          <div key={index} className={`chat-message ${msg.role}`}>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}