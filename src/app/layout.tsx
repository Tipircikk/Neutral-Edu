
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Changed from Geist to Inter as per style guide
import './globals.css';
import { AppProviders } from '@/providers/AppProviders';
import { cn } from '@/lib/utils';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans', // Using --font-sans for Inter
});

export const metadata: Metadata = {
  title: 'NeutralEdu AI',
  description: 'AI-powered PDF summarization for students.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.variable)}>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
