
"use client";

import React, { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input as ShadInput } from "@/components/ui/input"; // Renamed
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HelpCircle, Send, Loader2, AlertTriangle, UploadCloud, ImageIcon, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { solveQuestion, type SolveQuestionOutput, type SolveQuestionInput } from "@/ai/flows/question-solver-flow";
import NextImage from "next/image";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ParsedSolutionPart {
  type: "heading" | "subheading" | "paragraph" | "listitem" | "codeblock";
  content: React.ReactNode[];
}
interface ParsedSolution {
  answerValue: React.ReactNode[] | null;
  explanationSections: ParsedSolutionPart[];
}

export default function QuestionSolverPage() {
  const [questionText, setQuestionText] = useState("");
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [answer, setAnswer] = useState<SolveQuestionOutput | null>(null);
  const [parsedSolution, setParsedSolution] = useState<ParsedSolution | null>(null);
  const [isSolving, setIsSolving] = useState(false);
  const { toast } = useToast();
  const { userProfile, loading: userProfileLoading, checkAndResetQuota, decrementQuota } = useUser();
  const [canProcess, setCanProcess] = useState(false);
  const [adminSelectedModel, setAdminSelectedModel] = useState<string | undefined>(undefined);

  const [loadingMessage, setLoadingMessage] = useState("Çözüm oluşturuluyor...");
  const loadingMessageIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const loadingStartTimeRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (isSolving) {
      loadingStartTimeRef.current = Date.now();
      setLoadingMessage("Çözüm oluşturuluyor...");
      const messages = [
        { time: 15, message: "Yapay zeka düşünüyor, bu biraz zaman alabilir..." },
        { time: 30, message: "Karmaşık bir soru üzerinde çalışılıyor, bu işlem birkaç dakika sürebilir, lütfen bekleyin..." },
        { time: 60, message: "Hesaplama devam ediyor. Çok karmaşık soruların çözümü beklenenden uzun sürebilir. Sabrınız için teşekkürler." },
        { time: 120, message: "İşlem hala devam ediyor. Sunucu zaman aşımı limitlerine yaklaşılıyor olabilir. Eğer çözüm çok uzun sürerse, soruyu basitleştirmeyi veya farklı bir modelle denemeyi düşünebilirsiniz." },
        { time: 180, message: "Bu gerçekten uzun sürdü... Sunucunun yanıt vermesi bekleniyor. Gerekirse sayfayı yenileyip daha basit bir soruyla tekrar deneyebilirsiniz." },
        { time: 240, message: "Çok uzun bir bekleme süresi oldu. Teknik bir sorun olabilir veya model soruyu işlemekte zorlanıyor. Biraz daha bekleyebilir veya işlemi iptal etmeyi düşünebilirsiniz."}
      ];
      let messageIndex = 0;
      loadingMessageIntervalRef.current = setInterval(() => {
        if (loadingStartTimeRef.current) {
          const elapsedTimeSeconds = Math.floor((Date.now() - loadingStartTimeRef.current) / 1000);
          if (messageIndex < messages.length && elapsedTimeSeconds >= messages[messageIndex].time) {
            setLoadingMessage(messages[messageIndex].message);
            messageIndex++;
          }
        }
      }, 5000); 
    } else {
      if (loadingMessageIntervalRef.current) clearInterval(loadingMessageIntervalRef.current);
      loadingStartTimeRef.current = null;
    }
    return () => { if (loadingMessageIntervalRef.current) clearInterval(loadingMessageIntervalRef.current); };
  }, [isSolving]);

  const parseInlineFormatting = (line: string | undefined | null): React.ReactNode[] => {
    if (!line) return [<React.Fragment key={`empty-${Math.random()}`}></React.Fragment>];
    
    const elements: React.ReactNode[] = [];
    const regex = /(\S+?)\^(\d+|\{[\d\w.-]+\})|(\S+?)_(\d+|\{[\d\w.-]+\})|\*\*(.*?)\*\*|`(.*?)`/g;
    let lastIndex = 0;
    let match;
    let keyIndex = 0;
  
    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        elements.push(<Fragment key={`text-${keyIndex++}`}>{line.substring(lastIndex, match.index)}</Fragment>);
      }
      
      if (match[5]) { // Bold: **text**
        elements.push(<strong key={`bold-${keyIndex++}`}>{match[5]}</strong>);
      } else if (match[6]) { // Inline code: `text`
        elements.push(<code key={`code-${keyIndex++}`} className="bg-muted text-muted-foreground px-1 py-0.5 rounded text-sm">{match[6]}</code>);
      } else if (match[1] && match[2]) { // Superscript: text^number or text^{number}
        elements.push(<Fragment key={`base-sup-${keyIndex}`}>{match[1]}</Fragment>);
        elements.push(<sup key={`sup-${keyIndex++}`}>{match[2].replace(/[{}]/g, '')}</sup>);
      } else if (match[3] && match[4]) { // Subscript: text_number or text_{number}
        elements.push(<Fragment key={`base-sub-${keyIndex}`}>{match[3]}</Fragment>);
        elements.push(<sub key={`sub-${keyIndex++}`}>{match[4].replace(/[{}]/g, '')}</sub>);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < line.length) {
      elements.push(<Fragment key={`text-end-${keyIndex}`}>{line.substring(lastIndex)}</Fragment>);
    }
    
    return elements.filter(el => el !== ""); 
  };

 const formatSolverOutputForDisplay = (text: string): ParsedSolution => {
    const lines = text.split('\n');
    let answerValue: React.ReactNode[] | null = null;
    const explanationSections: ParsedSolutionPart[] = [];
    let isExplanationSection = false;
    let inCodeBlock = false;
    let codeBlockContent = "";
    let keyCounter = 0;

    const flushCodeBlock = () => {
        if (inCodeBlock) {
            explanationSections.push({
                type: "codeblock",
                content: [codeBlockContent.trimEnd()]
            });
            codeBlockContent = "";
            inCodeBlock = false;
        }
    };

    let captureAnswer = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("```")) {
          flushCodeBlock(); // Flush previous code block if any
          inCodeBlock = !inCodeBlock; // Toggle code block state
          if (inCodeBlock && lines[i+1] && lines[i+1].startsWith("```")) { // Handle empty block case
             inCodeBlock = false; i++; 
          }
          continue;
      }

      if (inCodeBlock) {
          codeBlockContent += line + '\n';
          continue;
      }

      if (trimmedLine.toLowerCase().startsWith("cevap:")) {
        isExplanationSection = false;
        captureAnswer = true;
        const answerText = trimmedLine.substring("cevap:".length).trim();
        if (answerText) {
          answerValue = parseInlineFormatting(answerText);
        } else if (lines[i+1] && lines[i+1].trim() && !lines[i+1].trim().toLowerCase().startsWith("açıklama:")) {
          answerValue = parseInlineFormatting(lines[i+1].trim());
          i++; 
        }
        continue;
      }
      
      if (trimmedLine.toLowerCase().startsWith("açıklama:")) {
        isExplanationSection = true;
        captureAnswer = false;
        explanationSections.push({type: "paragraph", content: [<React.Fragment key={`desc-label-${keyCounter++}`}></React.Fragment>]}); // Placeholder for spacing if needed
        continue;
      }

      if (captureAnswer && trimmedLine && !trimmedLine.toLowerCase().startsWith("açıklama:")) {
        answerValue = [...(answerValue || []), ...parseInlineFormatting((answerValue ? "\n" : "") + trimmedLine)];
        continue;
      }
      
      if (isExplanationSection) {
        if (trimmedLine.startsWith('### ')) {
          explanationSections.push({ type: "subheading", content: parseInlineFormatting(trimmedLine.substring(4)) });
        } else if (trimmedLine.startsWith('## ')) {
          explanationSections.push({ type: "heading", content: parseInlineFormatting(trimmedLine.substring(3)) });
        } else if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
          explanationSections.push({ type: "listitem", content: parseInlineFormatting(trimmedLine.substring(trimmedLine.indexOf(' ') + 1)) });
        } else if (trimmedLine !== "") {
          explanationSections.push({ type: "paragraph", content: parseInlineFormatting(line) });
        }
      }
    }
    flushCodeBlock();

    return { answerValue, explanationSections };
  };


  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { 
        toast({ title: "Dosya Boyutu Büyük", description: "Lütfen 5MB'den küçük bir görsel yükleyin.", variant: "destructive" });
        event.target.value = ""; setImageFile(null); setImageDataUri(null); return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImageDataUri(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setImageFile(null); setImageDataUri(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() && !imageDataUri) {
      toast({ title: "Girdi Gerekli", description: "Lütfen bir soru metni girin veya bir görsel yükleyin.", variant: "destructive" }); return;
    }
    setIsSolving(true); setAnswer(null); setParsedSolution(null);

    const currentProfile = await memoizedCheckAndResetQuota();
    if (!currentProfile || (currentProfile.dailyRemainingQuota ?? 0) <= 0) {
      toast({ title: "Kota Aşıldı", description: "Bugünkü hakkınızı doldurdunuz.", variant: "destructive" });
      setIsSolving(false); setCanProcess(false); return;
    }
    setCanProcess(true);

    try {
      if (!currentProfile?.plan) throw new Error("Kullanıcı planı bulunamadı.");
      const input: SolveQuestionInput = {
        questionText: questionText.trim() || undefined,
        imageDataUri: imageDataUri || undefined,
        userPlan: currentProfile.plan,
        customModelIdentifier: userProfile?.isAdmin ? adminSelectedModel : undefined,
      };
      const result = await solveQuestion(input);
      setAnswer(result);
      if (result && result.solution) {
        setParsedSolution(formatSolverOutputForDisplay(result.solution));
      }

      if (result && typeof result.solution === 'string' && Array.isArray(result.relatedConcepts) && Array.isArray(result.examStrategyTips)) {
        if (result.solution.startsWith("AI modeli") || result.solution.startsWith("Sunucu tarafında") || result.solution.includes("Hata:") || result.solution.includes("Error:")) {
           toast({ title: "Çözüm Bilgisi", description: result.solution.substring(0,100) + "...", variant: "default" });
        } else {
           toast({ title: "Çözüm Hazır!", description: "Sorunuz için bir çözüm oluşturuldu." });
        }
        if (!result.solution.startsWith("Kota Aşıldı") && decrementQuota) {
          const decrementSuccess = await decrementQuota(currentProfile);
          if (decrementSuccess) {
            const updatedProfileAgain = await memoizedCheckAndResetQuota();
            if (updatedProfileAgain) setCanProcess((updatedProfileAgain.dailyRemainingQuota ?? 0) > 0);
            else setCanProcess(false);
          } else {
             const refreshedProfile = await memoizedCheckAndResetQuota();
             if (refreshedProfile) setCanProcess((refreshedProfile.dailyRemainingQuota ?? 0) > 0);
          }
        }
      } else {
        const errorMessage = "AI akışından geçersiz veya eksik bir yanıt alındı.";
        setAnswer({ solution: errorMessage, relatedConcepts: ["Hata"], examStrategyTips: ["Tekrar deneyin"] });
        setParsedSolution(formatSolverOutputForDisplay(errorMessage));
        toast({ title: "Yanıt Hatası", description: errorMessage, variant: "destructive" });
      }
    } catch (error: any) {
      let errorMessage = "Bilinmeyen bir istemci tarafı hatası oluştu.";
      if (error instanceof Error) errorMessage = error.message;
      else if (typeof error === 'string') errorMessage = error;
      else if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') errorMessage = error.message;

      setAnswer({ solution: `İstemci Hatası: ${errorMessage}. Geliştirici konsolunu kontrol edin.`, relatedConcepts: ["Hata"], examStrategyTips: ["Tekrar deneyin"] });
      setParsedSolution(formatSolverOutputForDisplay(`İstemci Hatası: ${errorMessage}.`));
      toast({ title: "Çözüm Hatası", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSolving(false);
    }
  };
  
  const isSubmitButtonDisabled = 
    isSolving || 
    (!questionText.trim() && !imageDataUri) ||
    (!userProfileLoading && userProfile && !canProcess) ||
    (!userProfileLoading && !userProfile);

  const isModelSelectDisabled = 
    isSolving || 
    !userProfile?.isAdmin ||
    (!userProfileLoading && userProfile && !canProcess) ||
    (!userProfileLoading && !userProfile);

  const isFormElementsDisabled = 
    isSolving ||
    (!userProfileLoading && userProfile && !canProcess) ||
    (!userProfileLoading && !userProfile);

  if (userProfileLoading && !userProfile) {
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
          <div className="flex items-center gap-3"> <HelpCircle className="h-7 w-7 text-primary" /> <CardTitle className="text-2xl">AI Soru Çözücü</CardTitle> </div>
          <CardDescription> Aklınızdaki YKS sorularını sorun, yapay zeka size adım adım çözümler ve açıklamalar sunsun. İsterseniz soru içeren bir görsel de yükleyebilirsiniz. </CardDescription>
        </CardHeader>
        <CardContent>
            {userProfile?.isAdmin && (
              <div className="space-y-2 p-4 mb-4 border rounded-md bg-muted/50">
                <Label htmlFor="adminModelSelectSolver" className="font-semibold text-primary flex items-center gap-2"><Settings size={16}/> Model Seç (Admin Özel)</Label>
                <Select 
                  value={adminSelectedModel} 
                  onValueChange={setAdminSelectedModel} 
                  disabled={isModelSelectDisabled}
                >
                  <SelectTrigger id="adminModelSelectSolver">
                    <SelectValue placeholder="Varsayılan Modeli Kullan (Plan Bazlı)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default_gemini_flash">Varsayılan (Gemini 2.0 Flash)</SelectItem>
                    <SelectItem value="experimental_gemini_1_5_flash">Deneysel (Gemini 1.5 Flash)</SelectItem>
                    <SelectItem value="experimental_gemini_2_5_flash_preview">Deneysel (Gemini 2.5 Flash Preview)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground"> Farklı AI modellerini test edebilirsiniz. </p>
              </div>
            )}
        </CardContent>
      </Card>

      {!userProfileLoading && userProfile && !canProcess && !isSolving && (userProfile.dailyRemainingQuota ?? 0) <=0 && (
         <Alert variant="destructive" className="shadow-md">
          <AlertTriangle className="h-4 w-4" /> <AlertTitle>Günlük Kota Doldu</AlertTitle>
          <AlertDescription> Bugünlük ücretsiz hakkınızı kullandınız. Lütfen yarın tekrar kontrol edin veya Premium/Pro'ya yükseltin. </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label htmlFor="questionText" className="block text-sm font-medium text-foreground mb-1">Soru Metni (isteğe bağlı)</Label>
              <Textarea id="questionText" placeholder="Örneğin: Bir dik üçgenin hipotenüsü 10 cm, bir dik kenarı 6 cm ise diğer dik kenarı kaç cm'dir?" value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={5} className="text-base" disabled={isFormElementsDisabled} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="imageUpload" className="block text-sm font-medium text-foreground">Soru Görseli Yükle (isteğe bağlı, maks 5MB)</Label>
                 <ShadInput id="imageUpload" type="file" accept="image/*" onChange={handleImageChange} className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" disabled={isFormElementsDisabled} />
                {imageDataUri && imageFile && (
                  <div className="mt-2 p-2 border rounded-md bg-muted">
                    <p className="text-sm text-muted-foreground mb-2">Seçilen görsel: {imageFile.name}</p>
                    <NextImage src={imageDataUri} alt="Yüklenen soru görseli" width={200} height={200} className="rounded-md object-contain max-h-48" />
                  </div>
                )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitButtonDisabled}> {isSolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Çözüm İste </Button>
          </CardContent>
        </Card>
      </form>

      {isSolving && !answer && (
        <Card className="mt-6 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center"> <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" /> <p className="text-lg font-medium text-foreground">{loadingMessage}</p> </div>
          </CardContent>
        </Card>
      )}

      {parsedSolution && (
        <Card className="mt-6">
          <CardHeader> <CardTitle className="text-xl">Neutral Edu AI Çözümü</CardTitle> </CardHeader>
          <CardContent>
            <ScrollArea className="h-auto max-h-[600px] w-full rounded-md border p-4 bg-muted/30">
              <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                {parsedSolution.answerValue && (
                  <div className="mb-4 p-3 border-b border-border">
                    <h3 className="text-lg font-semibold text-primary mb-1">Cevap:</h3>
                    <div className="text-lg font-bold text-foreground">{parsedSolution.answerValue}</div>
                  </div>
                )}
                {parsedSolution.explanationSections.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-primary mb-2">Açıklama:</h3>
                    {parsedSolution.explanationSections.map((part, index) => {
                        let key = `part-${index}-${Math.random()}`;
                        switch(part.type) {
                            case "heading": return <h3 key={key} className="text-lg font-semibold mt-4 mb-2 text-foreground">{part.content}</h3>;
                            case "subheading": return <h4 key={key} className="text-md font-semibold mt-3 mb-1 text-foreground">{part.content}</h4>;
                            case "listitem": return <li key={key} className="ml-4 list-disc">{part.content}</li>;
                            case "codeblock": return <pre key={key} className="bg-background/50 p-2 my-2 rounded-md overflow-x-auto text-sm"><code className="text-foreground">{part.content}</code></pre>;
                            case "paragraph":
                            default:
                                return <p key={key} className="mb-2 last:mb-0">{part.content}</p>;
                        }
                    })}
                  </div>
                )}
                {!parsedSolution.answerValue && parsedSolution.explanationSections.length === 0 && answer?.solution && (
                   <p>{parseInlineFormatting(answer.solution)}</p> 
                )}
              </div>
            </ScrollArea>
             {answer && answer.relatedConcepts && answer.relatedConcepts.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-md font-semibold text-foreground mb-1">İlgili Kavramlar:</h4>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                    {answer.relatedConcepts.map((concept, index) => ( <li key={`concept-${index}-${Math.random()}`}>{parseInlineFormatting(concept)}</li> ))}
                  </ul>
                </div>
              )}
              {answer && answer.examStrategyTips && answer.examStrategyTips.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-md font-semibold text-foreground mb-1">Sınav Stratejisi İpuçları:</h4>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                    {answer.examStrategyTips.map((tip, index) => ( <li key={`tip-${index}-${Math.random()}`}>{parseInlineFormatting(tip)}</li> ))}
                  </ul>
                </div>
              )}
            <div className="mt-4 p-3 text-xs text-destructive-foreground bg-destructive/80 rounded-md flex items-center gap-2"> <AlertTriangle className="h-4 w-4" /> <span>NeutralEdu AI bir yapay zekadır bu nedenle hata yapabilir, bu yüzden verdiği bilgileri doğrulayınız.</span> </div>
          </CardContent>
        </Card>
      )}
       {!isSolving && !answer && !userProfileLoading && (userProfile || !userProfile) && (
         <Alert className="mt-6">
          <HelpCircle className="h-4 w-4" />
          <AlertTitle>Çözüme Hazır!</AlertTitle>
          <AlertDescription>
            Yukarıya bir YKS sorusu yazın veya görselini yükleyin. Yapay zeka, sorunuzu adım adım çözerek size yardımcı olacaktır.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

    