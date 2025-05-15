
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LayoutGrid, Wand2, Loader2, AlertTriangle } from "lucide-react"; // Changed icon
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
// import { generateFlashcards, type GenerateFlashcardsOutput, type GenerateFlashcardsInput } from "@/ai/flows/flashcard-generator-flow"; // Placeholder import

export default function FlashcardGeneratorPage() {
  const [inputText, setInputText] = useState("");
  // const [flashcardsOutput, setFlashcardsOutput] = useState<GenerateFlashcardsOutput | null>(null); // Placeholder state
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
    if (!inputText.trim()) {
      toast({ title: "Metin Gerekli", description: "Lütfen bilgi kartı oluşturmak için bir metin girin.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    // setFlashcardsOutput(null); // Placeholder

    const currentProfile = await memoizedCheckAndResetQuota();
    if (!currentProfile || currentProfile.dailyRemainingQuota <= 0) {
      toast({ title: "Kota Aşıldı", description: "Bugünkü hakkınızı doldurdunuz.", variant: "destructive" });
      setIsGenerating(false);
      setCanProcess(false);
      return;
    }
    setCanProcess(true);

    try {
      // const input: GenerateFlashcardsInput = { textContent: inputText }; // Placeholder input
      // const result = await generateFlashcards(input); // Placeholder call

      // if (result && result.flashcards && result.flashcards.length > 0) {
      //   setFlashcardsOutput(result);
      //   toast({ title: "Bilgi Kartları Hazır!", description: "Metniniz için bilgi kartları oluşturuldu." });
      //   if (decrementQuota) await decrementQuota();
      //   const updatedProfileAgain = await memoizedCheckAndResetQuota();
      //   if (updatedProfileAgain) {
      //     setCanProcess(updatedProfileAgain.dailyRemainingQuota > 0);
      //   }
      // } else {
      //   throw new Error("Yapay zeka bilgi kartı üretemedi.");
      // }
      toast({ title: "Yakında!", description: "Bu özellik şu anda geliştirme aşamasındadır.", variant: "default" });
      // Simulating a delay for demo
      await new Promise(resolve => setTimeout(resolve, 1000));


    } catch (error: any) {
      console.error("Bilgi kartı oluşturma hatası:", error);
      toast({
        title: "Oluşturma Hatası",
        description: error.message || "Bilgi kartları oluşturulurken beklenmedik bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const isSubmitDisabled = isGenerating || !inputText.trim() || (!canProcess && !userProfileLoading && (userProfile?.dailyRemainingQuota ?? 0) <=0);

  if (userProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">AI Bilgi Kartı Oluşturucu yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <LayoutGrid className="h-7 w-7 text-primary" /> 
            <CardTitle className="text-2xl">AI Bilgi Kartı Oluşturucu</CardTitle>
          </div>
          <CardDescription>
            Öğrenmek istediğiniz metni girin, yapay zeka sizin için önemli kavramlardan etkileşimli bilgi kartları (flashcards) oluştursun. (Yakında)
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
            <Textarea
              placeholder="Bilgi kartlarına dönüştürmek istediğiniz metni, tanımları veya anahtar noktaları buraya yapıştırın..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={8}
              className="text-base"
              disabled={isGenerating || !canProcess}
            />
            <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Bilgi Kartları Oluştur (Yakında)
            </Button>
          </CardContent>
        </Card>
      </form>

      {isGenerating /*&& !flashcardsOutput*/ && (
        <Card className="mt-6 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium text-foreground">Bilgi Kartları Oluşturuluyor...</p>
              <p className="text-sm text-muted-foreground">
                Yapay zeka sihrini yapıyor... Bu işlem biraz zaman alabilir.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Placeholder for displaying flashcards - to be implemented
      {flashcardsOutput && flashcardsOutput.flashcards && flashcardsOutput.flashcards.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Oluşturulan Bilgi Kartları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {flashcardsOutput.flashcards.map((card, index) => (
              <div key={index} className="p-4 border rounded-md bg-muted/50">
                <p className="font-semibold text-foreground">Ön Yüz: {card.front}</p>
                <p className="mt-2 text-sm text-muted-foreground">Arka Yüz: {card.back}</p>
              </div>
            ))}
             <div className="mt-4 p-3 text-xs text-destructive-foreground bg-destructive/80 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>NeutralEdu AI bir yapay zekadır bu nedenle hata yapabilir, bu yüzden verdiği bilgileri doğrulayınız.</span>
            </div>
          </CardContent>
        </Card>
      )}
      */}
       <Alert variant="default" className="mt-6 shadow-md bg-accent/50 border-primary/30">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">Bu Araç Geliştirme Aşamasında</AlertTitle>
          <AlertDescription>
            AI Bilgi Kartı Oluşturucu yakında sizlerle olacak. Gelişmeler için takipte kalın!
          </AlertDescription>
        </Alert>
    </div>
  );
}
