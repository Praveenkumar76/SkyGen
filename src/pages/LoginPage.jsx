import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import './Auth.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) setError(error.message);
  };

  return (
    <div className="auth-container">
      <div className="auth-form-box">
        <h1>Welcome Back!</h1>
        <p>Sign in to continue to SkyGen.</p>
        <form onSubmit={handleEmailLogin}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Logging In...' : 'Log In'}
          </button>
          {error && <p className="error-message">{error}</p>}
        </form>
        <div className="divider"><span>OR</span></div>
        <button onClick={handleGoogleLogin} className="google-button">
          Sign In with Google
        </button>
        <p className="redirect-link">
          Don't have an account? <Link to="/signup">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}