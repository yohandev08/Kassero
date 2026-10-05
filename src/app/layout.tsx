import type { Metadata } from 'next';
import { ThemeProvider } from '@/context/ThemeContext';
import '../index.css';

export const metadata: Metadata = {
  title: 'Kassero — Sari-Sari Store Management',
  description: 'Point of sale, inventory, customer ledger, and analytics for your sari-sari store.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
