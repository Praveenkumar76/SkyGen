import React from 'react';
import './AgentActivity.css'; // We'll create this CSS file next

// Icons for different stages
const ThoughtIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>;
const ToolIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>;
const OutputIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>;
const ErrorIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>;


const AgentActivity = ({ activity }) => {
    if (!activity) return null;

    const renderContent = () => {
        switch (activity.type) {
            case 'thought':
                return <><ThoughtIcon /> <p><strong>Thinking:</strong> {activity.content}</p></>;
            case 'tool_call':
                return <><ToolIcon /> <p><strong>Using Tool:</strong> <code>{activity.tool_name}</code></p></>;
            case 'tool_output':
                return <><OutputIcon /> <p><strong>Tool Result:</strong> {activity.content}</p></>;
            case 'error':
                 return <><ErrorIcon /> <p><strong>Error:</strong> {activity.content}</p></>;
            default:
                return null;
        }
    };

    return (
        <div className={`agent-activity-container ${activity.type}`}>
            {renderContent()}
        </div>
    );
};

export default AgentActivity;