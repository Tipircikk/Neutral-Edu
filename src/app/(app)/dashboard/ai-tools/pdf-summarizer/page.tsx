
"use client";

import { useState, useEffect, useCallback } from "react";
import SummaryDisplay from "@/components/dashboard/SummaryDisplay";
import { extractTextFromPdf } from "@/lib/pdfUtils";
import { summarizePdfForStudent, type SummarizePdfForStudentOutput, type SummarizePdfForStudentInput } from "@/ai/flows/summarize-pdf-flow";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Loader2, AlertTriangle, FileScan, Settings, UploadCloud, FileText as FileTextIcon } from "lucide-react"; // Renamed FileText to FileTextIcon
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input as ShadInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function PdfSummarizerPage() {
  const [summaryOutput, setSummaryOutput] = useState<SummarizePdfForStudentOutput | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [pdfTextContent, setPdfTextContent] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | undefined>(undefined);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [summaryLength, setSummaryLength] = useState<SummarizePdfForStudentInput["summaryLength"]>("medium");
  const [keywords, setKeywords] = useState<string>("");
  const [pageRange, setPageRange] = useState<string>("");
  const [outputDetail, setOutputDetail] = useState<SummarizePdfForStudentInput["outputDetail"]>("full");
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
      setSummaryOutput(null);
      setPdfTextContent(null);
    } else {
      setSelectedFile(null);
      setCurrentFileName(undefined);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast({ title: "Dosya Gerekli", description: "Lütfen özetlemek için bir PDF dosyası yükleyin.", variant: "destructive" });
      return;
    }

    setIsSummarizing(true);
    setSummaryOutput(null);
    setPdfTextContent(null);

    const currentProfile = await memoizedCheckAndResetQuota();
     if (!currentProfile) {
        toast({ title: "Kullanıcı Bilgisi Yüklenemedi", description: "Lütfen sayfayı yenileyin veya tekrar giriş yapın.", variant: "destructive" });
        setIsSummarizing(false);
        setCanProcess(false);
        return;
    }
    const currentCanProcess = (currentProfile.dailyRemainingQuota ?? 0) > 0;
    setCanProcess(currentCanProcess);

    if (!currentCanProcess) {
      toast({ title: "Kota Aşıldı", description: "Bugünkü özetleme hakkınızı doldurdunuz.", variant: "destructive" });
      setIsSummarizing(false);
      return;
    }


    try {
      toast({ title: "PDF İşleniyor...", description: "PDF'inizden metin içeriği çıkarılıyor." });
      const text = await extractTextFromPdf(selectedFile);
      setPdfTextContent(text);
      toast({ title: "Metin Çıkarıldı", description: "Şimdi konu anlatımınız oluşturuluyor..." });


      const input: SummarizePdfForStudentInput = {
        pdfText: text,
        summaryLength,
        keywords: keywords.trim() || undefined,
        pageRange: pageRange.trim() || undefined,
        outputDetail,
        userPlan: currentProfile.plan,
        customModelIdentifier: userProfile?.isAdmin ? adminSelectedModel : undefined,
      };
      const result = await summarizePdfForStudent(input);

      if (result && result.formattedStudyOutput) {
        setSummaryOutput(result);
        toast({ title: "Konu Anlatımı Oluşturuldu!", description: "PDF içeriğiniz için detaylı anlatım hazır." });
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
        const errorMessage = result?.summary || "Yapay zeka bir anlatım üretemedi veya format hatalı.";
        toast({ title: "Anlatım Sonucu Yetersiz", description: errorMessage, variant: "destructive"});
        setSummaryOutput({ summary: errorMessage, keyPoints: [], mainIdea: "Hata", examTips: [], practiceQuestions: [], formattedStudyOutput: `## Hata\n\n${errorMessage}` });
      }
    } catch (error: any) {
      console.error("Detaylı anlatım oluşturma hatası:", error);
      toast({ title: "Anlatım Oluşturma Hatası", description: error.message || "Anlatım oluşturulurken beklenmedik bir hata oluştu.", variant: "destructive" });
      const errorMessage = error.message || "Beklenmedik bir hata oluştu.";
      setSummaryOutput({ summary: errorMessage, keyPoints: [], mainIdea: "Hata", examTips: [], practiceQuestions: [], formattedStudyOutput: `## Hata\n\n${errorMessage}` });
    } finally {
      setIsSummarizing(false);
    }
  };

  const isSubmitButtonDisabled =
    isSummarizing ||
    !selectedFile ||
    (!userProfileLoading && userProfile && !canProcess) ||
    (!userProfileLoading && !userProfile);

  const isModelSelectDisabled =
    isSummarizing ||
    !userProfile?.isAdmin ||
    (!userProfileLoading && userProfile && !canProcess) ||
    (!userProfileLoading && !userProfile);

  const isFormElementsDisabled =
    isSummarizing ||
    (!userProfileLoading && userProfile && !canProcess) ||
    (!userProfileLoading && !userProfile);


  if (userProfileLoading && !userProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">AI PDF Anlatıcısı yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
       <Card className="shadow-sm">
        <CardHeader>
            <div className="flex items-center gap-3">
                <FileScan className="h-6 w-6 md:h-7 md:w-7 text-primary"/>
                <CardTitle className="text-xl md:text-2xl">AI PDF Detaylı Konu Anlatıcısı</CardTitle>
            </div>
          <CardDescription>
            PDF belgenizi yükleyin, seçenekleri ayarlayın ve yapay zekanın sizin için konuyu derinlemesine anlatmasına izin verin.
          </CardDescription>
        </CardHeader>
         <CardContent className="space-y-4 md:space-y-6">
            {userProfile?.isAdmin && (
              <div className="space-y-2 p-4 mb-4 border rounded-md bg-muted/50">
                <Label htmlFor="adminModelSelectPdf" className="font-semibold text-primary flex items-center gap-2"><Settings size={16}/> Model Seç (Admin Özel)</Label>
                <Select
                  value={adminSelectedModel}
                  onValueChange={setAdminSelectedModel}
                  disabled={isModelSelectDisabled}
                >
                  <SelectTrigger id="adminModelSelectPdf">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="summaryLength" className="mb-1 block text-sm">Anlatım Uzunluğu</Label>
                    <Select
                    value={summaryLength}
                    onValueChange={(value: SummarizePdfForStudentInput["summaryLength"]) => setSummaryLength(value)}
                    disabled={isFormElementsDisabled}
                    >
                    <SelectTrigger id="summaryLength">
                        <SelectValue placeholder="Uzunluk seçin" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="short">Kısa (Ana Hatlar)</SelectItem>
                        <SelectItem value="medium">Orta (Dengeli)</SelectItem>
                        <SelectItem value="detailed">Detaylı (Kapsamlı)</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
                 <div>
                    <Label htmlFor="outputDetail" className="mb-1 block text-sm">İstenen Çıktı Detayı</Label>
                    <Select
                    value={outputDetail}
                    onValueChange={(value: SummarizePdfForStudentInput["outputDetail"]) => setOutputDetail(value)}
                    disabled={isFormElementsDisabled}
                    >
                    <SelectTrigger id="outputDetail">
                        <SelectValue placeholder="Çıktı detayını seçin" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="full">Tam Anlatım (Varsayılan)</SelectItem>
                        <SelectItem value="key_points_only">Sadece Anahtar Noktalar</SelectItem>
                        <SelectItem value="exam_tips_only">Sadece Sınav İpuçları</SelectItem>
                        <SelectItem value="questions_only">Sadece Örnek Sorular</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                    <Label htmlFor="keywords" className="mb-1 block text-sm">Anahtar Kelimeler (isteğe bağlı)</Label>
                    <ShadInput
                        id="keywords"
                        placeholder="örn: fotosentez, hücre zarı, enerji"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        disabled={isFormElementsDisabled}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Virgülle ayırarak birden fazla anahtar kelime girebilirsiniz.</p>
                </div>
                <div>
                    <Label htmlFor="pageRange" className="mb-1 block text-sm">Sayfa Aralığı (isteğe bağlı)</Label>
                    <ShadInput
                        id="pageRange"
                        placeholder="örn: 5-10, 12, 15-20"
                        value={pageRange}
                        onChange={(e) => setPageRange(e.target.value)}
                        disabled={isFormElementsDisabled}
                    />
                     <p className="text-xs text-muted-foreground mt-1">Belirli sayfalara odaklanmak için (AI yorumuna göre).</p>
                </div>
            </div>
        </CardContent>
      </Card>

      {!userProfileLoading && userProfile && !canProcess && !isSummarizing && (userProfile.dailyRemainingQuota ?? 0) <=0 && (
         <Alert variant="destructive" className="shadow-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Günlük Kota Doldu</AlertTitle>
          <AlertDescription>
            Bugünlük ücretsiz anlatım hakkınızı kullandınız. Daha fazlası için lütfen yarın tekrar kontrol edin veya Premium/Pro'ya yükseltin!
          </AlertDescription>
        </Alert>
      )}
        <Card className="w-full shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl flex items-center">
                <UploadCloud className="mr-3 h-6 w-6 text-primary" />
                PDF Yükle
                </CardTitle>
                <CardDescription>
                Anlatımını oluşturmak istediğiniz PDF dosyasını seçin (Maksimum {MAX_FILE_SIZE_MB}MB).
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="pdfFile-upload" className="sr-only">PDF Dosyası</Label>
                    <div className="flex items-center justify-center w-full">
                        <label htmlFor="pdfFile-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted border-input transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                                <p className="mb-1 text-sm text-muted-foreground"><span className="font-semibold">Yüklemek için tıklayın</span> veya sürükleyip bırakın</p>
                                <p className="text-xs text-muted-foreground">PDF (MAKS. {MAX_FILE_SIZE_MB}MB)</p>
                            </div>
                            <ShadInput
                            id="pdfFile-upload"
                            type="file"
                            className="hidden"
                            accept=".pdf"
                            onChange={handleFileChange}
                            disabled={isFormElementsDisabled}
                            />
                        </label>
                    </div>
                    {currentFileName && (
                    <div className="mt-2 flex items-center text-sm text-muted-foreground bg-muted p-2 rounded-md">
                        <FileTextIcon className="h-5 w-5 mr-2 text-primary" />
                        Seçilen Dosya: {currentFileName}
                    </div>
                    )}
                </div>
                </CardContent>
                <CardFooter>
                <Button type="submit" className="w-full" disabled={isSubmitButtonDisabled}>
                    {isSummarizing ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Anlatım Oluşturuluyor...
                    </>
                    ) : "PDF Anlatımı Oluştur"}
                </Button>
                </CardFooter>
            </form>
        </Card>


      {isSummarizing && !summaryOutput && (
        <Card className="mt-6 md:mt-8 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium text-foreground">Anlatım Oluşturuluyor...</p>
              <p className="text-sm text-muted-foreground">
                {pdfTextContent ? "Yapay zeka sihrini yapıyor..." : "PDF işleniyor..."}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Bu işlem birkaç dakika sürebilir.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {summaryOutput && <SummaryDisplay summaryOutput={summaryOutput} originalFileName={currentFileName} />}

      {!isSummarizing && !summaryOutput && !userProfileLoading && (userProfile || !userProfile) && (
         <Alert className="mt-6 md:mt-8 shadow-md">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Anlatıma Hazır!</AlertTitle>
          <AlertDescription>
            Başlamak için yukarıdaki formu kullanarak bir PDF belgesi yükleyin ve seçenekleri ayarlayın. Yapay zeka tarafından oluşturulan detaylı anlatımınız burada görünecektir.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
    