
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Frown } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground p-4 text-center">
      <Frown className="h-24 w-24 text-primary mb-8" />
      <h1 className="text-4xl md:text-6xl font-bold mb-4">404</h1>
      <h2 className="text-2xl md:text-3xl font-semibold mb-6">Sayfa Bulunamadı</h2>
      <p className="text-lg text-muted-foreground mb-8 max-w-md">
        Aradığınız sayfa mevcut değil, taşınmış veya hiç var olmamış olabilir.
      </p>
      <Button asChild size="lg">
        <Link href="/">Ana Sayfaya Dön</Link>
      </Button>
    </div>
  );
}
