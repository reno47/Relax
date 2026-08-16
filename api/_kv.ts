export async function getKv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const { createClient } = await import('@vercel/kv')
  return createClient({ url, token })
}

export type Kv = NonNullable<Awaited<ReturnType<typeof getKv>>>

export function withPrefix(key: string): string {
  return (process.env.KV_KEY_PREFIX || '') + key
}
