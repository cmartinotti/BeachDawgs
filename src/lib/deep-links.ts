import { Linking } from 'react-native';
import { router } from 'expo-router';

// Allowlist of valid internal route patterns
// Only beachdawgs:// scheme is accepted; all paths must match a known pattern
const ALLOWED_ROUTES: { pattern: RegExp; path: (m: RegExpMatchArray) => string }[] = [
  {
    pattern: /^\/profile\/([a-zA-Z0-9_-]{1,30})$/,
    path: (m) => `/profile/${m[1]}`,
  },
  {
    pattern: /^\/beach\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
    path: (m) => `/beach/${m[1]}`,
  },
  {
    pattern: /^\/checkin\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
    path: (m) => `/checkin/${m[1]}`,
  },
];

export function handleDeepLink(url: string): void {
  try {
    const parsed = new URL(url);

    // Only handle our own scheme
    if (parsed.protocol !== `${APP_SCHEME}:`) return;

    // Reconstruct path from hostname + pathname (e.g. beachdawgs://beach/id → /beach/id)
    const path = '/' + parsed.hostname + (parsed.pathname === '/' ? '' : parsed.pathname);

    for (const route of ALLOWED_ROUTES) {
      const match = path.match(route.pattern);
      if (match) {
        router.push(route.path(match) as any);
        return;
      }
    }

    // Path did not match any known route — silently ignore
    if (__DEV__) console.warn('[DeepLink] Rejected unknown path:', path);
  } catch {
    // Malformed URL — ignore
  }
}

const APP_SCHEME = 'beachdawgs';

export function setupDeepLinkListener(): () => void {
  const subscription = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
  return () => subscription.remove();
}
