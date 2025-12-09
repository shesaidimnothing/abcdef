# Secure Code Vault

A secure, encrypted code storage system with syntax highlighting. Single-user system with automatic user creation.

## Quick Start

1. **Set up environment variables:**
   Copy `.env.example` to `.env.local` and fill in your values:
   ```bash
   cp .env.example .env.local
   ```
   
   Required variables:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `ENCRYPTION_KEY`: At least 32 characters (generate with `openssl rand -base64 32`)
   - `DEFAULT_USERNAME`: 128-character username for the single user account
   - `DEFAULT_PASSWORD`: 128-character password for the single user account

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Initialize database and create user:**
   ```bash
   npm run dev
   ```
   Then call:
   ```bash
   curl -X POST http://localhost:3000/api/init
   ```
   The user is automatically created using `DEFAULT_USERNAME` and `DEFAULT_PASSWORD` from your `.env.local` file.

4. **Login:**
   Use the `DEFAULT_USERNAME` and `DEFAULT_PASSWORD` from your `.env.local` file to login.

## Features

- 🔐 AES-256 encryption for all stored content
- 🎨 Automatic code syntax highlighting
- 📝 IDE-like code editor with formatting preservation
- 🛡️ Secure authentication and session management
- ⚡ Rate limiting and security headers

## Security

- All content is encrypted before storage
- Secure password hashing (bcrypt)
- Session-based authentication
- Rate limiting on all endpoints
- SQL injection prevention
- XSS protection

