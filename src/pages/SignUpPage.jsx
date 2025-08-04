import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import './Auth.css';

export default function SignUpPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        username: username,
        age: parseInt(age, 10),
        gender: gender,
      });

      if (profileError) {
        setError(profileError.message);
      } else {
        alert('Sign-up successful! Please check your email to verify your account.');
        navigate('/login');
      }
    }
    setLoading(false);
  };
  
  // --- NEW: Add the Google sign-in handler ---
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) setError(error.message);
  };

  return (
    <div className="auth-container">
      <div className="auth-form-box">
        <h1>Create an Account</h1>
        <p>Join the SkyGen community today!</p>
        <form onSubmit={handleEmailSignUp}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="age">Age</label>
            <input id="age" type="number" value={age} onChange={(e) => setAge(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="gender">Gender</label>
            <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)} required>
              <option value="" disabled>Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Signing Up...' : 'Sign Up with Email'}
          </button>
          {error && <p className="error-message">{error}</p>}
        </form>

        {/* --- NEW: Add the divider and Google button --- */}
        <div className="divider"><span>OR</span></div>
        <button onClick={handleGoogleLogin} className="google-button">
          Sign Up with Google
        </button>

        <p className="redirect-link">
          Already have an account? <Link to="/login">Log In</Link>
        </p>
      </div>
    </div>
  );
}