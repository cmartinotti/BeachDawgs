import { Redirect } from 'expo-router';

// Any unmatched route redirects to root, which handles auth-based routing
export default function NotFound() {
  return <Redirect href="/" />;
}
