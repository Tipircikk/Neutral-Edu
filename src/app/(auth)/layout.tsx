
"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, BookOpenText } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  if (loading || (!loading && user)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
       <div className="mb-8 flex flex-col items-center">
        <BookOpenText className="h-16 w-16 text-primary mb-2" />
        <h1 className="text-4xl font-bold text-foreground">NeutralEdu AI</h1>
        <p className="text-muted-foreground">Öğrenciler İçin Akıllı Özetler</p>
      </div>
      {children}
    </div>
  );
}
