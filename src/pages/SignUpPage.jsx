import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import './SignUpPage.css'; // Using a new, dedicated CSS file

const LOGO_URL = "/X.jpg"; // Assumes X.jpg is in your `public` folder

const SignUpPage = () => {
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

  // The trigger will handle profile creation. We just need to pass the
  // username, age, and gender in the options.data field.
  const { error } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        username: username,
        age: parseInt(age, 10),
        gender: gender,
      }
    }
  });

  if (error) {
    setError(error.message);
  } else {
    alert('Sign-up successful! Please check your email to verify your account.');
    navigate('/login');
  }
  
  setLoading(false);
};

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) setError(error.message);
  };

  return (
    <div className="signup-container">
      <div className="signup-wrapper">
        {/* Left Panel */}
        <div className="signup-left-panel">
          <div className="left-panel-content">
            <img src={LOGO_URL} alt="SkyGen Logo" className="logo-image" />
            <h1 className="brand-name">SkyGen</h1>
            <p className="brand-quote">
              Unlock the power of conversation. Your intelligent future starts here.
            </p>
          </div>
        </div>

        {/* Right Panel */}
        <div className="signup-right-panel">
          <div className="signup-form-container">
            <div className="signup-header">
              <h2>Create an Account</h2>
              <p>Join the SkyGen today!</p>
            </div>

            <form className="signup-form" onSubmit={handleEmailSignUp}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="username">Username</label>
                  <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group small">
                  <label htmlFor="age">Age</label>
                  <input id="age" type="number" value={age} onChange={(e) => setAge(e.target.value)} required />
                </div>
                <div className="form-group small">
                  <label htmlFor="gender">Gender</label>
                  <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)} required>
                    <option value="" disabled>Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group button-group">
                   <button type="submit" className="signup-button" disabled={loading}>
                    {loading ? '...' : 'Sign Up with Email'}
                  </button>
                </div>
              </div>
               {error && <p className="error-message">{error}</p>}
            </form>

            <div className="divider">OR</div>

            <button className="google-button" onClick={handleGoogleLogin}>
              Sign Up with Google
            </button>

            <p className="redirect-link">
              Already have an account? <Link to="/login">Log In</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
