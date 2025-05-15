
// src/app/(landing)/pricing/page.tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
// import { db } from "@/lib/firebase/config"; // Future: for fetching prices
// import { doc, getDoc } from "firebase/firestore"; // Future: for fetching prices

// Define a type for individual plan features for better structure
interface PlanFeature {
  text: string;
  included: boolean;
}

// Define a type for the pricing plan structure
interface PricingPlan {
  name: string;
  price: string;
  originalPrice: string | null;
  frequency: string;
  description: string;
  features: PlanFeature[];
  cta: string;
  ctaLink: string;
  isPrimary: boolean;
  badge?: string;
}

// Hardcoded initial plans - this would be replaced by fetched data in a future step
const initialPricingPlans: PricingPlan[] = [
  {
    name: "Ücretsiz",
    price: "0₺",
    originalPrice: null,
    frequency: "/ay",
    description: "NeutralEdu AI'ı denemek ve günlük temel kullanım için mükemmel.",
    features: [
      { text: "Günde 2 İşlem", included: true },
      { text: "İndirilebilir Özetler (TXT)", included: true },
      { text: "Standart AI Destekli Yanıtlar", included: true },
      { text: "Anahtar Noktalar ve Açıklamalar", included: true },
      { text: "Temel Örnek Sorular", included: true },
      { text: "Daha Hızlı İşleme", included: false },
      { text: "Öncelikli Destek", included: false },
      { text: "Gelişmiş AI Modelleri", included: false },
      { text: "En Gelişmiş AI Modelleri", included: false },
    ],
    cta: "Ücretsiz Kaydolun",
    ctaLink: "/signup",
    isPrimary: false,
  },
  {
    name: "Premium",
    price: "100₺",
    originalPrice: "200₺",
    frequency: "/ay",
    description: "Daha fazla güç ve özelliğe ihtiyaç duyan özel akademisyenler için.",
    features: [
      { text: "Günde 10 İşlem", included: true },
      { text: "İndirilebilir Özetler (TXT/PDF*)", included: true }, // *PDF yakında
      { text: "Gelişmiş AI Destekli Yanıtlar", included: true },
      { text: "Anahtar Noktalar ve Detaylı Açıklamalar", included: true },
      { text: "Kapsamlı Örnek Sorular", included: true },
      { text: "Daha Hızlı İşleme", included: true },
      { text: "Öncelikli Destek", included: true },
      { text: "Gelişmiş AI Modellerine Erişim", included: true },
      { text: "En Gelişmiş AI Modelleri", included: false },
    ],
    cta: "Premium'a Yükseltin",
    ctaLink: "#contact-sales",
    isPrimary: false,
    badge: "%50 İNDİRİM",
  },
  {
    name: "Pro",
    price: "300₺",
    originalPrice: "600₺",
    frequency: "/ay",
    description: "Maksimum potansiyelini açığa çıkarmak isteyen en talepkar kullanıcılar için.",
    features: [
      { text: "Günde 50 İşlem", included: true },
      { text: "İndirilebilir Özetler (TXT/PDF*)", included: true },
      { text: "En Üst Düzey AI Destekli Yanıtlar", included: true },
      { text: "Derinlemesine Anahtar Noktalar ve Uzman Açıklamaları", included: true },
      { text: "Uzman Seviyesinde Örnek Sorular ve Senaryolar", included: true },
      { text: "En Hızlı İşleme Önceliği", included: true },
      { text: "VIP Destek Hattı", included: true },
      { text: "Gelişmiş AI Modellerine Tam Erişim", included: true },
      { text: "En Gelişmiş ve Deneysel AI Modellerine Erişim (örn: Gemini 1.5 Pro)", included: true },
    ],
    cta: "Pro'ya Geçin",
    ctaLink: "#contact-sales",
    isPrimary: true,
    badge: "YENİ & %50 İNDİRİM",
  },
];

