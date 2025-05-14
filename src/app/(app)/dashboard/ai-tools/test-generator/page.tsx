
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileTextIcon, Wand2, Loader2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
// import { generateTest, type GenerateTestOutput } from "@/ai/flows/test-generator-flow"; // Placeholder

export default function TestGeneratorPage() {
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [testContent, setTestContent] = useState<string | null>(null); // Changed to string for simple text output
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast({ title: "Konu Gerekli", description: "Lütfen test oluşturmak istediğiniz konuyu girin.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setTestContent(null);

    try {
      // const result: GenerateTestOutput = await generateTest({ topic, numQuestions });
      // Simulating API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      const result = { testBody: `"${topic}" konusu ve ${numQuestions} soru için örnek bir test buraya gelecek. Bu özellik yakında aktif olacaktır. Sorular ve cevap anahtarları içerecektir.` };


      if (result && result.testBody) {
        setTestContent(result.testBody);
        toast({ title: "Test Hazır!", description: "Belirttiğiniz konu için bir test oluşturuldu." });
      } else {
        throw new Error("Yapay zeka bir test üretemedi.");
      }
    } catch (error: any) {
      console.error("Test oluşturma hatası:", error);
      toast({
        title: "Test Oluşturma Hatası",
        description: error.message || "Test oluşturulurken beklenmedik bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileTextIcon className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl">AI Test Oluşturucu</CardTitle>
          </div>
          <CardDescription>
            Belirlediğiniz konularda veya metinlerden özel pratik testleri anında oluşturun. (Bu özellik yakında!)
          </CardDescription>
        </CardHeader>
      </Card>

      <Alert variant="default" className="bg-accent/50 border-primary/30">
        <AlertTriangle className="h-4 w-4 text-primary" />
        <AlertTitle className="text-primary">Yakında Sizlerle!</AlertTitle>
        <AlertDescription>
          AI Test Oluşturucu özelliği şu anda geliştirme aşamasındadır. Çok yakında kullanımınıza sunulacaktır. Anlayışınız için teşekkürler!
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <label htmlFor="topic" className="block text-sm font-medium text-foreground mb-1">Test Konusu</label>
              <Textarea
                id="topic"
                placeholder="Örneğin: Hücre Biyolojisi, Osmanlı Tarihi Yükselme Dönemi, Limit ve Türev..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
                className="text-base"
                disabled // Temporarily disable
              />
            </div>
            <div>
                <label htmlFor="numQuestions" className="block text-sm font-medium text-foreground mb-1">Soru Sayısı</label>
                <input 
                    type="number" 
                    id="numQuestions"
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(parseInt(e.target.value,10))}
                    min="3"
                    max="20"
                    className="w-full p-2 border rounded-md bg-input border-border"
                    disabled // Temporarily disable
                />
            </div>
            <Button type="submit" className="w-full" disabled={isGenerating || !topic.trim()}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Test Oluştur
            </Button>
          </CardContent>
        </Card>
      </form>

      {testContent && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Oluşturulan Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line">
              {testContent}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

    