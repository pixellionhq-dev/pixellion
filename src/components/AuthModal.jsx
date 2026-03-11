import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import Button from './ui/Button';
import Input from './ui/Input';

export default function AuthModal({ isOpen, onClose }) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login, register } = useAuth();
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isLogin) {
                await login({ email, password });
            } else {
                await register({ email, username, password });
            }
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30 backdrop-blur-[8px] animate-fade-in">
            <div className="w-full max-w-md p-6 relative border border-white/60" style={{ borderRadius: 28, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', animation: 'fadeUp 250ms cubic-bezier(0.16,1,0.3,1) forwards' }}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/6 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition flex items-center justify-center"
                >
                    ✕
                </button>

                <h2 className="text-2xl font-bold mb-6 text-center text-[var(--color-text-primary)]">
                    {isLogin ? 'Sign In' : 'Create Account'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                                Brand Name
                            </label>
                            <Input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full h-[52px] rounded-[14px] border border-black/10 focus:ring-0 focus:border-[1.5px] focus:border-black/40"
                                placeholder="e.g. Acme Corp"
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                            Email
                        </label>
                        <Input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full h-[52px] rounded-[14px] border border-black/10 focus:ring-0 focus:border-[1.5px] focus:border-black/40"
                            placeholder="you@company.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                            Password
                        </label>
                        <Input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full h-[52px] rounded-[14px] border border-black/10 focus:ring-0 focus:border-[1.5px] focus:border-black/40"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-4 h-[52px] bg-black hover:bg-black font-medium text-base rounded-[14px] shadow-none"
                    >
                        {loading ? (
                            <span className="w-[18px] h-[18px] rounded-full border-2 border-white/30 border-t-white inline-block animate-spin" />
                        ) : isLogin ? 'Sign In' : 'Sign Up'}
                    </Button>
                </form>

                <p className="text-center text-sm text-[var(--color-text-tertiary)] mt-6">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                        type="button"
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-[var(--color-accent)] hover:underline font-medium"
                    >
                        {isLogin ? 'Sign up' : 'Sign in'}
                    </button>
                </p>
            </div>
        </div>
    );
}
