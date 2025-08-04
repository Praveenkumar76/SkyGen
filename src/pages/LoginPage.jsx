import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import './LoginPage.css';

const LOGO_URL = "/X.jpg"; // Assumes X.jpg is in your `public` folder

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) setError(error.message);
  };

  const handleFacebookLogin = () => {
    alert("Facebook login is not yet configured.");
  };

  return (
    <div className="login-container">
      <div className="login-wrapper">
        {/* Left Panel */}
        <div className="login-left-panel">
          <div className="left-panel-content">
            <img src={LOGO_URL} alt="SkyGen Logo" className="logo-image" />
            <h1 className="brand-name">SkyGen</h1>
            <p className="brand-quote">
              Unlock the power of conversation. Your intelligent future starts here.
            </p>
          </div>
        </div>

        {/* Right Panel */}
        <div className="login-right-panel">
          <div className="login-form-container">
            <div className="login-header">
              <h2>Login to your account</h2>
              <p>
                Don't have an account? <Link to="/signup">Sign Up</Link>
              </p>
            </div>

            <div className="social-login-buttons">
              <button className="social-button google" onClick={handleGoogleLogin}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Sign in with Google
              </button>
            </div>

            <div className="divider">OR</div>

            <form className="login-form" onSubmit={handleEmailLogin}>
              <div className="form-group">
                <div className="label-wrapper">
                  <label htmlFor="email">Email / Username</label>
                </div>
                <input type="email" id="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>

              <div className="form-group">
                <div className="label-wrapper">
                  <label htmlFor="password">Password</label>
                  <Link to="/forgot-password" className="forgot-password">Forgot Password?</Link>
                </div>
                <input type="password" id="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>

              <div className="form-group remember-me">
                <input type="checkbox" id="remember" name="remember" />
                <label htmlFor="remember">Remember me</label>
              </div>
              
              <button type="submit" className="login-button" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </button>
              {error && <p className="error-message" style={{color: 'red', marginTop: '1rem'}}>{error}</p>}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
