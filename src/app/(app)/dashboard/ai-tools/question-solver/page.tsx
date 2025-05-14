
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Added import
import { HelpCircle, Send, Loader2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
// import { solveQuestion, type SolveQuestionOutput } from "@/ai/flows/question-solver-flow"; // Placeholder for actual flow

export default function QuestionSolverPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null); // Changed to string for simple text answer
  const [isSolving, setIsSolving] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      toast({ title: "Soru Gerekli", description: "Lütfen çözmek istediğiniz soruyu girin.", variant: "destructive" });
      return;
    }

    setIsSolving(true);
    setAnswer(null);

    try {
      // const result: SolveQuestionOutput = await solveQuestion({ questionText: question });
      // Simulating API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      const result = { solution: `"${question}" sorunuz için örnek bir çözüm ve açıklama buraya gelecek. Bu özellik yakında aktif olacaktır.` };


      if (result && result.solution) {
        setAnswer(result.solution);
        toast({ title: "Çözüm Hazır!", description: "Sorunuz için bir çözüm oluşturuldu." });
      } else {
        throw new Error("Yapay zeka bir çözüm üretemedi.");
      }
    } catch (error: any) {
      console.error("Soru çözme hatası:", error);
      toast({
        title: "Çözüm Hatası",
        description: error.message || "Soru çözülürken beklenmedik bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsSolving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <HelpCircle className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl">AI Soru Çözücü</CardTitle>
          </div>
          <CardDescription>
            Aklınızdaki soruları sorun, yapay zeka size adım adım çözümler ve açıklamalar sunsun. (Bu özellik yakında!)
          </CardDescription>
        </CardHeader>
      </Card>

      <Alert variant="default" className="bg-accent/50 border-primary/30">
        <AlertTriangle className="h-4 w-4 text-primary" />
        <AlertTitle className="text-primary">Yakında Sizlerle!</AlertTitle>
        <AlertDescription>
          AI Soru Çözücü özelliği şu anda geliştirme aşamasındadır. Çok yakında kullanımınıza sunulacaktır. Anlayışınız için teşekkürler!
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Textarea
              placeholder="Örneğin: Bir dik üçgenin hipotenüsü 10 cm, bir dik kenarı 6 cm ise diğer dik kenarı kaç cm'dir?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={5}
              className="text-base"
              disabled // Temporarily disable until feature is ready
            />
            <Button type="submit" className="w-full" disabled={isSolving || !question.trim()}>
              {isSolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Çözüm İste
            </Button>
          </CardContent>
        </Card>
      </form>

      {answer && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Yapay Zeka Çözümü</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line">
              {answer}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
