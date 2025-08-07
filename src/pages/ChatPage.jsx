import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import ConversationOptions from '../components/ConversationOptions';
import UserAvatar from '../components/UserAvatar';
import AgentActivity from '../components/AgentActivity'; // <-- NEW
import { ReactComponent as Logo } from '../assets/logo.svg'; // <-- NEW: For placeholder
import './ChatPage.css'; // <-- NEW styles will be applied

// Ensure you have this in your .env file
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function ChatPage({ session, profile }) {
    const [conversations, setConversations] = useState([]);
    const [activeConversationId, setActiveConversationId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [agentActivity, setAgentActivity] = useState(null); // Will hold structured data
    const chatboxRef = useRef(null);
    const navigate = useNavigate();

    if (!session || !profile) {
        return <div className="loading-screen">Loading user session...</div>;
    }
    
    const { user } = session;

    useEffect(() => {
        const fetchConversations = async () => {
            const { data, error } = await supabase.from('conversations').select('id, title').eq('user_id', user.id).order('created_at', { ascending: false });
            if (error) console.error('Error fetching conversations:', error);
            else setConversations(data || []);
        };
        fetchConversations();

        const conversationChannel = supabase.channel('public:conversations').on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `user_id=eq.${user.id}` }, (payload) => {
            fetchConversations(); // Re-fetch to keep it simple and in sync
            if (payload.eventType === 'DELETE' && activeConversationId === payload.old.id) {
                setActiveConversationId(null);
            }
        }).subscribe();
        
        return () => supabase.removeChannel(conversationChannel);
    }, [user.id, activeConversationId]);

    useEffect(() => {
        if (!activeConversationId) {
            setMessages([]);
            return;
        }
        const fetchMessages = async () => {
            const { data, error } = await supabase.from('chat_messages').select('id, role, message').eq('conversation_id', activeConversationId).order('created_at', { ascending: true });
            if (error) console.error('Error fetching messages:', error);
            else setMessages(data.map(m => ({ role: m.role, content: m.message })) || []);
        };
        fetchMessages();
    }, [activeConversationId]);

    useEffect(() => {
        if (chatboxRef.current) chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
    }, [messages, agentActivity]);

    const handleNewChat = () => setActiveConversationId(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userInput = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userInput }]);
        setIsLoading(true);
        setAgentActivity({ type: 'thought', content: 'Thinking...' });

        let currentConversationId = activeConversationId;
        if (!currentConversationId) {
            try {
                const tempTitle = userInput.substring(0, 40) + (userInput.length > 40 ? '...' : '');
                const { data, error } = await supabase.from('conversations').insert({ user_id: user.id, title: tempTitle }).select('id').single();
                if (error) throw error;
                currentConversationId = data.id;
                setActiveConversationId(data.id);
            } catch (err) {
                console.error("Error creating new conversation:", err);
                setMessages(prev => prev.slice(0, -1)); // Remove optimistic user message
                setIsLoading(false);
                setAgentActivity(null);
                return;
            }
        }

        await supabase.from('chat_messages').insert({ user_id: user.id, conversation_id: currentConversationId, role: 'user', message: userInput });
        
        const messagesForApi = [...messages, { role: 'user', content: userInput }].map(({ role, content }) => ({ role, content }));

        try {
            const response = await fetch(`${BACKEND_URL}/agent-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: messagesForApi, user_id: user.id, conversation_id: currentConversationId })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantResponse = { id: `asst_${Date.now()}`, role: 'assistant', content: '' };
            setMessages(prev => [...prev, assistantResponse]);

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const eventLines = chunk.split('\n\n').filter(line => line.startsWith('data: '));

                for (const line of eventLines) {
                    const jsonData = JSON.parse(line.substring(6));
                    
                    if (jsonData.done) {
                        break;
                    } else if (jsonData.type === 'error') {
                        setAgentActivity({ type: 'error', content: jsonData.content });
                    } else if (['thought', 'tool_call', 'tool_output'].includes(jsonData.type)) {
                        setAgentActivity(jsonData);
                    } else if (jsonData.type === 'agent_action' && jsonData.action === 'sign_out') {
                        await supabase.auth.signOut();
                        navigate('/login');
                    } else if (jsonData.type === 'token' || jsonData.type === 'final_answer') {
                        setAgentActivity(null); // Hide agent activity once final answer starts
                        assistantResponse.content += jsonData.content;
                        setMessages(current => current.map(msg => msg.id === assistantResponse.id ? { ...msg, content: assistantResponse.content } : msg));
                    }
                }
            }
            
            // Finalize the message in the database
            if (assistantResponse.content.trim()) {
                 await supabase.from('chat_messages').insert({ user_id: user.id, conversation_id: currentConversationId, role: 'assistant', message: assistantResponse.content });
            }
            setMessages(current => current.filter(msg => msg.id !== assistantResponse.id)); // Remove temp message
            // Re-fetch messages to get the real one from DB with a real ID
            const { data } = await supabase.from('chat_messages').select('id, role, message').eq('conversation_id', currentConversationId).order('created_at', { ascending: true });
            setMessages(data.map(m => ({ role: m.role, content: m.message })) || []);


        } catch (error) {
            console.error('Streaming error:', error);
            setMessages(current => [...current, { role: 'assistant', content: `Sorry, something went wrong: ${error.message}` }]);
        } finally {
            setIsLoading(false);
            setAgentActivity(null);
        }
    };
    
    // NOTE: The delete/rename functions are now handled by the agent.
    // You can keep the buttons and have them trigger a pre-defined message like:
    const handleDeleteConversation = (convId, convTitle) => {
        setInput(`Please delete the chat titled "${convTitle}"`);
    }

    return (
        <div className="chat-layout">
            {/* Sidebar remains mostly the same, but with new class names for styling */}
            <div className="sidebar">
                <div className="sidebar-header">
                    <h2>SkyGen</h2>
                    <button onClick={handleNewChat} className="new-chat-button">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                        New Chat
                    </button>
                </div>
                <div className="conversation-list">
                    {conversations.map(conv => (
                        <div key={conv.id} className={`conversation-item ${activeConversationId === conv.id ? 'active' : ''}`} onClick={() => setActiveConversationId(conv.id)}>
                            <span className="conversation-title">{conv.title}</span>
                            <ConversationOptions onDelete={() => handleDeleteConversation(conv.id, conv.title)} />
                        </div>
                    ))}
                </div>
                <div className="sidebar-footer">
                    <div className="user-profile-link" onClick={() => navigate('/profile')}>
                        <UserAvatar username={profile.username} />
                        <span>{profile.username}</span>
                    </div>
                </div>
            </div>

            {/* Main Chat Window */}
            <div className="chat-window">
                <div className="chat-messages" ref={chatboxRef}>
                    {messages.length === 0 && !isLoading && (
                        <div className="empty-chat-placeholder">
                            <Logo className="placeholder-logo" />
                            <h1>How can I help you today?</h1>
                        </div>
                    )}
                    {messages.map((msg, index) => (
                         <div key={index} className={`chat-message-wrapper ${msg.role}`}>
                            {msg.role === 'assistant' && <UserAvatar username="Skaira" />}
                            <div className="message-content">{msg.content}</div>
                         </div>
                    ))}
                    
                    {/* NEW: Agent Activity Display */}
                    {isLoading && agentActivity && <AgentActivity activity={agentActivity} />}

                    {/* Simple loading indicator for when agent is just waiting */}
                    {isLoading && !agentActivity && messages.length > 0 && (
                        <div className="chat-message-wrapper assistant">
                            <UserAvatar username="Skaira" />
                            <div className="message-content loading-dots">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="chat-input-area">
                    <form onSubmit={handleSubmit} className="chat-input-form">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask Skaira a question or give a command..."
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading || !input.trim()}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                        </button>
                    </form>
                    <p className="footer-text">SkyGen is an AI assistant. Please verify important information.</p>
                </div>
            </div>
        </div>
    );
}