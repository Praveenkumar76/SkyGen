import React, { useEffect, useMemo, useState } from 'react';
import './LoginPage.css';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FaGoogle } from 'react-icons/fa';

const LOGO_URL = "/X.jpg";

const loadExternalScript = (src) => {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (existing.getAttribute('data-loaded') === 'true') {
                resolve();
            } else {
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', (e) => reject(e));
            }
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => {
            script.setAttribute('data-loaded', 'true');
            resolve();
        };
        script.onerror = reject;
        document.body.appendChild(script);
    });
};

export default function LoginPage() {
    const [isRegisterActive, setIsRegisterActive] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regUsername, setRegUsername] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const navigate = useNavigate();

    const containerClassName = useMemo(() => {
        return isRegisterActive ? 'container active' : 'container';
    }, [isRegisterActive]);

    useEffect(() => {
        let isCancelled = false;
        (async () => {
            try {
                await loadExternalScript('https://unpkg.com/boxicons@2.1.4/dist/boxicons.js');
                await loadExternalScript('https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js');
                if (isCancelled) return;
                if (typeof window !== 'undefined' && window.particlesJS) {
                    window.particlesJS('particles-js', {
                        particles: {
                            number: { value: 100, density: { enable: true, value_area: 800 } },
                            color: { value: ['#6a0dad', '#8a2be2', '#b832b8'] },
                            shape: { type: 'circle' },
                            opacity: { value: 0.8, random: true, anim: { enable: true, speed: 1, opacity_min: 0.4 } },
                            size: { value: 5, random: true, anim: { enable: true, speed: 2, size_min: 1 } },
                            line_linked: { enable: true, distance: 150, color: '#8a2be2', opacity: 0.6, width: 1.5 },
                            move: { enable: true, speed: 2, direction: 'none', random: true, out_mode: 'out', attract: { enable: true } }
                        },
                        interactivity: {
                            events: { onhover: { enable: true, mode: 'repulse' }, onclick: { enable: true, mode: 'push' } },
                            modes: { repulse: { distance: 100 }, push: { particles_nb: 4 } }
                        },
                        retina_detect: true
                    });
                }
            } catch (err) {
                console.error("Failed to load external scripts:", err);
            }
        })();
        return () => { isCancelled = true; };
    }, []);
    
    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        console.log('[SignIn] Attempt started for:', email);

        if (!email || !password) {
            setError('Please enter both email and password');
            setLoading(false);
            return;
        }

        if (!validateEmail(email)) {
            setError('Please enter a valid email address (e.g., user@example.com)');
            setLoading(false);
            return;
        }

        try {
            console.log('[SignIn] Calling supabase.auth.signInWithPassword...');
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (signInError) {
                console.error('[SignIn] FAILED —', signInError.message, '| status:', signInError.status, '| code:', signInError.code);
                throw signInError;
            }

            console.log('[SignIn] SUCCESS — user:', data.user?.id, '| email:', data.user?.email);
            navigate('/');
        } catch (err) {
            const errorMessage = err.message || '';
            const errorStatus = err.status || err.code || '';

            if (errorMessage.includes('email_provider_disabled') || err.code === 'email_provider_disabled') {
                setError('Email login is currently disabled. Please use "Continue with Google" or contact support.');
            } else if (errorMessage.includes('Invalid login credentials') || errorStatus === 400) {
                setError('Invalid email or password. Please check your credentials and try again.');
            } else if (errorMessage.includes('Too many requests') || errorStatus === 429) {
                setError('Too many login attempts. Please wait a few minutes before trying again.');
            } else if (errorMessage.includes('User not found')) {
                setError('No account found with this email. Please check your email or sign up for a new account.');
            } else if (errorMessage.includes('Invalid email')) {
                setError('Please enter a valid email address.');
            } else {
                setError(errorMessage || 'Login failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const performRegistration = async () => {
        console.log('[SignUp] Attempt started — email:', regEmail, '| username:', regUsername.trim());
        try {
            console.log('[SignUp] Calling supabase.auth.signUp...');
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: regEmail,
                password: regPassword,
                options: {
                    data: {
                        username: regUsername.trim()
                    }
                }
            });

            if (signUpError) {
                console.error('[SignUp] FAILED —', signUpError.message, '| status:', signUpError.status, '| code:', signUpError.code);
                throw signUpError;
            }

            console.log('[SignUp] supabase.auth.signUp response — user:', data.user?.id, '| identities:', data.user?.identities?.length, '| session:', !!data.session);

            setRetryCount(0);

            if (data.user && data.user.identities && data.user.identities.length === 0) {
                console.warn('[SignUp] Zero identities — user likely already exists but unconfirmed');
                setError('An account with this email already exists. Please try logging in instead.');
            } else if (data.user) {
                if (data.session) {
                    console.log('[SignUp] SUCCESS with immediate session — navigating to /');
                    navigate('/');
                } else {
                    console.log('[SignUp] SUCCESS — email confirmation required (check Supabase settings if unexpected)');
                    setError('Registration successful! Please check your email for a confirmation link.');
                }
            }

            setIsRegisterActive(false);
            setEmail(regEmail);
            setPassword('');

        } catch (err) {
            console.error('[SignUp] ERROR DETAILS:');
            console.error('  message:', err.message);
            console.error('  status:', err.status ?? err.code);
            console.error('  full object:', JSON.stringify(err, null, 2));

            const errorMessage = err.message || '';
            const errorStatus = err.status || err.code || '';
            const errorDetails = Array.isArray(err.errors)
                ? err.errors.map(e => e?.message || e).join(' ')
                : (err.errors || err.details || '');
            const fullErrorText = `${errorMessage} ${errorDetails}`.toLowerCase();

            if (errorMessage.includes('email_provider_disabled') || err.code === 'email_provider_disabled') {
                console.warn('[SignUp] Email provider is disabled in Supabase — enable it in Authentication → Providers → Email');
                setError('Email sign-up is currently disabled. Please use "Continue with Google" or contact support.');
                return;
            }

            if (errorMessage.includes('rate limit') || errorMessage.includes('email rate limit exceeded') || errorStatus === 429) {
                console.warn('[SignUp] Rate limit hit — aborting retries');
                setError('Too many registration attempts. Please wait 10-15 minutes before trying again.');
                setRetryCount(0);
                setTimeout(() => {
                    setIsRegisterActive(false);
                    setEmail(regEmail);
                    setError('Please try logging in instead.');
                }, 3000);
                return;
            }

            if (
                fullErrorText.includes('duplicate key') ||
                fullErrorText.includes('23505') ||
                fullErrorText.includes('profiles_username_key') ||
                (errorStatus === 500 && fullErrorText.includes('username'))
            ) {
                console.warn('[SignUp] Duplicate username constraint hit');
                setError('This username is already taken. Please choose a different one.');
                setRetryCount(0);
                return;
            }

            if (errorMessage.includes('User already registered') || errorMessage.includes('already registered') || errorStatus === 422) {
                console.warn('[SignUp] Email already registered');
                setError('An account with this email already exists. Please try logging in instead.');
                setTimeout(() => {
                    setIsRegisterActive(false);
                    setEmail(regEmail);
                    setError('Please try logging in with your existing account.');
                }, 2000);
                return;
            }

            if (errorMessage.includes('Invalid email')) {
                setError('Please enter a valid email address.');
            } else if (errorMessage.includes('Password should be at least')) {
                setError('Password must be at least 6 characters long.');
            } else if (errorStatus === 500) {
                setError('Registration failed due to a server error. The username may already be taken — please try a different one.');
            } else {
                setError(errorMessage || 'Failed to register. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError(null);

        if (!regUsername || !regEmail || !regPassword) {
            setError('Please fill in all registration fields');
            return;
        }

        // Validate email format
        if (!validateEmail(regEmail)) {
            setError('Please enter a valid email address (e.g., user@example.com)');
            return;
        }

        if (regPassword.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }

        // Check if username is too short
        if (regUsername.trim().length < 3) {
            setError('Username must be at least 3 characters long');
            return;
        }

        setLoading(true);
        await performRegistration();
    };

    const handleGoogleSignIn = async () => {
        setError(null);
        setLoading(true);
        const redirectTo = `${window.location.origin}/`;
        console.log('[Google OAuth] Initiating sign-in — redirectTo:', redirectTo);
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo }
            });
            if (error) {
                console.error('[Google OAuth] FAILED —', error.message, '| status:', error.status);
                throw error;
            }
            console.log('[Google OAuth] Redirecting to Google... provider URL:', data?.url);
        } catch (err) {
            setError(err.message || 'Sign in with Google failed');
            setLoading(false);
        }
    };

    return (
        <div className="login-page-root">
            <div id="particles-js"></div>
            <div className={containerClassName}>
                <div className="curved-shape"></div>
                <div className="curved-shape2"></div>
                
                {/* LOGIN FORM */}
                <div className="form-box Login">
                    <h2 className="animation" style={{'--D': 0, '--S': 21}}>Login</h2>
                    <form onSubmit={handleEmailLogin}>
                        <div className="input-box animation" style={{'--D': 1, '--S': 22}}>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                            <label>Email</label>
                            <box-icon type='solid' name='user' color="gray"></box-icon>
                        </div>
                        <div className="input-box animation" style={{'--D': 2, '--S': 23}}>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                            <label>Password</label>
                            <box-icon name='lock-alt' type='solid' color="gray"></box-icon>
                        </div>
                        <button className="btn animation" type="submit" disabled={loading} style={{'--D': 3, '--S': 24}}>
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>
                    <div className="social-login animation" style={{'--D': 4, '--S': 24}}>
                         <button type="button" className="google-round-btn" onClick={handleGoogleSignIn} disabled={loading}>
                            <FaGoogle />
                            <span>Continue with Google</span>
                        </button>
                    </div>
                    {error && !isRegisterActive && <p className="error-message animation" style={{'--D': 5, '--S': 25}}>{error}</p>}
                    <div className="regi-link animation" style={{'--D': 6, '--S': 25}}>
                        <p>Don't have an account? <a href="#" className="SignUpLink" onClick={(e) => { e.preventDefault(); setIsRegisterActive(true); setError(null); }}>Sign Up</a></p>
                    </div>
                </div>

                <div className="info-content Login">
                    <h2 className="animation" style={{'--D': 0, '--S': 20}}>WELCOME BACK!</h2>
                    <p className="animation" style={{'--D': 1, '--S': 21}}>We are happy to have you with us again.</p>
                </div>

                {/* REGISTRATION FORM */}
                <div className="form-box Register">
                    <h2 className="animation" style={{'--li': 17, '--S': 0}}>Register</h2>
                    <form onSubmit={handleRegister}>
                        <div className="input-box animation" style={{'--li': 18, '--S': 1}}>
                            <input type="text" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} required autoComplete="username" />
                            <label>Username</label>
                            <box-icon name='user' type='solid' color="gray"></box-icon>
                        </div>
                        <div className="input-box animation" style={{'--li': 19, '--S': 2}}>
                            <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required autoComplete="email" />
                            <label>Email</label>
                            <box-icon name='envelope' type='solid' color="gray"></box-icon>
                        </div>
                        <div className="input-box animation" style={{'--li': 20, '--S': 3}}>
                            <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required autoComplete="new-password" />
                            <label>Password</label>
                            <box-icon name='lock-alt' type='solid' color="gray"></box-icon>
                        </div>
                        <button className="btn animation" type="submit" disabled={loading} style={{'--li': 21, '--S': 5}}>
                            {loading ? 'Registering...' : 'Register'}
                        </button>
                    </form>
                    <div className="social-login animation" style={{'--li': 22, '--S': 6}}>
                        <button type="button" className="google-round-btn" onClick={handleGoogleSignIn} disabled={loading}>
                            <FaGoogle />
                            <span>Continue with Google</span>
                        </button>
                    </div>
                     {error && isRegisterActive && <p className="error-message animation" style={{'--li': 23, '--S': 7}}>{error}</p>}
                    <div className="regi-link animation" style={{'--li': 24, '--S': 7}}>
                        <p>Already have an account? <a href="#" className="SignInLink" onClick={(e) => { e.preventDefault(); setIsRegisterActive(false); setError(null); }}>Sign In</a></p>
                    </div>
                </div>

                <div className="info-content Register">
                    <h2 className="animation" style={{'--li': 17, '--S': 0}}>SKYGEN</h2>
                    <p className="animation" style={{'--li': 18, '--S': 1}}>We’re delighted to have you here.</p>
                </div>
            </div>
        </div>
    );
}