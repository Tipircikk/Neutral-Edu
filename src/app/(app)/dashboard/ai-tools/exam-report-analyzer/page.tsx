
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ClipboardCheck, Loader2, AlertTriangle, UploadCloud, FileText as FileTextIcon, Wand2, Settings } from "lucide-react"; // Renamed FileText
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { extractTextFromPdf } from "@/lib/pdfUtils";
import { analyzeExamReport, type ExamReportAnalyzerOutput, type ExamReportAnalyzerInput } from "@/ai/flows/exam-report-analyzer-flow";
import { Input as ShadInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function ExamReportAnalyzerPage() {
  const [analysisOutput, setAnalysisOutput] = useState<ExamReportAnalyzerOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pdfTextContent, setPdfTextContent] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | undefined>(undefined);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [adminSelectedModel, setAdminSelectedModel] = useState<string | undefined>(undefined);

  const { toast } = useToast();
  const { userProfile, loading: userProfileLoading, checkAndResetQuota, decrementQuota } = useUser();
  const [canProcess, setCanProcess] = useState(false);

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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (file.type !== "application/pdf") {
            toast({ title: "Geçersiz Dosya Türü", description: "Lütfen bir PDF dosyası yükleyin.", variant: "destructive" });
            event.target.value = ""; setSelectedFile(null); setCurrentFileName(undefined); return;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            toast({ title: "Dosya Boyutu Çok Büyük", description: `Lütfen ${MAX_FILE_SIZE_MB}MB'den küçük bir PDF dosyası yükleyin.`, variant: "destructive" });
            event.target.value = ""; setSelectedFile(null); setCurrentFileName(undefined); return;
        }
        setSelectedFile(file);
        setCurrentFileName(file.name);
        setPdfTextContent(null);
        setAnalysisOutput(null);
    } else {
        setSelectedFile(null);
        setCurrentFileName(undefined);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast({ title: "Dosya Gerekli", description: "Lütfen analiz için bir sınav raporu PDF'i yükleyin.", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisOutput(null);

    const currentProfile = await memoizedCheckAndResetQuota();
    if (!currentProfile) {
        toast({ title: "Kullanıcı Bilgisi Yüklenemedi", description: "Lütfen sayfayı yenileyin veya tekrar giriş yapın.", variant: "destructive" });
        setIsAnalyzing(false);
        setCanProcess(false);
        return;
    }
    const currentCanProcess = (currentProfile.dailyRemainingQuota ?? 0) > 0;
     setCanProcess(currentCanProcess);

    if (!currentCanProcess) {
      toast({ title: "Kota Aşıldı", description: "Bugünkü analiz hakkınızı doldurdunuz.", variant: "destructive" });
      setIsAnalyzing(false);
      return;
    }


    try {
      toast({ title: "Rapor İşleniyor...", description: "Sınav raporunuzdan metin içeriği çıkarılıyor." });
      const text = await extractTextFromPdf(selectedFile);
      setPdfTextContent(text);

      if (text.length < 100) {
        toast({ title: "Metin Çok Kısa", description: "Analiz için PDF'ten yeterli metin çıkarılamadı (en az 100 karakter gerekli). Lütfen raporunuzun okunabilir olduğundan emin olun.", variant: "destructive" });
        setIsAnalyzing(false);
        return;
      }

      toast({ title: "Metin Çıkarıldı", description: "Şimdi raporunuz analiz ediliyor..." });


      const input: ExamReportAnalyzerInput = {
        reportTextContent: text,
        userPlan: currentProfile.plan,
        customModelIdentifier: userProfile?.isAdmin ? adminSelectedModel : undefined,
      };
      const result = await analyzeExamReport(input);

      if (result && result.identifiedTopics && result.identifiedTopics.length > 0) {
        setAnalysisOutput(result);
        toast({ title: "Analiz Hazır!", description: "Sınav raporunuz için detaylı analiz oluşturuldu." });
        if (decrementQuota) {
            const decrementSuccess = await decrementQuota(currentProfile);
            if (decrementSuccess) {
                 const updatedProfileAfterDecrement = await memoizedCheckAndResetQuota();
                 if (updatedProfileAfterDecrement) {
                   setCanProcess((updatedProfileAfterDecrement.dailyRemainingQuota ?? 0) > 0);
                 }
            } else {
                // Decrement failed, refresh quota to be sure
                const refreshedProfile = await memoizedCheckAndResetQuota();
                if(refreshedProfile){
                  setCanProcess((refreshedProfile.dailyRemainingQuota ?? 0) > 0);
                }
            }
        }
      } else {
        const errorMessage = result?.overallFeedback || "Yapay zeka bir analiz üretemedi veya format hatalı.";
        toast({ title: "Analiz Sonucu Yetersiz", description: errorMessage, variant: "destructive"});
        setAnalysisOutput({ identifiedTopics: [], overallFeedback: errorMessage, studySuggestions: ["Lütfen rapor metnini kontrol edin veya farklı bir rapor deneyin."], reportSummaryTitle:"Analiz Başarısız"});
      }
    } catch (error: any) {
      console.error("Sınav raporu analiz hatası:", error);
      toast({ title: "Analiz Hatası", description: error.message || "Rapor analiz edilirken beklenmedik bir hata oluştu.", variant: "destructive" });
      setAnalysisOutput({ identifiedTopics: [], overallFeedback: error.message || "Beklenmedik bir hata oluştu.", studySuggestions: ["Tekrar deneyin."], reportSummaryTitle:"Analiz Hatası"});
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isSubmitButtonDisabled =
    isAnalyzing ||
    !selectedFile ||
    (!userProfileLoading && userProfile && !canProcess) ||
    (!userProfileLoading && !userProfile);

  const isModelSelectDisabled =
    isAnalyzing ||
    !userProfile?.isAdmin ||
    (!userProfileLoading && userProfile && !canProcess) ||
    (!userProfileLoading && !userProfile);

  const isFormElementsDisabled =
    isAnalyzing ||
    (!userProfileLoading && userProfile && !canProcess) ||
    (!userProfileLoading && !userProfile);


  if (userProfileLoading && !userProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">AI Sınav Raporu Analizcisi yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl">AI Sınav Raporu Analizcisi</CardTitle>
          </div>
          <CardDescription>
            YKS deneme sınavı raporunuzun PDF'ini yükleyin. Yapay zeka, zayıf olduğunuz konuları, genel performansınızı ve gelişim alanlarınızı analiz ederek size özel geri bildirimler ve çalışma önerileri sunsun.
          </CardDescription>
        </CardHeader>
        <CardContent>
         {userProfile?.isAdmin && (
              <div className="space-y-2 p-4 mb-4 border rounded-md bg-muted/50">
                <Label htmlFor="adminModelSelectExamReport" className="font-semibold text-primary flex items-center gap-2"><Settings size={16}/> Model Seç (Admin Özel)</Label>
                <Select
                  value={adminSelectedModel}
                  onValueChange={setAdminSelectedModel}
                  disabled={isModelSelectDisabled}
                >
                  <SelectTrigger id="adminModelSelectExamReport">
                    <SelectValue placeholder="Varsayılan Modeli Kullan (Plan Bazlı)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default_gemini_flash">Varsayılan (Gemini 2.0 Flash)</SelectItem>
                    <SelectItem value="experimental_gemini_1_5_flash">Deneysel (Gemini 1.5 Flash)</SelectItem>
                    <SelectItem value="experimental_gemini_2_5_flash_preview_05_20">Deneysel (Gemini 2.5 Flash Preview 05-20)</SelectItem>
                  </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground">Farklı AI modellerini test edebilirsiniz.</p>
              </div>
            )}
        </CardContent>
      </Card>

      {!userProfileLoading && userProfile && !canProcess && !isAnalyzing && (userProfile.dailyRemainingQuota ?? 0) <=0 && (
         <Alert variant="destructive" className="shadow-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Günlük Kota Doldu</AlertTitle>
          <AlertDescription>
            Bugünlük ücretsiz analiz hakkınızı kullandınız. Lütfen yarın tekrar kontrol edin veya Premium/Pro'ya yükseltin.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
             <CardTitle className="text-lg">Sınav Raporu Yükle</CardTitle>
             <CardDescription>Lütfen analiz etmek istediğiniz sınav raporunun PDF dosyasını seçin (Maksimum {MAX_FILE_SIZE_MB}MB).</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
                <Label htmlFor="reportUpload" className="sr-only">Sınav Raporu PDF</Label>
                <ShadInput
                    id="reportUpload"
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    disabled={isFormElementsDisabled}
                />
                {currentFileName && (
                  <div className="mt-2 flex items-center text-sm text-muted-foreground bg-muted p-2 rounded-md">
                    <FileTextIcon className="h-5 w-5 mr-2 text-primary" />
                    Seçilen Dosya: {currentFileName}
                  </div>
                )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitButtonDisabled}>
              {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Sınav Raporunu Analiz Et
            </Button>
          </CardContent>
        </Card>
      </form>

      {isAnalyzing && !analysisOutput && (
        <Card className="mt-6 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium text-foreground">Rapor Analiz Ediliyor...</p>
              <p className="text-sm text-muted-foreground">
                {pdfTextContent ? "Yapay zeka YKS performansınızı inceliyor..." : "PDF'ten metin çıkarılıyor..."}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Bu işlem biraz zaman alabilir.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {analysisOutput && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{analysisOutput.reportSummaryTitle || "Sınav Raporu Analizi Sonuçları"}</CardTitle>
            <CardDescription>Yapay zeka tarafından oluşturulan detaylı analiz ve önerileriniz aşağıdadır.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ScrollArea className="h-[600px] w-full rounded-md border p-4 bg-muted/30">
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line leading-relaxed">

                <h3 className="text-lg font-semibold mt-3 mb-1 text-foreground">Tespit Edilen Konular ve Analizler:</h3>
                {analysisOutput.identifiedTopics.length > 0 ? (
                    analysisOutput.identifiedTopics.map((item, index) => (
                        <div key={index} className="p-3 my-2 border rounded-md bg-card">
                            <p className="font-semibold text-base text-primary">{item.topic}
                                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                                    item.status === 'strong' ? 'bg-green-500 text-white' :
                                    item.status === 'needs_improvement' ? 'bg-yellow-500 text-black' :
                                    'bg-red-500 text-white'
                                }`}>
                                    {item.status === 'strong' ? 'Güçlü' : item.status === 'needs_improvement' ? 'Geliştirilmeli' : 'Zayıf'}
                                </span>
                            </p>
                            <p className="text-muted-foreground mt-1">{item.analysis}</p>
                        </div>
                    ))
                ) : (
                    <p className="text-muted-foreground italic">Belirli konulara dair detaylı analiz bulunamadı.</p>
                )}

                <h3 className="text-lg font-semibold mt-4 mb-1 text-foreground">Genel Geri Bildirim:</h3>
                <p className="text-muted-foreground">{analysisOutput.overallFeedback}</p>

                <h3 className="text-lg font-semibold mt-4 mb-1 text-foreground">Çalışma Önerileri:</h3>
                {analysisOutput.studySuggestions.length > 0 ? (
                    <ul className="list-disc pl-5 text-muted-foreground">
                        {analysisOutput.studySuggestions.map((suggestion, index) => (
                            <li key={index}>{suggestion}</li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground italic">Özel çalışma önerisi bulunamadı.</p>
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
       {!isAnalyzing && !analysisOutput && !userProfileLoading && (userProfile || !userProfile) &&(
         <Alert className="mt-6">
          <ClipboardCheck className="h-4 w-4" />
          <AlertTitle>Analize Hazır!</AlertTitle>
          <AlertDescription>
            YKS sınav raporunuzun PDF dosyasını yükleyerek kişiselleştirilmiş analizinizi ve çalışma önerilerinizi alın.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
