import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BeachDawgs — Manage Subscription',
  description: 'Manage your BeachDawgs Premium subscription',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#f8fafc' }}>{children}</body>
    </html>
  );
}
