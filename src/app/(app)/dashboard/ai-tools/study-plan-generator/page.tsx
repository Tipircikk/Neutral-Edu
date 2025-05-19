
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalendarDays, Wand2, Loader2, AlertTriangle, Settings } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { generateStudyPlan, type GenerateStudyPlanOutput, type GenerateStudyPlanInput } from "@/ai/flows/study-plan-generator-flow";

export default function StudyPlanGeneratorPage() {
  const [targetExam, setTargetExam] = useState("YKS");
  const [subjects, setSubjects] = useState("");
  const [studyDuration, setStudyDuration] = useState("4_hafta");
  const [hoursPerDay, setHoursPerDay] = useState(4);
  const [planOutput, setPlanOutput] = useState<GenerateStudyPlanOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [adminSelectedModel, setAdminSelectedModel] = useState<string | undefined>(undefined);

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
    if (subjects.trim().length < 5) {
      toast({ title: "Konular Yetersiz", description: "Lütfen en az 5 karakterden oluşan konular girin.", variant: "destructive" });
      return;
    }
    if (hoursPerDay < 1 || hoursPerDay > 12) {
        toast({ title: "Geçersiz Saat", description: "Günlük çalışma saati 1 ile 12 arasında olmalıdır.", variant: "destructive" });
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
      const input: GenerateStudyPlanInput = {
        targetExam,
        subjects,
        studyDuration,
        hoursPerDay,
        userPlan: currentProfile.plan,
        customModelIdentifier: userProfile?.isAdmin ? adminSelectedModel : undefined,
      };
      const result = await generateStudyPlan(input);

      if (result && result.planTitle && result.weeklyPlans) {
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
        throw new Error(result?.planTitle || "Yapay zeka bir çalışma planı üretemedi veya format hatalı.");
      }
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
  
  const isSubmitDisabled = isGenerating || !subjects.trim() || subjects.trim().length < 5 || (hoursPerDay < 1 || hoursPerDay > 12) || (!canProcess && !userProfileLoading && (userProfile?.dailyRemainingQuota ?? 0) <=0);

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
            Hedef sınavınızı, çalışmak istediğiniz konuları, süreyi ve günlük çalışma saatinizi girin. Yapay zeka sizin için kişiselleştirilmiş bir YKS çalışma planı taslağı oluştursun.
          </CardDescription>
        </CardHeader>
        <CardContent>
         {userProfile?.isAdmin && (
              <div className="space-y-2 p-4 mb-4 border rounded-md bg-muted/50">
                <Label htmlFor="adminModelSelectStudyPlan" className="font-semibold text-primary flex items-center gap-2"><Settings size={16}/> Model Seç (Admin Özel)</Label>
                <Select value={adminSelectedModel} onValueChange={setAdminSelectedModel} disabled={isSubmitDisabled}>
                  <SelectTrigger id="adminModelSelectStudyPlan"><SelectValue placeholder="Varsayılan Modeli Kullan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default_gemini_flash">Varsayılan (Gemini 2.0 Flash)</SelectItem>
                    <SelectItem value="experimental_gemini_1_5_flash">Deneysel (Gemini 1.5 Flash)</SelectItem>
                    <SelectItem value="experimental_gemini_2_5_flash_preview">Deneysel (Gemini 2.5 Flash Preview)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Farklı AI modellerini test edebilirsiniz.</p>
              </div>
            )}
        </CardContent>
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

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
             <CardTitle className="text-lg">Plan Detayları</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="targetExam">Hedef Sınav</Label>
                    <Input id="targetExam" value={targetExam} onChange={(e) => setTargetExam(e.target.value)} placeholder="örn: YKS, TYT, AYT" disabled={isGenerating || !canProcess} />
                </div>
                <div>
                    <Label htmlFor="studyDuration">Çalışma Süresi</Label>
                    <Select value={studyDuration} onValueChange={setStudyDuration} disabled={isGenerating || !canProcess}>
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
                <Input type="number" id="hoursPerDay" value={hoursPerDay} onChange={(e) => setHoursPerDay(parseInt(e.target.value, 10))} min="1" max="12" disabled={isGenerating || !canProcess}/>
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
                disabled={isGenerating || !canProcess}
                />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Çalışma Planı Oluştur
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
            <CardTitle>{planOutput.planTitle}</CardTitle>
            {planOutput.introduction && <CardDescription>{planOutput.introduction}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-6">
            <ScrollArea className="h-[600px] w-full rounded-md border p-4 bg-muted/30">
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-line leading-relaxed">
                {planOutput.weeklyPlans.map((weekPlan, weekIndex) => (
                  <div key={weekIndex} className="mb-6 p-4 border rounded-md bg-card">
                    <h3 className="text-lg font-semibold mt-3 mb-2 text-primary">
                      {weekPlan.week}. Hafta
                      {weekPlan.weeklyGoal && `: ${weekPlan.weeklyGoal}`}
                    </h3>
                    {weekPlan.dailyTasks.map((dayTask, dayIndex) => (
                      <div key={dayIndex} className="mb-3 p-3 border-t border-dashed">
                        <h4 className="font-semibold text-foreground">{dayTask.day}</h4>
                        <p className="text-muted-foreground">
                          <span className="font-medium">Odak Konular:</span> {dayTask.focusTopics.join(", ")}
                        </p>
                        {dayTask.estimatedTime && <p className="text-xs text-muted-foreground">Tahmini Süre: {dayTask.estimatedTime}</p>}
                        {dayTask.activities && dayTask.activities.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mt-1">Aktiviteler:</p>
                            <ul className="list-disc list-inside pl-2 text-xs text-muted-foreground">
                              {dayTask.activities.map((activity, actIndex) => <li key={actIndex}>{activity}</li>)}
                            </ul>
                          </div>
                        )}
                        {dayTask.notes && <p className="text-xs italic text-accent-foreground/80 mt-1">Not: {dayTask.notes}</p>}
                      </div>
                    ))}
                  </div>
                ))}
                {planOutput.generalTips && planOutput.generalTips.length > 0 && (
                  <div className="mt-4 p-3 border rounded-md bg-card">
                    <h3 className="text-lg font-semibold mt-3 mb-2 text-primary">Genel İpuçları</h3>
                    <ul className="list-disc list-inside pl-2 text-muted-foreground">
                      {planOutput.generalTips.map((tip, tipIndex) => <li key={tipIndex}>{tip}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </ScrollArea>
             <p className="text-sm text-muted-foreground mt-2">{planOutput.disclaimer}</p>
            <div className="mt-4 p-3 text-xs text-destructive-foreground bg-destructive/80 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>NeutralEdu AI bir yapay zekadır bu nedenle hata yapabilir, bu yüzden verdiği bilgileri doğrulayınız ve bu planı bir başlangıç noktası olarak kullanınız.</span>
            </div>
          </CardContent>
        </Card>
      )}
       {!isGenerating && !planOutput && !userProfileLoading && (
         <Alert className="mt-6">
          <CalendarDays className="h-4 w-4" />
          <AlertTitle>Plana Hazır!</AlertTitle>
          <AlertDescription>
            Yukarıdaki formu doldurarak kişiselleştirilmiş YKS çalışma planınızı oluşturun.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
    