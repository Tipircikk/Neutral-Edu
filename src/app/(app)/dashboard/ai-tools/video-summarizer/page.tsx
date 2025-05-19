
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Youtube, Loader2, AlertTriangle, Brain, List } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { summarizeVideo, type VideoSummarizerOutput, type VideoSummarizerInput } from "@/ai/flows/video-summarizer-flow";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function VideoSummarizerPage() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [summaryOutput, setSummaryOutput] = useState<VideoSummarizerOutput | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const { toast } = useToast();
  const { userProfile, loading: userProfileLoading, checkAndResetQuota, decrementQuota } = useUser();
  const [canProcess, setCanProcess] = useState(false);

  const memoizedCheckAndResetQuota = useCallback(async () => {
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
    if (!youtubeUrl.trim()) {
      toast({ title: "URL Gerekli", description: "Lütfen bir YouTube video URL'si girin.", variant: "destructive" });
      return;
    }
    // Basic URL validation (more robust validation can be added)
    try {
      new URL(youtubeUrl);
      if (!youtubeUrl.includes("youtube.com/") && !youtubeUrl.includes("youtu.be/")) {
        throw new Error("Geçersiz YouTube URL'si.");
      }
    } catch (_) {
      toast({ title: "Geçersiz URL", description: "Lütfen geçerli bir YouTube video URL'si girin.", variant: "destructive" });
      return;
    }

    setIsSummarizing(true);
    setSummaryOutput(null);

    const currentProfile = await memoizedCheckAndResetQuota();
    if (!currentProfile || (currentProfile.dailyRemainingQuota ?? 0) <= 0) {
      toast({ title: "Kota Aşıldı", description: "Bugünkü video özetleme hakkınızı doldurdunuz.", variant: "destructive" });
      setIsSummarizing(false);
      setCanProcess(false);
      return;
    }
    setCanProcess(true);

    try {
      if (!currentProfile?.plan) {
        throw new Error("Kullanıcı planı bulunamadı.");
      }
      const input: VideoSummarizerInput = {
        youtubeUrl,
        userPlan: currentProfile.plan
      };
      const result = await summarizeVideo(input);
      setSummaryOutput(result);

      if (result.summary || (result.keyPoints && result.keyPoints.length > 0)) {
        toast({ title: "Video Özeti Hazır!", description: result.videoTitle ? `"${result.videoTitle}" videosu için özet oluşturuldu.` : "Video için özet oluşturuldu." });
        if (decrementQuota) {
          await decrementQuota(currentProfile);
        }
        const updatedProfileAgain = await memoizedCheckAndResetQuota();
        if (updatedProfileAgain) {
          setCanProcess((updatedProfileAgain.dailyRemainingQuota ?? 0) > 0);
        }
      } else if (result.warnings && result.warnings.length > 0) {
         toast({ title: "Özetleme Bilgisi", description: result.warnings.join(" "), variant: "default" });
      } else {
        throw new Error("Yapay zeka bir video özeti üretemedi veya format hatalı.");
      }
    } catch (error: any) {
      console.error("Video özetleme hatası:", error);
      toast({
        title: "Video Özetleme Hatası",
        description: error.message || "Video özetlenirken beklenmedik bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  const isSubmitDisabled = isSummarizing || !youtubeUrl.trim() || (!canProcess && !userProfileLoading && (userProfile?.dailyRemainingQuota ?? 0) <= 0);

  if (userProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">AI Video Özetleyici yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Youtube className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl">AI YouTube Video Özetleyici</CardTitle>
          </div>
          <CardDescription>
            YouTube ders videolarının linkini girerek eğitimsel içeriklerini özetleyin. Bu özellik deneyseldir ve her video için çalışmayabilir.
          </CardDescription>
        </CardHeader>
      </Card>

      {!canProcess && !isSummarizing && userProfile && (userProfile.dailyRemainingQuota ?? 0) <= 0 && (
        <Alert variant="destructive" className="shadow-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Günlük Kota Doldu</AlertTitle>
          <AlertDescription>
            Bugünlük ücretsiz video özetleme hakkınızı kullandınız. Lütfen yarın tekrar kontrol edin veya Premium/Pro'ya yükseltin.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label htmlFor="youtubeUrl" className="block text-sm font-medium text-foreground mb-1">YouTube Video URL'si</Label>
              <Input
                id="youtubeUrl"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="text-base"
                disabled={isSummarizing || !canProcess}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
              {isSummarizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
              Videoyu Özetle
            </Button>
          </CardContent>
        </Card>
      </form>

      {isSummarizing && !summaryOutput && (
        <Card className="mt-6 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium text-foreground">Video Özetleniyor...</p>
              <p className="text-sm text-muted-foreground">
                Yapay zeka videoyu analiz ediyor... Bu işlem biraz zaman alabilir.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {summaryOutput && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{summaryOutput.videoTitle || "Video Özeti"}</CardTitle>
            {summaryOutput.warnings && summaryOutput.warnings.length > 0 && (
              <Alert variant="destructive" className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Uyarılar</AlertTitle>
                {summaryOutput.warnings.map((warn, index) => (
                  <AlertDescription key={index}>{warn}</AlertDescription>
                ))}
              </Alert>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {(summaryOutput.summary || (summaryOutput.keyPoints && summaryOutput.keyPoints.length > 0)) ? (
              <ScrollArea className="h-auto max-h-[500px] w-full rounded-md border p-4 bg-muted/30">
                {summaryOutput.summary && (
                  <>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Özet:</h3>
                    <p className="text-muted-foreground whitespace-pre-line">{summaryOutput.summary}</p>
                  </>
                )}
                {summaryOutput.keyPoints && summaryOutput.keyPoints.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">Anahtar Noktalar:</h3>
                    <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                      {summaryOutput.keyPoints.map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  </>
                )}
              </ScrollArea>
            ) : (
              !summaryOutput.warnings && <p className="text-muted-foreground">Bu video için bir özet veya anahtar nokta üretilemedi.</p>
            )}
             <div className="mt-4 p-3 text-xs text-destructive-foreground bg-destructive/80 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>NeutralEdu AI bir yapay zekadır bu nedenle hata yapabilir, bu yüzden verdiği bilgileri doğrulayınız. Video özetleme özelliği deneyseldir ve her zaman doğru sonuç vermeyebilir.</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
