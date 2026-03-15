import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabase';
import Button from './ui/Button';
import Input from './ui/Input';

export default function AuthModal({ isOpen, onClose }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);
    const [supabaseMode, setSupabaseMode] = useState('options'); // 'options' | 'email' | 'password'
    const [otpSent, setOtpSent] = useState(false);
    const [otpCode, setOtpCode] = useState('');

    if (!isOpen) return null;

    const handleGoogle = async () => {
        setError('');
        setLoading(true);
        try {
            await supabase.auth.signOut();
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin },
            });
            if (error) throw error;
        } catch (err) {
            setError(err.message || 'Google login failed');
            setLoading(false);
        }
    };

    const handleEmailOtp = async () => {
        setError('');
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: { shouldCreateUser: true },
            });
            if (error) throw error;
            setOtpSent(true);
            setOtpCode('');
        } catch (err) {
            setError(err.message || 'Email OTP failed');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        setError('');
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.verifyOtp({
                email,
                token: otpCode,
                type: 'email',
            });
            if (error) throw error;
            const accessToken = data.session?.access_token;
            if (!accessToken) throw new Error('No session after OTP verify');
            const res = await fetch('/api/auth/supabase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ supabase_token: accessToken }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.message || 'Backend auth failed');
            }
            onClose();
        } catch (err) {
            setError(err.message || 'Sign in failed');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login({ email, password });
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Authentication failed');
        } finally {
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

                {/* Main auth options */}
                {supabaseMode === 'options' && (
                    <div className="space-y-3">
                        <button
                            onClick={handleGoogle}
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
                        <button
                            onClick={() => setSupabaseMode('email')}
                            disabled={loading}
                            className="w-full h-[52px] flex items-center justify-center gap-3 rounded-[14px] border border-black/10 bg-white hover:bg-black/[0.03] font-medium text-[var(--color-text-primary)] text-sm transition-colors"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                            </svg>
                            Continue with Email
                        </button>
                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-black/8" /></div>
                            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-[var(--color-text-tertiary)]">or</span></div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSupabaseMode('password')}
                            className="w-full text-center text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                            Sign in with password
                        </button>
                    </div>
                )}

                {/* Email OTP — enter email */}
                {supabaseMode === 'email' && !otpSent && (
                    <div className="space-y-3">
                        <button onClick={() => setSupabaseMode('options')} className="flex items-center gap-1 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] mb-2 transition-colors">
                            ← Back
                        </button>
                        <Input
                            type="email"
                            autoFocus
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full h-[52px] rounded-[14px] border border-black/10"
                            placeholder="you@company.com"
                        />
                        <Button
                            onClick={handleEmailOtp}
                            disabled={loading || !email}
                            className="w-full h-[52px] bg-black text-white font-medium text-sm rounded-[14px] shadow-none"
                        >
                            {loading ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white inline-block animate-spin" /> : 'Send code'}
                        </Button>
                    </div>
                )}

                {/* Email OTP — enter 6-digit code */}
                {supabaseMode === 'email' && otpSent && (
                    <div className="space-y-4">
                        <button onClick={() => { setOtpSent(false); setOtpCode(''); }} className="flex items-center gap-1 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">
                            ← Back
                        </button>
                        <div className="text-center">
                            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                                </svg>
                            </div>
                            <p className="font-semibold text-[var(--color-text-primary)] text-sm">Check your email</p>
                            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">We sent a 6-digit code to <strong>{email}</strong></p>
                        </div>
                        <Input
                            type="text"
                            autoFocus
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="w-full h-[52px] rounded-[14px] border border-black/10 text-center text-2xl tracking-[0.5em] font-mono"
                            placeholder="000000"
                            maxLength={6}
                            inputMode="numeric"
                        />
                        <Button
                            onClick={handleVerifyOtp}
                            disabled={loading || otpCode.length !== 6}
                            className="w-full h-[52px] bg-black text-white font-medium text-sm rounded-[14px] shadow-none"
                        >
                            {loading ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white inline-block animate-spin" /> : 'Verify & Sign In'}
                        </Button>
                        <button onClick={handleEmailOtp} disabled={loading} className="w-full text-center text-xs text-[var(--color-text-tertiary)] hover:underline disabled:opacity-50">
                            Resend code
                        </button>
                    </div>
                )}

                {/* Password login */}
                {supabaseMode === 'password' && (
                    <form onSubmit={handlePasswordLogin} className="space-y-3">
                        <button type="button" onClick={() => setSupabaseMode('options')} className="flex items-center gap-1 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] mb-2 transition-colors">
                            ← Back
                        </button>
                        <Input
                            type="email"
                            autoFocus
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full h-[52px] rounded-[14px] border border-black/10"
                            placeholder="you@company.com"
                        />
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full h-[52px] rounded-[14px] border border-black/10"
                            placeholder="••••••••"
                        />
                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-[52px] bg-black text-white font-medium text-sm rounded-[14px] shadow-none"
                        >
                            {loading ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white inline-block animate-spin" /> : 'Sign In'}
                        </Button>
                    </form>
                )}

                {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
            </div>
        </div>
    );
}
