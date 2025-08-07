import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import ConversationOptions from '../components/ConversationOptions';
import UserAvatar from '../components/UserAvatar';
import AgentActivity from '../components/AgentActivity';
import './ChatPage.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function ChatPage({ session, profile }) {
    const [conversations, setConversations] = useState([]);
    const [activeConversationId, setActiveConversationId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [agentActivity, setAgentActivity] = useState(null);
    const chatboxRef = useRef(null);
    const navigate = useNavigate();

    if (!session || !profile) {
        return <div className="loading-screen">Loading user session...</div>;
    }
    
    const { user } = session;
    
    // Extracted fetchMessages to be callable from multiple places
    const fetchMessages = async (conversationId) => {
        if (!conversationId) {
            setMessages([]);
            return;
        }
        const { data, error } = await supabase.from('chat_messages').select('id, role, message').eq('conversation_id', conversationId).order('created_at', { ascending: true });
        if (error) {
            console.error('Error fetching messages:', error);
        } else {
            // FIX 1: Ensure the message 'id' from the database is saved into the state.
            setMessages(data.map(m => ({ id: m.id, role: m.role, content: m.message })) || []);
        }
    };

    useEffect(() => {
        const fetchConversations = async () => {
            const { data, error } = await supabase.from('conversations').select('id, title, share_id').eq('user_id', user.id).order('created_at', { ascending: false });
            if (error) console.error('Error fetching conversations:', error);
            else setConversations(data || []);
        };
        fetchConversations();

        const conversationChannel = supabase.channel('public:conversations').on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `user_id=eq.${user.id}` }, (payload) => {
            fetchConversations();
            if (payload.eventType === 'DELETE' && activeConversationId === payload.old.id) {
                setActiveConversationId(null);
            }
        }).subscribe();
        
        return () => supabase.removeChannel(conversationChannel);
    }, [user.id, activeConversationId]);

    useEffect(() => {
        fetchMessages(activeConversationId);
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
        
        // FIX 2: Add a temporary unique ID to the new user message for the React key.
        const tempUserMessage = { id: `user_${Date.now()}`, role: 'user', content: userInput, isTemp: true };
        setMessages(prev => [...prev, tempUserMessage]);
        
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
                setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id)); // Remove optimistic user message on error
                setIsLoading(false);
                setAgentActivity(null);
                return;
            }
        }

        await supabase.from('chat_messages').insert({ user_id: user.id, conversation_id: currentConversationId, role: 'user', message: userInput });
        
        // Exclude temporary messages when sending to API
        const messagesForApi = messages.filter(m => !m.isTemp).concat([{ role: 'user', content: userInput }]).map(({ role, content }) => ({ role, content }));

        try {
            const response = await fetch(`${BACKEND_URL}/agent-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: messagesForApi, user_id: user.id, conversation_id: currentConversationId })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            // Re-fetch messages to replace temporary ones with real ones from DB
            await fetchMessages(currentConversationId);
            
            let assistantResponse = { id: `asst_${Date.now()}`, role: 'assistant', content: '' };
            setMessages(prev => [...prev, assistantResponse]);

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const eventLines = chunk.split('\n\n').filter(line => line.startsWith('data: '));

                for (const line of eventLines) {
                    const jsonData = JSON.parse(line.substring(6));
                    
                    if (jsonData.done) break;
                    else if (jsonData.type === 'error') setAgentActivity({ type: 'error', content: jsonData.content });
                    else if (['thought', 'tool_call', 'tool_output'].includes(jsonData.type)) setAgentActivity(jsonData);
                    else if (jsonData.type === 'agent_action' && jsonData.action === 'sign_out') {
                        await supabase.auth.signOut();
                        navigate('/login');
                    } else if (jsonData.type === 'token' || jsonData.type === 'final_answer') {
                        setAgentActivity(null); 
                        assistantResponse.content += jsonData.content;
                        setMessages(current => current.map(msg => msg.id === assistantResponse.id ? { ...msg, content: assistantResponse.content } : msg));
                    }
                }
            }
            
            // Remove the temporary streaming message
            setMessages(current => current.filter(msg => msg.id !== assistantResponse.id));
            if (assistantResponse.content.trim()) {
                 await supabase.from('chat_messages').insert({ user_id: user.id, conversation_id: currentConversationId, role: 'assistant', message: assistantResponse.content });
            }
            
            // Final fetch to get the very last message with its proper DB ID
            await fetchMessages(currentConversationId);

        } catch (error) {
            console.error('Streaming error:', error);
            setMessages(current => [...current, { id: `err_${Date.now()}`, role: 'assistant', content: `Sorry, something went wrong: ${error.message}` }]);
        } finally {
            setIsLoading(false);
            setAgentActivity(null);
        }
    };
    
    const handleDirectDelete = async (conversationId) => {
       // This function is unchanged
       const isConfirmed = window.confirm("Are you sure you want to delete this conversation? This is a permanent action."); 
         if (!isConfirmed) return; 

         try { 
             const { error } = await supabase.from('conversations').delete().eq('id', conversationId); 
             if (error) throw error; 
             if (activeConversationId === conversationId) setActiveConversationId(null); 
         } catch (error) { 
             console.error('Error deleting conversation:', error); 
             alert('Failed to delete the conversation. Please try again.'); 
         } 
    };

    const handleRename = async (conversationId, currentTitle) => {
        // This function is unchanged
        const newTitle = prompt("Enter a new name for the conversation:", currentTitle); 
         if (newTitle && newTitle.trim() !== '' && newTitle !== currentTitle) { 
             try { 
                 const { error } = await supabase 
                     .from('conversations') 
                     .update({ title: newTitle.trim() }) 
                     .eq('id', conversationId); 
                 if (error) throw error; 
             } catch (error) { 
                 console.error('Error renaming conversation:', error); 
                 alert('Failed to rename the conversation.'); 
             } 
         } 
    };

    const handleShare = async (conversationId) => {
        // This function is unchanged
         try { 
             const conversation = conversations.find(c => c.id === conversationId); 
             let shareId = conversation?.share_id; 

             if (!shareId) { 
                 const newShareId = crypto.randomUUID(); 
                 const { error } = await supabase 
                     .from('conversations') 
                     .update({ share_id: newShareId, is_shared: true }) 
       _            .eq('id', conversationId); 
                  
                 if (error) throw error; 
                 shareId = newShareId; 
             } 

             const shareUrl = `${window.location.origin}/share/${shareId}`; 
             await navigator.clipboard.writeText(shareUrl); 
             alert('Share link copied to clipboard!'); 

         } catch (error) { 
             console.error('Error sharing conversation:', error); 
             alert('Could not create or copy share link.'); 
         } 
    };

    const handleDeleteMessage = async (messageId) => {
        const isConfirmed = window.confirm("Are you sure you want to permanently delete this message?");
        if (!isConfirmed) return;

        try {
            const { error } = await supabase
                .from('chat_messages')
                .delete()
                .eq('id', messageId);
            
            if (error) throw error;

            // Update the UI by removing the message from state
            setMessages(currentMessages => currentMessages.filter(msg => msg.id !== messageId));
        } catch (error) {
            console.error('Error deleting message:', error);
            alert('Could not delete the message.');
        }
    };
    
    return (
        <div className="chat-layout">
            <div className="sidebar">
                 {/* ... Sidebar JSX is unchanged ... */}
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
                             <ConversationOptions 
                                 onDelete={() => handleDirectDelete(conv.id)} 
                                 onRename={() => handleRename(conv.id, conv.title)} 
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
                 </div>
            </div>

            <div className="chat-window">
                <div className="chat-messages" ref={chatboxRef}>
                    {messages.length === 0 && !isLoading && (
                        <div className="empty-chat-placeholder">
                            <img src="/X-removebg-preview.png" alt="SkyGen Logo" className="placeholder-logo" />
                            <h1>How can I help you today?</h1>
                        </div>
                    )}
                    {messages.map((msg) => (
                         // The key is now always unique
                         <div key={msg.id} className={`chat-message-wrapper ${msg.role}`}>
                            {msg.role === 'assistant' && <UserAvatar username="Skaira" />}
                            <div className="message-content">{msg.content}</div>
                             {/* Only show delete button for messages that are not temporary */}
                            {!msg.isTemp && (
                                <button className="delete-message-button" onClick={() => handleDeleteMessage(msg.id)}>
                                    🗑️
                                </button>
                            )}
                         </div>
                    ))}
                    
                    {isLoading && agentActivity && <AgentActivity activity={agentActivity} />}

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
                    {/* ... Input area JSX is unchanged ... */}
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