
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Download, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

type SummaryDisplayProps = {
  summary: string | null;
  originalFileName?: string;
  onSave?: () => Promise<void>; // Placeholder for save functionality
  isSaving?: boolean;
};

// Helper to format summary - basic newlines to paragraphs
// A more sophisticated markdown parser could be used if AI output is markdown
const formatSummary = (text: string): JSX.Element[] => {
  return text.split('\n').map((paragraph, index) => {
    if (paragraph.trim().startsWith('* ') || paragraph.trim().startsWith('- ')) {
      // Basic list item handling
      return <li key={index} className="ml-4 list-disc">{paragraph.substring(paragraph.indexOf(' ') + 1)}</li>;
    }
    if (paragraph.trim().match(/^(#+)\s/)) { // Basic heading H1-H6
        const match = paragraph.trim().match(/^(#+)\s/);
        const level = match ? match[1].length : 0;
        const content = paragraph.substring(paragraph.indexOf(' ') + 1);
        if (level === 1) return <h2 key={index} className="text-xl font-semibold mt-4 mb-2">{content}</h2>;
        if (level === 2) return <h3 key={index} className="text-lg font-semibold mt-3 mb-1">{content}</h3>;
        if (level === 3) return <h4 key={index} className="text-md font-semibold mt-2 mb-1">{content}</h4>;
    }
    return <p key={index} className="mb-2 last:mb-0">{paragraph}</p>;
  });
};


export default function SummaryDisplay({ summary, originalFileName, onSave, isSaving }: SummaryDisplayProps) {
  const { toast } = useToast();

  if (!summary) {
    return null;
  }

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(summary)
      .then(() => {
        toast({ title: "Copied!", description: "Summary copied to clipboard." });
      })
      .catch(err => {
        console.error("Failed to copy text: ", err);
        toast({ title: "Error", description: "Failed to copy summary.", variant: "destructive" });
      });
  };

  const handleDownloadText = () => {
    const blob = new Blob([summary], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeFileName = originalFileName?.replace(/\.pdf$/i, '_summary.txt').replace(/[^a-z0-9_.-]/gi, '_') || "summary.txt";
    link.download = safeFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "Summary downloaded as a text file." });
  };


  return (
    <Card className="w-full mt-8 shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="text-2xl">Generated Summary</CardTitle>
                {originalFileName && <CardDescription>For: {originalFileName}</CardDescription>}
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={handleCopyToClipboard} title="Copy to Clipboard">
                    <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleDownloadText} title="Download as Text">
                    <Download className="h-4 w-4" />
                </Button>
                {/* {onSave && (
                    <Button variant="outline" size="icon" onClick={onSave} disabled={isSaving} title="Save to Cloud">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                )} */}
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-muted/30">
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed">
            {formatSummary(summary)}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
