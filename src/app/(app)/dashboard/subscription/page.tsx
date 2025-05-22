
"use client";

import { useUser } from "@/hooks/useUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Gem, CheckCircle, ExternalLink, AlertTriangle, CalendarClock, Ticket } from "lucide-react";
import Link from "next/link";
import { getDefaultQuota } from "@/lib/firebase/firestore";
import { Badge } from "@/components/ui/badge";
import { Timestamp } from "firebase/firestore";
import { format, differenceInDays, isToday, isPast, formatDistanceToNowStrict } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { applyCouponCodeAction } from "@/app/actions/couponActions";


export default function SubscriptionPage() {
  const { userProfile, loading: userLoading, fetchUserProfile } = useUser();
  const [couponCode, setCouponCode] = useState("");
  const [isLoadingCoupon, setIsLoadingCoupon] = useState(false);
  const { toast } = useToast();

  const handleRedeemCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) {
      toast({ title: "Kupon Kodu Gerekli", description: "Lütfen bir kupon kodu girin.", variant: "destructive" });
      return;
    }
    setIsLoadingCoupon(true);
    try {
      const result = await applyCouponCodeAction(couponCode.trim());
      if (result.success) {
        toast({ title: "Kupon Kullanıldı!", description: result.message });
        setCouponCode("");
        if (userProfile) { // Fetch updated profile only if a profile was already loaded
          await fetchUserProfile(userProfile.uid); // Refresh user profile to show new plan details
        }
      } else {
        toast({ title: "Kupon Kullanma Hatası", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Beklenmedik Hata", description: error.message || "Kupon işlenirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsLoadingCoupon(false);
    }
  };


  if (userLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Abonelik Bilgileri Yükleniyor...</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive">Kullanıcı Bulunamadı</h2>
        <p className="text-muted-foreground mt-2">Abonelik bilgilerinizi görüntülemek için lütfen giriş yapın.</p>
      </div>
    );
  }

  const totalQuota = getDefaultQuota(userProfile.plan);
  const planName = userProfile.plan.charAt(0).toUpperCase() + userProfile.plan.slice(1);

  const planFeatures: Record<UserProfile["plan"], string[]> = {
    free: [
      `Günde ${FREE_PLAN_DAILY_QUOTA} Yapay Zeka İşlemi`,
      "Temel AI Yanıtları",
      "Standart Destek",
    ],
    premium: [
      `Günde ${PREMIUM_PLAN_DAILY_QUOTA} Yapay Zeka İşlemi`,
      "Gelişmiş AI Yanıtları ve Modelleri (potansiyel)",
      "Öncelikli Destek",
      "Daha Hızlı İşleme (potansiyel)",
    ],
    pro: [
      `Günde ${PRO_PLAN_DAILY_QUOTA} Yapay Zeka İşlemi`,
      "En Gelişmiş AI Yanıtları ve Modelleri (potansiyel)",
      "VIP Destek",
      "En Hızlı İşleme Önceliği (potansiyel)",
      "Yeni Özelliklere Erken Erişim (potansiyel)",
    ],
  };

  let expiryDateDisplay: string | null = null;
  let remainingTimeDisplay: string | null = null;

  if (userProfile.planExpiryDate && userProfile.planExpiryDate instanceof Timestamp) {
    const expiryDate = userProfile.planExpiryDate.toDate();
    expiryDateDisplay = format(expiryDate, 'PP', { locale: tr }); 

    const now = new Date();
    if (isPast(expiryDate) && !isToday(expiryDate)) {
      remainingTimeDisplay = "Süresi Doldu";
    } else if (isToday(expiryDate)) {
      remainingTimeDisplay = "Bugün Sona Eriyor";
    } else {
      const daysRemaining = differenceInDays(expiryDate, now);
      if (daysRemaining >= 0) {
        remainingTimeDisplay = formatDistanceToNowStrict(expiryDate, { locale: tr, addSuffix: true, unit: 'day' }).replace("içinde", "kaldı");
      } else {
         remainingTimeDisplay = "Süresi Doldu"; 
      }
    }
  }

  return (
    <div className="space-y-6 md:space-y-8 max-w-5xl mx-auto"> 
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Gem className="h-7 w-7 md:h-8 md:w-8 text-primary" />
            <CardTitle className="text-2xl md:text-3xl">Abonelik Detaylarım</CardTitle>
          </div>
          <CardDescription>
            Mevcut plan bilgilerinizi ve kullanım haklarınızı görüntüleyin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Mevcut Planınız</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm sm:text-base">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plan Adı:</span>
                <Badge 
                    variant={userProfile.plan === 'pro' ? 'default' : userProfile.plan === 'premium' ? 'secondary' : 'outline'}
                    className={
                        userProfile.plan === 'pro' ? 'bg-purple-600 hover:bg-purple-700 text-white text-base sm:text-lg px-3 py-1' : 
                        userProfile.plan === 'premium' ? 'bg-blue-500 hover:bg-blue-600 text-white text-base sm:text-lg px-3 py-1' : 'text-base sm:text-lg px-3 py-1'
                    }
                >
                    {planName}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Günlük Kalan Kullanım Hakkı:</span>
                <span className="font-semibold text-primary">{userProfile.dailyRemainingQuota} / {totalQuota}</span>
              </div>
              {(userProfile.plan === 'premium' || userProfile.plan === 'pro') && (
                <>
                  {expiryDateDisplay && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Plan Bitiş Tarihi:</span>
                      <span className="font-semibold">{expiryDateDisplay}</span>
                    </div>
                  )}
                  {remainingTimeDisplay && (
                    <div className="flex items-center justify-between pt-1 border-t border-dashed">
                      <span className="text-muted-foreground flex items-center"><CalendarClock size={16} className="mr-2"/>Kalan Süre:</span>
                      <Badge 
                        variant={remainingTimeDisplay === "Süresi Doldu" || remainingTimeDisplay === "Bugün Sona Eriyor" ? "destructive" : "outline"} 
                        className="font-semibold"
                      >
                        {remainingTimeDisplay}
                      </Badge>
                    </div>
                  )}
                   {!expiryDateDisplay && userProfile.plan !== 'free' && (
                     <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Plan Bitiş Tarihi:</span>
                        <span className="font-semibold">Süresiz</span>
                    </div>
                   )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">{planName} Plan Avantajları</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm sm:text-base">
                {planFeatures[userProfile.plan].map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

           <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2"><Ticket className="h-5 w-5"/>Kupon Kodu Kullan</CardTitle>
              <CardDescription>Bir kupon kodunuz varsa, buradan kullanabilirsiniz.</CardDescription>
            </CardHeader>
            <form onSubmit={handleRedeemCoupon}>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="couponCode" className="sr-only">Kupon Kodu</Label>
                  <Input
                    id="couponCode"
                    type="text"
                    placeholder="Kupon kodunuzu girin"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    disabled={isLoadingCoupon}
                    className="text-base"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isLoadingCoupon || !couponCode.trim()} className="w-full sm:w-auto">
                  {isLoadingCoupon ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Kodu Kullan"}
                </Button>
              </CardFooter>
            </form>
          </Card>


          {userProfile.plan !== "pro" && (
            <Card className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 border-primary/30">
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">
                  {userProfile.plan === "free" ? "Premium veya Pro'ya Yükseltin!" : "Pro'ya Yükseltin!"}
                </CardTitle>
                <CardDescription>
                  Daha fazla kullanım hakkı ve gelişmiş özellikler için planınızı yükseltin.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full text-sm sm:text-base">
                  <Link href="/pricing">
                    Planları İncele <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground">
                  Yükseltmeler şimdilik manuel olarak yapılmaktadır. Detaylar için fiyatlandırma sayfasını ziyaret edin.
                </p>
              </CardFooter>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    