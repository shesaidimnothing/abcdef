import { NextRequest, NextResponse } from 'next/server';
import { initDatabase } from '@/lib/db';
import { setSecurityHeaders } from '@/lib/security';

// This endpoint initializes the database and creates the single user
// Only call it once to initialize the database schema
export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    
    return setSecurityHeaders(
      NextResponse.json(
        { message: 'Database initialized and user created successfully' },
        { status: 200 }
      )
    );
  } catch (error: any) {
    console.error('Database initialization error:', error);
    console.error('Error stack:', error.stack);
    
    // Return detailed error in development
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? error.message || 'Database initialization failed'
      : 'Database initialization failed';
    
    return setSecurityHeaders(
      NextResponse.json(
        { 
          error: errorMessage,
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        { status: 500 }
      )
    );
  }
}

