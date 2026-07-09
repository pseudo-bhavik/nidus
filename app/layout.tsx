import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nidus — Hyper-Minimalist Link Manager',
  description: 'A dense, lightning-fast bookmark dashboard inspired by Hacker News and Notion.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
