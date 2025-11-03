import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import ConversationOptions from '../components/ConversationOptions';
import UserAvatar from '../components/UserAvatar';
import AgentActivity from '../components/AgentActivity';
import VideoLoader from '../components/VideoLoader';
import './ChatPage.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '/api';
console.log('BACKEND_URL:', BACKEND_URL);
const ACTIVE_CONVERSATION_KEY = 'lastActiveChat';

// Custom link component with icons and pills
const CustomLink = ({ href, children }) => {
    let domain = "Link";
    let icon = "🔗";
    
    try {
        const url = new URL(href);
        domain = url.hostname.replace('www.', ''); // e.g., "stanford.edu"
        
        // Map specific domains to icons
        if (domain.includes('stanford.edu')) icon = '🎓';
        else if (domain.includes('livescience.com')) icon = '🔬';
        else if (domain.includes('github.com')) icon = '💻';
        else if (domain.includes('youtube.com') || domain.includes('youtu.be')) icon = '📺';
        else if (domain.includes('wikipedia.org')) icon = '📚';
        else if (domain.includes('twitter.com') || domain.includes('x.com')) icon = '🐦';
        else if (domain.includes('linkedin.com')) icon = '💼';
        else if (domain.includes('reddit.com')) icon = '🤖';
        else if (domain.includes('stackoverflow.com')) icon = '❓';
        else if (domain.includes('arxiv.org')) icon = '📄';
        else if (domain.includes('medium.com')) icon = '📝';
        else if (domain.includes('news') || domain.includes('bbc') || domain.includes('cnn') || domain.includes('reuters')) icon = '📰';
        else if (domain.includes('docs') || domain.includes('documentation')) icon = '📖';
        else if (domain.includes('research') || domain.includes('edu')) icon = '🎓';
        else if (domain.includes('science') || domain.includes('nature.com') || domain.includes('science.org')) icon = '🔬';
    } catch (e) {
        // Invalid URL, keep default
    }
    
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="markdown-link">
            {children}
            <span className="link-pill">{icon} {domain}</span>
        </a>
    );
};

