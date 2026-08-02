import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const AuthContext = createContext({});

// ─── Simple API helpers ────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  return res.json();
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [shop, setShop]       = useState(null);
  const [loading, setLoading] = useState(true);
  const lastIdRef             = useRef(null);

  // ── Fetch full profile + shop after we know who's logged in ─────────────────
  const loadProfileAndShop = useCallback(async (loggedInUser) => {
    if (!loggedInUser || loggedInUser.id === lastIdRef.current) return;
    lastIdRef.current = loggedInUser.id;

    try {
      // Profile is embedded in user object from our API
      const profileData = loggedInUser;
      setProfile(profileData);

      // Fetch shop separately using shop_id
      if (loggedInUser.shopId || loggedInUser.shop_id) {
        const shopId = loggedInUser.shopId || loggedInUser.shop_id;
        const res = await apiFetch(`/api/db?table=shops&id=${shopId}`);
        setShop(res.data ?? null);
      } else {
        setShop(null);
      }
    } catch {
      setProfile(loggedInUser);
      setShop(null);
    }
  }, []);

  // ── On mount: check if session already exists ───────────────────────────────
  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 6000); // safety net

    apiFetch('/api/auth?action=me')
      .then(async (res) => {
        clearTimeout(timeout);
        if (res.user) {
          setUser(res.user);
          await loadProfileAndShop(res.user);
        } else {
          setUser(null);
          setProfile(null);
          setShop(null);
        }
      })
      .catch(() => {
        clearTimeout(timeout);
      })
      .finally(() => setLoading(false));

    return () => clearTimeout(timeout);
  }, [loadProfileAndShop]);

  // ── signIn ──────────────────────────────────────────────────────────────────
  const signIn = async (email, password) => {
    try {
      const res = await apiFetch('/api/auth?action=login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (res.error) return { data: null, error: new Error(res.error) };

      setUser(res.user);
      lastIdRef.current = null; // allow re-fetch
      await loadProfileAndShop(res.user);
      return { data: { user: res.user }, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  };

  // ── signOut ─────────────────────────────────────────────────────────────────
  const signOut = async () => {
    await apiFetch('/api/auth?action=logout', { method: 'POST' });
    setUser(null);
    setProfile(null);
    setShop(null);
    lastIdRef.current = null;
  };

  // ── Role helpers ─────────────────────────────────────────────────────────────
  const activeRole  = profile?.role ?? (user ? 'owner' : null);
  const isOwner     = activeRole === 'owner';
  const isAdmin     = isOwner;
  const isManager   = activeRole === 'owner' || activeRole === 'manager';
  const isStaff     = ['owner', 'manager', 'shopkeeper'].includes(activeRole);

  return (
    <AuthContext.Provider value={{ user, profile, shop, loading, signIn, signOut, isOwner, isAdmin, isManager, isStaff }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
