import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { apiClient } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const initAuth = async () => {
            const { data } = await supabase.auth.getSession();
            if (data?.session) {
                // Immediately hydrate UI with Supabase session to prevent "Sign In" flashing
                setUser(data.session.user);
                syncBackend(data.session.access_token);
            }
        };

        const syncBackend = async (access_token) => {
            try {
                // Exchange Supabase token for Backend JWT
                const res = await apiClient.post("/auth/supabase", { access_token });
                const token = res.data.access_token || res.data.token;
                if (!token) return;

                localStorage.setItem("token", token);
                
                // Fetch the fully formed user from the backend (with buyer details, colors, etc.)
                const meRes = await apiClient.get("/auth/me");
                setUser(prev => ({ ...prev, ...meRes.data }));
            } catch (err) {
                console.error("Backend sync failed:", err);
            }
        };

        initAuth();

        const { data: listener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (session) {
                    // Instantly sync Supabase user object into the UI State on login!
                    setUser(session.user);
                    if (event === 'SIGNED_IN') {
                        syncBackend(session.access_token);
                    }
                } else {
                    setUser(null);
                    localStorage.removeItem('token');
                }
            }
        );

        return () => {
            listener.subscription.unsubscribe();
        };
    }, []);

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        localStorage.removeItem('token');
    };

    return (
        <AuthContext.Provider value={{ user, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
