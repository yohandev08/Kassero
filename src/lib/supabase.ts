// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fallback prevents app-crashing throw if env vars are missing
const validUrl =
    supabaseUrl && supabaseUrl.startsWith('http')
        ? supabaseUrl
        : 'https://placeholder.supabase.co';

const validKey = supabaseAnonKey || 'placeholder-key';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        'Supabase environment variables are missing! Check Vercel Settings > Environment Variables.'
    );
}

export const supabase = createClient(validUrl, validKey);