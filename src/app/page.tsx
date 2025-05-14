// src/app/page.tsx

export default function HomePage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', textAlign: 'center', color: 'hsl(var(--foreground))', backgroundColor: 'hsl(var(--background))', minHeight: '100vh' }}>
      <h1>Welcome to Scholar Summarizer</h1>
      <p>This is the root page. It should normally redirect you based on your login status.</p>
      <p>If you see this, basic routing to the main page is working.</p>
      <p>
        You can try navigating to the 
        <a href="/landing" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline', marginLeft: '5px' }}>
          Landing Page
        </a>.
      </p>
      <p>
        Or, if you are logged in, try the 
        <a href="/dashboard" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline', marginLeft: '5px' }}>
          Dashboard
        </a>.
      </p>
      <p style={{ marginTop: '20px', fontSize: '0.9em', color: 'hsl(var(--muted-foreground))' }}>
        (The original redirect logic has been temporarily replaced to diagnose the 404 issue.)
      </p>
    </div>
  );
}
