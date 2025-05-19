
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LayoutGrid, Wand2, Loader2, AlertTriangle, Settings, RotateCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input as ShadInput } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { generateFlashcards, type GenerateFlashcardsOutput, type GenerateFlashcardsInput } from "@/ai/flows/flashcard-generator-flow";

export default function FlashcardGeneratorPage() {
  const [inputText, setInputText] = useState("");
  const [numFlashcards, setNumFlashcards] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<GenerateFlashcardsInput["difficulty"]>("medium");
  const [flashcardsOutput, setFlashcardsOutput] = useState<GenerateFlashcardsOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [adminSelectedModel, setAdminSelectedModel] = useState<string | undefined>(undefined);
  const [flippedStates, setFlippedStates] = useState<Record<number, boolean>>({});

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

  const handleFlipCard = (index: number) => {
    setFlippedStates(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) {
      toast({ title: "Metin Gerekli", description: "Lütfen bilgi kartı oluşturmak için bir metin girin.", variant: "destructive" });
      return;
    }
    if (inputText.trim().length < 50) {
      toast({ title: "Metin Çok Kısa", description: "Lütfen en az 50 karakterlik bir metin girin.", variant: "destructive" });
      return;
    }
    if (numFlashcards < 3 || numFlashcards > 15) {
      toast({ title: "Geçersiz Kart Sayısı", description: "Bilgi kartı sayısı 3 ile 15 arasında olmalıdır.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setFlashcardsOutput(null);
    setFlippedStates({}); // Reset flipped states for new cards

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
      const input: GenerateFlashcardsInput = {
        textContent: inputText,
        numFlashcards,
        difficulty,
        userPlan: currentProfile.plan,
        customModelIdentifier: userProfile?.isAdmin ? adminSelectedModel : undefined,
      };
      const result = await generateFlashcards(input);

      if (result && result.flashcards && result.flashcards.length > 0) {
        setFlashcardsOutput(result);
        toast({ title: "Bilgi Kartları Hazır!", description: "Metniniz için bilgi kartları oluşturuldu." });
        if (decrementQuota) {
          await decrementQuota(currentProfile);
        }
        const updatedProfileAgain = await memoizedCheckAndResetQuota();
        if (updatedProfileAgain) {
          setCanProcess((updatedProfileAgain.dailyRemainingQuota ?? 0) > 0);
        }
      } else {
        const errorMessage = result?.summaryTitle || "Yapay zeka bilgi kartı üretemedi veya format hatalı.";
        toast({ title: "Oluşturma Sonucu Yetersiz", description: errorMessage, variant: "destructive" });
        setFlashcardsOutput({ flashcards: [], summaryTitle: errorMessage });
      }
    } catch (error: any) {
      console.error("Bilgi kartı oluşturma hatası:", error);
      toast({
        title: "Oluşturma Hatası",
        description: error.message || "Bilgi kartları oluşturulurken beklenmedik bir hata oluştu.",
        variant: "destructive",
      });
      setFlashcardsOutput({ flashcards: [], summaryTitle: error.message || "Beklenmedik bir hata oluştu." });
    } finally {
      setIsGenerating(false);
    }
  };

  const isSubmitDisabled = isGenerating || !inputText.trim() || inputText.trim().length < 50 || (numFlashcards < 3 || numFlashcards > 15) || (!canProcess && !userProfileLoading && (userProfile?.dailyRemainingQuota ?? 0) <= 0);

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
            Öğrenmek istediğiniz metni girin (en az 50 karakter), yapay zeka sizin için önemli kavramlardan etkileşimli bilgi kartları (flashcards) oluştursun. Kartlara tıklayarak ön ve arka yüzlerini görebilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userProfile?.isAdmin && (
            <div className="space-y-2 p-4 mb-4 border rounded-md bg-muted/50">
              <Label htmlFor="adminModelSelectFlashcard" className="font-semibold text-primary flex items-center gap-2"><Settings size={16} /> Model Seç (Admin Özel)</Label>
              <Select value={adminSelectedModel} onValueChange={setAdminSelectedModel} disabled={isSubmitDisabled || isGenerating}>
                <SelectTrigger id="adminModelSelectFlashcard"><SelectValue placeholder="Varsayılan Modeli Kullan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default_gemini_flash">Varsayılan (Gemini 2.0 Flash)</SelectItem>
                  <SelectItem value="experimental_gemini_1_5_flash">Deneysel (Gemini 1.5 Flash)</SelectItem>
                  <SelectItem value="experimental_gemini_2_5_flash_preview">Deneysel (Gemini 2.5 Flash Preview)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Farklı AI modellerini test edebilirsiniz.</p>
            </div>
          )}
        </CardContent>
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
          <CardContent className="pt-6 space-y-4">
            <Textarea
              placeholder="Bilgi kartlarına dönüştürmek istediğiniz metni, tanımları veya anahtar noktaları buraya yapıştırın (en az 50 karakter)..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={8}
              className="text-base"
              disabled={isGenerating || !canProcess}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="numFlashcards" className="block text-sm font-medium text-foreground mb-1">Bilgi Kartı Sayısı (3-15)</Label>
                <ShadInput
                  type="number"
                  id="numFlashcards"
                  value={numFlashcards}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setNumFlashcards(isNaN(val) ? 3 : val);
                  }}
                  min="3"
                  max="15"
                  className="w-full p-2 border rounded-md bg-input border-border"
                  disabled={isGenerating || !canProcess}
                />
              </div>
              <div>
                <Label htmlFor="difficulty" className="block text-sm font-medium text-foreground mb-1">YKS Zorluk Seviyesi</Label>
                <Select
                  value={difficulty}
                  onValueChange={(value: GenerateFlashcardsInput["difficulty"]) => setDifficulty(value)}
                  disabled={isGenerating || !canProcess}
                >
                  <SelectTrigger id="difficulty">
                    <SelectValue placeholder="Zorluk seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Kolay</SelectItem>
                    <SelectItem value="medium">Orta</SelectItem>
                    <SelectItem value="hard">Zor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Bilgi Kartları Oluştur
            </Button>
          </CardContent>
        </Card>
      </form>

      {isGenerating && !flashcardsOutput && (
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

      {flashcardsOutput && flashcardsOutput.flashcards && flashcardsOutput.flashcards.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{flashcardsOutput.summaryTitle || "Oluşturulan Bilgi Kartları"}</CardTitle>
            <CardDescription>{flashcardsOutput.flashcards.length} adet bilgi kartı oluşturuldu. Kartlara tıklayarak çevirebilirsiniz.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {flashcardsOutput.flashcards.map((card, index) => (
                <div key={index} onClick={() => handleFlipCard(index)} className="cursor-pointer perspective group">
                  <div className={`relative w-full h-52 md:h-60 transform-style-3d transition-transform duration-700 ${flippedStates[index] ? 'rotate-y-180' : ''}`}>
                    {/* Front of the card */}
                    <Card className={`absolute w-full h-full backface-hidden flex flex-col p-4 border rounded-lg shadow-md ${flippedStates[index] ? 'z-0 opacity-0 pointer-events-none' : 'z-10 opacity-100'}`}>
                      <div className="flex justify-between items-center mb-2">
                         <CardTitle className="text-base text-primary">Ön Yüz</CardTitle>
                         <RotateCw className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <p className="text-sm text-foreground flex-grow overflow-y-auto">{card.front}</p>
                      {card.topic && <p className="text-xs mt-auto pt-2 text-accent-foreground/80">Konu: {card.topic}</p>}
                    </Card>

                    {/* Back of the card */}
                    <Card className={`absolute w-full h-full backface-hidden rotate-y-180 flex flex-col p-4 border rounded-lg shadow-md ${flippedStates[index] ? 'z-10 opacity-100' : 'z-0 opacity-0 pointer-events-none'}`}>
                       <div className="flex justify-between items-center mb-2">
                        <CardTitle className="text-base text-primary">Arka Yüz</CardTitle>
                        <RotateCw className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <p className="text-sm text-muted-foreground flex-grow overflow-y-auto">{card.back}</p>
                      {card.topic && <p className="text-xs mt-auto pt-2 text-accent-foreground/80">Konu: {card.topic}</p>}
                    </Card>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 text-xs text-destructive-foreground bg-destructive/80 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>NeutralEdu AI bir yapay zekadır bu nedenle hata yapabilir, bu yüzden verdiği bilgileri doğrulayınız.</span>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Global styles for the 3D flip effect */}
      <style jsx global>{`
        .perspective {
          perspective: 1000px;
        }
        .transform-style-3d {
          transform-style: preserve-3d;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
        .backface-hidden {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden; /* Safari */
        }
      `}</style>
    </div>
  );
}
