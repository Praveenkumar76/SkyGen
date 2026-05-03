import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import './Auth.css';

export default function CreateUsernamePage({ session }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const metaUsername = session?.user?.user_metadata?.username ||
                         session?.user?.user_metadata?.full_name?.replace(/\s+/g, '').toLowerCase();
    if (metaUsername) {
      console.log('[CreateUsername] Prefilling username from metadata:', metaUsername);
      setUsername(metaUsername);
    }
  }, [session]);

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    console.log('[CreateUsername] Creating profile for user:', session.user.id, '| username:', username.trim());

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters long.');
      setLoading(false);
      return;
    }

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: session.user.id, username: username.trim() });

      if (profileError) {
        console.error('[CreateUsername] Insert ERROR:', profileError.message, '| code:', profileError.code);
        const errorMessage = profileError.message || '';
        if (
          (errorMessage.includes('duplicate key value violates unique constraint') || errorMessage.includes('23505')) &&
          (errorMessage.includes('profiles_username_key') || errorMessage.includes('username'))
        ) {
          setError('This username is already taken. Please choose a different one.');
        } else {
          setError(errorMessage || 'Failed to create profile. Please try again.');
        }
        setLoading(false);
        return;
      }

      console.log('[CreateUsername] Profile created — navigating to /');
      setLoading(false);
      navigate('/');
    } catch (err) {
      console.error('[CreateUsername] Unexpected error:', err);
      setError(err.message || 'Failed to create profile. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form-box">
        <h1>One last step</h1>
        <p>Choose a username for your SkyGen account.</p>
        <form onSubmit={handleCreateProfile}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. skygen_user"
              required
              autoFocus
              autoComplete="username"
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button className="auth-button" type="submit" disabled={loading} style={{ marginTop: '16px' }}>
            {loading ? 'Creating...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}