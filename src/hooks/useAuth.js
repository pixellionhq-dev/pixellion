import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { apiClient } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);

    useEffect(() => {
        let mounted = true;

        const exchangeTokenAndFetchUser = async (supabaseAccessToken) => {
            try {
                // 1. Send Supabase token to backend
                const res = await apiClient.post("/auth/supabase", { 
                    access_token: supabaseAccessToken 
                });
                
                const token = res.data.access_token || res.data.token;
                if (!token) return;

                // 2. MUST store backend JWT (localStorage)
                localStorage.setItem("token", token);
                
                // 3. fetch /auth/me strictly via backend JWT
                const meRes = await apiClient.get("/auth/me");
                if (mounted) setUser(meRes.data);
            } catch (err) {
                console.error("Backend sync failed:", err);
                localStorage.removeItem("token");
                if (mounted) setUser(null);
            }
        };

        const initAuth = async () => {
            const { data } = await supabase.auth.getSession();
            if (data?.session) {
                // Only act on Backend JWT flow
                await exchangeTokenAndFetchUser(data.session.access_token);
            } else {
                localStorage.removeItem("token");
                if (mounted) setUser(null);
            }
        };

        initAuth();

        const { data: listener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (session && event === 'SIGNED_IN') {
                    // Always exchange it for backend JWT
                    await exchangeTokenAndFetchUser(session.access_token);
                } else if (!session || event === 'SIGNED_OUT') {
                    localStorage.removeItem('token');
                    if (mounted) setUser(null);
                }
            }
        );

        return () => {
            mounted = false;
            listener.subscription.unsubscribe();
        };
    }, []);

    const logout = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('token');
        setUser(null);
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
