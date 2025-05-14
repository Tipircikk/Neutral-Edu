
"use client";

import { useState, useEffect, useCallback } from "react";
import PdfUploadForm from "@/components/dashboard/PdfUploadForm";
import SummaryDisplay from "@/components/dashboard/SummaryDisplay";
import { extractTextFromPdf } from "@/lib/pdfUtils";
import { summarizePdfForStudent, type SummarizePdfForStudentOutput } from "@/ai/flows/summarize-pdf"; // Import type
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  const [summaryOutput, setSummaryOutput] = useState<SummarizePdfForStudentOutput | null>(null); // Changed state name and type
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [pdfTextContent, setPdfTextContent] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const { userProfile, loading: userProfileLoading, checkAndResetQuota, decrementQuota } = useUser();

  const [canSummarize, setCanSummarize] = useState(false);

  const memoizedCheckAndResetQuota = useCallback(checkAndResetQuota, [checkAndResetQuota]);

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
    setSummaryOutput(null); // Clear previous summary output
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

      const result = await summarizePdfForStudent({ pdfText: text });
      
      if (result && result.formattedStudyOutput) { // Check for formattedStudyOutput
        setSummaryOutput(result); // Set the full output object
        toast({ title: "Özet Oluşturuldu!", description: "PDF özetiniz hazır." });
        await decrementQuota(); 
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
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Kontrol paneliniz yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Kontrol Paneli</h1>
        <p className="text-muted-foreground">
          PDF'inizi yükleyin ve yapay zekamızın öğrenci dostu bir özet sunmasına izin verin.
        </p>
      </div>

      {!canSummarize && !isSummarizing && userProfile && userProfile.dailyRemainingQuota <=0 && (
         <Alert variant="destructive" className="shadow-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Günlük Kota Doldu</AlertTitle>
          <AlertDescription>
            Bugünlük ücretsiz özet hakkınızı kullandınız. Daha fazlası için lütfen yarın tekrar kontrol edin!
          </AlertDescription>
        </Alert>
      )}

      <PdfUploadForm onSubmit={handlePdfSubmit} isSummarizing={isSummarizing} isDisabled={!canSummarize && !isSummarizing} />

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
