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
  // We rely solely on onAuthStateChange (fires INITIAL_SESSION first, after processing
  // the URL hash from OAuth redirects) instead of calling getSession() separately.
  // This prevents a race where getSession() returns null before the OAuth hash is parsed,
  // causing a flash redirect to /login that swallows the token.
  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[App] Auth state change — event:', event, '| user:', session?.user?.email ?? 'none');
      if (!isMounted) return;
      setSession(session);
      // Only mark loading done after the first event (INITIAL_SESSION or SIGNED_IN)
      setLoading(false);
      if (!session) {
        localStorage.removeItem('lastActiveChat');
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);  

  // Effect 2: Handle Profile Data
  useEffect(() => {
    if (session) {
      const fetchProfile = async () => {
        setProfileLoading(true);
        console.log('[App] Fetching profile for user:', session.user.id);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id);
        
        if (error) {
          console.error('[App] Profile fetch ERROR:', error);
        } else if (data && data.length > 0) {
          console.log('[App] Profile loaded — username:', data[0].username);
          setProfile(data[0]);
        } else {
          console.warn('[App] No profile found — redirecting to CreateUsernamePage');
          setProfile(null);
        }
        setProfileLoading(false);
      };
      fetchProfile();
    } else {
      setProfile(null);
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