'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Lock, Mail, AlertCircle, CheckCircle, ArrowLeft, Eye, EyeOff, RotateCcw } from 'lucide-react';
import Spinner from '../../components/Spinner';

export default function LoginPage() {
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeFont, setActiveFont] = useState('sans');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Dynamically sync theme accent color and font settings
  useEffect(() => {
    const storedTheme = localStorage.getItem('antigravity_theme') || 'orange';
    let color = '#ff6600';
    if (storedTheme === 'emerald') color = '#10b981';
    if (storedTheme === 'blue') color = '#3b82f6';
    if (storedTheme === 'violet') color = '#8b5cf6';
    document.documentElement.style.setProperty('--accent-color', color);

    const storedFont = localStorage.getItem('antigravity_font') || 'sans';
    setActiveFont(storedFont);
    
    // Apply font-family helper class to body dynamically
    document.body.classList.remove('font-sans-custom', 'font-serif-custom', 'font-mono-custom');
    document.body.classList.add(`font-${storedFont}-custom`);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isLoginTab) {
        // Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) throw error;
        if (data?.user) {
          window.location.href = '/';
        }
      } else {
        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) throw error;
        setSuccessMsg('Account created! Please check your email inbox and click the verification link to activate your account.');
        setIsLoginTab(true);
        setPassword('');
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
    const targetEmail = resetEmail.trim() || email.trim();
    if (!targetEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
      setSuccessMsg(`Password reset link sent to ${targetEmail}. Check your inbox!`);
      setForgotPasswordMode(false);
      setResetEmail('');
    } catch (err: any) {
      console.error('Password reset failed:', err);
      setErrorMsg(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestContinue = () => {
    window.location.href = '/';
  };

  // Font family helper mapping
  const getFontClass = () => {
    if (activeFont === 'serif') return 'font-serif-custom';
    if (activeFont === 'mono') return 'font-mono-custom';
    return 'font-sans-custom';
  };

  return (
    <div 
      className={`min-h-screen flex w-full h-full overflow-hidden select-none ${getFontClass()}`}
      style={{ backgroundColor: '#fbfbfa', height: '100vh', width: '100vw', display: 'flex', overflow: 'hidden' }}
    >
      {/* 1. MOCK SIDEBAR (For proper visual sync with website theme) */}
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

      {/* 2. MOCK CENTRAL MONITOR (For proper visual sync with website theme) */}
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
              <h2 style={{ margin: 0, fontWeight: '750', fontSize: '13px', color: '#111111', letterSpacing: '-0.02em' }}>Nidus Links Login</h2>
            </div>
            {/* Back Arrow button */}
            <button 
              onClick={handleGuestContinue}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: 'bold', color: '#6a6a6a', border: 'none', background: 'transparent', cursor: 'pointer' }}
            >
              <ArrowLeft style={{ width: '12px', height: '12px' }} />
              <span>Exit</span>
            </button>
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Tab switchers */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(17, 17, 17, 0.06)', fontSize: '12px', fontWeight: '700', userSelect: 'none' }}>
              <button
                type="button"
                onClick={() => {
                  setIsLoginTab(true);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                style={
                  isLoginTab
                    ? { flex: 1, paddingBottom: '8px', border: 'none', borderBottom: '2px solid var(--accent-color)', backgroundColor: 'transparent', color: '#111111', cursor: 'pointer', fontWeight: '800' }
                    : { flex: 1, paddingBottom: '8px', border: 'none', borderBottom: '2px solid transparent', backgroundColor: 'transparent', color: '#6a6a6a', cursor: 'pointer', fontWeight: '700' }
                }
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLoginTab(false);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                style={
                  !isLoginTab
                    ? { flex: 1, paddingBottom: '8px', border: 'none', borderBottom: '2px solid var(--accent-color)', backgroundColor: 'transparent', color: '#111111', cursor: 'pointer', fontWeight: '800' }
                    : { flex: 1, paddingBottom: '8px', border: 'none', borderBottom: '2px solid transparent', backgroundColor: 'transparent', color: '#6a6a6a', cursor: 'pointer', fontWeight: '700' }
                }
              >
                Sign Up
              </button>
            </div>

            {/* Form area */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '11px' }}>
              {errorMsg && (
                <div style={{ padding: '10px', backgroundColor: 'rgba(254, 226, 226, 0.7)', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '4px', display: 'flex', alignItems: 'flex-start', gap: '8px', fontWeight: '700', lineHeight: '1.4' }}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ width: '14px', height: '14px', color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ flex: 1 }}>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div style={{ padding: '10px', backgroundColor: 'rgba(209, 250, 229, 0.7)', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: '4px', display: 'flex', alignItems: 'flex-start', gap: '8px', fontWeight: '700', lineHeight: '1.4' }}>
                  <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ width: '14px', height: '14px', color: '#059669', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ flex: 1 }}>{successMsg}</span>
                </div>
              )}

              {/* Email Field */}
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

              {/* Password Field */}
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
                {/* Forgot password link — only on Sign In tab */}
                {isLoginTab && (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordMode(true);
                      setErrorMsg('');
                      setSuccessMsg('');
                      setResetEmail(email);
                    }}
                    style={{ alignSelf: 'flex-end', background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: '700', color: 'var(--accent-color)', padding: '2px 0', marginTop: '2px' }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              {/* Primary Action Button */}
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
                  <span>{isLoginTab ? 'Sign In & Sync' : 'Create Account'}</span>
                )}
              </button>

              {/* Signup email verification hint */}
              {!isLoginTab && (
                <p style={{ fontSize: '10px', color: '#6a6a6a', fontWeight: '600', lineHeight: '1.5', textAlign: 'center', margin: 0 }}>
                  A verification email will be sent to confirm your address before you can sign in.
                </p>
              )}

              {/* Divider line */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '2px', paddingBottom: '2px', color: 'rgba(17, 17, 17, 0.08)', userSelect: 'none' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(17, 17, 17, 0.06)' }} />
                <span style={{ fontSize: '9px', fontWeight: '800', color: '#6a6a6a', textTransform: 'uppercase' }}>or</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(17, 17, 17, 0.06)' }} />
              </div>

              {/* Guest fallback button */}
              <button
                type="button"
                onClick={handleGuestContinue}
                style={{ width: '100%', paddingTop: '9px', paddingBottom: '9px', backgroundColor: 'transparent', border: '1px solid rgba(17, 17, 17, 0.12)', color: '#111111', fontWeight: '700', borderRadius: '4px', cursor: 'pointer', textAlign: 'center', fontSize: '12px' }}
              >
                Continue as Guest (Local Offline)
              </button>
            </form>
          </div>

          {/* Forgot Password Modal Overlay */}
          {forgotPasswordMode && (
            <div
              style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.97)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px', gap: '14px', zIndex: 10, borderRadius: '6px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw style={{ width: '16px', height: '16px', color: 'var(--accent-color)' }} />
                <h3 style={{ margin: 0, fontWeight: '800', fontSize: '13px', color: '#111111' }}>Reset Password</h3>
              </div>
              <p style={{ fontSize: '11px', color: '#6a6a6a', fontWeight: '600', lineHeight: '1.5', margin: 0 }}>
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>

              {errorMsg && (
                <div style={{ padding: '10px', backgroundColor: 'rgba(254, 226, 226, 0.7)', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '4px', display: 'flex', alignItems: 'flex-start', gap: '8px', fontWeight: '700', lineHeight: '1.4', fontSize: '11px' }}>
                  <AlertCircle style={{ width: '14px', height: '14px', color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ flex: 1 }}>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div style={{ padding: '10px', backgroundColor: 'rgba(209, 250, 229, 0.7)', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: '4px', display: 'flex', alignItems: 'flex-start', gap: '8px', fontWeight: '700', lineHeight: '1.4', fontSize: '11px' }}>
                  <CheckCircle style={{ width: '14px', height: '14px', color: '#059669', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ flex: 1 }}>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Mail style={{ position: 'absolute', left: '10px', width: '14px', height: '14px', color: '#6a6a6a', pointerEvents: 'none' }} />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@domain.com"
                    style={{ width: '100%', paddingLeft: '32px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', border: '1px solid rgba(17, 17, 17, 0.12)', borderRadius: '4px', outline: 'none', fontWeight: '600', fontSize: '12px', backgroundColor: '#ffffff' }}
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ width: '100%', paddingTop: '9px', paddingBottom: '9px', backgroundColor: 'var(--accent-color)', color: '#ffffff', fontWeight: '800', borderRadius: '4px', border: 'none', cursor: 'pointer', textAlign: 'center', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {loading ? (
                    <>
                      <Spinner size="sm" className="border-t-transparent border-white" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>Send Reset Link</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForgotPasswordMode(false);
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
        </div>
      </div>

      {/* Footer hint */}
      <p style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '300px', fontSize: '10px', color: '#6a6a6a', fontWeight: '700', textAlign: 'center', lineHeight: '1.4' }}>
        Signing in is fully optional; local demo mode works out of the box!
      </p>
    </div>
  );
}
