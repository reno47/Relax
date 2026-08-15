import crypto from 'node:crypto'

// AES-256-GCM encrypt/decrypt for secrets stored at rest (e.g. a user's Azure
// DevOps PAT). The key is derived from TFS_ENC_KEY (preferred) or, as a
// fallback, CLERK_SECRET_KEY — both are server-only env vars. Files prefixed
// with `_` are not treated as routes by Vercel.
//
// Node's Buffer/Uint8Array typings vary across @types/node versions, so every
// value handed to the crypto APIs is normalised to a plain Uint8Array.
function bytes(input: Uint8Array): Uint8Array {
  return Uint8Array.from(input)
}

function getKey(): Uint8Array {
  const secret = process.env.TFS_ENC_KEY || process.env.CLERK_SECRET_KEY || ''
  if (!secret) throw new Error('No encryption key configured (set TFS_ENC_KEY).')
  return bytes(crypto.createHash('sha256').update(secret).digest())
}

// Returns "iv.tag.ciphertext", all base64.
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), bytes(iv))
  const enc = Buffer.concat([bytes(cipher.update(plain, 'utf8')), bytes(cipher.final())])
  const tag = cipher.getAuthTag()
  return [
    Buffer.from(iv).toString('base64'),
    Buffer.from(tag).toString('base64'),
    enc.toString('base64'),
  ].join('.')
}

export function decryptSecret(payload: string): string {
  const [ivB, tagB, dataB] = payload.split('.')
  if (!ivB || !tagB || !dataB) throw new Error('Malformed ciphertext.')
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), bytes(Buffer.from(ivB, 'base64')))
  decipher.setAuthTag(bytes(Buffer.from(tagB, 'base64')))
  const out = Buffer.concat([
    bytes(decipher.update(bytes(Buffer.from(dataB, 'base64')))),
    bytes(decipher.final()),
  ])
  return out.toString('utf8')
}