export default function ChatPage({ session, profile }) {
    const [conversations, setConversations] = useState([]);
    const [activeConversationId, setActiveConversationId] = useState(
        () => localStorage.getItem(ACTIVE_CONVERSATION_KEY) || null
    );
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [agentActivity, setAgentActivity] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isPlanDropdownOpen, setIsPlanDropdownOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const chatboxRef = useRef(null);
    const searchInputRef = useRef(null);
    const navigate = useNavigate();

    if (!session || !profile) {
        return <VideoLoader size="large" message="Loading user session..." />;
    }
    
    const { user } = session;
    
    // Extracted fetchMessages to be callable from multiple places - memoized for performance
    const fetchMessages = useCallback(async (conversationId) => {
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
    }, []);

    useEffect(() => {
        const fetchConversations = async () => {
            const { data, error } = await supabase.from('conversations').select('id, title, share_id').eq('user_id', user.id).order('created_at', { ascending: false });
            if (error) console.error('Error fetching conversations:', error);
            else {
                setConversations(data || []);
                // Restore active conversation from localStorage after conversations are loaded
                const savedConversationId = localStorage.getItem(ACTIVE_CONVERSATION_KEY);
                if (savedConversationId && data && data.some(conv => conv.id === savedConversationId)) {
                    setActiveConversationId(savedConversationId);
                }
            }
        };
        fetchConversations();

        const conversationChannel = supabase.channel('public:conversations').on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `user_id=eq.${user.id}` }, (payload) => {
            fetchConversations();
            if (payload.eventType === 'DELETE' && activeConversationId === payload.old.id) {
                setActiveConversationId(null);
                localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
            }
        }).subscribe();
        
        return () => supabase.removeChannel(conversationChannel);
    }, [user.id, activeConversationId]);

    useEffect(() => {
        fetchMessages(activeConversationId);
        // Save active conversation to localStorage whenever it changes
        if (activeConversationId) {
            localStorage.setItem(ACTIVE_CONVERSATION_KEY, activeConversationId);
        } else {
            localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
        }
    }, [activeConversationId, fetchMessages]);

    useEffect(() => {
        if (chatboxRef.current) chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
    }, [messages, agentActivity]);

    const handleNewChat = useCallback(() => {
        setActiveConversationId(null);
        localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
    }, []);

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
                const tempTitle = userInput.substring(0, 20) + (userInput.length > 20 ? '...' : '');
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
            
            let accumulatedResponse = "";
            let finalDbMessage = { role: 'assistant', content: '' };

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const eventLines = chunk.split('\n\n').filter(line => line.startsWith('data: '));

                for (const line of eventLines) {
                    const jsonData = JSON.parse(line.substring(6));
                    
                                            if (jsonData.done === true) break;
                    else if (jsonData.type === 'error') setAgentActivity({ type: 'error', content: jsonData.content });
                    else if (['thought', 'tool_call', 'tool_output'].includes(jsonData.type)) setAgentActivity(jsonData);
                    else if (jsonData.type === 'agent_action' && jsonData.action === 'sign_out') {
                        localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
                        await supabase.auth.signOut();
                        navigate('/login');
                    } else if (jsonData.type === 'token' || jsonData.type === 'final_answer') {
                        setAgentActivity(null); 
                        accumulatedResponse += jsonData.content;
                        // Display the streaming content in a temporary message
                        setMessages(current => {
                            const lastMsg = current[current.length - 1];
                            if (lastMsg && lastMsg.isStreaming) {
                                return current.map((msg, index) => index === current.length - 1 ? { ...msg, content: accumulatedResponse } : msg);
                            }
                            return [...current, { id: `asst_stream_${Date.now()}`, role: 'assistant', content: accumulatedResponse, isStreaming: true }];
                        });
                    }
                }
            }
            
            finalDbMessage.content = accumulatedResponse;
            if (finalDbMessage.content.trim()) {
                await supabase.from('chat_messages').insert({ user_id: user.id, conversation_id: currentConversationId, role: 'assistant', message: finalDbMessage.content });
                
                // Clean up streaming message and replace with final message
                setMessages(current => {
                    return current.map(msg => 
                        msg.isStreaming ? { ...msg, isStreaming: false, isTemp: false } : msg
                    );
                });
            }

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
             if (activeConversationId === conversationId) {
                setActiveConversationId(null);
                localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
            } 
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

    const handleDeleteMessage = useCallback(async (messageId) => {
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
    }, []);

    // Filter conversations based on search query
    const filteredConversations = useMemo(() => {
        if (!searchQuery.trim()) {
            return conversations;
        }
        const query = searchQuery.toLowerCase();
        return conversations.filter(conv => 
            conv.title.toLowerCase().includes(query)
        );
    }, [conversations, searchQuery]);

    // Memoize conversation list to prevent unnecessary re-renders
    const conversationList = useMemo(() => (
        filteredConversations.map(conv => ( 
            <div key={conv.id} className={`conversation-item ${activeConversationId === conv.id ? 'active' : ''}`} onClick={() => {
                setActiveConversationId(conv.id);
                setSearchQuery('');
                setIsSearchOpen(false);
            }}> 
                <span className="conversation-title">{conv.title}</span> 
                <ConversationOptions 
                    onDelete={() => handleDirectDelete(conv.id)} 
                    onRename={() => handleRename(conv.id, conv.title)} 
                    onShare={() => handleShare(conv.id)} 
                /> 
            </div> 
        ))
    ), [filteredConversations, activeConversationId]);

    // Handle search button click
    const handleSearchClick = () => {
        setIsSearchOpen(true);
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 100);
    };

    // Close search when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isSearchOpen && !event.target.closest('.search-input-inline')) {
                setIsSearchOpen(false);
                setSearchQuery('');
            }
        };
        if (isSearchOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isSearchOpen]);

    // Close plan dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isPlanDropdownOpen && !event.target.closest('.chat-title-wrapper')) {
                setIsPlanDropdownOpen(false);
            }
        };
        if (isPlanDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isPlanDropdownOpen]);
    
    const hasMessages = messages.length > 0;
    const showCenteredInput = !hasMessages && !isLoading;

    // Empire-themed quotes
    const empireQuotes = [
        "Join With SkyGen",
        "Ascend With SkyGen",
        "Command Your Destiny",
        "Forge Your Empire",
        "Reign Supreme",
        "Conquer The Unknown"
    ];
    const randomQuote = empireQuotes[Math.floor(Math.random() * empireQuotes.length)];

    return (
        <div className="chat-layout">
            {isSidebarOpen && (
            <div className="sidebar">
                <button className="close-sidebar-button" onClick={() => setIsSidebarOpen(false)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <div className="sidebar-top">
                <div className="sidebar-logo">
  <img src="/favicon-white.svg" alt="Logo" className="logo-image" />
</div>


                    <button onClick={handleNewChat} className="nav-button"> 
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 5V19M5 12H19"></path>
                        </svg>
                        New chat
                    </button>
                    {!isSearchOpen ? (
                        <button onClick={handleSearchClick} className="nav-button">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="M21 21l-4.35-4.35"></path>
                            </svg>
                            Search chats
                        </button>
                    ) : (
                        <div className="search-input-inline">
                            <div className="search-input-wrapper-inline">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <path d="M21 21l-4.35-4.35"></path>
                                </svg>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search chats..."
                                    className="search-input"
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={() => {
                                            setSearchQuery('');
                                            searchInputRef.current?.focus();
                                        }}
                                        className="clear-search-button"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
                                )}
                                <button 
                                    onClick={() => {
                                        setIsSearchOpen(false);
                                        setSearchQuery('');
                                    }}
                                    className="close-search-button"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            {searchQuery && (
                                <div className="search-results-inline">
                                    {filteredConversations.length > 0 ? (
                                        filteredConversations.map(conv => (
                                            <div 
                                                key={conv.id} 
                                                className="search-result-item"
                                                onClick={() => {
                                                    setActiveConversationId(conv.id);
                                                    setSearchQuery('');
                                                    setIsSearchOpen(false);
                                                }}
                                            >
                                                <span className="search-result-title">{conv.title}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="search-no-results">
                                            <span>No conversations found</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    <button className="nav-button locked">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                        </svg>
                        Library
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lock-icon">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    </button>
                    <button className="nav-button locked">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        Projects
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lock-icon">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    </button>
                </div>

                {/* {isSearchOpen && (
                    <div className="search-container">
                        <div className="search-input-wrapper">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="M21 21l-4.35-4.35"></path>
                            </svg>
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search chats..."
                                className="search-input"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => {
                                        setSearchQuery('');
                                        searchInputRef.current?.focus();
                                    }}
                                    className="clear-search-button"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            )}
                        </div>
                        {searchQuery && (
                            <div className="search-results">
                                {filteredConversations.length > 0 ? (
                                    filteredConversations.map(conv => (
                                        <div 
                                            key={conv.id} 
                                            className="search-result-item"
                                            onClick={() => {
                                                setActiveConversationId(conv.id);
                                                setSearchQuery('');
                                                setIsSearchOpen(false);
                                            }}
                                        >
                                            <span className="search-result-title">{conv.title}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="search-no-results">
                                        <span>No conversations found</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )} */}

                <div className="sidebar-section">
                    <div className="section-header">Agent Tools</div>
                    <button className="nav-button locked">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                        </svg>
                        Explore
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lock-icon">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    </button>
                    <button className="nav-button locked">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="9" cy="9" r="2"></circle>
                            <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
                        </svg>
                        image generator
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lock-icon">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    </button>
                </div>

                <div className="sidebar-section">
                    <div className="section-header">Chats</div>
                    <div className="conversation-list"> 
                        {conversationList} 
                    </div>
                </div>

                <div className="sidebar-footer"> 
                    <div className="user-profile-link" onClick={() => navigate('/profile')}> 
                        <UserAvatar username={profile.username} /> 
                        <div className="user-info">
                            <span className="user-name">{profile.username}</span>
                            <span className="user-plan">Free</span>
                        </div>
                    </div> 
                </div>
            </div>
            )}
            
            {!isSidebarOpen && (
                <button className="open-sidebar-button" onClick={() => setIsSidebarOpen(true)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
            )}

            <div className={`chat-window ${!isSidebarOpen ? 'full-width' : ''}`}>
                <div className="chat-header">
                    <div className="chat-title-wrapper">
                        <div 
                            className="chat-title" 
                            onClick={() => setIsPlanDropdownOpen(!isPlanDropdownOpen)}
                        >
                            <span>SkyGen</span>
                            <svg 
                                width="16" 
                                height="16" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                className={isPlanDropdownOpen ? 'rotated' : ''}
                            >
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>
                        {isPlanDropdownOpen && (
                            <div className="plan-dropdown">
                                <div className="plan-option" onClick={() => setIsPlanDropdownOpen(false)}>
                                    <span>Free</span>
                                </div>
                                <div className="plan-option vip" onClick={() => setIsPlanDropdownOpen(false)}>
                                    <span>VIP</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="chat-messages" ref={chatboxRef}>
                    {messages.length === 0 && !isLoading && (
                        <div className="empty-chat-placeholder">
                            <h1>{randomQuote}</h1>
                        </div>
                    )}
                    {messages.map((msg) => (
                         <div key={msg.id} className={`chat-message-wrapper ${msg.role}`}>
                            {msg.role === 'assistant' && <UserAvatar username="Skaira" />}
                            <div className="message-content">
                                {msg.role === 'assistant' ? (
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            a: CustomLink
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                ) : (
                                    msg.content
                                )}
                            </div>
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
                
                <div className={`chat-input-area ${showCenteredInput ? 'centered' : ''}`}>
                    <form onSubmit={handleSubmit} className="chat-input-form"> 
                        <button type="button" className="attach-button">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5V19M5 12H19"></path>
                            </svg>
                        </button>
                        <input 
                            type="text" 
                            value={input} 
                            onChange={(e) => setInput(e.target.value)} 
                            placeholder="Ask how to use Excel" 
                            disabled={isLoading} 
                        /> 
                        <div className="input-actions">
                            <button type="button" className="voice-button">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                    <line x1="12" y1="19" x2="12" y2="23"></line>
                                    <line x1="8" y1="23" x2="16" y2="23"></line>
                                </svg>
                            </button>
                            <button type="button" className="sound-button">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                </svg>
                            </button>
                        </div>
                    </form> 
                </div>
            </div>
        </div>
    );
}