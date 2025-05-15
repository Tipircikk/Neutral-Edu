
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Download, AlertTriangle, ThumbsUp, ThumbsDown } from "lucide-react"; 
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SummarizePdfForStudentOutput } from "@/ai/flows/summarize-pdf"; 

type SummaryDisplayProps = {
  summaryOutput: SummarizePdfForStudentOutput | null; 
  originalFileName?: string;
};

export default function SummaryDisplay({ summaryOutput, originalFileName }: SummaryDisplayProps) {
  const { toast } = useToast();

  if (!summaryOutput || !summaryOutput.formattedStudyOutput) { 
    return null;
  }

  const { formattedStudyOutput } = summaryOutput; 

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(formattedStudyOutput)
      .then(() => {
        toast({ title: "Kopyalandı!", description: "Özet panoya kopyalandı." });
      })
      .catch(err => {
        console.error("Metin kopyalanamadı: ", err);
        toast({ title: "Hata", description: "Özet kopyalanamadı.", variant: "destructive" });
      });
  };

  const handleDownloadText = () => {
    const blob = new Blob([formattedStudyOutput], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeFileName = originalFileName?.replace(/\.pdf$/i, '_özet.txt').replace(/[^a-z0-9_.-]/gi, '_') || "özet.txt";
    link.download = safeFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "İndirildi", description: "Özet metin dosyası olarak indirildi." });
  };

  const handleFeedback = (type: "like" | "dislike") => {
    // TODO: Implement actual feedback saving logic to Firestore
    toast({
      title: "Geri Bildiriminiz Alındı!",
      description: type === "like" ? "Özeti beğendiğiniz için teşekkür ederiz." : "Daha iyisini yapmak için çalışacağız.",
    });
  };

  const formatOutputForDisplay = (text: string): JSX.Element[] => {
    return text.split('\n').map((line, index) => {
      if (line.trim().startsWith('## ')) {
        return <h2 key={index} className="text-xl font-semibold mt-4 mb-2 text-foreground">{line.substring(3)}</h2>;
      }
      if (line.trim().startsWith('### ')) {
        return <h3 key={index} className="text-lg font-semibold mt-3 mb-1 text-foreground">{line.substring(4)}</h3>;
      }
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        return <li key={index} className="ml-4 list-disc text-muted-foreground">{line.substring(line.indexOf(' ') + 1)}</li>;
      }
      if (line.trim() === "") {
        return <div key={index} className="h-2"></div>; 
      }
      return <p key={index} className="mb-2 last:mb-0 text-muted-foreground">{line}</p>;
    });
  };


  return (
    <Card className="w-full mt-8 shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="text-2xl">Oluşturulan Özet</CardTitle>
                {originalFileName && <CardDescription>Dosya: {originalFileName}</CardDescription>}
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={handleCopyToClipboard} title="Panoya Kopyala">
                    <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleDownloadText} title="Metin Olarak İndir">
                    <Download className="h-4 w-4" />
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-muted/30">
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line leading-relaxed">
            {formatOutputForDisplay(formattedStudyOutput)}
          </div>
        </ScrollArea>
        <div className="mt-4 flex justify-end items-center gap-3">
            <span className="text-sm text-muted-foreground">Bu özeti faydalı buldunuz mu?</span>
            <Button variant="outline" size="icon" onClick={() => handleFeedback("like")} title="Beğendim">
                <ThumbsUp className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => handleFeedback("dislike")} title="Beğenmedim">
                <ThumbsDown className="h-4 w-4" />
            </Button>
        </div>
        <div className="mt-4 p-3 text-xs text-destructive-foreground bg-destructive/80 rounded-md flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>NeutralEdu AI bir yapay zekadır bu nedenle hata yapabilir, bu yüzden verdiği bilgileri doğrulayınız.</span>
        </div>
      </CardContent>
    </Card>
  );
}
