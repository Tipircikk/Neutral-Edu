
"use client";

import Link from "next/link";

type FooterProps = {
  appName: string;
};

export default function Footer({ appName }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-8 text-center border-t border-border/40 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {currentYear} {appName}. All rights reserved.
          </p>
          <nav className="flex gap-4 flex-wrap justify-center">
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            {/* <Link href="#data" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Data Policy
            </Link> */}
            <Link href="#contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Contact
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
