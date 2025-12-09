import { NextRequest, NextResponse } from 'next/server';

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 100;
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Get client IP address
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

/**
 * Rate limiting middleware
 */
export function rateLimit(
  request: NextRequest,
  maxRequests: number = MAX_REQUESTS_PER_WINDOW,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): { allowed: boolean; remaining: number; resetTime: number } {
  const ip = getClientIP(request);
  const now = Date.now();
  
  const record = rateLimitStore.get(ip);
  
  if (!record || now > record.resetTime) {
    // Create new record
    const newRecord = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(ip, newRecord);
    
    // Clean up old records periodically
    if (rateLimitStore.size > 10000) {
      for (const [key, value] of rateLimitStore.entries()) {
        if (now > value.resetTime) {
          rateLimitStore.delete(key);
        }
      }
    }
    
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: newRecord.resetTime,
    };
  }
  
  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }
  
  record.count++;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * Validate and sanitize input
 */
export function sanitizeInput(input: string, maxLength: number = 10000): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input');
  }
  
  if (input.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
  }
  
  // Remove null bytes and other dangerous control characters
  // BUT preserve newlines (\n), carriage returns (\r), and tabs (\t) for code formatting
  let sanitized = input
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control chars except \n, \r, \t
  
  // Don't trim - preserve leading/trailing whitespace for code
  // Only trim if it's completely empty after sanitization
  if (sanitized.trim().length === 0 && input.trim().length > 0) {
    sanitized = input; // Fallback to original if we removed everything
  }
  
  return sanitized;
}

/**
 * Validate username
 */
export function validateUsername(username: string): boolean {
  if (!username || typeof username !== 'string') {
    return false;
  }
  
  // Username: 3-255 characters, base64 characters allowed for 128-char credentials
  const usernameRegex = /^[A-Za-z0-9+/=]{3,255}$/;
  return usernameRegex.test(username);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!password || password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }
  
  if (password.length > 255) {
    errors.push('Password must be less than 255 characters');
  }
  
  // For 128-character base64 passwords, skip character type requirements
  if (password.length < 128) {
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Set secure HTTP headers
 */
export function setSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // XSS protection
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Strict transport security (HTTPS only)
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self';"
  );
  
  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  );
  
  return response;
}

/**
 * Create secure cookie options
 */
export function getSecureCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
  path: string;
} {
  return {
    httpOnly: true, // Prevent JavaScript access
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict', // CSRF protection
    maxAge: 24 * 60 * 60, // 24 hours
    path: '/',
  };
}

