
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Download, Save, Loader2 } from "lucide-react"; // Added Loader2
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SummarizePdfForStudentOutput } from "@/ai/flows/summarize-pdf"; // Import the type

type SummaryDisplayProps = {
  summaryOutput: SummarizePdfForStudentOutput | null; // Changed prop name and type
  originalFileName?: string;
  onSave?: () => Promise<void>; 
  isSaving?: boolean;
};

export default function SummaryDisplay({ summaryOutput, originalFileName, onSave, isSaving }: SummaryDisplayProps) {
  const { toast } = useToast();

  if (!summaryOutput || !summaryOutput.formattedStudyOutput) { // Check for formattedStudyOutput
    return null;
  }

  const { formattedStudyOutput } = summaryOutput; // Destructure formattedStudyOutput

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

  // Basic markdown-like formatting. More robust parsing might be needed for complex markdown.
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
        return <div key={index} className="h-2"></div>; // Empty line for spacing
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
                {/* {onSave && ( // Save functionality can be re-enabled when implemented
                    <Button variant="outline" size="icon" onClick={onSave} disabled={isSaving} title="Buluta Kaydet">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                )} */}
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-muted/30">
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line leading-relaxed">
            {formatOutputForDisplay(formattedStudyOutput)}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
