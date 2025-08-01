import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// The backend URL will now be loaded from an environment variable
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your AI assistant. How can I help you today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatboxRef = useRef(null);

  useEffect(() => {
    if (chatboxRef.current) {
      chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const assistantMessage = { role: 'assistant', content: '' };
      setMessages([...newMessages, assistantMessage]);

      // The URL is now clean and easy to manage
      const apiURL = `${BACKEND_URL}/generate-stream`;
      
      const response = await fetch(apiURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const eventLines = chunk.split('\n\n').filter(line => line.length > 0);

        for (const line of eventLines) {
          if (line.startsWith('data: ')) {
            try {
              const data = line.slice(6);
              const parsed = JSON.parse(data);
              
              // App.jsx

              if (parsed.token) {
                setMessages(currentMessages => {
                  // Get the last message from the array
                  const lastMessage = currentMessages[currentMessages.length - 1];
                  
                  // Create a brand new message object with the updated content
                  const updatedLastMessage = {
                    ...lastMessage,
                    content: lastMessage.content + parsed.token,
                  };

                  // Return a new array with the updated message
                  return [
                    ...currentMessages.slice(0, -1), // All messages except the last
                    updatedLastMessage,              // The new, updated last message
                  ];
                });
              }
            } catch (e) {
              console.error('Error parsing SSE message:', e, line);
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
      setMessages(currentMessages => {
        const lastIndex = currentMessages.length - 1;
        return [
          ...currentMessages.slice(0, lastIndex),
          { role: 'assistant', content: `Error: ${error.message}. Check if the backend is running and the URL is correct.` }
        ];
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>SkyGen</h1>
        <p>Powered by SkyVerse</p>
      </div>
      <div className="chat-box" ref={chatboxRef}>
        {messages.map((msg, index) => (
          <div key={index} className={`chat-message ${msg.role}`}>
            <div className="message-content">
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="chat-message assistant">
            <div className="message-content loading-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          id="chat-input"
          name="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
    </div>
  );
}

export default App;