
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
        <Link href="/" className="flex items-center gap-2"> {/* Changed href to / for main landing page */}
          <BookOpenText className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold text-foreground">NeutralEdu AI</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/#features">Özellikler</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/#how-it-works">Nasıl Çalışır?</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/pricing">Fiyatlandırma</Link>
          </Button>
          {!loading && !user && (
            <>
              <Button variant="outline" asChild>
                <Link href="/login">Giriş Yap</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Kayıt Ol</Link>
              </Button>
            </>
          )}
          {!loading && user && (
             <Button asChild>
                <Link href="/dashboard">Kontrol Paneline Git</Link>
              </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
