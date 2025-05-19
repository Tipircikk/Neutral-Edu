
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lightbulb, Brain, Loader2, AlertTriangle, Settings } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { summarizeTopic, type SummarizeTopicOutput, type SummarizeTopicInput } from "@/ai/flows/topic-summarizer-flow";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function TopicSummarizerPage() {
  const [topicOrText, setTopicOrText] = useState("");
  const [summaryOutput, setSummaryOutput] = useState<SummarizeTopicOutput | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryLength, setSummaryLength] = useState<SummarizeTopicInput["summaryLength"]>("medium");
  const [outputFormat, setOutputFormat] = useState<SummarizeTopicInput["outputFormat"]>("paragraph");
  const [adminSelectedModel, setAdminSelectedModel] = useState<string | undefined>(undefined);

  const { toast } = useToast();
  const { userProfile, loading: userProfileLoading, checkAndResetQuota, decrementQuota } = useUser();
  const [canProcess, setCanProcess] = useState(false);

  const memoizedCheckAndResetQuota = useCallback(async () => {
    if (!checkAndResetQuota) return userProfile;
    return checkAndResetQuota();
  }, [checkAndResetQuota, userProfile]);

  useEffect(() => {
    if (!userProfileLoading) {
      if (userProfile) {
        memoizedCheckAndResetQuota().then(updatedProfile => {
          setCanProcess((updatedProfile?.dailyRemainingQuota ?? 0) > 0);
        });
      } else {
        setCanProcess(false);
      }
    }
  }, [userProfile, userProfileLoading, memoizedCheckAndResetQuota]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicOrText.trim()) {
      toast({ title: "Konu veya Metin Gerekli", description: "Lütfen özetlemek istediğiniz konuyu veya metni girin.", variant: "destructive" });
      return;
    }

    setIsSummarizing(true);
    setSummaryOutput(null);

    const currentProfile = await memoizedCheckAndResetQuota();
    if (!currentProfile || (currentProfile.dailyRemainingQuota ?? 0) <= 0) {
      toast({ title: "Kota Aşıldı", description: "Bugünkü hakkınızı doldurdunuz.", variant: "destructive" });
      setIsSummarizing(false);
      setCanProcess(false);
      return;
    }
    setCanProcess(true);

    try {
      if (!currentProfile?.plan) {
        throw new Error("Kullanıcı planı bulunamadı.");
      }
      const input: SummarizeTopicInput = { 
        inputText: topicOrText, 
        summaryLength, 
        outputFormat,
        userPlan: currentProfile.plan,
        customModelIdentifier: userProfile?.isAdmin ? adminSelectedModel : undefined,
      };
      const result = await summarizeTopic(input);

      if (result && result.topicSummary) {
        setSummaryOutput(result);
        toast({ title: "Özet Hazır!", description: "Konu veya metin başarıyla özetlendi." });
        if (decrementQuota) {
            await decrementQuota(currentProfile);
        }
        const updatedProfileAgain = await memoizedCheckAndResetQuota();
        if (updatedProfileAgain) {
          setCanProcess((updatedProfileAgain.dailyRemainingQuota ?? 0) > 0);
        }
      } else {
        const errorMessage = result?.topicSummary || "Yapay zeka bir özet üretemedi.";
        toast({ title: "Özetleme Sonucu Yetersiz", description: errorMessage, variant: "destructive"});
        setSummaryOutput({ topicSummary: errorMessage, keyConcepts: [], yksConnections: [], sourceReliability: "Hata oluştu." });
      }
    } catch (error: any) {
      console.error("Konu özetleme hatası:", error);
      toast({ title: "Özetleme Hatası", description: error.message || "Konu özetlenirken beklenmedik bir hata oluştu.", variant: "destructive" });
       setSummaryOutput({ topicSummary: error.message || "Beklenmedik bir hata oluştu.", keyConcepts: [], yksConnections: [], sourceReliability: "Hata oluştu." });
    } finally {
      setIsSummarizing(false);
    }
  };
  
  const isSubmitButtonDisabled = 
    isSummarizing || 
    !topicOrText.trim() ||
    (!userProfileLoading && userProfile && !canProcess) ||
    (!userProfileLoading && !userProfile);

  const isModelSelectDisabled = 
    isSummarizing || 
    !userProfile?.isAdmin ||
    (!userProfileLoading && userProfile && !canProcess) ||
    (!userProfileLoading && !userProfile);

  const isFormElementsDisabled = 
    isSummarizing ||
    (!userProfileLoading && userProfile && !canProcess) ||
    (!userProfileLoading && !userProfile);


  if (userProfileLoading && !userProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">AI Konu Özetleyici yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Lightbulb className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl">AI Konu Özetleyici</CardTitle>
          </div>
          <CardDescription>
            Geniş konuları veya uzun metinleri temel kavramlarına indirgeyerek hızlı ve etkili bir şekilde öğrenin. Özet uzunluğunu ve çıktı formatını seçebilirsiniz.
          </CardDescription>
        </CardHeader>
         <CardContent>
          {userProfile?.isAdmin && (
              <div className="space-y-2 p-4 mb-4 border rounded-md bg-muted/50">
                <Label htmlFor="adminModelSelectTopicSum" className="font-semibold text-primary flex items-center gap-2"><Settings size={16}/> Model Seç (Admin Özel)</Label>
                <Select 
                  value={adminSelectedModel} 
                  onValueChange={setAdminSelectedModel} 
                  disabled={isModelSelectDisabled}
                >
                  <SelectTrigger id="adminModelSelectTopicSum">
                    <SelectValue placeholder="Varsayılan Modeli Kullan (Plan Bazlı)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default_gemini_flash">Varsayılan (Gemini 2.0 Flash)</SelectItem>
                    <SelectItem value="experimental_gemini_1_5_flash">Deneysel (Gemini 1.5 Flash)</SelectItem>
                    <SelectItem value="experimental_gemini_2_5_flash_preview">Deneysel (Gemini 2.5 Flash Preview)</SelectItem>
                  </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground">Farklı AI modellerini test edebilirsiniz.</p>
              </div>
            )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div>
                <Label htmlFor="summaryLength" className="mb-1 block">Özet Uzunluğu</Label>
                <Select
                value={summaryLength}
                onValueChange={(value: SummarizeTopicInput["summaryLength"]) => setSummaryLength(value)}
                disabled={isFormElementsDisabled}
                >
                <SelectTrigger id="summaryLength">
                    <SelectValue placeholder="Özet uzunluğunu seçin" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="short">Kısa (Ana Hatlar)</SelectItem>
                    <SelectItem value="medium">Orta (Dengeli)</SelectItem>
                    <SelectItem value="detailed">Detaylı (Derinlemesine)</SelectItem>
                </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="outputFormat" className="mb-1 block">Çıktı Formatı</Label>
                <Select
                value={outputFormat}
                onValueChange={(value: SummarizeTopicInput["outputFormat"]) => setOutputFormat(value)}
                disabled={isFormElementsDisabled}
                >
                <SelectTrigger id="outputFormat">
                    <SelectValue placeholder="Çıktı formatını seçin" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="paragraph">Paragraf</SelectItem>
                    <SelectItem value="bullet_points">Madde İşaretleri</SelectItem>
                </SelectContent>
                </Select>
            </div>
          </div>
        </CardContent>
      </Card>

       {!userProfileLoading && userProfile && !canProcess && !isSummarizing && (userProfile.dailyRemainingQuota ?? 0) <=0 && (
         <Alert variant="destructive" className="shadow-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Günlük Kota Doldu</AlertTitle>
          <AlertDescription>
            Bugünlük ücretsiz hakkınızı kullandınız. Lütfen yarın tekrar kontrol edin veya Premium/Pro'ya yükseltin.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Textarea
              placeholder="Özetlemek istediğiniz konuyu (Örn: Fotosentez, İkinci Dünya Savaşı'nın Nedenleri) veya metni buraya yapıştırın..."
              value={topicOrText}
              onChange={(e) => setTopicOrText(e.target.value)}
              rows={8}
              className="text-base"
              disabled={isFormElementsDisabled}
            />
            <Button type="submit" className="w-full" disabled={isSubmitButtonDisabled}>
              {isSummarizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
              Özetle
            </Button>
          </CardContent>
        </Card>
      </form>

      {isSummarizing && !summaryOutput && (
        <Card className="mt-6 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium text-foreground">Özet Oluşturuluyor...</p>
              <p className="text-sm text-muted-foreground">
                Yapay zeka sihrini yapıyor... Bu işlem biraz zaman alabilir.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {summaryOutput && summaryOutput.topicSummary && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Konu Özeti</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-auto max-h-[500px] w-full rounded-md border p-4 bg-muted/30">
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line">
                <p>{summaryOutput.topicSummary}</p>
                {summaryOutput.keyConcepts && summaryOutput.keyConcepts.length > 0 && (
                    <>
                    <h3 className="font-semibold text-foreground mt-4">Anahtar Kavramlar:</h3>
                    <ul className="list-disc pl-5">
                        {summaryOutput.keyConcepts.map((concept, index) => (
                        <li key={index}>{concept}</li>
                        ))}
                    </ul>
                    </>
                )}
                {summaryOutput.yksConnections && summaryOutput.yksConnections.length > 0 && (
                    <>
                    <h3 className="font-semibold text-foreground mt-4">YKS Bağlantıları:</h3>
                    <ul className="list-disc pl-5">
                        {summaryOutput.yksConnections.map((connection, index) => (
                        <li key={index}>{connection}</li>
                        ))}
                    </ul>
                    </>
                )}
                </div>
            </ScrollArea>
             {summaryOutput.sourceReliability && (
                <p className="text-xs text-muted-foreground mt-3 italic">Kaynak Güvenilirliği/Not: {summaryOutput.sourceReliability}</p>
            )}
            <div className="mt-4 p-3 text-xs text-destructive-foreground bg-destructive/80 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>NeutralEdu AI bir yapay zekadır bu nedenle hata yapabilir, bu yüzden verdiği bilgileri doğrulayınız.</span>
            </div>
          </CardContent>
        </Card>
      )}
      {!isSummarizing && !summaryOutput && !userProfileLoading && (userProfile || !userProfile) &&(
        <Alert className="mt-6">
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>Özete Hazır!</AlertTitle>
          <AlertDescription>
            Yukarıdaki metin alanına bir konu veya metin girerek ve ayarları yaparak YKS odaklı özetinizi alın.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

    