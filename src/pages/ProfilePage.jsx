import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import UserAvatar from '../components/UserAvatar';
import VideoLoader from '../components/VideoLoader';
import './ProfilePage.css';

// A small component to render social media icons with animation
const SocialIcon = ({ type, href }) => {
  const icons = {
    github: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>,
    linkedin: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.25 6.5 1.75 1.75 0 016.5 8.25zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93-.78 0-1.38.56-1.38 1.93V19h-3v-9h3v1.38h.04c.42-.79 1.44-1.38 2.96-1.38 3.03 0 3.46 2.46 3.46 5.66V19z"></path></svg>,
    x: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>,
    facebook: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"></path></svg>,
  };
  return href ? (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className="social-icon"
    >
      {icons[type]}
    </a>
  ) : null;
};

// Activity chart component (placeholder visualization)
const ActivityChart = ({ data }) => {
  // Placeholder data if none provided
  const activityData = data || [4, 6, 2, 8, 5, 10, 7, 3, 9, 5, 8, 4, 7, 6];
  
  return (
    <div className="activity-chart">
      <h4>Recent Agent Activity</h4>
      <div className="chart-bars">
        {activityData.map((value, index) => (
          <div 
            key={index} 
            className="chart-bar"
            style={{ height: `${value * 8}px` }}
          />
        ))}
      </div>
      <div className="chart-labels">
        <span>Last 14 Days</span>
        <span>Today</span>
      </div>
    </div>
  );
};

// Badge component
const Badge = ({ type, label, achieved = true }) => {
  const icons = {
    conversation: "🗣️",
    agent: "🤖",
    power: "⚡",
    expertise: "🧠",
    streak: "🔥",
  };

  return (
    <div className={`profile-badge ${achieved ? 'achieved' : 'locked'}`}>
      <div className="badge-icon">{icons[type] || "🏆"}</div>
      <div className="badge-label">{label}</div>
    </div>
  );
};

// Tab component
const Tab = ({ id, label, icon, active, onClick }) => (
  <div 
    className={`profile-tab ${active ? 'active' : ''}`}
    onClick={() => onClick(id)}
  >
    <span className="tab-icon">{icon}</span>
    <span className="tab-label">{label}</span>
    {active && <div className="tab-indicator" />}
  </div>
);

