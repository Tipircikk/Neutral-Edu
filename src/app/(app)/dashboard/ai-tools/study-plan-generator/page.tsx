
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalendarDays, Wand2, Loader2, AlertTriangle, Settings, UploadCloud, FileText as FileTextIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input as ShadInput } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import React, { useState, useEffect, useCallback, Fragment } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { generateStudyPlan, type GenerateStudyPlanOutput, type GenerateStudyPlanInput } from "@/ai/flows/study-plan-generator-flow";
import { extractTextFromPdf } from "@/lib/pdfUtils";

const MAX_PDF_SIZE_MB = 5;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

export default function StudyPlanGeneratorPage() {
  const [userField, setUserField] = useState<GenerateStudyPlanInput["userField"] | undefined>(undefined);
  const [customSubjectsInput, setCustomSubjectsInput] = useState("");
  const [studyDuration, setStudyDuration] = useState("4_hafta");
  const [hoursPerDay, setHoursPerDay] = useState(4);
  const [planOutput, setPlanOutput] = useState<GenerateStudyPlanOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [adminSelectedModel, setAdminSelectedModel] = useState<string | undefined>(undefined);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [pdfContextText, setPdfContextText] = useState<string | null>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);

  const { toast } = useToast();
  const { userProfile, loading: userProfileLoading, checkAndResetQuota, decrementQuota } = useUser();
  const [canProcess, setCanProcess] = useState(false);

  const memoizedCheckAndResetQuota = useCallback(async () => {
    if (!checkAndResetQuota) return userProfile;
    return checkAndResetQuota();
  }, [checkAndResetQuota, userProfile]);

  useEffect(() => {
    if (!userProfileLoading) {
      if (userProfile) {
        memoizedCheckAndResetQuota().then(updatedProfile => {
          setCanProcess((updatedProfile?.dailyRemainingQuota ?? 0) > 0);
        });
      } else {
         setCanProcess(false);
      }
    }
  }, [userProfile, userProfileLoading, memoizedCheckAndResetQuota]);

  const handlePdfFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast({ title: "Geçersiz Dosya Türü", description: "Lütfen bir PDF dosyası yükleyin.", variant: "destructive" });
        setPdfFile(null); setPdfFileName(null); setPdfContextText(null);
        event.target.value = ""; return;
      }
      if (file.size > MAX_PDF_SIZE_BYTES) {
        toast({ title: "Dosya Boyutu Çok Büyük", description: `Lütfen ${MAX_PDF_SIZE_MB}MB'den küçük bir PDF dosyası yükleyin.`, variant: "destructive" });
        setPdfFile(null); setPdfFileName(null); setPdfContextText(null);
        event.target.value = ""; return;
      }
      
      const confirmUpload = window.confirm(`"${file.name}" adlı dosyayı yükleyip içeriğini çalışma planı için ek bağlam olarak kullanmak istediğinize emin misiniz? Bu işlem dosya boyutuna göre zaman alabilir.`);
      if (!confirmUpload) {
        event.target.value = ""; 
        setPdfFile(null); setPdfFileName(null); setPdfContextText(null);
        return;
      }
      
      setPdfFile(file); setPdfFileName(file.name); setPlanOutput(null);
      setIsProcessingPdf(true);
      toast({ title: "PDF İşleniyor...", description: "Lütfen bekleyin." });
      try {
        const text = await extractTextFromPdf(file);
        setPdfContextText(text);
        toast({ title: "PDF İşlendi", description: "PDF içeriği çalışma planı için ek bağlam olarak kullanılmaya hazır." });
      } catch (error: any) {
        console.error("PDF metin çıkarma hatası:", error);
        toast({ title: "PDF İşleme Hatası", description: error.message || "PDF'ten metin çıkarılırken bir hata oluştu.", variant: "destructive" });
        setPdfFile(null); setPdfFileName(null); setPdfContextText(null);
        event.target.value = "";
      } finally {
        setIsProcessingPdf(false);
      }
    } else {
      setPdfFile(null); setPdfFileName(null); setPdfContextText(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userField && !customSubjectsInput.trim()) {
      toast({ title: "Girdi Gerekli", description: "Lütfen bir YKS alanı seçin veya odaklanmak istediğiniz konuları girin.", variant: "destructive" });
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
        userField: userField || undefined,
        customSubjectsInput: customSubjectsInput.trim() || undefined,
        studyDuration,
        hoursPerDay,
        userPlan: currentProfile.plan,
        customModelIdentifier: userProfile?.isAdmin ? adminSelectedModel : undefined,
        pdfContextText: pdfContextText || undefined,
      };
      const result = await generateStudyPlan(input);

      if (result && result.planTitle && Array.isArray(result.weeklyPlans)) { // introduction is optional in schema
        const validatedWeeklyPlans = result.weeklyPlans.map((plan, index) => ({
          ...plan,
          week: typeof plan.week === 'number' && !isNaN(plan.week) ? plan.week : index + 1,
          dailyTasks: Array.isArray(plan.dailyTasks) ? plan.dailyTasks.map(task => ({
            ...task,
            focusTopics: Array.isArray(task.focusTopics) && task.focusTopics.length > 0 ? task.focusTopics : ["Genel Tekrar / Boş Zaman"],
          })) : [],
        }));
        setPlanOutput({ ...result, weeklyPlans: validatedWeeklyPlans });
        toast({ title: "Çalışma Planı Hazır!", description: "Kişiselleştirilmiş çalışma planınız oluşturuldu." });
        if (decrementQuota) {
            await decrementQuota(currentProfile);
        }
        const updatedProfileAgain = await memoizedCheckAndResetQuota();
        if (updatedProfileAgain) {
          setCanProcess((updatedProfileAgain.dailyRemainingQuota ?? 0) > 0);
        }
      } else {
        let errorMessage = result?.introduction || result?.planTitle || "Yapay zeka bir çalışma planı üretemedi veya format hatalı.";
        if (result?.weeklyPlans === undefined || !Array.isArray(result?.weeklyPlans)){
            errorMessage += " Haftalık planlar oluşturulamadı.";
        }
        if (result && (typeof result.planTitle !== 'string' || typeof result.introduction !== 'string' || !Array.isArray(result.weeklyPlans) || typeof result.disclaimer !== 'string')) {
             errorMessage = "AI'dan gelen yanıt beklenen formatta değil. Lütfen tekrar deneyin veya farklı bir model seçin.";
        }
        toast({ title: "Plan Oluşturma Sonucu Yetersiz", description: errorMessage, variant: "destructive"});
        setPlanOutput({ planTitle: "Plan Oluşturulamadı", introduction: errorMessage, weeklyPlans: [], disclaimer: "Bir sorun oluştu." });
      }
    } catch (error: any) {
      console.error("[Study Plan Generator Page] Plan oluşturma hatası:", error);
      let displayErrorMessage = "Çalışma planı oluşturulurken beklenmedik bir hata oluştu.";
        if (error instanceof Error) {
            if (error.name === 'GenkitError' && error.message.includes('Schema validation failed')) {
                let zodErrorDetails = "Şema Doğrulama Hatası.";
                // @ts-ignore
                if (error.details && Array.isArray(error.details) && error.details.length > 0) {
                    // @ts-ignore
                    zodErrorDetails = error.details.map((detail: any) => detail.message || JSON.stringify(detail.path ? `${detail.path.join('.')} - ${detail.message}`: detail.message )).join('; ');
                }
                displayErrorMessage = `AI modelinden gelen yanıt şemayla uyuşmuyor: ${zodErrorDetails.substring(0, 300)}`;
                 if (zodErrorDetails.toLowerCase().includes("week") || zodErrorDetails.toLowerCase().includes("focustopics") || zodErrorDetails.toLowerCase().includes("plantitle") || zodErrorDetails.toLowerCase().includes("introduction")) {
                   displayErrorMessage += " (AI, haftalık planları, başlığı, girişi veya günlük odak konularını beklenen formatta oluşturamadı.)";
                 }
            } else {
                displayErrorMessage = error.message;
            }
        } else if (typeof error === 'string' && error.length > 0) {
            displayErrorMessage = error;
        } else if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
            displayErrorMessage = error.message;
        }
      toast({ title: "Oluşturma Hatası", description: displayErrorMessage, variant: "destructive" });
      setPlanOutput({ planTitle: "Hata", introduction: displayErrorMessage, weeklyPlans: [], disclaimer: "Bir sorun oluştu." });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const isSubmitButtonDisabled = 
    isGenerating || 
    isProcessingPdf || 
    (!userField && !customSubjectsInput.trim()) ||
    (hoursPerDay < 1 || hoursPerDay > 12) || 
    (!userProfileLoading && userProfile && !canProcess && (userProfile.dailyRemainingQuota ?? 0) <= 0) ||
    (!userProfileLoading && !userProfile);
  
  const isModelSelectDisabled = 
    isGenerating || 
    isProcessingPdf ||
    !userProfile?.isAdmin ||
    (!userProfileLoading && userProfile && !canProcess && (userProfile.dailyRemainingQuota ?? 0) <= 0) ||
    (!userProfileLoading && !userProfile);

  const isFormElementsDisabled = 
    isGenerating || 
    isProcessingPdf || 
    (!userProfileLoading && userProfile && !canProcess && (userProfile.dailyRemainingQuota ?? 0) <= 0) ||
    (!userProfileLoading && !userProfile);

  const renderFormattedText = (text: string | undefined | null): React.ReactNode => {
    if (!text) return null; // Return null if text is null, undefined, or empty
    
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    let listItems: string[] = [];
    let keyCounter = 0;

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`ul-${keyCounter++}`} className="list-disc pl-5 my-2 space-y-1 text-muted-foreground">
            {listItems.map((item, idx) => <li key={`li-${keyCounter}-${idx}`}>{item}</li>)}
          </ul>
        );
        listItems = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      const proTipMatch = trimmedLine.match(/^(PRO KULLANICI İÇİN STRATEJİLER|PRO İPUCU|PREMIUM KULLANICI İÇİN STRATEJİLER|ÜCRETSİZ KULLANICI İÇİN STRATEJİLER|ÖNEMLİ NOT|UNUTMA|GENEL STRATEJİLER VE YKS TAKTİKLERİ):\s*(.*)/i);

      if (proTipMatch) {
        flushList();
        const label = proTipMatch[1];
        const content = proTipMatch[2];
        elements.push(
          <div key={`pro-tip-${keyCounter++}`} className="my-3 p-3 border-l-4 border-primary bg-primary/10 rounded-r-md">
            <strong className="font-bold text-primary">{label}:</strong>
            <p className="text-muted-foreground mt-1 leading-relaxed">{content}</p>
          </div>
        );
      } else if (trimmedLine.startsWith("* ") || trimmedLine.startsWith("- ")) {
        listItems.push(trimmedLine.substring(line.indexOf(' ') + 1));
      } else if (trimmedLine.startsWith("## ")) {
         flushList();
         elements.push(<h3 key={`h3-${keyCounter++}`} className="text-lg font-semibold mt-3 mb-1 text-foreground">{trimmedLine.substring(3)}</h3>);
      } else if (trimmedLine.startsWith("### ")) {
         flushList();
         elements.push(<h4 key={`h4-${keyCounter++}`} className="text-md font-semibold mt-2 mb-1 text-foreground">{trimmedLine.substring(4)}</h4>);
      } else if (trimmedLine === "") {
         flushList();
         if (index < lines.length -1 && lines[index+1].trim() !== "") {
            elements.push(<div key={`space-${keyCounter++}`} className="h-3"></div>); 
         }
      }
      else {
        flushList();
        elements.push(<p key={`p-${keyCounter++}`} className="my-1 text-muted-foreground leading-relaxed">{line || <Fragment key={`empty-${keyCounter++}`}>&nbsp;</Fragment>}</p>); 
      }
    });
    flushList(); 
    return elements;
  };


  if (userProfileLoading && !userProfile) {
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
            YKS alanınızı, toplam çalışma sürenizi ve günlük çalışma saatinizi girin. İsteğe bağlı olarak, konularınızı veya notlarınızı içeren bir PDF yükleyerek ya da özel konular belirterek AI'nın daha kişisel bir plan oluşturmasına yardımcı olabilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
         {userProfile?.isAdmin && (
              <div className="space-y-2 p-4 mb-4 border rounded-md bg-muted/50">
                <Label htmlFor="adminModelSelectStudyPlan" className="font-semibold text-primary flex items-center gap-2"><Settings size={16}/> Model Seç (Admin Özel)</Label>
                <Select 
                  value={adminSelectedModel} 
                  onValueChange={setAdminSelectedModel} 
                  disabled={isModelSelectDisabled}
                >
                  <SelectTrigger id="adminModelSelectStudyPlan">
                    <SelectValue placeholder="Varsayılan Modeli Kullan (Plan Bazlı)" />
                  </SelectTrigger>
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

      {!userProfileLoading && userProfile && !canProcess && !isGenerating && !isProcessingPdf && (userProfile.dailyRemainingQuota ?? 0) <=0 && (
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
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="userField">YKS Alanınız / Bölümünüz</Label>
                    <Select value={userField} onValueChange={(value: GenerateStudyPlanInput["userField"]) => setUserField(value)} disabled={isFormElementsDisabled}>
                        <SelectTrigger id="userField" className="mt-1">
                            <SelectValue placeholder="Genel bir plan için boş bırakın veya alan seçin" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="sayisal">Sayısal</SelectItem>
                            <SelectItem value="ea">Eşit Ağırlık</SelectItem>
                            <SelectItem value="sozel">Sözel</SelectItem>
                            <SelectItem value="tyt">Sadece TYT</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="studyDuration">Toplam Çalışma Süresi</Label>
                    <Select value={studyDuration} onValueChange={setStudyDuration} disabled={isFormElementsDisabled} className="mt-1">
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
                <Label htmlFor="customSubjectsInput">Odaklanmak İstediğiniz Özel Konular/Dersler (isteğe bağlı)</Label>
                <Textarea
                    id="customSubjectsInput"
                    placeholder="Örn: Sadece Kimya - Organik Kimya ve Çözeltiler konuları için bir plan istiyorum."
                    value={customSubjectsInput}
                    onChange={(e) => setCustomSubjectsInput(e.target.value)}
                    rows={3}
                    className="mt-1"
                    disabled={isFormElementsDisabled}
                />
                <p className="text-xs text-muted-foreground mt-1">Bu alanı doldurursanız, yukarıdaki alan seçimi yerine buradaki konular önceliklendirilir.</p>
            </div>
             <div>
                <Label htmlFor="hoursPerDay">Günlük Ortalama Çalışma Saati (1-12)</Label>
                <ShadInput type="number" id="hoursPerDay" value={hoursPerDay} onChange={(e) => setHoursPerDay(parseInt(e.target.value, 10))} min="1" max="12" disabled={isFormElementsDisabled} className="mt-1"/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="pdfUploadStudyPlan" className="flex items-center gap-2">
                    <UploadCloud className="h-5 w-5 text-muted-foreground" />
                    Ek Bağlam İçin PDF Yükle (İsteğe Bağlı, Maks {MAX_PDF_SIZE_MB}MB)
                </Label>
                <ShadInput 
                    id="pdfUploadStudyPlan"
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfFileChange}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    disabled={isFormElementsDisabled}
                />
                {pdfFileName && (
                  <div className="mt-2 flex items-center text-sm text-muted-foreground bg-muted p-2 rounded-md">
                    <FileTextIcon className="h-5 w-5 mr-2 text-primary" />
                    Yüklenen PDF: {pdfFileName} {isProcessingPdf && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  </div>
                )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitButtonDisabled}>
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
                Yapay zeka sizin için en uygun planı hazırlıyor... Bu işlem biraz zaman alabilir.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {planOutput && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{planOutput.planTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             {planOutput.introduction && (
                <Card className="bg-muted/30 p-4">
                    <CardHeader className="p-0 mb-2">
                        <CardTitle className="text-lg text-primary">Giriş ve Genel Stratejiler</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 prose prose-sm dark:prose-invert max-w-none">
                        {renderFormattedText(planOutput.introduction)}
                    </CardContent>
                </Card>
             )}
            
            <ScrollArea className="h-[700px] w-full rounded-md border p-4">
              {planOutput.weeklyPlans && planOutput.weeklyPlans.length > 0 ? (
                planOutput.weeklyPlans.map((weekPlan, weekIndex) => (
                  <Card key={weekPlan.week ?? weekIndex} className="bg-card shadow-md mb-6 last:mb-0">
                    <CardHeader>
                        <CardTitle className="text-lg text-primary">
                        {weekPlan.week}. Hafta
                        {weekPlan.weeklyGoal && `: ${weekPlan.weeklyGoal}`}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {weekPlan.dailyTasks && weekPlan.dailyTasks.length > 0 ? (
                          weekPlan.dailyTasks.map((dayTask, dayIndex) => (
                            <div key={dayIndex} className="p-3 border-t border-border first:border-t-0">
                              <h4 className="font-semibold text-foreground mb-1">{dayTask.day}</h4>
                              <p className="text-sm text-muted-foreground">
                                <strong className="text-foreground/90">Odak Konular:</strong> {dayTask.focusTopics.join(", ")}
                              </p>
                              {dayTask.activities && dayTask.activities.length > 0 && (
                                <div className="mt-1">
                                  <p className="text-xs text-foreground/80">Aktiviteler:</p>
                                  <ul className="list-disc list-inside pl-4 text-xs text-muted-foreground">
                                    {dayTask.activities.map((activity, actIndex) => <li key={actIndex}>{activity}</li>)}
                                  </ul>
                                </div>
                              )}
                              {dayTask.estimatedTime && <p className="text-xs text-muted-foreground mt-1"><strong className="text-foreground/80">Tahmini Süre:</strong> {dayTask.estimatedTime}</p>}
                              {dayTask.notes && <div className="text-xs italic text-muted-foreground mt-2 prose prose-xs dark:prose-invert max-w-none whitespace-pre-line">{renderFormattedText(dayTask.notes)}</div>}
                            </div>
                          ))
                        ) : (
                           <p className="text-sm text-muted-foreground italic">Bu hafta için günlük görev bulunmuyor.</p>
                        )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                 <p className="text-center text-muted-foreground">Haftalık planlar oluşturulamadı veya bulunamadı.</p>
              )}
            </ScrollArea>
             {planOutput.disclaimer && (
                <Alert className="mt-4" variant="default">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Sorumluluk Reddi</AlertTitle>
                    <AlertDescription>{planOutput.disclaimer}</AlertDescription>
                </Alert>
             )}
            <div className="mt-4 p-3 text-xs text-destructive-foreground bg-destructive/80 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>NeutralEdu AI bir yapay zekadır bu nedenle hata yapabilir, bu yüzden verdiği bilgileri doğrulayınız ve bu planı bir başlangıç noktası olarak kullanınız.</span>
            </div>
          </CardContent>
        </Card>
      )}
       {!isGenerating && !isProcessingPdf && !planOutput && !userProfileLoading && (userProfile || !userProfile) &&(
         <Alert className="mt-6">
          <CalendarDays className="h-4 w-4" />
          <AlertTitle>Plana Hazır!</AlertTitle>
          <AlertDescription>
            Yukarıdaki formu doldurarak kişiselleştirilmiş YKS çalışma planınızı oluşturun. İsterseniz ek bağlam için bir PDF de yükleyebilirsiniz.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

    
