
// src/app/(landing)/pricing/page.tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/config";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import type { PricingConfig } from "@/types";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface PricingPlan {
  name: string;
  price: string; // Firestore'dan string olarak gelecek (örn: "100")
  originalPrice: string | null; // Firestore'dan string olarak gelebilir (örn: "200")
  frequency: string;
  description: string;
  features: PlanFeature[];
  cta: string;
  ctaLink: string;
  isPrimary: boolean;
  badge?: string; // Bu, "YENİ" gibi ek etiketler için kullanılabilir. İndirim metni dinamik olacak.
}

const initialPricingPlans: PricingPlan[] = [
  {
    name: "Ücretsiz",
    price: "0",
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
    price: "100", 
    originalPrice: "200",
    frequency: "/ay",
    description: "Daha fazla güç ve özelliğe ihtiyaç duyan özel akademisyenler için.",
    features: [
      { text: "Günde 10 İşlem", included: true },
      { text: "İndirilebilir Özetler (TXT/PDF*)", included: true },
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
    badge: "YENİ &", // Bu, indirim oranı metninden önce görünecek.
  },
  {
    name: "Pro",
    price: "250",  // Örnek görseldeki gibi
    originalPrice: "600", // Örnek görseldeki gibi
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
      { text: "En Gelişmiş ve Deneysel AI Modellerine Erişim", included: true },
    ],
    cta: "Pro'ya Geçin",
    ctaLink: "#contact-sales", 
    isPrimary: true,
    badge: "YENİ &",
  },
];

export default function PricingPage() {
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>(initialPricingPlans);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      setLoading(true);
      try {
        const pricingDocRef = doc(db, "pricingConfig", "currentPrices");
        const docSnap = await getDoc(pricingDocRef);
        if (docSnap.exists()) {
          const fetchedData = docSnap.data() as PricingConfig;
          const updatedPlans = initialPricingPlans.map(plan => {
            if (plan.name === "Premium" && fetchedData.premium?.price) {
              return { 
                ...plan, 
                price: fetchedData.premium.price,
                originalPrice: fetchedData.premium.originalPrice || null
              };
            }
            if (plan.name === "Pro" && fetchedData.pro?.price) {
              return { 
                ...plan, 
                price: fetchedData.pro.price,
                originalPrice: fetchedData.pro.originalPrice || null
              };
            }
            return plan;
          });
          setPricingPlans(updatedPlans);
        } else {
          console.log("No pricing config found, using defaults.");
          setPricingPlans(initialPricingPlans); 
        }
      } catch (error) {
        console.error("Error fetching pricing:", error);
        setPricingPlans(initialPricingPlans); 
      } finally {
        setLoading(false);
      }
    };
    fetchPrices();
  }, []);

  const calculateDiscountBadge = (priceStr: string, originalPriceStr: string | null, staticBadgeText?: string): string | null => {
    if (!originalPriceStr) return staticBadgeText || null;

    const priceNum = parseFloat(priceStr);
    const originalPriceNum = parseFloat(originalPriceStr);

    if (isNaN(priceNum) || isNaN(originalPriceNum) || originalPriceNum <= priceNum) {
      return staticBadgeText || null;
    }

    const discountPercentage = Math.round(((originalPriceNum - priceNum) / originalPriceNum) * 100);
    let badgeText = "";
    if (staticBadgeText) {
      badgeText += staticBadgeText + " ";
    }
    badgeText += `%${discountPercentage} İNDİRİM`;
    return badgeText;
  };


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

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Fiyatlar yükleniyor...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
            {pricingPlans.map((plan) => {
              const dynamicBadge = calculateDiscountBadge(plan.price, plan.originalPrice, plan.badge);
              return (
                <Card
                  key={plan.name}
                  className={`flex flex-col ${plan.isPrimary ? 'border-2 border-primary shadow-2xl scale-105' : 'shadow-lg'} bg-card transform hover:-translate-y-2 transition-transform duration-300`}
                >
                  <CardHeader className="text-center relative pb-4">
                    {dynamicBadge && (
                      <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-destructive text-destructive-foreground text-xs font-semibold px-3 py-1 rounded-full shadow-md flex items-center">
                        <Sparkles className="h-3 w-3 mr-1" /> {dynamicBadge}
                      </div>
                    )}
                    <CardTitle className={`text-3xl mt-4 ${plan.isPrimary ? 'text-primary' : 'text-foreground'}`}>{plan.name}</CardTitle>
                    <CardDescription className="text-lg text-muted-foreground min-h-[3em]">{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 text-center flex-grow">
                    <div>
                      {plan.originalPrice && parseFloat(plan.originalPrice) > parseFloat(plan.price) && (
                        <span className="text-2xl line-through text-muted-foreground mr-2">{plan.originalPrice}₺</span>
                      )}
                      <span className="text-5xl font-bold text-foreground">{plan.price}₺</span>
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
              );
            })}
          </div>
        )}
        <div className="text-center mt-12 text-muted-foreground">
          <p>Premium ve Pro plan yükseltmeleri şu anda manuel olarak yapılmaktadır. Daha fazla bilgi için lütfen bizimle iletişime geçin.</p>
          <p>Tüm fiyatlar Türk Lirası (₺) cinsindendir.</p>
        </div>
      </div>
    </div>
  );
}
