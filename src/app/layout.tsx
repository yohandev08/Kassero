import type { Metadata } from 'next';
import { ThemeProvider } from '@/context/ThemeContext';
import { AlertProvider } from '@/context/AlertContext';
import '../index.css';
import { IBM_Plex_Sans, Public_Sans } from "next/font/google";
import { cn } from "@/lib/utils";

const publicSansHeading = Public_Sans({ subsets: ['latin'], variable: '--font-heading' });

const publicSans = Public_Sans({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="en" suppressHydrationWarning className={cn("font-sans", publicSans.variable, publicSansHeading.variable)}>
      <body>
        <ThemeProvider>
          <AlertProvider>
            {children}
          </AlertProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
