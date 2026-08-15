// Shared Upstash KV client for the API routes. Files prefixed with `_` are not
// treated as routes by Vercel.
export async function getKv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const { createClient } = await import('@vercel/kv')
  return createClient({ url, token })
}

export type Kv = NonNullable<Awaited<ReturnType<typeof getKv>>>

// Optional namespace so a single Upstash DB can host multiple environments
// (e.g. set KV_KEY_PREFIX="staging:" on the Vercel Preview env). Empty in
// production, so prod keys keep their original names.
export function withPrefix(key: string): string {
  return (process.env.KV_KEY_PREFIX || '') + key
}
