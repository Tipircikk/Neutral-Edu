
"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileScan, HelpCircle, FileTextIcon, Lightbulb, ArrowRight, LayoutGrid, ClipboardCheck, CalendarDays, Presentation, Youtube } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const allAiTools = [
  {
    name: "AI PDF Anlatıcısı",
    description: "Uzun PDF'lerinizi saniyeler içinde anahtar noktaları içeren, detaylı ve öğrenci dostu anlatımlara dönüştürün.",
    icon: <FileScan className="h-10 w-10 text-primary mb-4" />,
    link: "/dashboard/ai-tools/pdf-summarizer",
    status: "active",
    category: "ozetleme",
  },
  {
    name: "AI Soru Çözücü",
    description: "Karmaşık YKS sorularınıza adım adım çözümler ve açıklamalar alın. (Geliştirme Aşamasında)",
    icon: <HelpCircle className="h-10 w-10 text-primary mb-4" />,
    link: "/dashboard/ai-tools/question-solver",
    status: "soon",
    category: "soru",
  },
  {
    name: "AI Test Oluşturucu",
    description: "Belirlediğiniz konulardan YKS formatında, detaylı çözümlü pratik testler oluşturun.",
    icon: <FileTextIcon className="h-10 w-10 text-primary mb-4" />,
    link: "/dashboard/ai-tools/test-generator",
    status: "active",
    category: "soru",
  },
  {
    name: "AI Konu Özetleyici",
    description: "Geniş konuları veya metinleri temel kavramlarına indirgeyerek YKS odaklı hızlı özetler alın.",
    icon: <Lightbulb className="h-10 w-10 text-primary mb-4" />,
    link: "/dashboard/ai-tools/topic-summarizer",
    status: "active",
    category: "ozetleme",
  },
  {
    name: "AI Bilgi Kartı Oluşturucu",
    description: "Önemli kavramlardan ve tanımlardan hızlıca çalışmak için etkileşimli bilgi kartları (flashcard) oluşturun.",
    icon: <LayoutGrid className="h-10 w-10 text-primary mb-4" />,
    link: "/dashboard/ai-tools/flashcard-generator",
    status: "active",
    category: "ozetleme",
  },
  {
    name: "AI Sınav Raporu Analizcisi",
    description: "YKS deneme sınavı raporlarınızı (PDF) analiz ederek zayıf olduğunuz konuları ve gelişim alanlarınızı belirleyin.",
    icon: <ClipboardCheck className="h-10 w-10 text-primary mb-4" />,
    link: "/dashboard/ai-tools/exam-report-analyzer",
    status: "active",
    category: "analiz",
  },
  {
    name: "AI Çalışma Planı Oluşturucu",
    description: "Hedeflerinize ve konularınıza özel kişiselleştirilmiş YKS çalışma planı taslakları alın.",
    icon: <CalendarDays className="h-10 w-10 text-primary mb-4" />,
    link: "/dashboard/ai-tools/study-plan-generator",
    status: "active",
    category: "analiz",
  },
  {
    name: "AI Konu Anlatımı Oluşturucu",
    description: "Belirttiğiniz YKS konusunu yapay zekanın detaylı, seviyeli ve farklı hoca tarzlarında anlatmasını sağlayın.",
    icon: <Presentation className="h-10 w-10 text-primary mb-4" />,
    link: "/dashboard/ai-tools/topic-explainer",
    status: "active",
    category: "ozetleme",
  },
  {
    name: "AI Video Özetleyici",
    description: "YouTube ders videolarının linkini vererek eğitimsel içeriklerini özetleyin. (Deneysel)",
    icon: <Youtube className="h-10 w-10 text-primary mb-4" />,
    link: "/dashboard/ai-tools/video-summarizer",
    status: "active", // Changed to active for testing
    category: "ozetleme",
  },
];

const ToolCard = ({ tool }: { tool: typeof allAiTools[0] }) => (
  <Card className="flex flex-col hover:shadow-xl transition-shadow duration-300">
    <CardHeader className="items-center text-center">
      {tool.icon}
      <CardTitle>{tool.name}</CardTitle>
    </CardHeader>
    <CardContent className="flex-grow text-center">
      <p className="text-muted-foreground text-sm">{tool.description}</p>
    </CardContent>
    <CardFooter>
      <Button asChild className="w-full" disabled={tool.status === "soon"}>
        <Link href={tool.link}>
          {tool.status === "soon" ? "Yakında" : "Aracı Kullan"}
          {tool.status !== "soon" && <ArrowRight className="ml-2 h-4 w-4" />}
        </Link>
      </Button>
    </CardFooter>
  </Card>
);

export default function AiToolsPage() {
  const soruTools = allAiTools.filter(tool => tool.category === 'soru');
  const ozetlemeTools = allAiTools.filter(tool => tool.category === 'ozetleme');
  const analizTools = allAiTools.filter(tool => tool.category === 'analiz');

  return (
    <Tabs defaultValue="ozetleme" className="w-full">
      <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 mb-6">
        <TabsTrigger value="ozetleme">Konu Anlama ve Özetleme</TabsTrigger>
        <TabsTrigger value="soru">Sınav ve Soru Hazırlığı</TabsTrigger>
        <TabsTrigger value="analiz">Analiz ve Planlama</TabsTrigger>
      </TabsList>
      <TabsContent value="ozetleme">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ozetlemeTools.map((tool) => (
            <ToolCard tool={tool} key={tool.name} />
          ))}
        </div>
      </TabsContent>
      <TabsContent value="soru">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {soruTools.map((tool) => (
            <ToolCard tool={tool} key={tool.name} />
          ))}
        </div>
      </TabsContent>
      <TabsContent value="analiz">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {analizTools.map((tool) => (
            <ToolCard tool={tool} key={tool.name} />
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
