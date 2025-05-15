
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalendarDays, Wand2, Loader2, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
// import { generateStudyPlan, type GenerateStudyPlanOutput, type GenerateStudyPlanInput } from "@/ai/flows/study-plan-generator-flow";

export default function StudyPlanGeneratorPage() {
  const [targetExam, setTargetExam] = useState("YKS");
  const [subjects, setSubjects] = useState("");
  const [studyDuration, setStudyDuration] = useState("4_hafta"); // e.g., "4_hafta", "3_ay"
  const [hoursPerDay, setHoursPerDay] = useState(4);
  const [planOutput, setPlanOutput] = useState<any | null>(null); // Replace 'any' with GenerateStudyPlanOutput
  const [isGenerating, setIsGenerating] = useState(false);

  const { toast } = useToast();
  const { userProfile, loading: userProfileLoading, checkAndResetQuota, decrementQuota } = useUser();
  const [canProcess, setCanProcess] = useState(false);

  const memoizedCheckAndResetQuota = useCallback(async () => {
    if (checkAndResetQuota) return checkAndResetQuota();
    return Promise.resolve(userProfile);
  }, [checkAndResetQuota, userProfile]);

  useEffect(() => {
    if (userProfile) {
      memoizedCheckAndResetQuota().then(updatedProfile => {
        setCanProcess((updatedProfile?.dailyRemainingQuota ?? 0) > 0);
      });
    }
  }, [userProfile, memoizedCheckAndResetQuota]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjects.trim()) {
      toast({ title: "Konular Gerekli", description: "Lütfen çalışma planı oluşturmak için konuları girin.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setPlanOutput(null);

    const currentProfile = await memoizedCheckAndResetQuota();
    if (!currentProfile || (currentProfile.dailyRemainingQuota ?? 0) <= 0) {
      toast({ title: "Kota Aşıldı", description: "Bugünkü hakkınızı doldurdunuz.", variant: "destructive" });
      setIsGenerating(false);
      setCanProcess(false);
      return;
    }
    setCanProcess(true);

    try {
      if (!currentProfile?.plan) {
        throw new Error("Kullanıcı planı bulunamadı.");
      }
      /*
      const input: GenerateStudyPlanInput = {
        targetExam,
        subjects,
        studyDuration,
        hoursPerDay,
        userPlan: currentProfile.plan
      };
      const result = await generateStudyPlan(input);

      if (result) { // Adjust condition based on actual output structure
        setPlanOutput(result);
        toast({ title: "Çalışma Planı Hazır!", description: "Kişiselleştirilmiş çalışma planınız oluşturuldu." });
        if (decrementQuota) {
            await decrementQuota(currentProfile);
        }
        const updatedProfileAgain = await memoizedCheckAndResetQuota();
        if (updatedProfileAgain) {
          setCanProcess((updatedProfileAgain.dailyRemainingQuota ?? 0) > 0);
        }
      } else {
        throw new Error("Yapay zeka bir çalışma planı üretemedi.");
      }
      */
      // Placeholder for now
      toast({ title: "Çalışma Planı Oluşturucu (Yakında)", description: "Bu özellik şu anda geliştirme aşamasındadır.", variant: "default" });
      setPlanOutput({ placeholder: "Yapay zeka tarafından oluşturulan çalışma planı burada görünecek." });


    } catch (error: any) {
      console.error("Çalışma planı oluşturma hatası:", error);
      toast({
        title: "Oluşturma Hatası",
        description: error.message || "Çalışma planı oluşturulurken beklenmedik bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const isSubmitDisabled = true; // isGenerating || !subjects.trim() || (!canProcess && !userProfileLoading && (userProfile?.dailyRemainingQuota ?? 0) <=0);

  if (userProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">AI Çalışma Planı Oluşturucu yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CalendarDays className="h-7 w-7 text-primary" /> 
            <CardTitle className="text-2xl">AI Çalışma Planı Oluşturucu</CardTitle>
          </div>
          <CardDescription>
            Hedef sınavınızı, çalışmak istediğiniz konuları, süreyi ve günlük çalışma saatinizi girin. Yapay zeka sizin için kişiselleştirilmiş bir YKS çalışma planı taslağı oluştursun. (Bu özellik yakında aktif olacaktır)
          </CardDescription>
        </CardHeader>
      </Card>

      {!canProcess && !isGenerating && userProfile && (userProfile.dailyRemainingQuota ?? 0) <=0 && (
         <Alert variant="destructive" className="shadow-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Günlük Kota Doldu</AlertTitle>
          <AlertDescription>
            Bugünlük ücretsiz hakkınızı kullandınız. Lütfen yarın tekrar kontrol edin veya Premium/Pro'ya yükseltin.
          </AlertDescription>
        </Alert>
      )}

       <Alert variant="default" className="shadow-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Yakında Sizlerle!</AlertTitle>
          <AlertDescription>
            AI Çalışma Planı Oluşturucu özelliği şu anda geliştirme aşamasındadır. Anlayışınız için teşekkür ederiz!
          </AlertDescription>
        </Alert>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
             <CardTitle className="text-lg">Plan Detayları</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="targetExam">Hedef Sınav</Label>
                    <Input id="targetExam" value={targetExam} onChange={(e) => setTargetExam(e.target.value)} placeholder="örn: YKS, TYT, AYT" disabled={isSubmitDisabled} />
                </div>
                <div>
                    <Label htmlFor="studyDuration">Çalışma Süresi</Label>
                    <Select value={studyDuration} onValueChange={setStudyDuration} disabled={isSubmitDisabled}>
                        <SelectTrigger id="studyDuration">
                            <SelectValue placeholder="Süre seçin" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1_hafta">1 Hafta</SelectItem>
                            <SelectItem value="2_hafta">2 Hafta</SelectItem>
                            <SelectItem value="4_hafta">4 Hafta (1 Ay)</SelectItem>
                            <SelectItem value="8_hafta">8 Hafta (2 Ay)</SelectItem>
                            <SelectItem value="12_hafta">12 Hafta (3 Ay)</SelectItem>
                            <SelectItem value="6_ay">6 Ay</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
             <div>
                <Label htmlFor="hoursPerDay">Günlük Ortalama Çalışma Saati</Label>
                <Input type="number" id="hoursPerDay" value={hoursPerDay} onChange={(e) => setHoursPerDay(parseInt(e.target.value))} min="1" max="12" disabled={isSubmitDisabled}/>
            </div>
            <div>
                <Label htmlFor="subjects">Çalışılacak Konular (Virgülle ayırın)</Label>
                <Textarea
                id="subjects"
                placeholder="örn: Matematik - Türev, Fizik - Optik, Tarih - Osmanlı Yükselme Dönemi..."
                value={subjects}
                onChange={(e) => setSubjects(e.target.value)}
                rows={5}
                className="text-base"
                disabled={isSubmitDisabled}
                />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Çalışma Planı Oluştur (Yakında)
            </Button>
          </CardContent>
        </Card>
      </form>

      {isGenerating && !planOutput && (
        <Card className="mt-6 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium text-foreground">Çalışma Planı Oluşturuluyor...</p>
              <p className="text-sm text-muted-foreground">
                Yapay zeka sizin için en uygun planı hazırlıyor...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {planOutput && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Oluşturulan Çalışma Planı Taslağı</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line">
              {/* Render the actual plan output here once the flow is implemented */}
              <pre>{JSON.stringify(planOutput, null, 2)}</pre>
            </div>
            <div className="mt-4 p-3 text-xs text-destructive-foreground bg-destructive/80 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>NeutralEdu AI bir yapay zekadır bu nedenle hata yapabilir, bu yüzden verdiği bilgileri doğrulayınız ve bu planı bir başlangıç noktası olarak kullanınız.</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
