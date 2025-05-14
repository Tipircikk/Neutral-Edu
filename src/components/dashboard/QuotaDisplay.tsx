
"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

type QuotaDisplayProps = {
  remaining: number;
  total: number;
};

export default function QuotaDisplay({ remaining, total }: QuotaDisplayProps) {
  const percentage = total > 0 ? (remaining / total) * 100 : 0;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Quota:</span>
      <Badge variant={remaining > 0 ? "secondary" : "destructive"} className="px-2 py-0.5 text-xs">
        {remaining}/{total}
      </Badge>
      {/* Optional progress bar
      <div className="w-20">
        <Progress value={percentage} className="h-2" />
      </div>
      */}
    </div>
  );
}
