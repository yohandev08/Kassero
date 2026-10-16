'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserProfile, UserRole } from '@/types';
import { ensureUserProfile, fetchUserProfile } from '@/services/user.Service';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isCashier: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Load and sync profile for a given user
  const loadProfile = useCallback(async (currentUser: User) => {
    try {
      const email = currentUser.email || '';
      const fullName = currentUser.user_metadata?.full_name;

      const { data, error } = await ensureUserProfile(currentUser.id, email, fullName);
      if (!error && data) {
        setProfile(data);
      } else {
        // Fallback profile if table is not yet migrated
        setProfile({
          id: currentUser.id,
          email,
          full_name: fullName || email.split('@')[0],
          role: 'cashier',
        });
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
      // Safe fallback
      setProfile({
        id: currentUser.id,
        email: currentUser.email || '',
        full_name: currentUser.email?.split('@')[0] || 'User',
        role: 'cashier',
      });
    }
  }, []);

  // Refresh profile on demand (e.g. after role update)
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await fetchUserProfile(user.id);
    if (data) {
      setProfile(data);
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;

    // 1. Initial session fetch
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        loadProfile(initialSession.user).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // 2. Auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        await loadProfile(newSession.user);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  const role = profile?.role ?? null;
  const isSuperAdmin = role === 'superadmin';
  const isAdmin = role === 'admin' || isSuperAdmin;
  const isCashier = role === 'cashier';

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        role,
        isSuperAdmin,
        isAdmin,
        isCashier,
        loading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
