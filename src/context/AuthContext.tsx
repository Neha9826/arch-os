'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// A signed-in session expires 24 hours after the last successful authentication.
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

const AuthContext = createContext<{ user: User | null; loading: boolean }>({
  user: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const lastSignIn = currentUser.metadata.lastSignInTime
        ? new Date(currentUser.metadata.lastSignInTime).getTime()
        : Number.NaN;
      const expired = !Number.isFinite(lastSignIn) || Date.now() - lastSignIn >= MAX_SESSION_AGE_MS;

      if (expired) {
        try {
          await signOut(auth);
        } finally {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
