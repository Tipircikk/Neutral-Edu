
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input as ShadInput } from "@/components/ui/input"; // Renamed to avoid conflict with HTML input
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileTextIcon, Wand2, Loader2, AlertTriangle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { generateTest, type GenerateTestOutput, type GenerateTestInput } from "@/ai/flows/test-generator-flow"; 

export default function TestGeneratorPage() {
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [testOutput, setTestOutput] = useState<GenerateTestOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
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
    if (!topic.trim()) {
      toast({ title: "Konu Gerekli", description: "Lütfen test oluşturmak istediğiniz konuyu girin.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setTestOutput(null);

    const currentProfile = await memoizedCheckAndResetQuota();
    if (!currentProfile || currentProfile.dailyRemainingQuota <= 0) {
      toast({ title: "Kota Aşıldı", description: "Bugünkü hakkınızı doldurdunuz.", variant: "destructive" });
      setIsGenerating(false);
      setCanProcess(false);
      return;
    }
    setCanProcess(true);

    try {
      const input: GenerateTestInput = { topic, numQuestions };
      const result = await generateTest(input);

      if (result && result.questions && result.questions.length > 0) {
        setTestOutput(result);
        toast({ title: "Test Hazır!", description: "Belirttiğiniz konu için bir test oluşturuldu." });
        if (decrementQuota) await decrementQuota();
        const updatedProfileAgain = await memoizedCheckAndResetQuota();
        if (updatedProfileAgain) {
          setCanProcess(updatedProfileAgain.dailyRemainingQuota > 0);
        }
      } else {
        throw new Error("Yapay zeka bir test üretemedi veya format hatalı.");
      }
    } catch (error: any) {
      console.error("Test oluşturma hatası:", error);
      toast({
        title: "Test Oluşturma Hatası",
        description: error.message || "Test oluşturulurken beklenmedik bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const isSubmitDisabled = isGenerating || !topic.trim() || (!canProcess && !userProfileLoading && (userProfile?.dailyRemainingQuota ?? 0) <=0);

  if (userProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">AI Test Oluşturucu yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileTextIcon className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl">AI Test Oluşturucu</CardTitle>
          </div>
          <CardDescription>
            Belirlediğiniz konularda özel pratik testleri anında oluşturun.
          </CardDescription>
        </CardHeader>
      </Card>

      {!canProcess && !isGenerating && userProfile && userProfile.dailyRemainingQuota <=0 && (
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
            <div>
              <Label htmlFor="topic" className="block text-sm font-medium text-foreground mb-1">Test Konusu</Label>
              <Textarea
                id="topic"
                placeholder="Örneğin: Hücre Biyolojisi, Osmanlı Tarihi Yükselme Dönemi, Limit ve Türev..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
                className="text-base"
                disabled={isGenerating || !canProcess}
              />
            </div>
            <div>
                <Label htmlFor="numQuestions" className="block text-sm font-medium text-foreground mb-1">Soru Sayısı</Label>
                <ShadInput 
                    type="number" 
                    id="numQuestions"
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(parseInt(e.target.value,10))}
                    min="3"
                    max="20"
                    className="w-full p-2 border rounded-md bg-input border-border"
                    disabled={isGenerating || !canProcess}
                />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Test Oluştur
            </Button>
          </CardContent>
        </Card>
      </form>
      
      {isGenerating && !testOutput && (
        <Card className="mt-6 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium text-foreground">Test Oluşturuluyor...</p>
              <p className="text-sm text-muted-foreground">
                Yapay zeka sihrini yapıyor... Bu işlem biraz zaman alabilir.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {testOutput && testOutput.questions && testOutput.questions.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{testOutput.testTitle || "Oluşturulan Test"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {testOutput.questions.map((q, index) => (
              <div key={index} className="p-4 border rounded-md bg-muted/50">
                <p className="font-semibold text-foreground">Soru {index + 1} ({q.questionType}): {q.questionText}</p>
                {q.options && q.options.length > 0 && (
                  <ul className="list-disc pl-5 mt-2 text-sm text-muted-foreground">
                    {q.options.map((opt, i) => <li key={i}>{opt}</li>)}
                  </ul>
                )}
                <p className="mt-2 text-sm"><span className="font-medium text-primary">Doğru Cevap:</span> {q.correctAnswer}</p>
                {q.explanation && <p className="mt-1 text-xs text-muted-foreground italic"><span className="font-medium">Açıklama:</span> {q.explanation}</p>}
              </div>
            ))}
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
