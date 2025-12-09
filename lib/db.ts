import { Pool, QueryResult, QueryResultRow } from 'pg';

// Parse connection string and configure SSL for Neon
const getPoolConfig = () => {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  // For Neon databases, we need to handle SSL properly
  const isNeon = connectionString.includes('neon.tech');
  const requiresSSL = connectionString.includes('sslmode=require');
  
  return {
    connectionString,
    ssl: requiresSSL || isNeon ? {
      rejectUnauthorized: false, // Neon uses valid certificates but we allow for compatibility
    } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000, // Increased timeout for Neon
    // Additional options for Neon
    ...(isNeon && {
      statement_timeout: 30000,
    }),
  };
};

// Secure database connection pool
const pool = new Pool(getPoolConfig());

// Prevent connection leaks
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit in development - just log
  if (process.env.NODE_ENV === 'production') {
    process.exit(-1);
  }
});

// Secure query function with parameterized queries (prevents SQL injection)
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    // Log slow queries in production
    if (duration > 1000) {
      console.warn('Slow query detected', { text, duration });
    }
    return res;
  } catch (error: any) {
    console.error('Database query error:', error);
    
    // Provide more detailed error information
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error code:', (error as any).code);
    }
    
    // If it's an AggregateError, log all errors
    if (error.name === 'AggregateError' && error.errors) {
      console.error('AggregateError details:');
      error.errors.forEach((err: any, index: number) => {
        console.error(`  Error ${index + 1}:`, err.message || err);
      });
    }
    
    throw error;
  }
}

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as current_time');
    console.log('Database connection successful. Current time:', result.rows[0].current_time);
    return true;
  } catch (error: any) {
    console.error('Database connection test failed:', error.message);
    if (error.name === 'AggregateError' && error.errors) {
      console.error('Connection errors:');
      error.errors.forEach((err: any, index: number) => {
        console.error(`  ${index + 1}. ${err.message || err}`);
      });
    }
    return false;
  }
}

// Initialize database schema and create user
export async function initDatabase() {
  try {
    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set. Please check your .env.local file.');
    }
    
    console.log('Testing database connection...');
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database. Please check your DATABASE_URL and network connection.');
    }
    
    console.log('Creating database schema...');
    // Create users table with secure password storage
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP
      )
    `);

    // Create encrypted_texts table
    await query(`
      CREATE TABLE IF NOT EXISTS encrypted_texts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        encrypted_content TEXT NOT NULL,
        iv VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_encrypted_texts_user_id 
      ON encrypted_texts(user_id)
    `);

    // Create sessions table for secure session management
    await query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for session lookups
    await query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_token 
      ON sessions(session_token)
    `);

    // Clean up expired sessions periodically
    await query(`
      DELETE FROM sessions WHERE expires_at < NOW()
    `);

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users LIMIT 1');
    
    if (existingUser.rows.length === 0) {
      // Create the single user with credentials from environment variables
      const username = process.env.DEFAULT_USERNAME;
      const password = process.env.DEFAULT_PASSWORD;
      
      if (!username || !password) {
        console.warn('DEFAULT_USERNAME and DEFAULT_PASSWORD not set. User will not be created automatically.');
        console.warn('Please set these environment variables and call /api/init again to create the user.');
        return;
      }
      
      try {
        // Hash password directly to avoid validation issues
        const { hashPassword } = await import('./encryption');
        const passwordHash = await hashPassword(password);
        
        // Insert user directly
        await query(
          `INSERT INTO users (username, password_hash) 
           VALUES ($1, $2) 
           RETURNING id, username, created_at`,
          [username, passwordHash]
        );
        console.log('User created successfully');
      } catch (userError: any) {
        console.error('Error creating user:', userError);
        // If user creation fails but tables exist, that's okay
        // Don't throw - database is still initialized
        if (userError.message?.includes('already exists')) {
          console.log('User already exists, skipping creation');
        } else {
          throw userError;
        }
      }
    } else {
      console.log('User already exists, skipping creation');
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

export default pool;
