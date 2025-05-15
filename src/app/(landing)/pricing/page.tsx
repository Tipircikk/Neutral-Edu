// src/app/(landing)/pricing/page.tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, ArrowRight } from "lucide-react";

const pricingPlans = [
  {
    name: "Ücretsiz",
    price: "0₺",
    originalPrice: null,
    frequency: "/ay",
    description: "NeutralEdu AI'ı denemek ve günlük kullanım için mükemmel.",
    features: [
      { text: "Günde 2 Özet/İşlem", included: true },
      { text: "İndirilebilir Özetler (TXT)", included: true },
      { text: "Standart AI Destekli Yanıtlar", included: true },
      { text: "Anahtar Noktalar ve Açıklamalar", included: true },
      { text: "Örnek Sorular", included: true },
      { text: "Daha Hızlı İşleme", included: false },
      { text: "Öncelikli Destek", included: false },
      { text: "Gelişmiş AI Modelleri", included: false },
    ],
    cta: "Ücretsiz Kaydolun",
    ctaLink: "/signup",
    isPrimary: true,
  },
  {
    name: "Premium",
    price: "100₺",
    originalPrice: "200₺",
    frequency: "/ay",
    description: "Daha fazla güç ve özelliğe ihtiyaç duyan özel akademisyenler için.",
    features: [
      { text: "Günde 10 Özet/İşlem", included: true },
      { text: "İndirilebilir Özetler (TXT/PDF*)", included: true }, // *PDF yakında
      { text: "Gelişmiş AI Destekli Yanıtlar", included: true },
      { text: "Anahtar Noktalar ve Detaylı Açıklamalar", included: true },
      { text: "Kapsamlı Örnek Sorular", included: true },
      { text: "Daha Hızlı İşleme", included: true },
      { text: "Öncelikli Destek", included: true },
      { text: "Gelişmiş AI Modellerine Erişim (En iyi sonuçlar için)", included: true },
    ],
    cta: "Premium'a Yükseltin",
    ctaLink: "#contact-sales", // Manuel yükseltme için yer tutucu
    isPrimary: false,
    badge: "%50 İNDİRİM",
  },
];

export default function PricingPage() {
  return (
    <div className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
            Basit, Şeffaf Fiyatlandırma
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Çalışma ihtiyaçlarınıza en uygun planı seçin. Gizli ücret yok. Premium yükseltmeler şu an için manueldir.
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
                  <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-destructive text-destructive-foreground text-xs font-semibold px-3 py-1 rounded-full shadow-md flex items-center">
                    {plan.badge}
                  </div>
                )}
                <CardTitle className={`text-3xl mt-4 ${plan.isPrimary ? 'text-primary' : 'text-foreground'}`}>{plan.name}</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">{plan.description}</CardDescription>
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
          <p>Premium plan yükseltmeleri şu anda manuel olarak yapılmaktadır. Daha fazla bilgi için lütfen bizimle iletişime geçin.</p>
          <p>Tüm fiyatlar Türk Lirası (₺) cinsindendir.</p>
        </div>
      </div>
    </div>
  );
}
