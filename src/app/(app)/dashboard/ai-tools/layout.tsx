
import type { ReactNode } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wand2 } from "lucide-react";

export default function AiToolsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Wand2 className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl">Yapay Zeka Araçları</CardTitle>
          </div>
          <CardDescription>
            Öğrenme sürecinizi hızlandıracak ve kolaylaştıracak güçlü yapay zeka araçlarını keşfedin.
          </CardDescription>
        </CardHeader>
      </Card>
      {children}
    </div>
  );
}

    
