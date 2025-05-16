
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input as ShadInput } from "@/components/ui/input"; 
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileTextIcon, Wand2, Loader2, AlertTriangle, ChevronLeft, ChevronRight, CheckCircle, XCircle, Eye } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { generateTest, type GenerateTestOutput, type GenerateTestInput, type QuestionSchema as QuestionType } from "@/ai/flows/test-generator-flow"; 
import { Separator } from "@/components/ui/separator";

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
  const { toast } = useToast();
  const { userProfile, loading: userProfileLoading, checkAndResetQuota, decrementQuota } = useUser();
  const [canProcess, setCanProcess] = useState(false);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{[key: number]: string}>({});
  const [checkedAnswers, setCheckedAnswers] = useState<CheckedAnswersState>({});
  const [showExplanations, setShowExplanations] = useState<{[key: number]: boolean}>({});

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

  const resetTestState = () => {
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setCheckedAnswers({});
    setShowExplanations({});
    setTestOutput(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast({ title: "Konu Gerekli", description: "Lütfen test oluşturmak istediğiniz konuyu girin.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    resetTestState(); 

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
      const input: GenerateTestInput = { 
        topic, 
        numQuestions, 
        difficulty, 
        userPlan: currentProfile.plan 
      };
      const result = await generateTest(input);

      if (result && result.questions && result.questions.length > 0) {
        setTestOutput(result);
        toast({ title: "Test Hazır!", description: "Belirttiğiniz konu için bir test oluşturuldu." });
        if (decrementQuota) {
            await decrementQuota(currentProfile);
        }
        const updatedProfileAgain = await memoizedCheckAndResetQuota();
        if (updatedProfileAgain) {
          setCanProcess((updatedProfileAgain.dailyRemainingQuota ?? 0) > 0);
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
  };

  const handleShowExplanation = () => {
    setShowExplanations(prev => ({...prev, [currentQuestionIndex]: true}));
  };

  const currentQuestion: QuestionType | undefined = testOutput?.questions[currentQuestionIndex];
  const isAnswerChecked = checkedAnswers[currentQuestionIndex] !== undefined;
  const isExplanationShown = showExplanations[currentQuestionIndex] === true;
  
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
            Belirlediğiniz konularda, istediğiniz zorluk seviyesinde ve soru sayısında YKS odaklı pratik testleri anında oluşturun.
          </CardDescription>
        </CardHeader>
      </Card>

      {!canProcess && !isGenerating && userProfile && (userProfile.dailyRemainingQuota ?? 0) <=0 && (
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
                    disabled={isGenerating || !canProcess}
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
                                if (val >= 3 && val <= 20) setNumQuestions(val);
                                else if (e.target.value === "") setNumQuestions(3); // or some default / allow empty for now
                            }}
                            min="3"
                            max="20"
                            className="w-full p-2 border rounded-md bg-input border-border"
                            disabled={isGenerating || !canProcess}
                        />
                    </div>
                    <div>
                        <Label htmlFor="difficulty" className="block text-sm font-medium text-foreground mb-1">Zorluk Seviyesi</Label>
                        <Select
                            value={difficulty}
                            onValueChange={(value: GenerateTestInput["difficulty"]) => setDifficulty(value)}
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
                YKS Testi Oluştur
                </Button>
            </CardContent>
            </Card>
        </form>
      )}
      
      {isGenerating && !testOutput && (
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
      )}

      {testOutput && currentQuestion && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{testOutput.testTitle} - Soru {currentQuestionIndex + 1} / {testOutput.questions.length}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-md bg-muted/30">
              <p className="font-semibold text-foreground whitespace-pre-line">{currentQuestion.questionText}</p>
            </div>
            
            {currentQuestion.options && (
                <RadioGroup 
                    onValueChange={handleOptionChange} 
                    value={userAnswers[currentQuestionIndex]}
                    disabled={isAnswerChecked}
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
                            className={`flex items-center space-x-3 p-3 rounded-md border-2 ${optionStyle} hover:bg-accent/50 transition-all cursor-pointer ${isAnswerChecked ? 'cursor-not-allowed opacity-70' : ''}`}
                        >
                            <RadioGroupItem 
                                value={optionLetter} 
                                id={`q${currentQuestionIndex}-opt${optionLetter}`} 
                                disabled={isAnswerChecked}
                            />
                            <span>{optionLetter}) {option}</span>
                            {IconComponent && <span className="ml-auto">{IconComponent}</span>}
                        </Label>
                    );
                })}
                </RadioGroup>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
                {!isAnswerChecked && (
                    <Button onClick={handleCheckAnswer} disabled={userAnswers[currentQuestionIndex] === undefined} className="flex-1">
                        Kontrol Et
                    </Button>
                )}
                {isAnswerChecked && !isExplanationShown && (
                    <Button onClick={handleShowExplanation} variant="outline" className="flex-1">
                        <Eye className="mr-2 h-4 w-4" /> Çözümü Gör
                    </Button>
                )}
            </div>

            {isAnswerChecked && checkedAnswers[currentQuestionIndex] && (
                 <Alert variant={checkedAnswers[currentQuestionIndex].isCorrect ? "default" : "destructive"} className={checkedAnswers[currentQuestionIndex].isCorrect ? "bg-green-500/10 border-green-500 text-green-700 dark:text-green-400" : ""}>
                    {checkedAnswers[currentQuestionIndex].isCorrect ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    <AlertTitle>{checkedAnswers[currentQuestionIndex].isCorrect ? "Doğru!" : "Yanlış!"}</AlertTitle>
                    <AlertDescription>
                        {checkedAnswers[currentQuestionIndex].isCorrect ? "Tebrikler, doğru cevap verdiniz." : `Doğru cevap: ${checkedAnswers[currentQuestionIndex].correctAnswer}.`}
                    </AlertDescription>
                </Alert>
            )}

            {isExplanationShown && currentQuestion.explanation && (
              <Card className="bg-accent/30 p-4 mt-4">
                <CardHeader className="p-0 mb-2"><CardTitle className="text-md">Açıklama</CardTitle></CardHeader>
                <CardContent className="p-0">
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{currentQuestion.explanation}</p>
                </CardContent>
              </Card>
            )}
            
            <Separator className="my-6"/>

            <div className="flex justify-between items-center">
              <Button 
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                variant="outline"
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Önceki Soru
              </Button>
              <Button onClick={resetTestState} variant="secondary">Yeni Test Oluştur</Button>
              <Button 
                onClick={() => setCurrentQuestionIndex(prev => Math.min(testOutput.questions.length - 1, prev + 1))}
                disabled={currentQuestionIndex === testOutput.questions.length - 1}
                variant="outline"
              >
                Sonraki Soru <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

             <div className="mt-6 p-3 text-xs text-destructive-foreground bg-destructive/80 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>NeutralEdu AI bir yapay zekadır bu nedenle hata yapabilir, bu yüzden verdiği bilgileri doğrulayınız.</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

