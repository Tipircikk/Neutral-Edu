
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileScan, HelpCircle, FileTextIcon, Lightbulb, ArrowRight } from "lucide-react";

const aiTools = [
  {
    name: "AI PDF Özetleyici",
    description: "Uzun PDF'lerinizi saniyeler içinde anahtar noktaları içeren anlaşılır özetlere dönüştürün.",
    icon: <FileScan className="h-10 w-10 text-primary mb-4" />,
    link: "/dashboard/ai-tools/pdf-summarizer",
    status: "active",
  },
  {
    name: "AI Soru Çözücü",
    description: "Karmaşık sorularınıza adım adım çözümler ve açıklamalar alın. İsterseniz soru içeren bir görsel de yükleyebilirsiniz.",
    icon: <HelpCircle className="h-10 w-10 text-primary mb-4" />,
    link: "/dashboard/ai-tools/question-solver",
    status: "active", // Changed from soon
  },
  {
    name: "AI Test Oluşturucu",
    description: "Belirlediğiniz konulardan pratik testler oluşturun.",
    icon: <FileTextIcon className="h-10 w-10 text-primary mb-4" />,
    link: "/dashboard/ai-tools/test-generator",
    status: "active", // Changed from soon
  },
  {
    name: "AI Konu Özetleyici",
    description: "Geniş konuları veya metinleri temel kavramlarına indirgeyerek hızlıca öğrenin.",
    icon: <Lightbulb className="h-10 w-10 text-primary mb-4" />,
    link: "/dashboard/ai-tools/topic-summarizer",
    status: "active", // Changed from soon
  },
];

export default function AiToolsPage() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {aiTools.map((tool) => (
        <Card key={tool.name} className="flex flex-col hover:shadow-xl transition-shadow duration-300">
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
      ))}
    </div>
  );
}
