import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { query } from '@/lib/db';
import { encryptText, decryptText } from '@/lib/encryption';
import { rateLimit, setSecurityHeaders, sanitizeInput } from '@/lib/security';

// GET - Retrieve a specific text
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
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

    // Handle params as Promise (Next.js 15+) or object
    const resolvedParams = params instanceof Promise ? await params : params;
    const textId = parseInt(resolvedParams.id);
    if (isNaN(textId)) {
      return setSecurityHeaders(
        NextResponse.json({ error: 'Invalid text ID' }, { status: 400 })
      );
    }

    // Get text (only if owned by user)
    const result = await query(
      `SELECT id, encrypted_content, iv, created_at, updated_at
       FROM encrypted_texts
       WHERE id = $1 AND user_id = $2`,
      [textId, user.id]
    );

    if (result.rows.length === 0) {
      return setSecurityHeaders(
        NextResponse.json({ error: 'Text not found' }, { status: 404 })
      );
    }

    const row = result.rows[0];
    try {
      const decrypted = decryptText(row.encrypted_content, row.iv);
      return setSecurityHeaders(
        NextResponse.json(
          {
            id: row.id,
            content: decrypted,
            created_at: row.created_at,
            updated_at: row.updated_at,
          },
          { status: 200 }
        )
      );
    } catch (error) {
      console.error('Decryption error:', error);
      return setSecurityHeaders(
        NextResponse.json(
          { error: 'Failed to decrypt text' },
          { status: 500 }
        )
      );
    }
  } catch (error: any) {
    console.error('Get text error:', error);
    
    return setSecurityHeaders(
      NextResponse.json(
        { error: 'Failed to retrieve text' },
        { status: 500 }
      )
    );
  }
}

// PUT - Update a text
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
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

    // Handle params as Promise (Next.js 15+) or object
    const resolvedParams = params instanceof Promise ? await params : params;
    const textId = parseInt(resolvedParams.id);
    if (isNaN(textId)) {
      return setSecurityHeaders(
        NextResponse.json({ error: 'Invalid text ID' }, { status: 400 })
      );
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string') {
      return setSecurityHeaders(
        NextResponse.json(
          { error: 'Content is required' },
          { status: 400 }
        )
      );
    }

    // Sanitize content
    const sanitizedContent = sanitizeInput(content, 1000000);

    // Encrypt content
    const { encrypted, iv } = encryptText(sanitizedContent);

    // Update text (only if owned by user)
    const result = await query(
      `UPDATE encrypted_texts
       SET encrypted_content = $1, iv = $2, updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING id, updated_at`,
      [encrypted, iv, textId, user.id]
    );

    if (result.rows.length === 0) {
      return setSecurityHeaders(
        NextResponse.json({ error: 'Text not found' }, { status: 404 })
      );
    }

    return setSecurityHeaders(
      NextResponse.json(
        {
          message: 'Text updated successfully',
          text: {
            id: result.rows[0].id,
            updated_at: result.rows[0].updated_at,
          },
        },
        { status: 200 }
      )
    );
  } catch (error: any) {
    console.error('Update text error:', error);
    
    return setSecurityHeaders(
      NextResponse.json(
        { error: error.message || 'Failed to update text' },
        { status: 400 }
      )
    );
  }
}

// DELETE - Delete a text
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
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

    // Handle params as Promise (Next.js 15+) or object
    const resolvedParams = params instanceof Promise ? await params : params;
    const textId = parseInt(resolvedParams.id);
    if (isNaN(textId)) {
      return setSecurityHeaders(
        NextResponse.json({ error: 'Invalid text ID' }, { status: 400 })
      );
    }

    // Delete text (only if owned by user)
    const result = await query(
      `DELETE FROM encrypted_texts
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [textId, user.id]
    );

    if (result.rows.length === 0) {
      return setSecurityHeaders(
        NextResponse.json({ error: 'Text not found' }, { status: 404 })
      );
    }

    return setSecurityHeaders(
      NextResponse.json(
        { message: 'Text deleted successfully' },
        { status: 200 }
      )
    );
  } catch (error: any) {
    console.error('Delete text error:', error);
    
    return setSecurityHeaders(
      NextResponse.json(
        { error: 'Failed to delete text' },
        { status: 500 }
      )
    );
  }
}

