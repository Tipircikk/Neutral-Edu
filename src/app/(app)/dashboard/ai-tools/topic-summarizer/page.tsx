
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lightbulb, Brain, Loader2, AlertTriangle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { summarizeTopic, type SummarizeTopicOutput, type SummarizeTopicInput } from "@/ai/flows/topic-summarizer-flow";

export default function TopicSummarizerPage() {
  const [topicOrText, setTopicOrText] = useState("");
  const [summaryOutput, setSummaryOutput] = useState<SummarizeTopicOutput | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const { toast } = useToast();
  const { userProfile, loading: userProfileLoading, checkAndResetQuota, decrementQuota } = useUser();
  const [canProcess, setCanProcess] = useState(false);

  const memoizedCheckAndResetQuota = useCallback(() => {
    if (checkAndResetQuota) return checkAndResetQuota();
    return Promise.resolve(userProfile);
  }, [checkAndResetQuota, userProfile]);

  useEffect(() => {
    if (userProfile) {
      memoizedCheckAndResetQuota().then(updatedProfile => {
        setCanProcess((updatedProfile?.dailyRemainingQuota ?? 0) > 0);
      });
    }
  }, [userProfile, memoizedCheckAndResetQuota]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicOrText.trim()) {
      toast({ title: "Konu veya Metin Gerekli", description: "Lütfen özetlemek istediğiniz konuyu veya metni girin.", variant: "destructive" });
      return;
    }

    setIsSummarizing(true);
    setSummaryOutput(null);

    const currentProfile = await memoizedCheckAndResetQuota();
    if (!currentProfile || currentProfile.dailyRemainingQuota <= 0) {
      toast({ title: "Kota Aşıldı", description: "Bugünkü hakkınızı doldurdunuz.", variant: "destructive" });
      setIsSummarizing(false);
      setCanProcess(false);
      return;
    }
    setCanProcess(true);

    try {
      const input: SummarizeTopicInput = { inputText: topicOrText, summaryLength: "medium", outputFormat: "paragraph" }; // Default values
      const result = await summarizeTopic(input);

      if (result && result.topicSummary) {
        setSummaryOutput(result);
        toast({ title: "Özet Hazır!", description: "Konu veya metin başarıyla özetlendi." });
        if (decrementQuota) await decrementQuota();
        const updatedProfileAgain = await memoizedCheckAndResetQuota();
        if (updatedProfileAgain) {
          setCanProcess(updatedProfileAgain.dailyRemainingQuota > 0);
        }
      } else {
        throw new Error("Yapay zeka bir özet üretemedi.");
      }
    } catch (error: any) {
      console.error("Konu özetleme hatası:", error);
      toast({
        title: "Özetleme Hatası",
        description: error.message || "Konu özetlenirken beklenmedik bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsSummarizing(false);
    }
  };
  
  const isSubmitDisabled = isSummarizing || !topicOrText.trim() || (!canProcess && !userProfileLoading && (userProfile?.dailyRemainingQuota ?? 0) <=0);

  if (userProfileLoading) {
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
            Geniş konuları veya uzun metinleri temel kavramlarına indirgeyerek hızlı ve etkili bir şekilde öğrenin.
          </CardDescription>
        </CardHeader>
      </Card>

       {!canProcess && !isSummarizing && userProfile && userProfile.dailyRemainingQuota <=0 && (
         <Alert variant="destructive" className="shadow-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Günlük Kota Doldu</AlertTitle>
          <AlertDescription>
            Bugünlük ücretsiz hakkınızı kullandınız. Lütfen yarın tekrar kontrol edin.
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
              disabled={isSummarizing || !canProcess}
            />
            <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
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
            </div>
            <div className="mt-4 p-3 text-xs text-destructive-foreground bg-destructive/80 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>NeutralEdu AI bir yapay zekadır bu nedenle hata yapabilir, bu yüzden verdiği bilgileri doğrulayınız.</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
