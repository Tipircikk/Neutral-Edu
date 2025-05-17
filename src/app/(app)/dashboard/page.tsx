
"use client";

import { useUser } from "@/hooks/useUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Wand2, Presentation, FileTextIcon, ArrowRight, Gem, Brain } from "lucide-react";

export default function DashboardHomePage() {
  const { userProfile } = useUser();

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          Hoş Geldin, {userProfile?.displayName || userProfile?.email?.split('@')[0] || "Kullanıcı"}!
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          NeutralEdu AI ile öğrenme potansiyelini keşfetmeye hazır mısın?
        </p>
      </div>

      <Card className="shadow-lg bg-card">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl text-foreground">Hızlı Başlangıç</CardTitle>
          <CardDescription>En çok kullanılan yapay zeka araçlarımızla hemen çalışmaya başla.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4 md:gap-6">
          <Link href="/dashboard/ai-tools/topic-explainer" className="block group">
            <Card className="bg-background hover:shadow-primary/20 transition-shadow duration-300 h-full border-border hover:border-primary/50">
              <CardHeader>
                <Presentation className="h-8 w-8 md:h-10 md:w-10 text-primary mb-3" />
                <CardTitle className="text-lg sm:text-xl text-foreground">AI Konu Anlatımı</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">Belirlediğin YKS konusunu yapay zekadan detaylıca öğren.</p>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" size="sm" className="text-primary group-hover:underline text-sm sm:text-base">
                  Konu Anlatımı Al <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </Link>
          <Link href="/dashboard/ai-tools/test-generator" className="block group">
            <Card className="bg-background hover:shadow-primary/20 transition-shadow duration-300 h-full border-border hover:border-primary/50">
              <CardHeader>
                <FileTextIcon className="h-8 w-8 md:h-10 md:w-10 text-primary mb-3" />
                <CardTitle className="text-lg sm:text-xl text-foreground">AI Test Oluşturucu</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">İstediğin YKS konusundan pratik testler oluştur, kendini sına.</p>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" size="sm" className="text-primary group-hover:underline text-sm sm:text-base">
                  Test Oluştur <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </Link>
        </CardContent>
      </Card>

      <Card className="shadow-md bg-card">
        <CardHeader>
            <div className="flex items-center gap-3">
                <Wand2 className="h-7 w-7 md:h-8 md:w-8 text-primary"/>
                <CardTitle className="text-xl sm:text-2xl text-foreground">Tüm Yapay Zeka Araçları</CardTitle>
            </div>
          <CardDescription>Öğrenme deneyimini bir üst seviyeye taşıyacak tüm araçlarımızı keşfet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm sm:text-base">
            NeutralEdu AI, öğrencilerin akademik hayatlarını kolaylaştırmak için tasarlandı. PDF içeriklerinden detaylı konu anlatımları, kişiye özel testler, sınav raporu analizleri ve daha birçok yapay zeka destekli aracı tek bir platformda sunuyoruz.
          </p>
          <Button asChild size="sm" className="sm:text-base text-primary-foreground bg-primary hover:bg-primary/90">
            <Link href="/dashboard/ai-tools">
              Araçları Keşfet <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {(userProfile?.plan !== 'premium' && userProfile?.plan !== 'pro') && (
        <Card className="shadow-lg bg-gradient-to-r from-primary/80 via-purple-600/80 to-pink-500/80 text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">NeutralEdu AI Pro</CardTitle>
            <CardDescription className="text-primary-foreground/90">Daha fazla işlem hakkı ve özel özelliklerle sınırları zorla!</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 mb-4 text-sm">
              <li>Daha Yüksek Günlük İşlem Hakkı</li>
              <li>Gelişmiş AI Modellerine Erişim (potansiyel)</li>
              <li>Öncelikli Destek</li>
            </ul>
            <Button variant="secondary" asChild className="bg-background text-primary hover:bg-background/90 text-sm sm:text-base">
              <Link href="/pricing">Planları İncele</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