export default function ProfilePage({ session }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activeTab, setActiveTab] = useState('info');
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [agentData, setAgentData] = useState(null);
  const profileCardRef = useRef(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      
      try {
        // Fetch profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        if (profileError) throw profileError;
        
        setProfile(profileData);
        setFormData(profileData);
        
        // Fetch agent activity data (if you have it)
        // This is placeholder logic - adjust based on your data structure
        const { data: activityData, error: activityError } = await supabase
          .from('agent_activity')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(14);
          
        if (!activityError && activityData) {
          setAgentData(activityData);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching profile:', error);
        setError('Failed to load profile data. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [session.user.id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setIsFormDirty(true);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess('');
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...formData, updated_at: new Date() })
        .eq('id', session.user.id)
        .select()
        .single();
        
      if (error) throw error;
      
      setProfile(data);
      setIsFormDirty(false);
      setSuccess('Profile updated successfully!');
      
      // Show success animation
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");
    if (newPassword.length < 6) return setError("Password must be at least 6 characters long.");
    
    setError(null);
    setSuccess('');
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      setSuccess("Password updated successfully!");
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    localStorage.removeItem('lastActiveChat');
    await supabase.auth.signOut();
    navigate('/login');
  };
  
  // Section rendering based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'address':
        return (
          <div key="address" className="tab-content">
            <form onSubmit={handleUpdateProfile}>
              <h3>Your Address</h3>
              <div className="special-section">
                <div className="section-icon">📍</div>
                <div className="form-group address-field">
                  <textarea 
                    name="address" 
                    value={formData.address || ''} 
                    onChange={handleChange} 
                    rows="4"
                    placeholder="Enter your full address..."
                    className="animate-input violet-field"
                  ></textarea>
                </div>
              </div>
              <div className="form-actions">
                <button 
                  type="submit" 
                  className="save-button" 
                  disabled={loading || !isFormDirty}
                >
                  Save Address
                </button>
              </div>
            </form>
          </div>
        );
      
      case 'about':
        return (
          <div key="about" className="tab-content">
            <form onSubmit={handleUpdateProfile}>
              <h3>About Me</h3>
              <div className="special-section">
                <div className="section-icon">👤</div>
                <div className="form-group about-field">
                  <textarea 
                    name="about" 
                    value={formData.about || ''} 
                    onChange={handleChange} 
                    rows="8" 
                    placeholder="Tell us a little about yourself..."
                    className="animate-input violet-field"
                  ></textarea>
                </div>
              </div>
              <div className="form-actions">
                <button 
                  type="submit" 
                  className="save-button" 
                  disabled={loading || !isFormDirty}
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        );
        
      case 'info':
        return (
          <div key="info" className="tab-content">
            <form onSubmit={handleUpdateProfile}>
              <h3>Information</h3>
              <div className="info-grid">
                <div className="info-item"><label>Email</label><p>{session.user.email}</p></div>
                <div className="info-item"><label>Username</label><p>{profile.username}</p></div>
                <div className="info-item">
                  <label>Full Name</label>
                  <input 
                    name="full_name" 
                    value={formData.full_name || ''} 
                    onChange={handleChange} 
                    className="animate-input"
                  />
                </div>
                <div className="info-item">
                  <label>Phone</label>
                  <input 
                    name="phone_number" 
                    value={formData.phone_number || ''} 
                    onChange={handleChange} 
                    className="animate-input"
                  />
                </div>
                <div className="info-item">
                  <label>Age</label>
                  <input 
                    name="age" 
                    type="number" 
                    value={formData.age || ''} 
                    onChange={handleChange} 
                    className="animate-input"
                  />
                </div>
                                <div className="info-item">
                  <label>Gender</label>
                  <input 
                    name="gender" 
                    value={formData.gender || ''} 
                    onChange={handleChange} 
                    className="animate-input"
                  />
                </div>
              </div>


              <div className="form-actions">
                <button 
                  type="submit" 
                  className="save-button" 
                  disabled={loading || !isFormDirty}
                >
                  Save Information
                </button>
              </div>
            </form>
          </div>
        );
        
      case 'socials':
        return (
          <div key="socials" className="tab-content">
            <form onSubmit={handleUpdateProfile}>
              <h3>Social & Professional Links</h3>
              <div className="info-grid">
                <div className="form-group">
                  <label>GitHub</label>
                  <div className="input-with-icon">
                    <span className="input-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>
                    </span>
                    <input 
                      name="github_link" 
                      value={formData.github_link || ''} 
                      onChange={handleChange} 
                      placeholder="https://github.com/..." 
                      className="animate-input"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>LinkedIn</label>
                  <div className="input-with-icon">
                    <span className="input-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.25 6.5 1.75 1.75 0 016.5 8.25zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93-.78 0-1.38.56-1.38 1.93V19h-3v-9h3v1.38h.04c.42-.79 1.44-1.38 2.96-1.38 3.03 0 3.46 2.46 3.46 5.66V19z"></path></svg>
                    </span>
                    <input 
                      name="linkedin_link" 
                      value={formData.linkedin_link || ''} 
                      onChange={handleChange} 
                      placeholder="https://linkedin.com/in/..." 
                      className="animate-input"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>X (Twitter)</label>
                  <div className="input-with-icon">
                    <span className="input-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>
                    </span>
                    <input 
                      name="x_link" 
                      value={formData.x_link || ''} 
                      onChange={handleChange} 
                      placeholder="https://x.com/..." 
                      className="animate-input"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Facebook</label>
                  <div className="input-with-icon">
                    <span className="input-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"></path></svg>
                    </span>
                    <input 
                      name="facebook_link" 
                      value={formData.facebook_link || ''} 
                      onChange={handleChange} 
                      placeholder="https://facebook.com/..." 
                      className="animate-input"
                    />
                  </div>
                </div>
              </div>
              <div className="form-actions">
                <button 
                  type="submit" 
                  className="save-button" 
                  disabled={loading || !isFormDirty}
                >
                  Save Social Links
                </button>
              </div>
            </form>
          </div>
        );
        
      case 'security':
        return (
          <div key="security" className="tab-content">
            <form className="profile-form" onSubmit={handleChangePassword}>
              <h3>Change Password</h3>
              <div className="info-grid">
                <div className="form-group">
                  <label>New Password</label>
                  <input 
                    type="password" 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    required 
                    className="animate-input"
                  />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input 
                    type="password" 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    required 
                    className="animate-input"
                  />
                </div>
              </div>
              <div className="form-actions">
                <button 
                  type="submit" 
                  className="save-button" 
                  disabled={loading}
                >
                  Save New Password
                </button>
              </div>
            </form>
            
            <div className="security-section">
              <h3>Account Management</h3>
              <div className="security-action-card">
                <div className="security-action-icon">🔐</div>
                <div className="security-action-content">
                  <h4>Two-Factor Authentication</h4>
                  <p>Add an extra layer of security to your account</p>
                </div>
              </div>
              <div className="form-actions">
                <button 
                  type="button" 
                  className="save-button"
                >
                  Setup 2FA
                </button>
              </div>
            </div>
          </div>
        );
        
      case 'agent':
        return (
          <div key="agent" className="tab-content agent-section">
            <div className="agent-stats">
              <div className="agent-stat-card">
                <div className="stat-value">42</div>
                <div className="stat-label">Conversations</div>
              </div>
              <div className="agent-stat-card">
                <div className="stat-value">187</div>
                <div className="stat-label">Messages</div>
              </div>
              <div className="agent-stat-card">
                <div className="stat-value">14</div>
                <div className="stat-label">Days Active</div>
              </div>
            </div>
            
            <ActivityChart data={[4, 7, 5, 9, 6, 11, 8, 12, 10, 8, 14, 9, 11, 15]} />
            
            <div className="agent-preferences">
              <h3>Agent Preferences</h3>
              <div className="preference-item">
                <label>Agent Response Style</label>
                <select 
                  name="agent_style" 
                  onChange={handleChange} 
                  value={formData.agent_style || 'balanced'}
                  className="animate-input"
                >
                  <option value="concise">Concise</option>
                  <option value="balanced">Balanced</option>
                  <option value="detailed">Detailed</option>
                </select>
              </div>
              
              <div className="preference-item">
                <label>Allow AI to learn from your conversations</label>
                <div className="toggle-switch">
                  <input 
                    type="checkbox" 
                    id="aiLearning" 
                    checked={formData.ai_learning || false} 
                    onChange={(e) => handleChange({ 
                      target: { 
                        name: 'ai_learning', 
                        value: e.target.checked 
                      } 
                    })}
                  />
                  <label htmlFor="aiLearning"></label>
                </div>
              </div>
            </div>
            
            <div className="badges-section">
              <h3>Agent Badges</h3>
              <div className="badges-grid">
                <Badge type="conversation" label="Conversation Master" achieved={true} />
                <Badge type="agent" label="AI Enthusiast" achieved={true} />
                <Badge type="streak" label="7-Day Streak" achieved={true} />
                <Badge type="power" label="Power User" achieved={false} />
                <Badge type="expertise" label="Domain Expert" achieved={false} />
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  if (loading || !profile) {
    return <VideoLoader size="large" message="Loading profile..." />;
  }

  return (
    <div className="profile-container">
      <div className="profile-card" ref={profileCardRef}>
        {/* Left Sidebar */}
        <div className="profile-sidebar">
          <div className="profile-avatar-wrapper">
            <UserAvatar username={profile.username} />
            <div className="avatar-outline"></div>
          </div>
          
          <h2>{profile.full_name || profile.username}</h2>
          <p>{profile.role || 'Explorer'}</p>
          
          <div className="social-links">
            <SocialIcon type="github" href={profile.github_link} />
            <SocialIcon type="linkedin" href={profile.linkedin_link} />
            <SocialIcon type="x" href={profile.x_link} />
            <SocialIcon type="facebook" href={profile.facebook_link} />
          </div>
          
          <div className="profile-tabs">
            <Tab 
              id="info" 
              label="Information" 
              icon="ℹ️" 
              active={activeTab === 'info'} 
              onClick={setActiveTab} 
            />
            <Tab 
              id="address" 
              label="Address" 
              icon="📍" 
              active={activeTab === 'address'} 
              onClick={setActiveTab} 
            />
            <Tab 
              id="about" 
              label="About Me" 
              icon="👤" 
              active={activeTab === 'about'} 
              onClick={setActiveTab} 
            />
            <Tab 
              id="socials" 
              label="Social Links" 
              icon="🔗" 
              active={activeTab === 'socials'} 
              onClick={setActiveTab} 
            />
            <Tab 
              id="agent" 
              label="Agent Activity" 
              icon="🤖" 
              active={activeTab === 'agent'} 
              onClick={setActiveTab} 
            />
            <Tab 
              id="security" 
              label="Security" 
              icon="🔒" 
              active={activeTab === 'security'} 
              onClick={setActiveTab} 
            />
          </div>
          
          <button className="signout-button" onClick={handleSignOut}>
            Sign Out
          </button>
          
          <button className="back-button" onClick={() => navigate('/')}>
            Back to Chat
          </button>
        </div>

        {/* Right Content */}
        <div className="profile-content">
          {renderTabContent()}
          
          {error && (
            <div className="message-container error">
              <p className="error-message">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="message-container success">
              <p className="success-message">{success}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}