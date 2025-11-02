import { useState, useEffect, Suspense, lazy } from 'react';
import { supabase } from './supabaseClient';
import { Routes, Route, Navigate } from 'react-router-dom';
import PerformanceMonitor from './components/PerformanceMonitor';
import VideoLoader from './components/VideoLoader';

// Lazy load page components for better performance
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const CreateUsernamePage = lazy(() => import('./pages/CreateUsernamePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SharedChatPage = lazy(() => import('./pages/SharedChatPage'));

// Loading component
const PageLoader = () => <VideoLoader size="large" />;

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  // Effect 1: Handle Auth State
  useEffect(() => {
    let isMounted = true;
  
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (isMounted) {
        setSession(session);
        setLoading(false);
      }
    };
  
    getInitialSession();
  
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Clear active conversation from localStorage when user logs out
      if (!session) {
        localStorage.removeItem('lastActiveChat');
      }
    });
  
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);  

  // Effect 2: Handle Profile Data (This is the corrected part)
  useEffect(() => {
    if (session) {
      const fetchProfile = async () => {
        setProfileLoading(true);
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
        setProfileLoading(false);
      };
      fetchProfile();
    } else {
      setProfile(null);
      // Ensure loading state is cleared when there is no active session
      setProfileLoading(false);
    }
  }, [session]);

  if (loading || profileLoading) {
    return <VideoLoader size="large" message="Loading..." />;
  }

  // --- Main routing logic ---
  return (
    <>
      <PerformanceMonitor />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/share/:shareId" element={<SharedChatPage />} />
          <Route
            path="*"
            element={
              !session ? (
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="*" element={<Navigate to="/login" />} />
                </Routes>
              ) : !profile ? (
                <CreateUsernamePage session={session} />
              ) : (
                <Routes>
                  <Route path="/" element={<ChatPage session={session} profile={profile} />} />
                  <Route path="/profile" element={<ProfilePage session={session} profile={profile} />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              )
            }
          />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;