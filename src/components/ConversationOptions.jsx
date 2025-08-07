import React, { useState, useEffect, useRef } from 'react';
import './ConversationOptions.css';

const ConversationOptions = ({ onRename, onDelete, onShare }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    // Function to close menu if escape key is pressed
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    // Function to close menu on clicks outside
    const handleClickOutside = (event) => {
      // The toggle button is outside the menu, so we check for that too
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        !event.target.closest('.options-button')
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    // Cleanup function
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]); // Re-run effect when isOpen changes

  return (
    <div className="options-container" ref={menuRef}>
      <button
        className="options-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Conversation options" /* <-- ACCESSIBILITY: Label for screen readers */
        aria-haspopup="true" /* <-- ACCESSIBILITY: Indicates it opens a menu */
        aria-expanded={isOpen} /* <-- ACCESSIBILITY: Tells screen readers if menu is open */
      >
        ⋮
      </button>

      {isOpen && (
        <div className="options-dropdown" role="menu">
          {/* ROBUSTNESS: Only render buttons if the function prop exists */}
          {onRename && (
            <button role="menuitem" onClick={() => { onRename(); setIsOpen(false); }}>Rename</button>
          )}

          {onShare && (
            <button role="menuitem" onClick={() => { onShare(); setIsOpen(false); }}>Share</button>
          )}
          
          {onDelete && (
            <button role="menuitem" onClick={() => { onDelete(); setIsOpen(false); }} className="delete">Delete</button>
          )}
        </div>
      )}
    </div>
  );
};

export default ConversationOptions;