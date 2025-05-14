
// src/app/(landing)/pricing/page.tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, ArrowRight } from "lucide-react";

const pricingPlans = [
  {
    name: "Free",
    price: "0₺",
    frequency: "/month",
    description: "Perfect for trying out Scholar Summarizer and casual use.",
    features: [
      { text: "2 Summaries per Day", included: true },
      { text: "Downloadable Summaries (TXT)", included: true },
      { text: "Standard Gemini-powered Summaries", included: true },
      { text: "Key Points & Explanations", included: true },
      { text: "Sample Questions", included: true },
      { text: "Faster Processing", included: false },
      { text: "Priority Support", included: false },
    ],
    cta: "Sign Up for Free",
    ctaLink: "/signup",
    isPrimary: true,
  },
  {
    name: "Premium",
    price: "100₺",
    frequency: "/month",
    description: "For dedicated scholars who need more power and features.",
    features: [
      { text: "10 Summaries per Day", included: true },
      { text: "Downloadable Summaries (TXT/PDF*)", included: true }, // *PDF coming soon
      { text: "Advanced Gemini-powered Summaries", included: true },
      { text: "Key Points & Explanations", included: true },
      { text: "Sample Questions", included: true },
      { text: "Faster Processing", included: true },
      { text: "Priority Support", included: true },
    ],
    cta: "Upgrade to Premium",
    ctaLink: "#contact-sales", // Placeholder for manual upgrade
    isPrimary: false,
    badge: "Best Value",
  },
];

export default function PricingPage() {
  return (
    <div className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that best fits your study needs. No hidden fees, upgrade or downgrade anytime (manual for now).
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
          {pricingPlans.map((plan) => (
            <Card 
              key={plan.name} 
              className={`flex flex-col ${plan.isPrimary ? 'border-2 border-primary shadow-xl' : 'shadow-lg'} bg-card transform hover:-translate-y-2 transition-transform duration-300`}
            >
              <CardHeader className="text-center relative pb-4">
                {plan.badge && (
                  <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full shadow-md">
                    {plan.badge}
                  </div>
                )}
                <CardTitle className={`text-3xl mt-4 ${plan.isPrimary ? 'text-primary' : 'text-foreground'}`}>{plan.name}</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 text-center flex-grow">
                <div>
                  <span className="text-5xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-lg text-muted-foreground">{plan.frequency}</span>
                </div>
                <ul className="space-y-3 text-muted-foreground text-left">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                      {feature.included ? (
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground/50 flex-shrink-0" />
                      )}
                      <span>{feature.text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="mt-auto">
                <Button 
                  size="lg" 
                  className="w-full text-lg py-6" 
                  variant={plan.isPrimary ? 'default' : 'outline'}
                  asChild={plan.ctaLink.startsWith('/')}
                  disabled={plan.ctaLink === "#contact-sales"} // Disable for manual upgrade for now
                >
                  {plan.ctaLink.startsWith('/') ? (
                    <Link href={plan.ctaLink}>
                      {plan.cta} <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  ) : (
                    <>
                     {plan.cta} {plan.ctaLink === "#contact-sales" && <span className="text-xs ml-1">(Contact Us)</span>}
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        <div className="text-center mt-12 text-muted-foreground">
          <p>Premium plan upgrades are currently handled manually. Please contact us for more information.</p>
          <p>All prices are in Turkish Lira (₺).</p>
        </div>
      </div>
    </div>
  );
}
