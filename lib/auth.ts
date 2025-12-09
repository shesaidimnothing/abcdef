import { query } from './db';
import { hashPassword, verifyPassword } from './encryption';
import crypto from 'crypto';

export interface User {
  id: number;
  username: string;
  created_at: Date;
}

export interface Session {
  id: number;
  user_id: number;
  session_token: string;
  expires_at: Date;
}

// Session duration: 24 hours
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generate a secure random session token
 */
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new user account
 */
export async function createUser(
  username: string,
  password: string
): Promise<User> {
  // Validate input
  if (!username || username.length < 3 || username.length > 255) {
    throw new Error('Username must be between 3 and 255 characters');
  }

  if (!password || password.length < 12) {
    throw new Error('Password must be at least 12 characters long');
  }

  // Allow base64 characters for 128-character credentials
  // Check for SQL injection patterns (additional layer of security)
  // Allow base64 characters: A-Z, a-z, 0-9, +, /, =
  if (!/^[A-Za-z0-9+/=]+$/.test(username)) {
    throw new Error('Invalid characters in username');
  }

  // Check if user already exists
  const existingUser = await query(
    'SELECT id FROM users WHERE username = $1',
    [username]
  );

  if (existingUser.rows.length > 0) {
    throw new Error('Username already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const result = await query(
    `INSERT INTO users (username, password_hash) 
     VALUES ($1, $2) 
     RETURNING id, username, created_at`,
    [username, passwordHash]
  );

  return result.rows[0];
}

/**
 * Authenticate user and create session
 */
export async function login(
  username: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ user: User; sessionToken: string }> {
  // Get user
  const userResult = await query(
    `SELECT id, username, password_hash, failed_login_attempts, locked_until, created_at
     FROM users WHERE username = $1`,
    [username]
  );

  if (userResult.rows.length === 0) {
    // Don't reveal if user exists (security best practice)
    throw new Error('Invalid credentials');
  }

  const user = userResult.rows[0];

  // Check if account is locked
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const lockoutTime = Math.ceil(
      (new Date(user.locked_until).getTime() - Date.now()) / 1000 / 60
    );
    throw new Error(
      `Account is locked. Please try again in ${lockoutTime} minutes.`
    );
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash);

  if (!isValid) {
    // Increment failed login attempts
    const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
    const shouldLock = newFailedAttempts >= MAX_FAILED_ATTEMPTS;
    const lockedUntil = shouldLock
      ? new Date(Date.now() + LOCKOUT_DURATION_MS)
      : null;

    await query(
      `UPDATE users 
       SET failed_login_attempts = $1, locked_until = $2 
       WHERE id = $3`,
      [newFailedAttempts, lockedUntil, user.id]
    );

    throw new Error('Invalid credentials');
  }

  // Reset failed login attempts on successful login
  await query(
    `UPDATE users 
     SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW() 
     WHERE id = $1`,
    [user.id]
  );

  // Create session
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await query(
    `INSERT INTO sessions (user_id, session_token, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, sessionToken, expiresAt, ipAddress || null, userAgent || null]
  );

  return {
    user: {
      id: user.id,
      username: user.username,
      created_at: user.created_at,
    },
    sessionToken,
  };
}

/**
 * Verify session token and get user
 */
export async function verifySession(
  sessionToken: string
): Promise<User | null> {
  if (!sessionToken) {
    return null;
  }

  const result = await query(
    `SELECT u.id, u.username, u.created_at, s.expires_at
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.session_token = $1 AND s.expires_at > NOW()`,
    [sessionToken]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    id: result.rows[0].id,
    username: result.rows[0].username,
    created_at: result.rows[0].created_at,
  };
}

/**
 * Logout - invalidate session
 */
export async function logout(sessionToken: string): Promise<void> {
  await query('DELETE FROM sessions WHERE session_token = $1', [sessionToken]);
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<void> {
  await query('DELETE FROM sessions WHERE expires_at < NOW()');
}

