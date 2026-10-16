import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserProfile, UserRole } from '@/types';

// ============================
// User & Profile Service
// Database operations for staff accounts and roles
// ============================

/**
 * Fetch the profile of a specific user by their auth ID
 */
export async function fetchUserProfile(userId: string): Promise<{ data: UserProfile | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch user profile';
    return { data: null, error: new Error(message) };
  }
}

/**
 * Ensure a profile row exists for the user (fallback for existing accounts)
 */
export async function ensureUserProfile(
  userId: string,
  email: string,
  fullName?: string
): Promise<{ data: UserProfile | null; error: Error | null }> {
  try {
    // Check if profile exists
    const { data: existing, error: fetchErr } = await fetchUserProfile(userId);
    if (fetchErr) throw fetchErr;

    if (existing) {
      return { data: existing, error: null };
    }

    // Insert new profile fallback
    const { data, error } = await supabase
      .from('profiles')
      .insert([
        {
          id: userId,
          email,
          full_name: fullName || email.split('@')[0],
          role: 'cashier',
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to ensure user profile';
    return { data: null, error: new Error(message) };
  }
}

/**
 * Fetch all profiles (used by Superadmin to manage staff)
 */
export async function fetchAllProfiles(): Promise<{ data: UserProfile[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch all profiles';
    return { data: [], error: new Error(message) };
  }
}

/**
 * Update the role of a user (Promote/Demote)
 * Requires Superadmin permissions
 */
export async function updateUserRole(
  userId: string,
  newRole: UserRole
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;
    return { error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update user role';
    return { error: new Error(message) };
  }
}

/**
 * Create a new staff account without terminating the current Superadmin session.
 * Uses an isolated, non-persisted client instance.
 */
export async function createStaffAccount(
  email: string,
  password: string,
  fullName: string,
  role: UserRole
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

    // Non-persisting client so the superadmin isn't signed out
    const isolatedClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data: signUpData, error: signUpError } = await isolatedClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) throw signUpError;
    if (!signUpData.user) throw new Error('No user created by Supabase Auth');

    const newUserId = signUpData.user.id;

    // Set their role to the requested role (e.g. cashier or admin)
    const { error: roleError } = await supabase
      .from('profiles')
      .upsert([
        {
          id: newUserId,
          email,
          full_name: fullName,
          role,
          updated_at: new Date().toISOString(),
        },
      ]);

    if (roleError) {
      console.warn('Could not set custom role immediately, profile will have default role:', roleError);
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create staff account';
    return { success: false, error: new Error(message) };
  }
}
