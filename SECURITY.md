# Security Implementation Details

This document outlines all security measures implemented in the Secure Text Vault.

## 🔐 Encryption

### Data Encryption
- **Algorithm**: AES-256-CBC
- **Key Management**: Encryption key stored in environment variable, separate from database
- **IV (Initialization Vector)**: Unique random IV generated for each text
- **Storage**: Encrypted text and IV stored separately in database
- **Key Length**: Minimum 32 characters (256 bits)

### Password Hashing
- **Algorithm**: bcrypt
- **Salt Rounds**: 12 (high cost factor for security)
- **Storage**: Only hashes stored, never plaintext passwords

## 🛡️ Authentication & Authorization

### User Authentication
- Session-based authentication using secure HTTP-only cookies
- Session tokens: 32-byte cryptographically random hex strings
- Session duration: 24 hours
- Session storage: Database with expiration tracking
- IP address and user agent tracking for sessions

### Password Requirements
- Minimum length: 12 characters
- Maximum length: 128 characters
- Must contain:
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character

### Account Protection
- Account lockout after 5 failed login attempts
- Lockout duration: 15 minutes
- Failed attempt counter resets on successful login
- Generic error messages (don't reveal if user exists)

### Username Validation
- Length: 3-50 characters
- Allowed characters: alphanumeric and underscore only
- Prevents SQL injection patterns

## 🚫 SQL Injection Prevention

### Parameterized Queries
- All database queries use parameterized statements
- No string concatenation in SQL queries
- PostgreSQL parameter binding ($1, $2, etc.)

### Input Validation
- All user inputs validated before database operations
- Type checking and length limits
- Character filtering for dangerous patterns

## 🌐 Network Security

### HTTPS Enforcement
- SSL/TLS required for database connections
- Secure cookies in production (HTTPS only)
- HSTS header for browser enforcement

### Security Headers
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - XSS protection
- `Strict-Transport-Security` - HSTS enforcement
- `Content-Security-Policy` - Restricts resource loading
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` - Restricts browser features

### CSRF Protection
- SameSite=strict cookies
- Session tokens in HTTP-only cookies
- No CSRF tokens needed (SameSite provides protection)

## ⚡ Rate Limiting

### General Endpoints
- Limit: 100 requests per 15 minutes per IP
- Applies to: All API endpoints
- Response: 429 Too Many Requests

### Authentication Endpoints
- Limit: 5 requests per 15 minutes per IP
- Applies to: Login, registration
- Prevents brute force attacks

### Implementation
- In-memory store (development)
- **Production Recommendation**: Use Redis for distributed rate limiting

## 🔍 Input Sanitization

### Text Content
- Maximum length: 1MB (1,000,000 characters)
- Null byte removal
- Control character filtering
- Whitespace trimming

### Username
- Pattern validation: `/^[a-zA-Z0-9_]{3,50}$/`
- SQL injection pattern detection
- Length limits enforced

### Password
- Strength validation
- Length limits (12-128 characters)
- Character set validation

## 🗄️ Database Security

### Connection Security
- SSL/TLS required (sslmode=require)
- Connection pooling with limits
- Timeout handling
- Error logging without exposing sensitive data

### Schema Security
- Foreign key constraints with CASCADE deletion
- Indexed queries for performance
- Timestamp tracking
- Automatic cleanup of expired sessions

### Access Control
- User-specific data isolation
- All queries filtered by user_id
- No cross-user data access possible

## 📊 Session Management

### Session Storage
- Sessions stored in database
- Automatic expiration (24 hours)
- Cleanup of expired sessions
- IP address and user agent tracking

### Session Security
- HTTP-only cookies (JavaScript cannot access)
- Secure flag in production (HTTPS only)
- SameSite=strict (CSRF protection)
- Cryptographically random tokens

## 🚨 Error Handling

### Security-First Error Messages
- Generic error messages for authentication failures
- No user enumeration (don't reveal if user exists)
- No stack traces in production
- Logging without exposing sensitive data

### Input Validation Errors
- Specific validation errors for user feedback
- No internal error details exposed
- Sanitized error messages

## 🔄 Data Integrity

### Referential Integrity
- Foreign key constraints
- CASCADE deletion (user deletion removes all texts)
- Database-level constraints

### Data Validation
- Type checking
- Length validation
- Pattern matching
- Sanitization before storage

## 📝 Logging & Monitoring

### Security Events Logged
- Failed login attempts
- Account lockouts
- Slow database queries
- Authentication errors

### What's NOT Logged
- Passwords (never logged)
- Encryption keys (never logged)
- Decrypted text content (only encrypted stored)
- Session tokens (only in database)

## ⚠️ Known Limitations & Recommendations

### Current Limitations
1. **Rate Limiting**: In-memory (not distributed)
   - **Recommendation**: Use Redis for production
   
2. **Session Storage**: Database (can be slow at scale)
   - **Recommendation**: Use Redis for session storage
   
3. **Encryption Key**: Single key for all data
   - **Recommendation**: Consider key rotation strategy
   
4. **No 2FA**: Single-factor authentication only
   - **Recommendation**: Add TOTP-based 2FA

### Production Recommendations
1. Use a managed database with automatic backups
2. Implement Redis for rate limiting and sessions
3. Set up monitoring and alerting
4. Regular security audits
5. Key rotation strategy
6. Automated security scanning
7. DDoS protection (Cloudflare, etc.)
8. Regular dependency updates

## 🧪 Security Testing

### Recommended Tests
1. **SQL Injection**: Try `' OR '1'='1` in inputs
2. **XSS**: Try `<script>alert('XSS')</script>` in text content
3. **Rate Limiting**: Make 100+ rapid requests
4. **Authentication**: Access protected endpoints without login
5. **Authorization**: Try accessing another user's texts
6. **Password Strength**: Try weak passwords
7. **Session Hijacking**: Try using expired/invalid tokens

## 📚 Security Standards Compliance

This implementation follows:
- OWASP Top 10 security practices
- NIST password guidelines
- PCI DSS data encryption standards
- GDPR data protection principles (encryption at rest)

---

**Last Updated**: Initial implementation
**Security Review**: Recommended before production deployment

