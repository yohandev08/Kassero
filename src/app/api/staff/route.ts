import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing.' },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing session token.' },
        { status: 401 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify caller's identity and privileges
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !caller) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid authentication session.' },
        { status: 401 }
      );
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    const allowedRoles = ['admin', 'superadmin'];
    if (!callerProfile || !allowedRoles.includes(callerProfile.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can create staff accounts.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, password, fullName, role } = body;

    if (!email || !password || !fullName || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, full name, or role.' },
        { status: 400 }
      );
    }

    // Provision staff account with email pre-confirmed
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
      },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    if (!created.user) {
      return NextResponse.json({ error: 'Failed to create user in Supabase Auth.' }, { status: 500 });
    }

    // Set role and details in profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: created.user.id,
        email,
        full_name: fullName,
        role,
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error('Failed to set profile role:', profileError);
    }

    return NextResponse.json({ success: true, user: created.user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
