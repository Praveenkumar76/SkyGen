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

  // Effect 2: Handle Profile Data
  useEffect(() => {
    if (session) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setProfile(data);
      };
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [session]);

  if (loading) {
    return <div className="loading-container">Loading...</div>;
  }

  return (
    <Routes>
      {/* Publicly accessible route for shared chats */}
      <Route path="/share/:shareId" element={<SharedChatPage />} />

      {/* --- Main routing logic --- */}
      <Route
        path="*"
        element={
          !session ? (
            // User is logged out: show login/signup pages
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
          ) : !profile ? (
            // User is logged in but has no profile: force username creation
            <CreateUsernamePage session={session} />
          ) : (
            // User is logged in and has a profile: show main app pages
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