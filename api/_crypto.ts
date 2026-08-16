import crypto from 'node:crypto'

function bytes(input: Uint8Array): Uint8Array {
  return Uint8Array.from(input)
}

function getKey(): Uint8Array {
  const secret = process.env.TFS_ENC_KEY || process.env.CLERK_SECRET_KEY || ''
  if (!secret) throw new Error('No encryption key configured (set TFS_ENC_KEY).')
  return bytes(crypto.createHash('sha256').update(secret).digest())
}

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
