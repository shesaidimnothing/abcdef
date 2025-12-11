import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { query } from '@/lib/db';
import { encryptText, decryptText } from '@/lib/encryption';
import { rateLimit, setSecurityHeaders, sanitizeInput } from '@/lib/security';

// GET - Retrieve all texts for the authenticated user
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = rateLimit(request);
    if (!rateLimitResult.allowed) {
      return setSecurityHeaders(
        NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        )
      );
    }

    // Verify authentication
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return setSecurityHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      return setSecurityHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );
    }

    // Get all texts for user
    // Try to select name columns - handle case where they don't exist yet
    let result;
    try {
      result = await query(
        `SELECT id, encrypted_content, iv, encrypted_name, name_iv, created_at, updated_at
         FROM encrypted_texts
         WHERE user_id = $1
         ORDER BY updated_at DESC`,
        [user.id]
      );
    } catch (error: any) {
      // If columns don't exist, fall back to query without name columns
      if (error.code === '42703') { // Column does not exist
        result = await query(
          `SELECT id, encrypted_content, iv, created_at, updated_at
           FROM encrypted_texts
           WHERE user_id = $1
           ORDER BY updated_at DESC`,
          [user.id]
        );
      } else {
        throw error;
      }
    }

    // Decrypt texts and names
    const texts = result.rows.map((row) => {
      try {
        const decrypted = decryptText(row.encrypted_content, row.iv);
        let decryptedName = '';
        
        // Try to decrypt name if it exists (columns may not exist, or name may be NULL)
        if (row.encrypted_name && row.name_iv) {
          try {
            decryptedName = decryptText(row.encrypted_name, row.name_iv);
          } catch (nameError) {
            console.error('Name decryption error for text ID:', row.id);
            decryptedName = '';
          }
        }
        
        return {
          id: row.id,
          name: decryptedName,
          content: decrypted,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      } catch (error) {
        console.error('Decryption error for text ID:', row.id);
        return {
          id: row.id,
          name: '',
          content: '[Decryption Error]',
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      }
    });

    return setSecurityHeaders(NextResponse.json({ texts }, { status: 200 }));
  } catch (error: any) {
    console.error('Get texts error:', error);
    
    return setSecurityHeaders(
      NextResponse.json(
        { error: 'Failed to retrieve texts' },
        { status: 500 }
      )
    );
  }
}

// POST - Create a new encrypted text
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = rateLimit(request);
    if (!rateLimitResult.allowed) {
      return setSecurityHeaders(
        NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        )
      );
    }

    // Verify authentication
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return setSecurityHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );
    }

    const user = await verifySession(sessionToken);
    if (!user) {
      return setSecurityHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );
    }

    const body = await request.json();
    const { name, content } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return setSecurityHeaders(
        NextResponse.json(
          { error: 'File name is required' },
          { status: 400 }
        )
      );
    }

    if (!content || typeof content !== 'string') {
      return setSecurityHeaders(
        NextResponse.json(
          { error: 'Content is required' },
          { status: 400 }
        )
      );
    }

    // Sanitize and validate content (max 1MB of text)
    const sanitizedContent = sanitizeInput(content, 1000000);
    const sanitizedName = sanitizeInput(name.trim(), 255);

    // Encrypt content and name
    const { encrypted, iv } = encryptText(sanitizedContent);
    const { encrypted: encryptedName, iv: nameIv } = encryptText(sanitizedName);

    // Store in database - try with name columns first
    let result;
    try {
      result = await query(
        `INSERT INTO encrypted_texts (user_id, encrypted_content, iv, encrypted_name, name_iv)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, created_at, updated_at`,
        [user.id, encrypted, iv, encryptedName, nameIv]
      );
    } catch (error: any) {
      // If columns don't exist, return error telling user to run migration
      if (error.code === '42703') { // Column does not exist
        return setSecurityHeaders(
          NextResponse.json(
            { 
              error: 'Database migration required. Please run: curl -X POST http://localhost:3000/api/init',
              details: 'The encrypted_name and name_iv columns need to be added to the database.'
            },
            { status: 500 }
          )
        );
      }
      throw error;
    }

    return setSecurityHeaders(
      NextResponse.json(
        {
          message: 'Text saved successfully',
          text: {
            id: result.rows[0].id,
            created_at: result.rows[0].created_at,
            updated_at: result.rows[0].updated_at,
          },
        },
        { status: 201 }
      )
    );
  } catch (error: any) {
    console.error('Save text error:', error);
    
    return setSecurityHeaders(
      NextResponse.json(
        { error: error.message || 'Failed to save text' },
        { status: 400 }
      )
    );
  }
}

