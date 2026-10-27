import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Try to get encryption secret from various places
const getSecret = () => {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return null;
  }
  // Ensure the secret is exactly 32 bytes for AES-256
  // If it's longer, truncate. If shorter, pad.
  const buf = Buffer.alloc(32);
  Buffer.from(secret).copy(buf);
  return buf;
};

export const encryptApiKey = (plaintext: string): string => {
  const secret = getSecret();
  if (!secret) {
    console.warn('WARNING: No AI_KEY_ENCRYPTION_SECRET or NEXTAUTH_SECRET found. API keys will be stored as plaintext.');
    return plaintext;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, secret, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${encrypted}:${tag}`;
};

export const decryptApiKey = (encrypted: string): string => {
  const secret = getSecret();
  if (!secret) {
    return encrypted;
  }

  // Check if it's actually encrypted (has our format iv:ciphertext:tag)
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    return encrypted; // Probably plaintext fallback
  }

  try {
    const [ivHex, ciphertextHex, tagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const decipher = createDecipheriv(ALGORITHM, secret, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt API key:', error);
    return encrypted; // Fallback to returning the raw string
  }
};
