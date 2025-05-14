
import type { ReactNode } from "react";
import LandingHeader from "@/components/layout/LandingHeader";
import Footer from "@/components/layout/Footer";

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <LandingHeader />
      <main className="flex-grow">
        {children}
      </main>
      <Footer appName="Scholar Summarizer" />
    </div>
  );
}
