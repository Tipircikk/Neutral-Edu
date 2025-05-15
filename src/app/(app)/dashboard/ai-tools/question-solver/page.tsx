
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HelpCircle, Send, Loader2, AlertTriangle, UploadCloud, Image as ImageIcon } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { solveQuestion, type SolveQuestionOutput, type SolveQuestionInput } from "@/ai/flows/question-solver-flow"; 
import NextImage from "next/image"; 

export default function QuestionSolverPage() {
  const [questionText, setQuestionText] = useState("");
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [answer, setAnswer] = useState<SolveQuestionOutput | null>(null);
  const [isSolving, setIsSolving] = useState(false);
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

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "Dosya Boyutu Büyük", description: "Lütfen 5MB'den küçük bir görsel yükleyin.", variant: "destructive" });
        event.target.value = ""; 
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageDataUri(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImageFile(null);
      setImageDataUri(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() && !imageDataUri) {
      toast({ title: "Girdi Gerekli", description: "Lütfen bir soru metni girin veya bir görsel yükleyin.", variant: "destructive" });
      return;
    }

    setIsSolving(true);
    setAnswer(null);

    const currentProfile = await memoizedCheckAndResetQuota();
    if (!currentProfile || (currentProfile.dailyRemainingQuota ?? 0) <= 0) {
      toast({ title: "Kota Aşıldı", description: "Bugünkü hakkınızı doldurdunuz.", variant: "destructive" });
      setIsSolving(false);
      setCanProcess(false);
      return;
    }
    setCanProcess(true);

    try {
      if (!currentProfile?.plan) {
        throw new Error("Kullanıcı planı bulunamadı.");
      }
      const input: SolveQuestionInput = { 
        questionText: questionText.trim() || undefined, 
        userPlan: currentProfile.plan 
      };
      if (imageDataUri) {
        input.imageDataUri = imageDataUri;
      }
      const result = await solveQuestion(input);

      if (result && result.solution) {
        setAnswer(result);
        toast({ title: "Çözüm Hazır!", description: "Sorunuz için bir çözüm oluşturuldu." });
        if (decrementQuota) {
            await decrementQuota(currentProfile); // Pass currentProfile
        }
        const updatedProfileAgain = await memoizedCheckAndResetQuota();
        if (updatedProfileAgain) {
          setCanProcess((updatedProfileAgain.dailyRemainingQuota ?? 0) > 0);
        }
      } else {
        throw new Error("Yapay zeka bir çözüm üretemedi.");
      }
    } catch (error: any) {
      console.error("Soru çözme hatası:", error);
      toast({
        title: "Çözüm Hatası",
        description: error.message || "Soru çözülürken beklenmedik bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsSolving(false);
    }
  };
  
  const isSubmitDisabled = isSolving || (!questionText.trim() && !imageDataUri) || (!canProcess && !userProfileLoading && (userProfile?.dailyRemainingQuota ?? 0) <=0);


  if (userProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">AI Soru Çözücü yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <HelpCircle className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl">AI Soru Çözücü</CardTitle>
          </div>
          <CardDescription>
            Aklınızdaki soruları sorun, yapay zeka size adım adım çözümler ve açıklamalar sunsun. İsterseniz soru içeren bir görsel de yükleyebilirsiniz.
          </CardDescription>
        </CardHeader>
      </Card>

      {!canProcess && !isSolving && userProfile && (userProfile.dailyRemainingQuota ?? 0) <=0 && (
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
            <div>
              <label htmlFor="questionText" className="block text-sm font-medium text-foreground mb-1">Soru Metni (isteğe bağlı)</label>
              <Textarea
                id="questionText"
                placeholder="Örneğin: Bir dik üçgenin hipotenüsü 10 cm, bir dik kenarı 6 cm ise diğer dik kenarı kaç cm'dir?"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={5}
                className="text-base"
                disabled={isSolving || !canProcess}
              />
            </div>
            <div className="space-y-2">
                <label htmlFor="imageUpload" className="block text-sm font-medium text-foreground">Soru Görseli Yükle (isteğe bağlı, maks 5MB)</label>
                 <Input
                    id="imageUpload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    disabled={isSolving || !canProcess}
                />
                {imageDataUri && imageFile && (
                  <div className="mt-2 p-2 border rounded-md bg-muted">
                    <p className="text-sm text-muted-foreground mb-2">Seçilen görsel: {imageFile.name}</p>
                    <NextImage src={imageDataUri} alt="Yüklenen soru görseli" width={200} height={200} className="rounded-md object-contain max-h-48" />
                  </div>
                )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
              {isSolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Çözüm İste
            </Button>
          </CardContent>
        </Card>
      </form>

      {isSolving && !answer && (
        <Card className="mt-6 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium text-foreground">Çözüm Oluşturuluyor...</p>
              <p className="text-sm text-muted-foreground">
                Yapay zeka sihrini yapıyor... Bu işlem biraz zaman alabilir.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {answer && answer.solution && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Yapay Zeka Çözümü</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line">
              <h3 className="font-semibold text-foreground">Çözüm:</h3>
              <p>{answer.solution}</p>
              {answer.relatedConcepts && answer.relatedConcepts.length > 0 && (
                <>
                  <h3 className="font-semibold text-foreground mt-4">İlgili Kavramlar:</h3>
                  <ul className="list-disc pl-5">
                    {answer.relatedConcepts.map((concept, index) => (
                      <li key={index}>{concept}</li>
                    ))}
                  </ul>
                </>
              )}
               {answer.examStrategyTips && answer.examStrategyTips.length > 0 && (
                <>
                  <h3 className="font-semibold text-foreground mt-4">Sınav Stratejisi İpuçları:</h3>
                  <ul className="list-disc pl-5">
                    {answer.examStrategyTips.map((tip, index) => (
                      <li key={index}>{tip}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            {answer.confidenceScore !== undefined && (
                <p className="text-xs text-muted-foreground mt-3 italic">AI Güven Skoru: {Math.round(answer.confidenceScore * 100)}%</p>
            )}
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