export default function PricingPage() {
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>(initialPricingPlans);
  const [loading, setLoading] = useState(false); // Future: true when fetching

  // Future: useEffect to fetch prices from Firestore
  // useEffect(() => {
  //   const fetchPrices = async () => {
  //     setLoading(true);
  //     try {
  //       const pricingDocRef = doc(db, "pricingConfig", "currentPrices");
  //       const docSnap = await getDoc(pricingDocRef);
  //       if (docSnap.exists()) {
  //         const fetchedPrices = docSnap.data();
  //         // Update initialPricingPlans with fetchedPrices
  //         // For example:
  //         // const updatedPlans = initialPricingPlans.map(plan => {
  //         //   if (plan.name === "Premium" && fetchedPrices.premium) {
  //         //     return { ...plan, price: fetchedPrices.premium.price + "₺", originalPrice: fetchedPrices.premium.originalPrice + "₺" };
  //         //   }
  //         //   if (plan.name === "Pro" && fetchedPrices.pro) {
  //         //     return { ...plan, price: fetchedPrices.pro.price + "₺", originalPrice: fetchedPrices.pro.originalPrice + "₺" };
  //         //   }
  //         //   return plan;
  //         // });
  //         // setPricingPlans(updatedPlans);
  //       } else {
  //         console.log("No pricing config found, using defaults.");
  //       }
  //     } catch (error) {
  //       console.error("Error fetching pricing:", error);
  //       // Fallback to initial hardcoded plans if fetch fails
  //     } finally {
  //       setLoading(false);
  //     }
  //   };
  //   // fetchPrices(); // Uncomment when Firestore structure is ready
  // }, []);

  // if (loading) {
  //   return <div className="text-center py-20">Fiyatlar yükleniyor...</div>;
  // }

  return (
    <div className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
            Size Uygun Planı Seçin
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Çalışma ihtiyaçlarınıza en uygun planı seçin. Yükseltmeler şu an için manueldir.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
          {pricingPlans.map((plan) => (
            <Card
              key={plan.name}
              className={`flex flex-col ${plan.isPrimary ? 'border-2 border-primary shadow-2xl scale-105' : 'shadow-lg'} bg-card transform hover:-translate-y-2 transition-transform duration-300`}
            >
              <CardHeader className="text-center relative pb-4">
                {plan.badge && (
                  <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-destructive text-destructive-foreground text-xs font-semibold px-3 py-1 rounded-full shadow-md flex items-center">
                    <Sparkles className="h-3 w-3 mr-1" /> {plan.badge}
                  </div>
                )}
                <CardTitle className={`text-3xl mt-4 ${plan.isPrimary ? 'text-primary' : 'text-foreground'}`}>{plan.name}</CardTitle>
                <CardDescription className="text-lg text-muted-foreground min-h-[3em]">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 text-center flex-grow">
                <div>
                  {plan.originalPrice && (
                    <span className="text-2xl line-through text-muted-foreground mr-2">{plan.originalPrice}</span>
                  )}
                  <span className="text-5xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-lg text-muted-foreground">{plan.frequency}</span>
                </div>
                <ul className="space-y-3 text-muted-foreground text-left">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      {feature.included ? (
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
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
                  disabled={plan.ctaLink === "#contact-sales"}
                >
                  {plan.ctaLink.startsWith('/') ? (
                    <Link href={plan.ctaLink}>
                      {plan.cta} <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  ) : (
                    <>
                     {plan.cta} {plan.ctaLink === "#contact-sales" && <span className="text-xs ml-1">(Bize Ulaşın)</span>}
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        <div className="text-center mt-12 text-muted-foreground">
          <p>Premium ve Pro plan yükseltmeleri şu anda manuel olarak yapılmaktadır. Daha fazla bilgi için lütfen bizimle iletişime geçin.</p>
          <p>Tüm fiyatlar Türk Lirası (₺) cinsindendir.</p>
        </div>
      </div>
    </div>
  );
}
