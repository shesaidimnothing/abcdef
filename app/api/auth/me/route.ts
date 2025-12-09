import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { setSecurityHeaders } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return setSecurityHeaders(
        NextResponse.json({ user: null }, { status: 200 })
      );
    }

    const user = await verifySession(sessionToken);

    if (!user) {
      return setSecurityHeaders(
        NextResponse.json({ user: null }, { status: 200 })
      );
    }

    return setSecurityHeaders(
      NextResponse.json(
        { user: { id: user.id, username: user.username } },
        { status: 200 }
      )
    );
  } catch (error: any) {
    console.error('Auth check error:', error);
    
    return setSecurityHeaders(
      NextResponse.json(
        { error: 'Authentication check failed' },
        { status: 500 }
      )
    );
  }
}

