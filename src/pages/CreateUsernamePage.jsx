import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import './Auth.css';

export default function CreateUsernamePage({ session }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Prefill from user metadata if present
  useEffect(() => {
    const metaUsername = session?.user?.user_metadata?.username;
    if (metaUsername) setUsername(metaUsername);
  }, [session]);

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: session.user.id, username: username.trim() });

      if (profileError) {
        const errorMessage = profileError.message || '';
        
        // Check for duplicate username error
        if (
          (errorMessage.includes('duplicate key value violates unique constraint') || errorMessage.includes('23505')) &&
          (errorMessage.includes('profiles_username_key') || errorMessage.includes('username'))
        ) {
          setError('This username is already taken. Please choose a different one.');
        } else {
          setError(errorMessage || 'Failed to create profile. Please try again.');
        }
        setLoading(false);
        return; // Don't navigate on error
      }
      
      // Only navigate on success
      setLoading(false);
      navigate('/');
    } catch (err) {
      console.error('Profile creation error:', err);
      setError(err.message || 'Failed to create profile. Please try again.');
      setLoading(false);
    }
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