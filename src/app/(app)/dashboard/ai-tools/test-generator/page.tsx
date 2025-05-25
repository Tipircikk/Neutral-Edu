
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input as ShadInput } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileTextIcon, Wand2, Loader2, AlertTriangle, ChevronLeft, ChevronRight, CheckCircle, XCircle, Eye, RotateCcw, History, Settings } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { generateTest, type GenerateTestOutput, type GenerateTestInput, type QuestionSchema as QuestionType } from "@/ai/flows/test-generator-flow";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type CheckedAnswersState = {
  [key: number]: {
    isCorrect: boolean;
    selectedOption: string;
    correctAnswer: string;
  };
};

export default function TestGeneratorPage() {
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState<GenerateTestInput["difficulty"]>("medium");
  const [testOutput, setTestOutput] = useState<GenerateTestOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [adminSelectedModel, setAdminSelectedModel] = useState<string | undefined>(undefined);

  const { toast } = useToast();
  const { userProfile, loading: userProfileLoading, checkAndResetQuota, decrementQuota } = useUser();
  const [canProcess, setCanProcess] = useState(false);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{[key: number]: string}>({});
  const [checkedAnswers, setCheckedAnswers] = useState<CheckedAnswersState>({});
  const [showExplanations, setShowExplanations] = useState<{[key: number]: boolean}>({});
  const [isTestFinished, setIsTestFinished] = useState(false);

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

  const resetTestState = () => {
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setCheckedAnswers({});
    setShowExplanations({});
    setTestOutput(null);
    setIsTestFinished(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast({ title: "Konu Gerekli", description: "Lütfen test oluşturmak istediğiniz konuyu girin.", variant: "destructive" });
      return;
    }
     if (numQuestions < 3 || numQuestions > 20) {
      toast({ title: "Geçersiz Soru Sayısı", description: "Soru sayısı 3 ile 20 arasında olmalıdır.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    resetTestState();

    const currentProfile = await memoizedCheckAndResetQuota();
     if (!currentProfile) {
        toast({ title: "Kullanıcı Bilgisi Yüklenemedi", description: "Lütfen sayfayı yenileyin veya tekrar giriş yapın.", variant: "destructive" });
        setIsGenerating(false);
        setCanProcess(false);
        return;
    }
    const currentCanProcess = (currentProfile.dailyRemainingQuota ?? 0) > 0;
    setCanProcess(currentCanProcess);

    if (!currentCanProcess) {
      toast({ title: "Kota Aşıldı", description: "Bugünkü hakkınızı doldurdunuz.", variant: "destructive" });
      setIsGenerating(false);
      return;
    }


    try {
      const input: GenerateTestInput = {
        topic,
        numQuestions,
        difficulty,
        userPlan: currentProfile.plan,
        customModelIdentifier: userProfile?.isAdmin ? adminSelectedModel : undefined,
        isAdmin: !!userProfile?.isAdmin,
      };
      const result = await generateTest(input);

      if (result && result.questions && result.questions.length > 0) {
        setTestOutput(result);
        toast({ title: "Test Hazır!", description: "Belirttiğiniz konu için bir test oluşturuldu." });
        if (decrementQuota) {
            const decrementSuccess = await decrementQuota(currentProfile);
            if (decrementSuccess) {
                 const updatedProfileAfterDecrement = await memoizedCheckAndResetQuota();
                 if (updatedProfileAfterDecrement) {
                   setCanProcess((updatedProfileAfterDecrement.dailyRemainingQuota ?? 0) > 0);
                 }
            } else {
                const refreshedProfile = await memoizedCheckAndResetQuota();
                if(refreshedProfile){
                  setCanProcess((refreshedProfile.dailyRemainingQuota ?? 0) > 0);
                }
            }
        }
      } else {
        const errorMessage = result?.testTitle || "Yapay zeka bir test üretemedi veya format hatalı.";
        toast({ title: "Test Oluşturma Sonucu Yetersiz", description: errorMessage, variant: "destructive"});
        setTestOutput({ testTitle: errorMessage, questions: [] });
      }
    } catch (error: any) {
      console.error("Test oluşturma hatası:", error);
      let displayErrorMessage = "Test oluşturulurken beklenmedik bir hata oluştu.";
      if (userProfile?.isAdmin) {
         displayErrorMessage = error.message || "Test oluşturulurken beklenmedik bir hata oluştu. (Admin)";
      } else {
         displayErrorMessage = "Sunucu yoğun olabilir veya beklenmedik bir hata oluştu. Lütfen biraz sonra tekrar deneyin.";
      }
      toast({ title: "Test Oluşturma Hatası", description: displayErrorMessage, variant: "destructive" });
      setTestOutput({ testTitle: displayErrorMessage, questions: [] });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOptionChange = (value: string) => {
    setUserAnswers(prev => ({...prev, [currentQuestionIndex]: value}));
  };

  const handleCheckAnswer = () => {
    if (!testOutput || userAnswers[currentQuestionIndex] === undefined) return;
    const currentQuestion = testOutput.questions[currentQuestionIndex];
    const isCorrect = userAnswers[currentQuestionIndex] === currentQuestion.correctAnswer;
    setCheckedAnswers(prev => ({
        ...prev,
        [currentQuestionIndex]: {
            isCorrect,
            selectedOption: userAnswers[currentQuestionIndex],
            correctAnswer: currentQuestion.correctAnswer
        }
    }));
    if (!isCorrect) {
        setShowExplanations(prev => ({...prev, [currentQuestionIndex]: true}));
    }
  };

  const handleToggleExplanation = (index: number) => {
    setShowExplanations(prev => ({...prev, [index]: !prev[index]}));
  };

  const handleNextQuestion = () => {
    if (testOutput && currentQuestionIndex < testOutput.questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
    } else {
        setIsTestFinished(true);
    }
  };

  const currentQuestion: QuestionType | undefined = testOutput?.questions[currentQuestionIndex];
  const isAnswerCheckedForCurrentQuestion = checkedAnswers[currentQuestionIndex] !== undefined;
  const isExplanationShownForCurrentQuestion = showExplanations[currentQuestionIndex] === true;

  const isSubmitButtonDisabled =
    isGenerating ||
    !topic.trim() ||
    (numQuestions < 3 || numQuestions > 20) ||
    (!userProfileLoading && userProfile && !canProcess) ||
    (!userProfileLoading && !userProfile);

  const isModelSelectDisabled =
    isGenerating ||
    !userProfile?.isAdmin ||
    (!userProfileLoading && userProfile && !canProcess) ||
    (!userProfileLoading && !userProfile);

  const isFormElementsDisabled =
    isGenerating ||
    (!userProfileLoading && userProfile && !canProcess) ||
    (!userProfileLoading && !userProfile);


  if (userProfileLoading && !userProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">AI Test Oluşturucu yükleniyor...</p>
      </div>
    );
  }

  if (isGenerating && !testOutput) {
    return (
        <Card className="mt-6 shadow-lg">
            <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-lg font-medium text-foreground">Test Oluşturuluyor...</p>
                <p className="text-sm text-muted-foreground">
                YKS odaklı yapay zeka, sorularınızı hazırlıyor... Bu işlem biraz zaman alabilir.
                </p>
            </div>
            </CardContent>
        </Card>
    );
  }

  if (isTestFinished && testOutput) {
    let correctCount = 0;
    testOutput.questions.forEach((q, index) => {
        const answerInfo = checkedAnswers[index];
        if (answerInfo?.isCorrect) {
             correctCount++;
        }
    });
    const scorePercentage = (correctCount / testOutput.questions.length) * 100;

    return (
        <Card className="mt-6">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl md:text-3xl">{testOutput.testTitle} - Sonuçlar</CardTitle>
                <CardDescription>
                    Toplam {testOutput.questions.length} sorudan {correctCount} tanesini doğru cevapladınız. (%{scorePercentage.toFixed(0)})
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Accordion type="multiple" className="w-full">
                    {testOutput.questions.map((q, index) => {
                        const userAnswer = userAnswers[index];
                        const checkedInfo = checkedAnswers[index] || {isCorrect: userAnswer === q.correctAnswer, selectedOption: userAnswer || "Cevaplanmadı", correctAnswer: q.correctAnswer};
                        return (
                            <AccordionItem value={`item-${index}`} key={`review-${index}`}>
                                <AccordionTrigger className={`text-left ${checkedInfo.isCorrect ? 'text-green-600' : 'text-red-600'} hover:no-underline`}>
                                    <div className="flex items-center gap-2">
                                        {checkedInfo.isCorrect ? <CheckCircle className="h-5 w-5"/> : <XCircle className="h-5 w-5"/>}
                                        <span>Soru {index + 1}: {q.questionText.substring(0, 50)}...</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-3 p-4 bg-muted/30 rounded-b-md">
                                    <p className="font-semibold whitespace-pre-line">{q.questionText}</p>
                                    <p className="text-sm">Verdiğiniz Cevap: <span className={`font-semibold ${userAnswer === q.correctAnswer ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{userAnswer || "Cevaplanmadı"}</span></p>
                                    <p className="text-sm">Doğru Cevap: <span className="font-semibold text-green-700 dark:text-green-400">{q.correctAnswer}</span></p>
                                    {q.explanation && (
                                        <div className="prose prose-sm dark:prose-invert max-w-none mt-2 border-t pt-2">
                                            <h4 className="font-semibold">Açıklama:</h4>
                                            <p className="whitespace-pre-line text-muted-foreground">{q.explanation}</p>
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
                <Button onClick={resetTestState} className="w-full mt-6">
                    <RotateCcw className="mr-2 h-4 w-4" /> Yeni Test Oluştur
                </Button>
                 <div className="mt-4 p-3 text-xs text-destructive-foreground bg-destructive/80 rounded-md flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>NeutralEdu AI bir yapay zekadır bu nedenle hata yapabilir, bu yüzden verdiği bilgileri doğrulayınız.</span>
                </div>
            </CardContent>
        </Card>
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
            Belirlediğiniz konularda, istediğiniz zorluk seviyesinde ve soru sayısında YKS odaklı pratik testleri anında oluşturun.
          </CardDescription>
        </CardHeader>
         <CardContent>
          {userProfile?.isAdmin && (
            <div className="space-y-2 p-4 mb-4 border rounded-md bg-muted/50">
              <Label htmlFor="adminModelSelectTestGen" className="font-semibold text-primary flex items-center gap-2"><Settings size={16}/> Model Seç (Admin Özel)</Label>
              <Select
                value={adminSelectedModel}
                onValueChange={setAdminSelectedModel}
                disabled={isModelSelectDisabled}
              >
                <SelectTrigger id="adminModelSelectTestGen">
                  <SelectValue placeholder="Varsayılan Modeli Kullan (Plan Bazlı)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="experimental_gemini_2_5_flash_preview_05_20">Gemini 2.5 Flash Preview (Varsayılan)</SelectItem>
                  <SelectItem value="default_gemini_flash">Gemini 2.0 Flash</SelectItem>
                  <SelectItem value="experimental_gemini_1_5_flash">Gemini 1.5 Flash</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Farklı AI modellerini test edebilirsiniz.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {!userProfileLoading && userProfile && !canProcess && !isGenerating && (userProfile.dailyRemainingQuota ?? 0) <=0 && (
         <Alert variant="destructive" className="shadow-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Günlük Kota Doldu</AlertTitle>
          <AlertDescription>
            Bugünlük ücretsiz hakkınızı kullandınız. Lütfen yarın tekrar kontrol edin veya Premium/Pro'ya yükseltin.
          </AlertDescription>
        </Alert>
      )}

      {!testOutput && (
        <form onSubmit={handleSubmit}>
            <Card>
            <CardHeader>
                <CardTitle className="text-lg">Test Ayarları</CardTitle>
                <CardDescription>Testinizi oluşturmak için aşağıdaki bilgileri girin.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
                <div>
                <Label htmlFor="topic" className="block text-sm font-medium text-foreground mb-1">Test Konusu</Label>
                <Textarea
                    id="topic"
                    placeholder="Örneğin: YKS Matematik - Fonksiyonlar, YKS Türk Dili ve Edebiyatı - Divan Edebiyatı, YKS Coğrafya - Türkiye'nin İklimi..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    rows={3}
                    className="text-base"
                    disabled={isFormElementsDisabled}
                />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="numQuestions" className="block text-sm font-medium text-foreground mb-1">Soru Sayısı (3-20)</Label>
                        <ShadInput
                            type="number"
                            id="numQuestions"
                            value={numQuestions}
                            onChange={(e) => {
                                const val = parseInt(e.target.value,10);
                                setNumQuestions(isNaN(val) ? 3 : val);
                            }}
                            min="3"
                            max="20"
                            className="w-full p-2 border rounded-md bg-input border-border"
                            disabled={isFormElementsDisabled}
                        />
                    </div>
                    <div>
                        <Label htmlFor="difficulty" className="block text-sm font-medium text-foreground mb-1">Zorluk Seviyesi</Label>
                        <Select
                            value={difficulty}
                            onValueChange={(value: GenerateTestInput["difficulty"]) => setDifficulty(value)}
                            disabled={isFormElementsDisabled}
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
                <Button type="submit" className="w-full" disabled={isSubmitButtonDisabled}>
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                YKS Testi Oluştur
                </Button>
            </CardContent>
            </Card>
        </form>
      )}

      {testOutput && currentQuestion && !isTestFinished && (
        <Card className="mt-6">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div className="mb-2 sm:mb-0">
                <CardTitle className="text-lg md:text-xl">{testOutput.testTitle}</CardTitle>
                <CardDescription>Soru {currentQuestionIndex + 1} / {testOutput.questions.length}</CardDescription>
            </div>
            <Button onClick={resetTestState} variant="outline" size="sm">
                <RotateCcw className="mr-2 h-4 w-4" /> Testi Sıfırla / Yeni Test
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-auto max-h-[200px] w-full rounded-md border p-4 bg-muted/30">
                <p className="font-semibold text-foreground whitespace-pre-line">{currentQuestion.questionText}</p>
            </ScrollArea>

            {currentQuestion.options && (
                <RadioGroup
                    onValueChange={handleOptionChange}
                    value={userAnswers[currentQuestionIndex]}
                    disabled={isAnswerCheckedForCurrentQuestion}
                    className="space-y-2"
                >
                {currentQuestion.options.map((option, index) => {
                    const optionLetter = String.fromCharCode(65 + index);
                    const checkedInfo = checkedAnswers[currentQuestionIndex];
                    let optionStyle = "border-border";
                    let IconComponent = null;

                    if (checkedInfo) {
                        if (optionLetter === checkedInfo.correctAnswer) {
                            optionStyle = "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
                            IconComponent = <CheckCircle className="h-5 w-5 text-green-500" />;
                        } else if (optionLetter === checkedInfo.selectedOption) {
                             optionStyle = "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400";
                             IconComponent = <XCircle className="h-5 w-5 text-red-500" />;
                        }
                    }

                    return (
                        <Label
                            key={optionLetter}
                            htmlFor={`q${currentQuestionIndex}-opt${optionLetter}`}
                            className={`flex items-center space-x-3 p-3 rounded-md border-2 ${optionStyle} hover:bg-accent/50 transition-all ${isAnswerCheckedForCurrentQuestion ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                        >
                            <RadioGroupItem
                                value={optionLetter}
                                id={`q${currentQuestionIndex}-opt${optionLetter}`}
                                disabled={isAnswerCheckedForCurrentQuestion}
                            />
                            <span className="flex-1">{optionLetter}) {option}</span>
                            {IconComponent && <span className="ml-auto">{IconComponent}</span>}
                        </Label>
                    );
                })}
                </RadioGroup>
            )}

            <div className="flex flex-col sm:flex-row gap-2 mt-4">
                {!isAnswerCheckedForCurrentQuestion && (
                    <Button onClick={handleCheckAnswer} disabled={userAnswers[currentQuestionIndex] === undefined || isGenerating} className="flex-1">
                        Kontrol Et
                    </Button>
                )}
                {isAnswerCheckedForCurrentQuestion && (
                    <Button onClick={() => handleToggleExplanation(currentQuestionIndex)} variant="outline" className="flex-1">
                        <Eye className="mr-2 h-4 w-4" /> {isExplanationShownForCurrentQuestion ? "Çözümü Gizle" : "Çözümü Gör"}
                    </Button>
                )}
            </div>

            {isAnswerCheckedForCurrentQuestion && checkedAnswers[currentQuestionIndex] && (
                 <Alert variant={checkedAnswers[currentQuestionIndex].isCorrect ? "default" : "destructive"} className={`mt-4 ${checkedAnswers[currentQuestionIndex].isCorrect ? "bg-green-500/10 border-green-500 text-green-700 dark:text-green-400" : ""}`}>
                    {checkedAnswers[currentQuestionIndex].isCorrect ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    <AlertTitle>{checkedAnswers[currentQuestionIndex].isCorrect ? "Doğru!" : "Yanlış!"}</AlertTitle>
                    <AlertDescription>
                        {checkedAnswers[currentQuestionIndex].isCorrect ? "Tebrikler, doğru cevap verdiniz." : `Doğru cevap: ${checkedAnswers[currentQuestionIndex].correctAnswer}.`}
                    </AlertDescription>
                </Alert>
            )}

            {isExplanationShownForCurrentQuestion && currentQuestion.explanation && (
              <Card className="bg-accent/30 p-4 mt-4">
                <CardHeader className="p-0 mb-2"><CardTitle className="text-md">Açıklama</CardTitle></CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-auto max-h-[200px] w-full">
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{currentQuestion.explanation}</p>
                    </ScrollArea>
                </CardContent>
              </Card>
            )}

            <Separator className="my-6"/>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4">
              <Button
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0 || isGenerating}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Önceki Soru
              </Button>

              <Button
                onClick={handleNextQuestion}
                disabled={isGenerating}
                className="w-full sm:w-auto"
              >
                {currentQuestionIndex === testOutput.questions.length - 1 ? "Testi Bitir ve Sonucu Gör" : "Sonraki Soru"}
                {currentQuestionIndex !== testOutput.questions.length - 1 && <ChevronRight className="ml-2 h-4 w-4" />}
                 {currentQuestionIndex === testOutput.questions.length - 1 && <History className="ml-2 h-4 w-4" />}
              </Button>
            </div>

             <div className="mt-6 p-3 text-xs text-destructive-foreground bg-destructive/80 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>NeutralEdu AI bir yapay zekadır bu nedenle hata yapabilir, bu yüzden verdiği bilgileri doğrulayınız.</span>
            </div>
          </CardContent>
        </Card>
      )}
      {!testOutput && !isGenerating && !userProfileLoading && (userProfile || !userProfile) && (
         <Alert className="mt-6">
          <FileTextIcon className="h-4 w-4" />
          <AlertTitle>Teste Hazır!</AlertTitle>
          <AlertDescription>
            Yukarıya bir YKS konu başlığı girerek ve ayarları yaparak kişiselleştirilmiş testinizi oluşturun.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

  