import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Routes, Route, Navigate } from 'react-router-dom';

// Import all page components
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import ChatPage from './pages/ChatPage';
import CreateUsernamePage from './pages/CreateUsernamePage';
import ProfilePage from './pages/ProfilePage';
import SharedChatPage from './pages/SharedChatPage';

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Effect 1: Handle Auth State
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Effect 2: Handle Profile Data (This is the corrected part)
  useEffect(() => {
    if (session) {
      const fetchProfile = async () => {
        // REMOVED .single() to prevent the 406 error
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id);
        
        if (error) {
          console.error("Error fetching profile:", error);
        } else if (data && data.length > 0) {
          setProfile(data[0]); // Set the profile if it exists
        } else {
          setProfile(null); // Explicitly set to null if no profile is found
        }
      };
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [session]);

  if (loading) {
    return <div className="loading-container">Loading...</div>;
  }

  // --- Main routing logic ---
  return (
    <Routes>
      <Route path="/share/:shareId" element={<SharedChatPage />} />
      <Route
        path="*"
        element={
          !session ? (
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
          ) : !profile ? (
            <CreateUsernamePage session={session} />
          ) : (
            <Routes>
              <Route path="/" element={<ChatPage session={session} profile={profile} />} />
              <Route path="/profile" element={<ProfilePage session={session} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          )
        }
      />
    </Routes>
  );
}

export default App;