
"use client";

import { useUser } from "@/hooks/useUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Wand2, Presentation, FileTextIcon, ArrowRight, Gem, Brain, CalendarClock, Activity, Gauge, AlertTriangle } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/firebase/config";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import type { ExamDatesConfig, UserProfile } from "@/types";
import { differenceInMilliseconds, intervalToDuration, format, isPast, isToday, formatDistanceToNowStrict } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Progress } from "@/components/ui/progress";
import { getDefaultQuota } from "@/lib/firebase/firestore";
import { Loader2 } from "lucide-react";

const CountdownItem = ({ targetDate, title }: { targetDate: Date | null, title: string }) => {
  const [timeLeft, setTimeLeft] = useState<Duration | null>(null);
  const [isDatePast, setIsDatePast] = useState(false);

  const calculateTimeLeft = useCallback(() => {
    if (!targetDate) {
      setTimeLeft(null);
      setIsDatePast(false);
      return;
    }
    const now = new Date();
    if (targetDate.getTime() < now.getTime()) {
      setTimeLeft(null);
      setIsDatePast(true);
      return;
    }
    setIsDatePast(false);
    const diff = differenceInMilliseconds(targetDate, now);
    const duration = intervalToDuration({ start: 0, end: diff });
    setTimeLeft(duration);
  }, [targetDate]);

  useEffect(() => {
    if (!targetDate || isDatePast) {
      setTimeLeft(null);
      return;
    }
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetDate, calculateTimeLeft, isDatePast]);

  if (!targetDate) {
    return <p className="text-sm text-muted-foreground">Tarih belirlenmemiş</p>;
  }
  if (isDatePast) {
    return <p className="text-sm text-destructive">{title} tarihi geçti.</p>;
  }
  if (!timeLeft) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground mb-0.5">{title}</p>
      <div className="flex flex-wrap justify-center items-baseline space-x-1">
        {timeLeft.months && timeLeft.months > 0 && (
          <>
            <span className="text-xl font-bold text-primary">{timeLeft.months}</span>
            <span className="text-xs text-muted-foreground self-end pb-0.5">ay</span>
          </>
        )}
        <span className="text-xl font-bold text-primary">{timeLeft.days || 0}</span>
        <span className="text-xs text-muted-foreground self-end pb-0.5">gün</span>
      </div>
      <p className="text-sm font-semibold text-foreground">
        {String(timeLeft.hours || 0).padStart(2, '0')}:{String(timeLeft.minutes || 0).padStart(2, '0')}:{String(timeLeft.seconds || 0).padStart(2, '0')}
      </p>
    </div>
  );
};


export default function DashboardHomePage() {
  const { userProfile } = useUser();
  const [examDates, setExamDates] = useState<ExamDatesConfig | null>(null);
  const [loadingDates, setLoadingDates] = useState(true);

  const parseDateString = (dateString?: string): Date | null => {
    if (!dateString) return null;
    const trimmedDateString = dateString.trim();
    const parts = trimmedDateString.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) return null;
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  };

  useEffect(() => {
    const fetchDates = async () => {
      setLoadingDates(true);
      try {
        const examDatesDocRef = doc(db, "appConfig", "examDates");
        const docSnap = await getDoc(examDatesDocRef);
        if (docSnap.exists()) {
          setExamDates(docSnap.data() as ExamDatesConfig);
        } else {
          setExamDates({});
        }
      } catch (error) {
        console.error("Error fetching exam dates for dashboard:", error);
        setExamDates({});
      } finally {
        setLoadingDates(false);
      }
    };
    fetchDates();
  }, []);

  const tytTargetDate = examDates?.tytDate ? parseDateString(examDates.tytDate) : null;
  const aytTargetDate = examDates?.aytDate ? parseDateString(examDates.aytDate) : null;

  let subscriptionStatus: string | null = null;
  if (userProfile?.planExpiryDate && userProfile.planExpiryDate instanceof Timestamp) {
    const expiry = userProfile.planExpiryDate.toDate();
    if (isPast(expiry) && !isToday(expiry)) {
      subscriptionStatus = "Süresi Doldu";
    } else if (isToday(expiry)) {
      subscriptionStatus = "Bugün Sona Eriyor";
    } else {
      subscriptionStatus = `${formatDistanceToNowStrict(expiry, { locale: tr, addSuffix: true, unit: 'day' }).replace("içinde", "kaldı")}`;
    }
  } else if (userProfile && (userProfile.plan === 'premium' || userProfile.plan === 'pro') && !userProfile.planExpiryDate) {
    subscriptionStatus = "Süresiz";
  }

  const totalQuota = userProfile ? getDefaultQuota(userProfile.plan) : 0;
  const usedQuota = userProfile ? totalQuota - userProfile.dailyRemainingQuota : 0;
  const quotaPercentage = totalQuota > 0 ? (usedQuota / totalQuota) * 100 : 0;

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

      <Card className="shadow-md bg-card">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" /> Genel Bakış
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <Card className="bg-background/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <CalendarClock size={16} /> YKS Geri Sayım
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingDates ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <>
                  {(tytTargetDate || aytTargetDate) ? (
                    <>
                     {tytTargetDate && <CountdownItem targetDate={tytTargetDate} title="TYT" />}
                     {aytTargetDate && <CountdownItem targetDate={aytTargetDate} title="AYT" />}
                    </>
                  ) : (
                     <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle size={14}/>Sınav tarihleri ayarlanmamış.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-background/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Gem size={16} /> Abonelik Durumu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-lg font-semibold text-primary">{userProfile?.plan.charAt(0).toUpperCase() + userProfile.plan.slice(1)} Plan</p>
              {subscriptionStatus && <p className="text-xs text-muted-foreground">{subscriptionStatus}</p>}
              {!subscriptionStatus && userProfile?.plan === 'free' && <p className="text-xs text-muted-foreground">Temel Ücretsiz Plan</p>}
            </CardContent>
          </Card>
          
          <Card className="bg-background/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Gauge size={16} /> Günlük Kullanım Hakkı
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Progress value={quotaPercentage} className="h-2 [&>div]:bg-primary" />
              <p className="text-sm font-semibold text-foreground">{usedQuota} / {totalQuota}</p>
              <p className="text-xs text-muted-foreground">Kalan: {userProfile?.dailyRemainingQuota}</p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>


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
