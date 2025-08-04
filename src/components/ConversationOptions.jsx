import React, { useState, useEffect, useRef } from 'react';
import './ConversationOptions.css';

const ConversationOptions = ({ onRename, onDelete, onShare }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="options-container" ref={menuRef}>
      <button className="options-button" onClick={() => setIsOpen(!isOpen)}>
        ⋮
      </button>
      {isOpen && (
        <div className="options-dropdown">
          <button onClick={() => { onRename(); setIsOpen(false); }}>Rename</button>
          <button onClick={() => { onShare(); setIsOpen(false); }}>Share</button>
          <button onClick={() => { onDelete(); setIsOpen(false); }} className="delete">Delete</button>
        </div>
      )}
    </div>
  );
};
export default ConversationOptions;