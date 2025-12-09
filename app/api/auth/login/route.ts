import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/lib/auth';
import { rateLimit, setSecurityHeaders, sanitizeInput, getClientIP, getSecureCookieOptions } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    // Stricter rate limiting for login
    const rateLimitResult = rateLimit(request, 5, 15 * 60 * 1000); // 5 attempts per 15 minutes
    if (!rateLimitResult.allowed) {
      return setSecurityHeaders(
        NextResponse.json(
          { error: 'Too many login attempts. Please try again later.' },
          { status: 429 }
        )
      );
    }

    const body = await request.json();
    const { username, password } = body;

    // Validate input
    if (!username || !password) {
      return setSecurityHeaders(
        NextResponse.json(
          { error: 'Username and password are required' },
          { status: 400 }
        )
      );
    }

    // Sanitize username (allow up to 255 characters for 128-char credentials)
    const sanitizedUsername = sanitizeInput(username, 255);

    // Get client info
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    // Attempt login
    const { user, sessionToken } = await login(
      sanitizedUsername,
      password,
      ipAddress,
      userAgent
    );

    // Create response
    const response = setSecurityHeaders(
      NextResponse.json(
        { message: 'Login successful', user: { id: user.id, username: user.username } },
        { status: 200 }
      )
    );

    // Set secure cookie
    const cookieOptions = getSecureCookieOptions();
    response.cookies.set('session_token', sessionToken, cookieOptions);

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    
    // Generic error message (don't reveal if user exists)
    return setSecurityHeaders(
      NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    );
  }
}

