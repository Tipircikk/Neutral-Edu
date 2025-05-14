
"use client";

import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function LandingHeader() {
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-20 items-center justify-between">
        <Link href="/landing" className="flex items-center gap-2">
          <BookOpenText className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold text-foreground">Scholar Summarizer</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/landing#features">Features</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/landing#how-it-works">How It Works</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/landing#pricing">Pricing</Link>
          </Button>
          {!loading && !user && (
            <>
              <Button variant="outline" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Sign Up</Link>
              </Button>
            </>
          )}
          {!loading && user && (
             <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
