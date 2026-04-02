import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import Button from './ui/Button';
import Input from './ui/Input';

export default function AuthModal({ isOpen, onClose }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login, reloadAuth } = useAuth();
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handlePasswordLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login({ email, password });
            await reloadAuth();
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
                    Enter your credentials to continue
                </p>

                <form onSubmit={handlePasswordLogin} className="space-y-3">
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

                {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
            </div>
        </div>
    );
}
