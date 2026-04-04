import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { apiClient } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        let mounted = true;

        const exchangeTokenAndFetchUser = async (supabaseAccessToken) => {
            if (!supabaseAccessToken || isSyncing) return;

            setIsSyncing(true);

            try {
                // 🔥 STEP 1: Send Supabase token to backend
                const res = await apiClient.post("/auth/supabase", {
                    access_token: supabaseAccessToken
                });

                console.log("BACKEND RESPONSE:", res.data);

                // 🔥 STEP 2: ONLY use access_token (NO fallback)
                const token = res.data?.data?.access_token || res.data?.access_token;

                if (!token) {
                    console.error("❌ No backend token received");
                    return;
                }

                // 🔥 STEP 3: Store backend JWT
                localStorage.setItem("token", token);

                console.log("✅ STORED TOKEN:", localStorage.getItem("token"));

                // 🔥 STEP 4: Fetch user using backend JWT
                const meRes = await apiClient.get("/auth/me");

                console.log("✅ USER DATA:", meRes.data);

                if (mounted) setUser(meRes.data);

            } catch (err) {
                console.error("❌ Backend sync failed:", err);
                localStorage.removeItem("token");
                if (mounted) setUser(null);
            } finally {
                setIsSyncing(false);
            }
        };

        const initAuth = async () => {
            const { data } = await supabase.auth.getSession();

            if (data?.session?.access_token) {
                await exchangeTokenAndFetchUser(data.session.access_token);
            } else {
                localStorage.removeItem("token");
                if (mounted) setUser(null);
            }
        };

        initAuth();

        const { data: listener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log("AUTH EVENT:", event);

                if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
                    await exchangeTokenAndFetchUser(session.access_token);
                } else if (!session || event === 'SIGNED_OUT') {
                    localStorage.removeItem("token");
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
        localStorage.removeItem("token");
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