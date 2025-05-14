
"use client";

import { useState, useEffect, useCallback } from "react";
import PdfUploadForm from "@/components/dashboard/PdfUploadForm";
import SummaryDisplay from "@/components/dashboard/SummaryDisplay";
import { extractTextFromPdf } from "@/lib/pdfUtils";
import { summarizePdfForStudent } from "@/ai/flows/summarize-pdf";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  const [summary, setSummary] = useState<string | null>(null);
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
    setSummary(null);
    setPdfTextContent(null);
    setCurrentFileName(file.name);

    // Check quota again right before processing
    const currentProfile = await memoizedCheckAndResetQuota();
    if (!currentProfile || currentProfile.dailyRemainingQuota <= 0) {
      toast({
        title: "Quota Exceeded",
        description: "You have used all your summaries for today. Please try again tomorrow.",
        variant: "destructive",
      });
      setIsSummarizing(false);
      setCanSummarize(false);
      return;
    }
    setCanSummarize(true);


    try {
      toast({ title: "Processing PDF...", description: "Extracting text content from your PDF." });
      const text = await extractTextFromPdf(file);
      setPdfTextContent(text);
      toast({ title: "Text Extracted", description: "Now generating your summary..." });

      const result = await summarizePdfForStudent({ pdfText: text });
      
      if (result.summary) {
        setSummary(result.summary);
        toast({ title: "Summary Generated!", description: "Your PDF summary is ready." });
        await decrementQuota(); // Decrement quota after successful summarization
        // Refresh quota display (useUser hook should update userProfile, triggering re-render)
        const updatedProfileAgain = await memoizedCheckAndResetQuota(); // re-fetch to ensure UI consistency
         if (updatedProfileAgain) {
          setCanSummarize(updatedProfileAgain.dailyRemainingQuota > 0);
        }

      } else {
        throw new Error("The AI failed to generate a summary.");
      }
    } catch (error: any) {
      console.error("Summarization error:", error);
      toast({
        title: "Summarization Error",
        description: error.message || "An unexpected error occurred while generating the summary.",
        variant: "destructive",
      });
      setSummary(null); // Clear any partial summary
    } finally {
      setIsSummarizing(false);
    }
  };
  
  if (userProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Upload your PDF and let our AI provide a student-friendly summary.
        </p>
      </div>

      {!canSummarize && !isSummarizing && userProfile && userProfile.dailyRemainingQuota <=0 && (
         <Alert variant="destructive" className="shadow-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Daily Quota Reached</AlertTitle>
          <AlertDescription>
            You&apos;ve used all your free summaries for today. Please check back tomorrow for more!
          </AlertDescription>
        </Alert>
      )}

      <PdfUploadForm onSubmit={handlePdfSubmit} isSummarizing={isSummarizing} isDisabled={!canSummarize && !isSummarizing} />

      {isSummarizing && !summary && (
        <Card className="mt-8 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium text-foreground">Generating Summary...</p>
              <p className="text-sm text-muted-foreground">
                {pdfTextContent ? "AI is working its magic..." : "Processing PDF..."}
              </p>
              <p className="text-xs text-muted-foreground mt-2">This may take a few moments.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {summary && <SummaryDisplay summary={summary} originalFileName={currentFileName} />}

      {!isSummarizing && !summary && (
         <Alert className="mt-8 shadow-md">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Ready to Summarize!</AlertTitle>
          <AlertDescription>
            Upload a PDF document using the form above to get started. Your AI-generated summary will appear here.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
