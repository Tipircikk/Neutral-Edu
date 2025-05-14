
"use client";

import { useUser } from "@/hooks/useUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Wand2, FileScan, HelpCircle, ArrowRight } from "lucide-react";

export default function DashboardHomePage() {
  const { userProfile } = useUser();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Hoş Geldin, {userProfile?.displayName || userProfile?.email?.split('@')[0] || "Kullanıcı"}!
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          NeutralEdu AI ile öğrenme potansiyelini keşfetmeye hazır mısın?
        </p>
      </div>

      <Card className="shadow-lg bg-gradient-to-br from-card to-card/90">
        <CardHeader>
          <CardTitle className="text-2xl">Hızlı Başlangıç</CardTitle>
          <CardDescription>En çok kullanılan yapay zeka araçlarımızla hemen çalışmaya başla.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <Link href="/dashboard/ai-tools/pdf-summarizer" className="block group">
            <Card className="hover:shadow-primary/30 transition-shadow duration-300 h-full">
              <CardHeader>
                <FileScan className="h-10 w-10 text-primary mb-3" />
                <CardTitle>AI PDF Özetleyici</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">Uzun PDF'lerini saniyeler içinde anlaşılır özetlere dönüştür.</p>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" size="sm" className="text-primary group-hover:underline">
                  Özetle <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </Link>
          <Link href="/dashboard/ai-tools/question-solver" className="block group">
            <Card className="hover:shadow-primary/30 transition-shadow duration-300 h-full">
              <CardHeader>
                <HelpCircle className="h-10 w-10 text-primary mb-3" />
                <CardTitle>AI Soru Çözücü</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">Zorlandığın soruları yapay zekaya sor, adım adım çözümler al. (Yakında)</p>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" size="sm" className="text-primary group-hover:underline" disabled>
                  Soru Sor <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </Link>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
            <div className="flex items-center gap-3">
                <Wand2 className="h-8 w-8 text-primary"/>
                <CardTitle className="text-2xl">Tüm Yapay Zeka Araçları</CardTitle>
            </div>
          <CardDescription>Öğrenme deneyimini bir üst seviyeye taşıyacak tüm araçlarımızı keşfet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            NeutralEdu AI, öğrencilerin akademik hayatlarını kolaylaştırmak için tasarlandı. PDF özetlemeden, karmaşık soruları çözmeye, kişiye özel testler oluşturmaya kadar birçok yapay zeka destekli aracı tek bir platformda sunuyoruz.
          </p>
          <Button asChild>
            <Link href="/dashboard/ai-tools">
              Araçları Keşfet <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {userProfile?.plan !== 'premium' && (
        <Card className="shadow-lg bg-gradient-to-r from-primary via-purple-600 to-pink-500 text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-2xl">NeutralEdu AI Premium</CardTitle>
            <CardDescription className="text-primary-foreground/80">Daha fazla özet hakkı ve özel özelliklerle sınırları zorla!</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 mb-4 text-sm">
              <li>Günde 10 özet hakkı</li>
              <li>Öncelikli işleme</li>
              <li>Gelişmiş AI modelleri (Yakında)</li>
            </ul>
            <Button variant="secondary" asChild className="bg-white text-primary hover:bg-white/90">
              <Link href="/pricing">Premium Planları İncele</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
