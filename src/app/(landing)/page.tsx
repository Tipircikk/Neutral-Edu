// src/app/(landing)/page.tsx
import Link from 'next/link';

export default function LandingPlaceholderPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', textAlign: 'center', minHeight: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <h1 className="text-3xl font-bold mb-4">Landing Page Section</h1>
      <p className="text-muted-foreground mb-8">
        This is a placeholder page for content that might be specific to a `/landing/...` route structure.
      </p>
      <p className="text-muted-foreground">
        The main landing page content is now served at the root (`/`).
      </p>
      <Link href="/" className="mt-8 text-primary hover:underline">
        Go to Main Landing Page (/)
      </Link>
    </div>
  );
}
