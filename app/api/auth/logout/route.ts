import { NextRequest, NextResponse } from 'next/server';
import { logout, verifySession } from '@/lib/auth';
import { setSecurityHeaders, getSecureCookieOptions } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (sessionToken) {
      // Verify session exists before deleting
      const user = await verifySession(sessionToken);
      if (user) {
        await logout(sessionToken);
      }
    }

    const response = setSecurityHeaders(
      NextResponse.json({ message: 'Logged out successfully' }, { status: 200 })
    );

    // Clear cookie
    response.cookies.delete('session_token');

    return response;
  } catch (error: any) {
    console.error('Logout error:', error);
    
    return setSecurityHeaders(
      NextResponse.json(
        { error: 'Logout failed' },
        { status: 500 }
      )
    );
  }
}

