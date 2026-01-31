
export function getApiKeys(): string[] {
  const keys: string[] = [];
  const primary = process.env.JULES_API_KEY;
  if (primary) keys.push(primary);

  // In Next.js server side, process.env is available for env vars starting with NEXT_PUBLIC_ or if defined in next.config.mjs env
  // BUT for secret keys like JULES_API_KEY, they are server-only.
  // We need to verify where this code runs. session-service.ts runs on server (actions).
  
  if (typeof process === 'undefined') return keys; // Client side?

  Object.keys(process.env).forEach(key => {
    if (key.startsWith('JULES_API_KEY_')) {
        const val = process.env[key];
        if (val) keys.push(val);
    }
  });

  return keys.sort();
}
