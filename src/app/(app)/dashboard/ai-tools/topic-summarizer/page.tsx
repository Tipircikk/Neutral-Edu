
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb, Brain, Loader2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
// import { summarizeTopic, type SummarizeTopicOutput } from "@/ai/flows/topic-summarizer-flow"; // Placeholder

export default function TopicSummarizerPage() {
  const [topicOrText, setTopicOrText] = useState("");
  const [summary, setSummary] = useState<string | null>(null); // Changed to string for simple text output
  const [isSummarizing, setIsSummarizing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicOrText.trim()) {
      toast({ title: "Konu veya Metin Gerekli", description: "Lütfen özetlemek istediğiniz konuyu veya metni girin.", variant: "destructive" });
      return;
    }

    setIsSummarizing(true);
    setSummary(null);

    try {
      // const result: SummarizeTopicOutput = await summarizeTopic({ inputText: topicOrText });
      // Simulating API call
      await new Promise(resolve => setTimeout(resolve, 1800));
      const result = { topicSummary: `"${topicOrText}" için kapsamlı bir konu özeti buraya gelecek. Ana fikirler, alt başlıklar ve önemli detaylar vurgulanacaktır. Bu özellik yakında aktif olacaktır.` };

      if (result && result.topicSummary) {
        setSummary(result.topicSummary);
        toast({ title: "Özet Hazır!", description: "Konu veya metin başarıyla özetlendi." });
      } else {
        throw new Error("Yapay zeka bir özet üretemedi.");
      }
    } catch (error: any) {
      console.error("Konu özetleme hatası:", error);
      toast({
        title: "Özetleme Hatası",
        description: error.message || "Konu özetlenirken beklenmedik bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Lightbulb className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl">AI Konu Özetleyici</CardTitle>
          </div>
          <CardDescription>
            Geniş konuları veya uzun metinleri temel kavramlarına indirgeyerek hızlı ve etkili bir şekilde öğrenin. (Bu özellik yakında!)
          </CardDescription>
        </CardHeader>
      </Card>

      <Alert variant="default" className="bg-accent/50 border-primary/30">
        <AlertTriangle className="h-4 w-4 text-primary" />
        <AlertTitle className="text-primary">Yakında Sizlerle!</AlertTitle>
        <AlertDescription>
          AI Konu Özetleyici özelliği şu anda geliştirme aşamasındadır. Çok yakında kullanımınıza sunulacaktır. Anlayışınız için teşekkürler!
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Textarea
              placeholder="Özetlemek istediğiniz konuyu (Örn: Fotosentez, İkinci Dünya Savaşı'nın Nedenleri) veya metni buraya yapıştırın..."
              value={topicOrText}
              onChange={(e) => setTopicOrText(e.target.value)}
              rows={8}
              className="text-base"
              disabled // Temporarily disable
            />
            <Button type="submit" className="w-full" disabled={isSummarizing || !topicOrText.trim()}>
              {isSummarizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
              Özetle
            </Button>
          </CardContent>
        </Card>
      </form>

      {summary && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Konu Özeti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line">
              {summary}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

    