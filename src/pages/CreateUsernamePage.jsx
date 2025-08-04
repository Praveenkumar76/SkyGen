import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import './Auth.css';

export default function CreateUsernamePage({ session }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: session.user.id, username: username });

    if (profileError) {
      setError(profileError.message);
    }
    setLoading(false);
    // App.jsx will automatically detect the profile and switch views.
  };

  return (
    <div className="auth-container">
      <div className="auth-form-box">
        <h1>Almost there!</h1>
        <p>Please choose a unique username to continue.</p>
        <form onSubmit={handleCreateProfile}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Saving...' : 'Create Profile'}
          </button>
          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
    </div>
  );
}