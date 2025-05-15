"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Presentation, Wand2, Loader2, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { explainTopic, type ExplainTopicOutput, type ExplainTopicInput } from "@/ai/flows/topic-explainer-flow";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function TopicExplainerPage() {
  const [topicName, setTopicName] = useState("");
  const [explanationOutput, setExplanationOutput] = useState<ExplainTopicOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
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
    if (!topicName.trim() || topicName.trim().length < 3) {
      toast({ title: "Konu Gerekli", description: "Lütfen en az 3 karakterden oluşan bir YKS konu başlığı girin.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setExplanationOutput(null);

    const currentProfile = await memoizedCheckAndResetQuota();
    if (!currentProfile || (currentProfile.dailyRemainingQuota ?? 0) <= 0) {
      toast({ title: "Kota Aşıldı", description: "Bugünkü hakkınızı doldurdunuz.", variant: "destructive" });
      setIsGenerating(false);
      setCanProcess(false);
      return;
    }
    setCanProcess(true);

    try {
      if (!currentProfile?.plan) {
        throw new Error("Kullanıcı planı bulunamadı.");
      }
      const input: ExplainTopicInput = {
        topicName,
        userPlan: currentProfile.plan
      };
      const result = await explainTopic(input);

      if (result && result.explanation) {
        setExplanationOutput(result);
        toast({ title: "Konu Anlatımı Hazır!", description: "Belirttiğiniz konu için detaylı bir anlatım oluşturuldu." });
        if (decrementQuota) {
          await decrementQuota(currentProfile);
        }
        const updatedProfileAgain = await memoizedCheckAndResetQuota();
        if (updatedProfileAgain) {
          setCanProcess((updatedProfileAgain.dailyRemainingQuota ?? 0) > 0);
        }
      } else {
        throw new Error("Yapay zeka bir konu anlatımı üretemedi.");
      }
    } catch (error: any) {
      console.error("Konu anlatımı oluşturma hatası:", error);
      toast({
        title: "Anlatım Oluşturma Hatası",
        description: error.message || "Konu anlatımı oluşturulurken beklenmedik bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const isSubmitDisabled = isGenerating || !topicName.trim() || topicName.trim().length < 3 || (!canProcess && !userProfileLoading && (userProfile?.dailyRemainingQuota ?? 0) <= 0);

  if (userProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">AI Konu Anlatımı Oluşturucu yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Presentation className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl">AI Konu Anlatımı Oluşturucu</CardTitle>
          </div>
          <CardDescription>
            Öğrenmek istediğiniz YKS konusunu girin, yapay zeka sizin için konuyu detaylıca anlatsın, anahtar kavramları ve YKS ipuçlarını versin.
          </CardDescription>
        </CardHeader>
      </Card>

      {!canProcess && !isGenerating && userProfile && (userProfile.dailyRemainingQuota ?? 0) <= 0 && (
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
          <CardHeader>
            <CardTitle className="text-lg">Anlatılacak Konu</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label htmlFor="topicName">YKS Konu Başlığı</Label>
              <Input
                id="topicName"
                placeholder="örn: Matematik - Limit ve Süreklilik, Edebiyat - Tanzimat Dönemi..."
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                className="text-base mt-1"
                disabled={isGenerating || !canProcess}
              />
               <p className="text-xs text-muted-foreground mt-1">Lütfen açıklanmasını istediğiniz konuyu girin (en az 3 karakter).</p>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Konu Anlatımı Oluştur
            </Button>
          </CardContent>
        </Card>
      </form>

      {isGenerating && !explanationOutput && (
        <Card className="mt-6 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium text-foreground">Konu Anlatımı Oluşturuluyor...</p>
              <p className="text-sm text-muted-foreground">
                Yapay zeka sihrini yapıyor... Bu işlem biraz zaman alabilir.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {explanationOutput && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{explanationOutput.explanationTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ScrollArea className="h-[600px] w-full rounded-md border p-4 bg-muted/30">
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line leading-relaxed">
                <h3 className="text-lg font-semibold mt-3 mb-1 text-foreground">Detaylı Konu Anlatımı:</h3>
                <p>{explanationOutput.explanation}</p>

                {explanationOutput.keyConcepts && explanationOutput.keyConcepts.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold mt-4 mb-1 text-foreground">Anahtar Kavramlar:</h3>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {explanationOutput.keyConcepts.map((concept, index) => (
                        <li key={index}>{concept}</li>
                      ))}
                    </ul>
                  </>
                )}
                
                {explanationOutput.commonMistakes && explanationOutput.commonMistakes.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold mt-4 mb-1 text-foreground">Sık Yapılan Hatalar:</h3>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {explanationOutput.commonMistakes.map((mistake, index) => (
                        <li key={index}>{mistake}</li>
                      ))}
                    </ul>
                  </>
                )}

                {explanationOutput.yksTips && explanationOutput.yksTips.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold mt-4 mb-1 text-foreground">YKS İpuçları:</h3>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {explanationOutput.yksTips.map((tip, index) => (
                        <li key={index}>{tip}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </ScrollArea>
            <div className="mt-4 p-3 text-xs text-destructive-foreground bg-destructive/80 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>NeutralEdu AI bir yapay zekadır bu nedenle hata yapabilir, bu yüzden verdiği bilgileri doğrulayınız.</span>
            </div>
          </CardContent>
        </Card>
      )}
      {!isGenerating && !explanationOutput && !userProfileLoading && (
         <Alert className="mt-6">
          <Presentation className="h-4 w-4" />
          <AlertTitle>Anlatıma Hazır!</AlertTitle>
          <AlertDescription>
            Yukarıya bir YKS konu başlığı girerek yapay zekanın sizin için detaylı bir konu anlatımı oluşturmasını sağlayın.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
