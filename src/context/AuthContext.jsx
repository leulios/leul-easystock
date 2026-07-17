import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const lastUserIdRef = useRef(null);

    async function fetchProfile(userId) {
        if (!userId || userId === lastUserIdRef.current) return;
        lastUserIdRef.current = userId;
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        setProfile(data);

        // Fetch the shop linked to this profile
        if (data?.shop_id) {
            const { data: shopData } = await supabase
                .from('shops')
                .select('*')
                .eq('id', data.shop_id)
                .single();
            setShop(shopData ?? null);
        } else {
            setShop(null);
        }
    }

    useEffect(() => {
        // Safety net: never hang on loading longer than 6 seconds
        const timeout = setTimeout(() => setLoading(false), 6000);

        // Eagerly resolve the session so the app never gets stuck on loading
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            clearTimeout(timeout);
            setUser(session?.user ?? null);
            if (session?.user) {
                await fetchProfile(session.user.id);
            } else {
                setProfile(null);
                setShop(null);
            }
            setLoading(false);
        }).catch(() => {
            clearTimeout(timeout);
            setLoading(false);
        });

        // Subscribe to future auth changes (login / logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const newUser = session?.user ?? null;
            setUser(newUser);
            if (newUser) {
                await fetchProfile(newUser.id);
            } else {
                lastUserIdRef.current = null;
                setProfile(null);
                setShop(null);
            }
            // Only clear loading if it's still true (first call handled above)
            setLoading(false);
        });

        return () => { clearTimeout(timeout); subscription.unsubscribe(); };
    }, []);

    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        return { data, error };
    };

    const signOut = async () => {
        lastUserIdRef.current = null;
        await supabase.auth.signOut();
    };

    // Role helpers (derived from profile)
    const activeRole = profile?.role || (user ? 'owner' : null); // Fallback to owner if profile isn't loaded yet, though normally we'd wait for profile
    const isOwner = activeRole === 'owner';
    const isAdmin = isOwner;
    const isManager = activeRole === 'owner' || activeRole === 'manager';
    const isStaff = ['owner', 'manager', 'shopkeeper'].includes(activeRole);

    return (
        <AuthContext.Provider value={{ user, profile, shop, loading, signIn, signOut, isOwner, isAdmin, isManager, isStaff }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
