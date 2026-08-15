import crypto from 'node:crypto'

// AES-256-GCM encrypt/decrypt for secrets stored at rest (e.g. a user's Azure
// DevOps PAT). The key is derived from TFS_ENC_KEY (preferred) or, as a
// fallback, CLERK_SECRET_KEY — both are server-only env vars. Files prefixed
// with `_` are not treated as routes by Vercel.
function getKey(): Buffer {
  const secret = process.env.TFS_ENC_KEY || process.env.CLERK_SECRET_KEY || ''
  if (!secret) throw new Error('No encryption key configured (set TFS_ENC_KEY).')
  return crypto.createHash('sha256').update(secret).digest()
}

// Returns "iv.tag.ciphertext", all base64.
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.')
}

export function decryptSecret(payload: string): string {
  const [ivB, tagB, dataB] = payload.split('.')
  if (!ivB || !tagB || !dataB) throw new Error('Malformed ciphertext.')
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]).toString('utf8')
}
