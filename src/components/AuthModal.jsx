import { useState } from 'react';
import Button from './ui/Button';
import Input from './ui/Input';
import { supabase } from '../utils/supabase';

export default function AuthModal({ isOpen, onClose }) {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: window.location.origin
                }
            });
            
            if (error) throw error;
            
            setMessage('Check your email to continue');
        } catch (err) {
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: window.location.origin
                }
            });
            if (error) throw error;
        } catch (err) {
            setError(err.message || 'Google login failed');
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
            <div
                className="w-full max-w-md p-8 relative border border-white/60"
                style={{ borderRadius: 28, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', animation: 'fadeUp 250ms cubic-bezier(0.16,1,0.3,1) forwards' }}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/6 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition flex items-center justify-center text-lg"
                >
                    ×
                </button>

                <h2 className="text-2xl font-bold mb-2 text-center text-[var(--color-text-primary)]">
                    Sign In
                </h2>
                <p className="text-sm text-center text-[var(--color-text-tertiary)] mb-8">
                    Choose how you'd like to continue
                </p>

                <form onSubmit={handleEmailLogin} className="space-y-3 mb-4">
                    <Input
                        type="email"
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-[52px] rounded-[14px] border border-black/10"
                        placeholder="you@company.com"
                    />
                    <button
                        type="submit"
                        disabled={loading || !email.trim()}
                        className="w-full h-[52px] flex items-center justify-center gap-3 rounded-[14px] border border-black/10 bg-white hover:bg-black/[0.03] font-medium text-[var(--color-text-primary)] text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black inline-block animate-spin" /> : 'Continue with Email'}
                    </button>
                </form>

                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-black/8" /></div>
                    <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-[var(--color-text-tertiary)]">or</span></div>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full h-[52px] flex items-center justify-center gap-3 rounded-[14px] border border-black/10 bg-white hover:bg-black/[0.03] font-medium text-[var(--color-text-primary)] text-sm transition-colors disabled:opacity-50"
                    >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                        </svg>
                        Continue with Google
                    </button>
                </div>

                {message && <p className="text-green-600 text-sm mt-4 text-center">{message}</p>}
                {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
            </div>
        </div>
    );
}
