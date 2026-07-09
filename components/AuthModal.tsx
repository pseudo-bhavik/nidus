import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Lock, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import Spinner from './Spinner';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string) => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

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
          onSuccess(data.user.email || email);
          onClose();
        }
      } else {
        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) throw error;
        setSuccessMsg('Account created successfully! Check your email to verify (if enabled) or log in directly.');
        setIsLoginTab(true);
        setPassword('');
      }
    } catch (err: any) {
      console.error('Authentication action failed:', err);
      setErrorMsg(err.message || 'Authentication failed. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div 
        className="w-full max-w-sm bg-white border border-neutral-200/60 rounded-lg shadow-xl overflow-hidden flex flex-col transition-all-custom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <span className="font-semibold text-neutral-800 text-xs uppercase tracking-wider">
            {isLoginTab ? 'Account Login' : 'Register Account'}
          </span>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-neutral-200/60 rounded-md transition-all-custom cursor-pointer"
          >
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-100 text-xs">
          <button
            onClick={() => {
              setIsLoginTab(true);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-2.5 font-bold transition-all-custom cursor-pointer ${
              isLoginTab 
                ? 'text-hn-orange border-b-2 border-hn-orange bg-neutral-50/10' 
                : 'text-neutral-500 hover:text-neutral-700 bg-neutral-50/30'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setIsLoginTab(false);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-2.5 font-bold transition-all-custom cursor-pointer ${
              !isLoginTab 
                ? 'text-hn-orange border-b-2 border-hn-orange bg-neutral-50/10' 
                : 'text-neutral-500 hover:text-neutral-700 bg-neutral-50/30'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-lg flex items-start gap-2.5 font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg flex items-start gap-2.5 font-medium">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Email field */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[10px] text-neutral-400 uppercase tracking-wider">Email Address</label>
            <div className="relative flex items-center">
              <Mail className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full pl-8 pr-2.5 py-2 border border-neutral-200 hover:border-neutral-300 focus:border-hn-orange/50 focus:ring-1 focus:ring-hn-orange/10 rounded outline-none font-medium"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Password field */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[10px] text-neutral-400 uppercase tracking-wider">Password</label>
            <div className="relative flex items-center">
              <Lock className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 shrink-0" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-8 pr-2.5 py-2 border border-neutral-200 hover:border-neutral-300 focus:border-hn-orange/50 focus:ring-1 focus:ring-hn-orange/10 rounded outline-none font-medium"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-hn-orange hover:bg-[#e05a00] text-white font-bold rounded cursor-pointer transition-all-custom flex items-center justify-center gap-2 mt-2 disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Spinner size="sm" className="border-t-transparent border-white" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{isLoginTab ? 'Sign In' : 'Create Account'}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
