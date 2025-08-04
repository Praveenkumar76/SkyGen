import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import UserAvatar from '../components/UserAvatar';
import './ProfilePage.css';

export default function ProfilePage({ session }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [profile, setProfile] = useState({
    username: '', full_name: '', age: '', gender: '', address: '', phone_number: '', 
    github_link: '', linkedin_link: '', employment_status: '', college: '', 
    company_name: '', role: '', about: ''
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (error) setError(error.message);
      else if (data) setProfile(data);
      setLoading(false);
    };
    fetchProfile();
  }, [session.user.id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess('');
    const { error } = await supabase
      .from('profiles')
      .update({ ...profile, updated_at: new Date() })
      .eq('id', session.user.id);
    if (error) setError(error.message);
    else setSuccess('Profile updated successfully!');
    setLoading(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    setError(null);
    setSuccess('');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setError(error.message);
    else {
      setSuccess("Password updated successfully!");
      setNewPassword('');
      setConfirmPassword('');
    }
  };
  
  if (loading && !profile.username) return <div>Loading profile...</div>;

  return (
    <div className="profile-page-container">
      <div className="profile-header">
        <UserAvatar username={profile.username} />
        <div>
          <h2>{profile.full_name || profile.username}</h2>
          <p>{session.user.email}</p>
        </div>
      </div>

      {/* Profile Details Form */}
      <form className="profile-form" onSubmit={handleUpdateProfile}>
        <h3>Personal Information</h3>
        <div className="form-grid">
          <div className="form-group"><label>Username</label><input type="text" value={profile.username} disabled title="Username cannot be changed." /></div>
          <div className="form-group"><label>Full Name</label><input type="text" name="full_name" value={profile.full_name || ''} onChange={handleChange} /></div>
          <div className="form-group"><label>Age</label><input type="number" name="age" value={profile.age || ''} onChange={handleChange} /></div>
          <div className="form-group"><label>Gender</label><input type="text" name="gender" value={profile.gender || ''} onChange={handleChange} /></div>
        </div>
        
        <div className="form-group">
          <label>About</label>
          <textarea name="about" value={profile.about || ''} onChange={handleChange} rows="4"></textarea>
        </div>

        <h3>Contact & Links</h3>
        <div className="form-grid">
          <div className="form-group"><label>Phone Number</label><input type="tel" name="phone_number" value={profile.phone_number || ''} onChange={handleChange} /></div>
          <div className="form-group"><label>Address</label><input type="text" name="address" value={profile.address || ''} onChange={handleChange} /></div>
          <div className="form-group"><label>GitHub Link</label><input type="url" name="github_link" value={profile.github_link || ''} onChange={handleChange} /></div>
          <div className="form-group"><label>LinkedIn Link</label><input type="url" name="linkedin_link" value={profile.linkedin_link || ''} onChange={handleChange} /></div>
        </div>

        <h3>Professional Information</h3>
        <div className="form-group">
          <label>Are you a student or employee?</label>
          <select name="employment_status" value={profile.employment_status || ''} onChange={handleChange}>
            <option value="">Select...</option><option value="student">Student</option><option value="employee">Employee</option>
          </select>
        </div>
        {profile.employment_status === 'student' && (
          <div className="form-group"><label>College Name</label><input type="text" name="college" value={profile.college || ''} onChange={handleChange} /></div>
        )}
        {profile.employment_status === 'employee' && (
          <div className="form-grid">
            <div className="form-group"><label>Company Name</label><input type="text" name="company_name" value={profile.company_name || ''} onChange={handleChange} /></div>
            <div className="form-group"><label>Role</label><input type="text" name="role" value={profile.role || ''} onChange={handleChange} /></div>
          </div>
        )}
        <div className="form-actions">
           <button type="submit" className="save-button" disabled={loading}>{loading ? 'Saving...' : 'Save Profile'}</button>
        </div>
      </form>

      {/* Change Password Form */}
      <form className="profile-form" onSubmit={handleChangePassword}>
        <h3>Change Password</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
        </div>
        <div className="form-actions">
           <button type="submit" className="save-button" disabled={loading}>Change Password</button>
        </div>
      </form>

      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">{success}</p>}
      <div className="form-actions">
         <button type="button" onClick={() => navigate('/')}>Back to Chat</button>
      </div>
    </div>
  );
}