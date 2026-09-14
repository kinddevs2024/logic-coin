import { load } from '@expo/env';

process.env.NODE_ENV ??= 'production';
load(process.cwd());
const api = process.env.EXPO_PUBLIC_API_URL?.trim();
const google = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim();
if (api) {
  const valid = api === '/api/v1' || /^https?:\/\/[^\s=?#]+\/api\/v1\/?$/.test(api);
  if (!valid) throw new Error('EXPO_PUBLIC_API_URL must be /api/v1 or an absolute URL ending in /api/v1. Check for joined .env lines.');
}
if (google && !/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(google)) {
  throw new Error('EXPO_PUBLIC_GOOGLE_CLIENT_ID is malformed. Use the Web OAuth client ID on web and Android.');
}
if (process.env.REQUIRE_PRODUCTION_AUTH === 'true' && !google) {
  throw new Error('EXPO_PUBLIC_GOOGLE_CLIENT_ID is required for production Google sign-in.');
}
console.log('Public API and OAuth build configuration validated.');
