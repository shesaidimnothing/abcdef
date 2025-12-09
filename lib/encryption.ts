import CryptoJS from 'crypto-js';

// Generate a secure encryption key from environment variable
// In production, this should be a strong random key stored securely
const getEncryptionKey = (): string => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
  }
  return key;
};

/**
 * Encrypt text using AES-256 encryption
 * Returns encrypted text and IV separately for secure storage
 */
export function encryptText(text: string): { encrypted: string; iv: string } {
  const key = getEncryptionKey();
  const iv = CryptoJS.lib.WordArray.random(128 / 8); // 16 bytes for AES
  
  const encrypted = CryptoJS.AES.encrypt(text, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return {
    encrypted: encrypted.toString(),
    iv: iv.toString(),
  };
}

/**
 * Decrypt text using AES-256 decryption
 */
export function decryptText(encrypted: string, iv: string): string {
  const key = getEncryptionKey();
  
  try {
    const decrypted = CryptoJS.AES.decrypt(encrypted, key, {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedText) {
      throw new Error('Decryption failed - invalid encrypted data');
    }

    return decryptedText;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt text');
  }
}

/**
 * Hash sensitive data (like passwords) using bcrypt
 * This is separate from encryption - hashing is one-way
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  const saltRounds = 12; // High cost factor for security
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(password, hash);
}

