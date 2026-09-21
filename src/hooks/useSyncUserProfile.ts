import { useEffect } from 'react';
import { useUser } from '@clerk/react';
import { supabase } from '@/lib/supabase';

export function useSyncUserProfile() {
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const syncUser = async () => {
      try {
        const primaryEmail = user.primaryEmailAddress?.emailAddress || '';
        const username = user.username || '';
        const firstName = user.firstName || '';
        const lastName = user.lastName || '';
        const avatarUrl = user.imageUrl || '';
        // If Clerk publicMetadata has role, use it; otherwise default to 'member'
        const role = (user.publicMetadata?.role as string) || 'member';

        const { error } = await supabase.from('profiles').upsert(
          {
            id: user.id,
            email: primaryEmail,
            username,
            first_name: firstName,
            last_name: lastName,
            avatar_url: avatarUrl,
            role,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

        if (error) {
          console.error('Error syncing profile to Supabase:', error.message);
        }
      } catch (err) {
        console.error('Failed to sync Clerk user to Supabase:', err);
      }
    };

    syncUser();
  }, [isLoaded, isSignedIn, user]);
}
