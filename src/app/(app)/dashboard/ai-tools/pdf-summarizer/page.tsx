
"use client";

import { useState, useEffect, useCallback } from "react";
import PdfUploadForm from "@/components/dashboard/PdfUploadForm";
import SummaryDisplay from "@/components/dashboard/SummaryDisplay";
import { extractTextFromPdf } from "@/lib/pdfUtils";
import { summarizePdfForStudent, type SummarizePdfForStudentOutput, type SummarizePdfForStudentInput } from "@/ai/flows/summarize-pdf";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Loader2, AlertTriangle, FileScan } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


export default function PdfSummarizerPage() {
  const [summaryOutput, setSummaryOutput] = useState<SummarizePdfForStudentOutput | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [pdfTextContent, setPdfTextContent] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | undefined>(undefined);
  const [summaryLength, setSummaryLength] = useState<"short" | "medium" | "detailed">("medium");
  const { toast } = useToast();
  const { userProfile, loading: userProfileLoading, checkAndResetQuota, decrementQuota } = useUser();

  const [canSummarize, setCanSummarize] = useState(false);

  const memoizedCheckAndResetQuota = useCallback(() => {
    if (checkAndResetQuota) {
      return checkAndResetQuota();
    }
    return Promise.resolve(userProfile); 
  }, [checkAndResetQuota, userProfile]);


  useEffect(() => {
    if (userProfile) {
      memoizedCheckAndResetQuota().then(updatedProfile => {
        if (updatedProfile) {
          setCanSummarize(updatedProfile.dailyRemainingQuota > 0);
        } else {
          setCanSummarize(userProfile.dailyRemainingQuota > 0);
        }
      });
    }
  }, [userProfile, memoizedCheckAndResetQuota]);


  const handlePdfSubmit = async (file: File) => {
    setIsSummarizing(true);
    setSummaryOutput(null); 
    setPdfTextContent(null);
    setCurrentFileName(file.name);

    const currentProfile = await memoizedCheckAndResetQuota();
    if (!currentProfile || currentProfile.dailyRemainingQuota <= 0) {
      toast({
        title: "Kota Aşıldı",
        description: "Bugünkü özet hakkınızı doldurdunuz. Lütfen yarın tekrar deneyin.",
        variant: "destructive",
      });
      setIsSummarizing(false);
      setCanSummarize(false);
      return;
    }
    setCanSummarize(true);


    try {
      toast({ title: "PDF İşleniyor...", description: "PDF'inizden metin içeriği çıkarılıyor." });
      const text = await extractTextFromPdf(file);
      setPdfTextContent(text);
      toast({ title: "Metin Çıkarıldı", description: "Şimdi özetiniz oluşturuluyor..." });

      const input: SummarizePdfForStudentInput = { pdfText: text, summaryLength };
      const result = await summarizePdfForStudent(input);
      
      if (result && result.formattedStudyOutput) { 
        setSummaryOutput(result); 
        toast({ title: "Özet Oluşturuldu!", description: "PDF özetiniz hazır." });
        if (decrementQuota) await decrementQuota(); 
        const updatedProfileAgain = await memoizedCheckAndResetQuota(); 
         if (updatedProfileAgain) {
          setCanSummarize(updatedProfileAgain.dailyRemainingQuota > 0);
        }

      } else {
        throw new Error("Yapay zeka bir özet oluşturamadı veya format hatalı.");
      }
    } catch (error: any) {
      console.error("Özetleme hatası:", error);
      toast({
        title: "Özetleme Hatası",
        description: error.message || "Özet oluşturulurken beklenmedik bir hata oluştu.",
        variant: "destructive",
      });
      setSummaryOutput(null); 
    } finally {
      setIsSummarizing(false);
    }
  };
  
  if (userProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">PDF Özetleyici yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
       <Card className="shadow-sm">
        <CardHeader>
            <div className="flex items-center gap-3">
                <FileScan className="h-7 w-7 text-primary"/>
                <CardTitle className="text-2xl">AI PDF Özetleyici</CardTitle>
            </div>
          <CardDescription>
            PDF belgenizi yükleyin, özet uzunluğunu seçin ve yapay zekanın sizin için kapsamlı bir özet oluşturmasına izin verin.
          </CardDescription>
        </CardHeader>
         <CardContent>
          <div className="mb-4 max-w-xs">
            <Label htmlFor="summaryLength" className="mb-1 block">Özet Uzunluğu</Label>
            <Select
              value={summaryLength}
              onValueChange={(value: "short" | "medium" | "detailed") => setSummaryLength(value)}
              disabled={isSummarizing || (!canSummarize && !isSummarizing && userProfile?.dailyRemainingQuota === 0)}
            >
              <SelectTrigger id="summaryLength">
                <SelectValue placeholder="Özet uzunluğunu seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Kısa (Ana Fikir)</SelectItem>
                <SelectItem value="medium">Orta (Dengeli)</SelectItem>
                <SelectItem value="detailed">Detaylı (Kapsamlı)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!canSummarize && !isSummarizing && userProfile && userProfile.dailyRemainingQuota <=0 && (
         <Alert variant="destructive" className="shadow-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Günlük Kota Doldu</AlertTitle>
          <AlertDescription>
            Bugünlük ücretsiz özet hakkınızı kullandınız. Daha fazlası için lütfen yarın tekrar kontrol edin veya Premium'a yükseltin!
          </AlertDescription>
        </Alert>
      )}

      <PdfUploadForm onSubmit={handlePdfSubmit} isSummarizing={isSummarizing} isDisabled={!canSummarize && !isSummarizing && userProfile?.dailyRemainingQuota === 0} />

      {isSummarizing && !summaryOutput && (
        <Card className="mt-8 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium text-foreground">Özet Oluşturuluyor...</p>
              <p className="text-sm text-muted-foreground">
                {pdfTextContent ? "Yapay zeka sihrini yapıyor..." : "PDF işleniyor..."}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Bu işlem birkaç dakika sürebilir.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {summaryOutput && <SummaryDisplay summaryOutput={summaryOutput} originalFileName={currentFileName} />}

      {!isSummarizing && !summaryOutput && (
         <Alert className="mt-8 shadow-md">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Özetlemeye Hazır!</AlertTitle>
          <AlertDescription>
            Başlamak için yukarıdaki formu kullanarak bir PDF belgesi yükleyin. Yapay zeka tarafından oluşturulan özetiniz burada görünecektir.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
