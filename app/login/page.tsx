'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Lock, Mail, AlertCircle, CheckCircle, ArrowLeft, Eye, EyeOff, KeyRound } from 'lucide-react';
import Spinner from '../../components/Spinner';

type ViewState = 'signin' | 'signup' | 'forgot' | 'update';

export default function LoginPage() {
  const [viewState, setViewState] = useState<ViewState>('signin');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeFont, setActiveFont] = useState('sans');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Sync theme, active font, and listen for password recovery URL callbacks
  useEffect(() => {
    const storedTheme = localStorage.getItem('antigravity_theme') || 'orange';
    let color = '#ff6600';
    if (storedTheme === 'emerald') color = '#10b981';
    if (storedTheme === 'blue') color = '#3b82f6';
    if (storedTheme === 'violet') color = '#8b5cf6';
    document.documentElement.style.setProperty('--accent-color', color);

    const storedFont = localStorage.getItem('antigravity_font') || 'sans';
    setActiveFont(storedFont);
    
    document.body.classList.remove('font-sans-custom', 'font-serif-custom', 'font-mono-custom');
    document.body.classList.add(`font-${storedFont}-custom`);

    // Detect if we came from a recovery/reset password email link
    const hash = typeof window !== 'undefined' ? window.location.hash || '' : '';
    if (hash.includes('type=recovery') || hash.includes('access_token=')) {
      setViewState('update');
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setViewState('update');
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleSignInOrSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (viewState === 'signin') {
        // Sign in flow
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) throw error;
        if (data?.user) {
          window.location.href = '/';
        }
      } else {
        // Sign up flow
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
          }
        });
        if (error) throw error;
        
        // Since Confirm Email is turned OFF, signUp automatically logs the user in and returns a session
        if (data?.session || data?.user) {
          setSuccessMsg('Account created successfully! Logging you in...');
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
        } else {
          setSuccessMsg('Account created! You can now sign in using your credentials.');
          setViewState('signin');
          setPassword('');
        }
      }
    } catch (err: any) {
      console.error('Authentication failed:', err);
      setErrorMsg(err.message || 'Authentication failed. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    // Client-side rate-limit protection (60 seconds cooldown)
    const now = Date.now();
    const lastRequest = localStorage.getItem('nidus_last_reset_request');
    if (lastRequest) {
      const timePassed = now - parseInt(lastRequest, 10);
      if (timePassed < 60000) {
        const secondsLeft = Math.ceil((60000 - timePassed) / 1000);
        setErrorMsg(`Too many requests. Please wait ${secondsLeft} seconds before trying again.`);
        return;
      }
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      
      // Save request timestamp to enforce cooldown
      localStorage.setItem('nidus_last_reset_request', now.toString());
      
      setSuccessMsg(`Password reset link sent to ${email.trim()}. Please check your email inbox!`);
      setEmail('');
    } catch (err: any) {
      console.error('Password reset request failed:', err);
      setErrorMsg(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      setErrorMsg('Please enter your new password.');
      return;
    }
    if (newPassword.trim().length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword.trim(),
      });
      if (error) throw error;
      setSuccessMsg('Password updated successfully! Redirecting you to the dashboard...');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err: any) {
      console.error('Password update failed:', err);
      setErrorMsg(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestContinue = () => {
    window.location.href = '/';
  };

  const getFontClass = () => {
    if (activeFont === 'serif') return 'font-serif-custom';
    if (activeFont === 'mono') return 'font-mono-custom';
    return 'font-sans-custom';
  };

  // Dynamically set title depending on viewState
  const getTitle = () => {
    if (viewState === 'forgot') return 'Reset Password';
    if (viewState === 'update') return 'Set New Password';
    return 'Nidus Links';
  };

  return (
    <div 
      className={`min-h-screen flex w-full h-full overflow-hidden select-none ${getFontClass()}`}
      style={{ backgroundColor: '#fbfbfa', height: '100vh', width: '100vw', display: 'flex', overflow: 'hidden' }}
    >
      {/* 1. MOCK SIDEBAR (Visual backdrop sync) */}
      <div 
        className="w-[240px] h-full flex flex-col justify-between shrink-0" 
        style={{ borderRight: '1px solid rgba(17, 17, 17, 0.08)', backgroundColor: '#fbfbfa', padding: '18px', opacity: 0.6 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img
              src="/Nidus logo.png"
              alt="Nidus Logo"
              style={{ width: '28px', height: '28px', objectFit: 'contain' }}
            />
            <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#111111' }}>Nidus</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            <div style={{ height: '24px', backgroundColor: '#f3f4f6', borderRadius: '6px', width: '100%' }}></div>
            <div style={{ height: '24px', backgroundColor: '#f3f4f6', borderRadius: '6px', width: '90%' }}></div>
            <div style={{ height: '24px', backgroundColor: '#f3f4f6', borderRadius: '6px', width: '85%' }}></div>
          </div>
        </div>
      </div>

      {/* 2. MOCK CENTRAL MONITOR (Visual backdrop sync) */}
      <div className="flex-1 h-full flex flex-col" style={{ backgroundColor: '#f6f6ef', opacity: 0.5 }}>
        <div className="h-14 bg-white flex items-center px-6" style={{ height: '56px', backgroundColor: '#ffffff', borderBottom: '1px solid rgba(17, 17, 17, 0.08)' }}>
          <div style={{ height: '32px', backgroundColor: '#f3f4f6', borderRadius: '6px', width: '240px' }}></div>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ height: '32px', backgroundColor: '#ffffff', borderRadius: '6px', width: '180px' }}></div>
          <div style={{ height: '40px', backgroundColor: '#ffffff', borderRadius: '6px', width: '100%' }}></div>
          <div style={{ height: '40px', backgroundColor: '#ffffff', borderRadius: '6px', width: '100%' }}></div>
          <div style={{ height: '40px', backgroundColor: '#ffffff', borderRadius: '6px', width: '100%' }}></div>
        </div>
      </div>

      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-xs"
        style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}
      >
        <div 
          className="bg-white border border-neutral-250 flex flex-col"
          style={{ width: '100%', maxWidth: '370px', backgroundColor: '#ffffff', border: '1px solid rgba(17, 17, 17, 0.12)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        >
          {/* Top Banner Branding */}
          <div 
            className="border-b border-neutral-100 flex items-center"
            style={{ padding: '20px 24px', borderBottom: '1px solid rgba(17, 17, 17, 0.06)', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#fbfbfa' }}
          >
            <img
              src="/Nidus logo.png"
              alt="Nidus Logo"
              style={{ width: '44px', height: '44px', objectFit: 'contain' }}
            />
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontWeight: '750', fontSize: '13px', color: '#111111', letterSpacing: '-0.02em' }}>{getTitle()}</h2>
            </div>
            {/* Exit/Back button */}
            {viewState === 'forgot' ? (
              <button 
                onClick={() => { setViewState('signin'); setErrorMsg(''); setSuccessMsg(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: 'bold', color: 'var(--accent-color)', border: 'none', background: 'transparent', cursor: 'pointer' }}
              >
                <ArrowLeft style={{ width: '12px', height: '12px' }} />
                <span>Sign In</span>
              </button>
            ) : viewState !== 'update' ? (
              <button 
                onClick={handleGuestContinue}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: 'bold', color: '#6a6a6a', border: 'none', background: 'transparent', cursor: 'pointer' }}
              >
                <ArrowLeft style={{ width: '12px', height: '12px' }} />
                <span>Exit</span>
              </button>
            ) : null}
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 1. Alerts */}
            {errorMsg && (
              <div style={{ padding: '10px', backgroundColor: 'rgba(254, 226, 226, 0.7)', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '4px', display: 'flex', alignItems: 'flex-start', gap: '8px', fontWeight: '700', lineHeight: '1.4' }}>
                <AlertCircle style={{ width: '14px', height: '14px', color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
                <span style={{ flex: 1 }}>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div style={{ padding: '10px', backgroundColor: 'rgba(209, 250, 229, 0.7)', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: '4px', display: 'flex', alignItems: 'flex-start', gap: '8px', fontWeight: '700', lineHeight: '1.4' }}>
                <CheckCircle style={{ width: '14px', height: '14px', color: '#059669', flexShrink: 0, marginTop: '2px' }} />
                <span style={{ flex: 1 }}>{successMsg}</span>
              </div>
            )}

            {/* 2. Mode-Specific Content Layout */}

            {/* SIGN IN & SIGN UP VIEW */}
            {(viewState === 'signin' || viewState === 'signup') && (
              <>
                {/* Tab switchers */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(17, 17, 17, 0.06)', fontSize: '12px', fontWeight: '700', userSelect: 'none' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setViewState('signin');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    style={
                      viewState === 'signin'
                        ? { flex: 1, paddingBottom: '8px', border: 'none', borderBottom: '2px solid var(--accent-color)', backgroundColor: 'transparent', color: '#111111', cursor: 'pointer', fontWeight: '800' }
                        : { flex: 1, paddingBottom: '8px', border: 'none', borderBottom: '2px solid transparent', backgroundColor: 'transparent', color: '#6a6a6a', cursor: 'pointer', fontWeight: '700' }
                    }
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewState('signup');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    style={
                      viewState === 'signup'
                        ? { flex: 1, paddingBottom: '8px', border: 'none', borderBottom: '2px solid var(--accent-color)', backgroundColor: 'transparent', color: '#111111', cursor: 'pointer', fontWeight: '800' }
                        : { flex: 1, paddingBottom: '8px', border: 'none', borderBottom: '2px solid transparent', backgroundColor: 'transparent', color: '#6a6a6a', cursor: 'pointer', fontWeight: '700' }
                    }
                  >
                    Sign Up
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSignInOrSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '11px' }}>
                  {/* Email */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontWeight: '700', fontSize: '9.5px', color: '#6a6a6a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Mail style={{ position: 'absolute', left: '10px', width: '14px', height: '14px', color: '#6a6a6a', pointerEvents: 'none' }} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@domain.com"
                        style={{ width: '100%', paddingLeft: '32px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', border: '1px solid rgba(17, 17, 17, 0.12)', borderRadius: '4px', outline: 'none', fontWeight: '600', fontSize: '12px', backgroundColor: '#ffffff' }}
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontWeight: '700', fontSize: '9.5px', color: '#6a6a6a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Lock style={{ position: 'absolute', left: '10px', width: '14px', height: '14px', color: '#6a6a6a', pointerEvents: 'none' }} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{ width: '100%', paddingLeft: '32px', paddingRight: '36px', paddingTop: '8px', paddingBottom: '8px', border: '1px solid rgba(17, 17, 17, 0.12)', borderRadius: '4px', outline: 'none', fontWeight: '600', fontSize: '12px', backgroundColor: '#ffffff' }}
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff style={{ width: '14px', height: '14px', color: '#6a6a6a' }} />
                        ) : (
                          <Eye style={{ width: '14px', height: '14px', color: '#6a6a6a' }} />
                        )}
                      </button>
                    </div>
                    {/* Forgot Password Link */}
                    {viewState === 'signin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setViewState('forgot');
                          setErrorMsg('');
                          setSuccessMsg('');
                        }}
                        style={{ alignSelf: 'flex-end', background: 'none', border: 'none', cursor: 'pointer', fontSize: '10.5px', fontWeight: '700', color: 'var(--accent-color)', padding: '2px 0', marginTop: '2px' }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>

                  {/* Primary Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    style={{ width: '100%', paddingTop: '9px', paddingBottom: '9px', backgroundColor: 'var(--accent-color)', color: '#ffffff', fontWeight: '800', borderRadius: '4px', border: 'none', cursor: 'pointer', textAlign: 'center', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    {loading ? (
                      <>
                        <Spinner size="sm" className="border-t-transparent border-white" />
                        <span>Syncing cloud...</span>
                      </>
                    ) : (
                      <span>{viewState === 'signin' ? 'Sign In & Sync' : 'Create Account'}</span>
                    )}
                  </button>

                  {/* Divider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '2px', paddingBottom: '2px', color: 'rgba(17, 17, 17, 0.08)', userSelect: 'none' }}>
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(17, 17, 17, 0.06)' }} />
                    <span style={{ fontSize: '9px', fontWeight: '800', color: '#6a6a6a', textTransform: 'uppercase' }}>or</span>
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(17, 17, 17, 0.06)' }} />
                  </div>

                  {/* Guest Fallback */}
                  <button
                    type="button"
                    onClick={handleGuestContinue}
                    style={{ width: '100%', paddingTop: '9px', paddingBottom: '9px', backgroundColor: 'transparent', border: '1px solid rgba(17, 17, 17, 0.12)', color: '#111111', fontWeight: '700', borderRadius: '4px', cursor: 'pointer', textAlign: 'center', fontSize: '12px' }}
                  >
                    Continue as Guest (Local Offline)
                  </button>
                </form>
              </>
            )}

            {/* FORGOT PASSWORD VIEW */}
            {viewState === 'forgot' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '11px', color: '#6a6a6a', fontWeight: '600', lineHeight: '1.5', margin: 0 }}>
                  Enter your email address and we will email you a secure link to reset your account password.
                </p>

                <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '11px' }}>
                  {/* Email */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontWeight: '700', fontSize: '9.5px', color: '#6a6a6a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Mail style={{ position: 'absolute', left: '10px', width: '14px', height: '14px', color: '#6a6a6a', pointerEvents: 'none' }} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@domain.com"
                        style={{ width: '100%', paddingLeft: '32px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', border: '1px solid rgba(17, 17, 17, 0.12)', borderRadius: '4px', outline: 'none', fontWeight: '600', fontSize: '12px', backgroundColor: '#ffffff' }}
                        required
                        disabled={loading}
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Submit Reset Link */}
                  <button
                    type="submit"
                    disabled={loading}
                    style={{ width: '100%', paddingTop: '9px', paddingBottom: '9px', backgroundColor: 'var(--accent-color)', color: '#ffffff', fontWeight: '800', borderRadius: '4px', border: 'none', cursor: 'pointer', textAlign: 'center', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    {loading ? (
                      <>
                        <Spinner size="sm" className="border-t-transparent border-white" />
                        <span>Sending reset link...</span>
                      </>
                    ) : (
                      <span>Send Recovery Link</span>
                    )}
                  </button>

                  {/* Cancel Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setViewState('signin');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    style={{ width: '100%', paddingTop: '9px', paddingBottom: '9px', backgroundColor: 'transparent', border: '1px solid rgba(17, 17, 17, 0.12)', color: '#111111', fontWeight: '700', borderRadius: '4px', cursor: 'pointer', textAlign: 'center', fontSize: '12px' }}
                  >
                    Back to Sign In
                  </button>
                </form>
              </div>
            )}

            {/* UPDATE PASSWORD (RECOVERY CALLBACK) VIEW */}
            {viewState === 'update' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(17, 17, 17, 0.06)', paddingBottom: '10px' }}>
                  <KeyRound style={{ width: '16px', height: '16px', color: 'var(--accent-color)' }} />
                  <span style={{ fontWeight: '800', fontSize: '12px', color: '#111111' }}>Reset Account Password</span>
                </div>
                
                <p style={{ fontSize: '11px', color: '#6a6a6a', fontWeight: '600', lineHeight: '1.5', margin: 0 }}>
                  Your secure recovery link was verified. Please enter a new password below.
                </p>

                <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '11px' }}>
                  {/* New Password */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontWeight: '700', fontSize: '9.5px', color: '#6a6a6a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Password</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Lock style={{ position: 'absolute', left: '10px', width: '14px', height: '14px', color: '#6a6a6a', pointerEvents: 'none' }} />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{ width: '100%', paddingLeft: '32px', paddingRight: '36px', paddingTop: '8px', paddingBottom: '8px', border: '1px solid rgba(17, 17, 17, 0.12)', borderRadius: '4px', outline: 'none', fontWeight: '600', fontSize: '12px', backgroundColor: '#ffffff' }}
                        required
                        disabled={loading}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        tabIndex={-1}
                      >
                        {showNewPassword ? (
                          <EyeOff style={{ width: '14px', height: '14px', color: '#6a6a6a' }} />
                        ) : (
                          <Eye style={{ width: '14px', height: '14px', color: '#6a6a6a' }} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Submit Update */}
                  <button
                    type="submit"
                    disabled={loading}
                    style={{ width: '100%', paddingTop: '9px', paddingBottom: '9px', backgroundColor: 'var(--accent-color)', color: '#ffffff', fontWeight: '800', borderRadius: '4px', border: 'none', cursor: 'pointer', textAlign: 'center', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    {loading ? (
                      <>
                        <Spinner size="sm" className="border-t-transparent border-white" />
                        <span>Saving new password...</span>
                      </>
                    ) : (
                      <span>Update Password</span>
                    )}
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Footer hint */}
      <p style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '300px', fontSize: '10px', color: '#6a6a6a', fontWeight: '700', textAlign: 'center', lineHeight: '1.4' }}>
        Signing in is fully optional; local demo mode works out of the box!
      </p>
    </div>
  );
}
