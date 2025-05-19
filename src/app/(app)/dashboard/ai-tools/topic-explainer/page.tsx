
"use client";

import React, { useState, useEffect, useCallback, Fragment } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Presentation, Wand2, Loader2, AlertTriangle, Download, Settings } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { explainTopic, type ExplainTopicOutput, type ExplainTopicInput } from "@/ai/flows/topic-explainer-flow";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function TopicExplainerPage() {
  const [topicName, setTopicName] = useState("");
  const [explanationLevel, setExplanationLevel] = useState<ExplainTopicInput["explanationLevel"]>("orta");
  const [teacherPersona, setTeacherPersona] = useState<ExplainTopicInput["teacherPersona"]>("samimi");
  const [customPersonaDescription, setCustomPersonaDescription] = useState("");
  const [explanationOutput, setExplanationOutput] = useState<ExplainTopicOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
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

  const parseInlineFormatting = (line: string | undefined | null): React.ReactNode[] => {
    if (!line) return [<React.Fragment key="empty-line"></React.Fragment>];
    // Regex to split by `text^number` or `text_number` while keeping delimiters part of the split array for easier processing
    // This regex looks for:
    // 1. text_number (e.g., H_2O, CO_2) - captures base (H), underscore, number (2), and any trailing characters (O)
    // 2. text^number (e.g., x^2, y^10) - captures base (x), caret, number (2), and any trailing characters
    // It uses capturing groups to make these parts accessible.
    const parts = line.split(/(\S+[_^]\d+[\s.,;:!?)]*|\S+[_^]\d+)/g);

    return parts.map((part, index) => {
      // Try to match subscript: e.g., H_2O, CO_2
      const subMatch = part.match(/^(\S+?)_(\d+)(.*)$/);
      if (subMatch) {
        return (
          <React.Fragment key={`${index}-sub`}>
            {subMatch[1]}
            <sub>{subMatch[2]}</sub>
            {subMatch[3]}
          </React.Fragment>
        );
      }
      // Try to match superscript: e.g., x^2, y^10
      const supMatch = part.match(/^(\S*)\^(\S+)(.*)$/);
      if (supMatch) {
        return (
          <React.Fragment key={`${index}-sup`}>
            {supMatch[1]}
            <sup>{supMatch[2]}</sup>
            {supMatch[3]}
          </React.Fragment>
        );
      }
      return <React.Fragment key={`${index}-text`}>{part}</React.Fragment>;
    });
  };


  const formatExplanationForDisplay = (text: string | undefined | null): JSX.Element[] => {
    if (!text) return [];
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    let listItems: React.ReactNode[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`ul-${elements.length}-${Math.random()}`} className="list-disc pl-5 my-2 space-y-1 text-muted-foreground">
            {listItems.map((itemContent, idx) => <li key={idx}>{itemContent}</li>)}
          </ul>
        );
        listItems = [];
      }
    };

    lines.forEach((line, index) => {
      if (line.trim().startsWith('### ')) {
        flushList();
        elements.push(<h4 key={index} className="text-md font-semibold mt-3 mb-1 text-foreground">{parseInlineFormatting(line.substring(4))}</h4>);
      } else if (line.trim().startsWith('## ')) {
        flushList();
        elements.push(<h3 key={index} className="text-lg font-semibold mt-4 mb-2 text-foreground">{parseInlineFormatting(line.substring(3))}</h3>);
      } else if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        listItems.push(parseInlineFormatting(line.substring(line.indexOf(' ') + 1)));
      } else if (line.trim() === "") {
        // flushList(); // Decide if empty lines should end lists or just be space
      } else {
        flushList();
        elements.push(<p key={index} className="mb-2 last:mb-0 text-muted-foreground">{parseInlineFormatting(line)}</p>);
      }
    });
    flushList();
    return elements;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicName.trim() || topicName.trim().length < 3) {
      toast({ title: "Konu Gerekli", description: "Lütfen en az 3 karakterden oluşan bir YKS konu başlığı girin.", variant: "destructive" });
      return;
    }
    if (teacherPersona === "ozel" && (!customPersonaDescription.trim() || customPersonaDescription.trim().length < 10)) {
      toast({ title: "Özel Kişilik Açıklaması Yetersiz", description: "Lütfen özel hoca kişiliği için en az 10 karakterlik bir açıklama girin.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setExplanationOutput(null);

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
      const input: ExplainTopicInput = {
        topicName,
        explanationLevel,
        teacherPersona,
        customPersonaDescription: teacherPersona === "ozel" ? customPersonaDescription : undefined,
        userPlan: currentProfile.plan,
        customModelIdentifier: userProfile?.isAdmin ? adminSelectedModel : undefined,
      };
      const result = await explainTopic(input);

      if (result && result.explanation) {
        setExplanationOutput(result);
        toast({ title: "Konu Anlatımı Hazır!", description: "Belirttiğiniz konu için detaylı bir anlatım oluşturuldu." });
        if (decrementQuota) {
          await decrementQuota(currentProfile);
        }
        const updatedProfileAgain = await memoizedCheckAndResetQuota();
        if (updatedProfileAgain) {
          setCanProcess((updatedProfileAgain.dailyRemainingQuota ?? 0) > 0);
        }
      } else {
        throw new Error(result?.explanationTitle || "Yapay zeka bir konu anlatımı üretemedi.");
      }
    } catch (error: any) {
      console.error("Konu anlatımı oluşturma hatası:", error);
      toast({
        title: "Anlatım Oluşturma Hatası",
        description: error.message || "Konu anlatımı oluşturulurken beklenmedik bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportToPdf = async () => {
    if (!explanationOutput) return;
    setIsExportingPdf(true);
    toast({ title: "PDF Oluşturuluyor...", description: "Lütfen bekleyin."});

    try {
      const { default: jsPDF } = await import('jspdf');

      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });
      
      doc.setFont('Helvetica', 'normal'); // Using a standard font

      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.width;
      const margin = 15;
      const contentWidth = pageWidth - 2 * margin;
      let currentY = margin + 5; 
      const lineHeight = 6; 
      const titleFontSize = 16;
      const headingFontSize = 12;
      const textFontSize = 10;

      const addWrappedText = (text: string | undefined | null, options: { x?: number, y?: number, fontSize?: number, fontStyle?: "normal" | "bold" | "italic" | "bolditalic", maxWidth?: number, isTitle?: boolean, isListItem?: boolean, color?: string }) => {
        if (!text) return;
        const { x = margin, fontSize = textFontSize, fontStyle = 'normal', maxWidth = contentWidth, isTitle = false, isListItem = false, color = "#000000" } = options;
        let { y = currentY } = options;

        doc.setFontSize(fontSize);
        doc.setFont('Helvetica', fontStyle); // Ensure font is set for each text block
        doc.setTextColor(color);

        const lines = doc.splitTextToSize(text, maxWidth);
        
        lines.forEach((line: string, index: number) => {
          if (y + lineHeight > pageHeight - margin) { 
            doc.addPage();
            y = margin; 
            // Re-apply font settings on new page
            doc.setFontSize(fontSize);
            doc.setFont('Helvetica', fontStyle);
            doc.setTextColor(color);
          }
          const lineText = isListItem && index === 0 ? `• ${line}` : line;
          const xOffset = isTitle ? (pageWidth - doc.getTextWidth(lineText)) / 2 : (isListItem ? margin + 2 : margin); // Adjusted x for list items
          doc.text(lineText, xOffset, y);
          y += lineHeight; 
        });
        currentY = y;
        if (!isListItem) currentY += (lineHeight / 2); 
      };
      
      if (explanationOutput.explanationTitle) {
        addWrappedText(explanationOutput.explanationTitle, { fontSize: titleFontSize, fontStyle: 'bold', isTitle: true, y: currentY });
        currentY += lineHeight; 
      }

      if (explanationOutput.explanation) {
        currentY += lineHeight / 2;
        addWrappedText("Detaylı Konu Anlatımı:", { fontSize: headingFontSize, fontStyle: 'bold', y: currentY });
        addWrappedText(explanationOutput.explanation, { fontSize: textFontSize });
      }

      if (explanationOutput.keyConcepts && explanationOutput.keyConcepts.length > 0) {
        currentY += lineHeight;
        addWrappedText("Anahtar Kavramlar:", { fontSize: headingFontSize, fontStyle: 'bold', y: currentY });
        explanationOutput.keyConcepts.forEach(concept => addWrappedText(concept, { fontSize: textFontSize, isListItem: true }));
      }

      if (explanationOutput.commonMistakes && explanationOutput.commonMistakes.length > 0) {
        currentY += lineHeight;
        addWrappedText("Sık Yapılan Hatalar:", { fontSize: headingFontSize, fontStyle: 'bold', y: currentY });
        explanationOutput.commonMistakes.forEach(mistake => addWrappedText(mistake, { fontSize: textFontSize, isListItem: true }));
      }
      
      if (explanationOutput.yksTips && explanationOutput.yksTips.length > 0) {
        currentY += lineHeight;
        addWrappedText("YKS İpuçları:", { fontSize: headingFontSize, fontStyle: 'bold', y: currentY });
        explanationOutput.yksTips.forEach(tip => addWrappedText(tip, { fontSize: textFontSize, isListItem: true }));
      }

      if (explanationOutput.activeRecallQuestions && explanationOutput.activeRecallQuestions.length > 0) {
        currentY += lineHeight;
        addWrappedText("Aktif Hatırlama Soruları:", { fontSize: headingFontSize, fontStyle: 'bold', y: currentY });
        explanationOutput.activeRecallQuestions.forEach(question => addWrappedText(question, { fontSize: textFontSize, isListItem: true }));
      }
      
      const safeFileName = (explanationOutput.explanationTitle || "konu_anlatimi").replace(/[^a-z0-9_]/gi, '_').toLowerCase();
      doc.save(`${safeFileName}.pdf`);
      toast({ title: "PDF Oluşturuldu!", description: "Konu anlatımı başarıyla PDF olarak indirildi." });

    } catch (error: any) {
      console.error("PDF oluşturma hatası:", error);
      let descriptionMessage = "PDF oluşturulurken bir hata oluştu.";
       if (error.message && error.message.toLowerCase().includes("module not found") && error.message.toLowerCase().includes("jspdf")) {
        descriptionMessage = "PDF oluşturma kütüphanesi ('jspdf') yüklenemedi. Lütfen 'npm install jspdf' komutunu çalıştırıp tekrar deneyin veya geliştiriciye bildirin.";
      } else if (error.message && error.message.toLowerCase().includes("jspdf")) {
        descriptionMessage = "PDF kütüphanesi ('jspdf') yüklenemedi veya bir sorun oluştu. İnternet bağlantınızı kontrol edin veya geliştiriciye bildirin.";
      }
      toast({
        title: "PDF Oluşturma Hatası",
        description: descriptionMessage,
        variant: "destructive",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const isSubmitDisabled = isGenerating || !topicName.trim() || topicName.trim().length < 3 || (teacherPersona === "ozel" && (!customPersonaDescription.trim() || customPersonaDescription.trim().length < 10)) || (!canProcess && !userProfileLoading && (userProfile?.dailyRemainingQuota ?? 0) <= 0);

  if (userProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">AI Konu Anlatımı Oluşturucu yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Presentation className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl">AI YKS Konu Anlatımı Oluşturucu</CardTitle>
          </div>
          <CardDescription>
            Öğrenmek istediğiniz YKS konusunu, anlatım detay seviyesini ve hoca tarzını girin. Yapay zeka sizin için konuyu detaylıca anlatsın, anahtar kavramları, YKS ipuçlarını ve aktif hatırlama sorularını versin.
          </CardDescription>
        </CardHeader>
         <CardContent>
         {userProfile?.isAdmin && (
              <div className="space-y-2 p-4 mb-4 border rounded-md bg-muted/50">
                <Label htmlFor="adminModelSelectTopicExp" className="font-semibold text-primary flex items-center gap-2"><Settings size={16}/> Model Seç (Admin Özel)</Label>
                <Select value={adminSelectedModel} onValueChange={setAdminSelectedModel} disabled={isSubmitDisabled}>
                  <SelectTrigger id="adminModelSelectTopicExp"><SelectValue placeholder="Varsayılan Modeli Kullan" /></SelectTrigger>
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

      {!canProcess && !isGenerating && userProfile && (userProfile.dailyRemainingQuota ?? 0) <= 0 && (
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
            <CardTitle className="text-lg">Anlatılacak Konu ve Ayarlar</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label htmlFor="topicName">YKS Konu Başlığı</Label>
              <Input
                id="topicName"
                placeholder="örn: Matematik - Limit ve Süreklilik"
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                className="text-base mt-1"
                disabled={isGenerating || !canProcess}
              />
              <p className="text-xs text-muted-foreground mt-1">Lütfen açıklanmasını istediğiniz konuyu girin (en az 3 karakter).</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="explanationLevel">Anlatım Seviyesi</Label>
                <Select
                  value={explanationLevel}
                  onValueChange={(value: ExplainTopicInput["explanationLevel"]) => setExplanationLevel(value)}
                  disabled={isGenerating || !canProcess}
                >
                  <SelectTrigger id="explanationLevel" className="mt-1">
                    <SelectValue placeholder="Seviye seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="temel">Temel Seviye</SelectItem>
                    <SelectItem value="orta">Orta Seviye</SelectItem>
                    <SelectItem value="detayli">Detaylı Seviye</SelectItem>
                  </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground mt-1">Konunun ne kadar detaylı anlatılacağını seçin.</p>
              </div>
              <div>
                <Label htmlFor="teacherPersona">Hoca Tarzı</Label>
                <Select
                  value={teacherPersona}
                  onValueChange={(value: ExplainTopicInput["teacherPersona"]) => setTeacherPersona(value)}
                  disabled={isGenerating || !canProcess}
                >
                  <SelectTrigger id="teacherPersona" className="mt-1">
                    <SelectValue placeholder="Hoca tarzı seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="samimi">Samimi ve Destekleyici</SelectItem>
                    <SelectItem value="eglenceli">Eğlenceli ve Motive Edici</SelectItem>
                    <SelectItem value="ciddi">Ciddi ve Odaklı</SelectItem>
                    <SelectItem value="ozel">Kişiliği Sen Tanımla...</SelectItem>
                  </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground mt-1">AI hocanızın anlatım tarzını seçin.</p>
              </div>
            </div>

            {teacherPersona === "ozel" && (
              <div>
                <Label htmlFor="customPersonaDescription">Özel Hoca Kişiliği Tanımı</Label>
                <Textarea
                  id="customPersonaDescription"
                  placeholder="İstediğiniz hoca kişiliğini detaylıca anlatın (örn: 'Sanki karşımda bir arkadaşım gibi, esprili ama konunun ciddiyetini de koruyan, bol örnek veren bir hoca...')"
                  value={customPersonaDescription}
                  onChange={(e) => setCustomPersonaDescription(e.target.value)}
                  rows={3}
                  className="mt-1"
                  disabled={isGenerating || !canProcess}
                />
                <p className="text-xs text-muted-foreground mt-1">AI hocanızın nasıl bir kişiliğe sahip olmasını istediğinizi açıklayın (en az 10 karakter).</p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Konu Anlatımı Oluştur
            </Button>
          </CardContent>
        </Card>
      </form>

      {isGenerating && !explanationOutput && (
        <Card className="mt-6 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium text-foreground">Konu Anlatımı Oluşturuluyor...</p>
              <p className="text-sm text-muted-foreground">
                AI YKS Süper Öğretmeniniz konuyu hazırlıyor... Bu işlem biraz zaman alabilir.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {explanationOutput && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>{explanationOutput.explanationTitle}</CardTitle>
            <Button onClick={handleExportToPdf} variant="outline" size="sm" disabled={isExportingPdf}>
              {isExportingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              PDF Olarak İndir
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <ScrollArea className="h-[600px] w-full rounded-md border p-4 bg-muted/30">
              <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                <h3 className="text-lg font-semibold mt-3 mb-1 text-foreground">Detaylı Konu Anlatımı:</h3>
                {formatExplanationForDisplay(explanationOutput.explanation)}

                {explanationOutput.keyConcepts && explanationOutput.keyConcepts.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold mt-4 mb-1 text-foreground">Anahtar Kavramlar:</h3>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {explanationOutput.keyConcepts.map((concept, index) => (
                        <li key={index}>{parseInlineFormatting(concept)}</li>
                      ))}
                    </ul>
                  </>
                )}
                
                {explanationOutput.commonMistakes && explanationOutput.commonMistakes.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold mt-4 mb-1 text-foreground">Sık Yapılan Hatalar:</h3>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {explanationOutput.commonMistakes.map((mistake, index) => (
                        <li key={index}>{parseInlineFormatting(mistake)}</li>
                      ))}
                    </ul>
                  </>
                )}

                {explanationOutput.yksTips && explanationOutput.yksTips.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold mt-4 mb-1 text-foreground">YKS İpuçları:</h3>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {explanationOutput.yksTips.map((tip, index) => (
                        <li key={index}>{parseInlineFormatting(tip)}</li>
                      ))}
                    </ul>
                  </>
                )}

                {explanationOutput.activeRecallQuestions && explanationOutput.activeRecallQuestions.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold mt-4 mb-1 text-foreground">Hadi Pekiştirelim! (Aktif Hatırlama Soruları):</h3>
                    <ul className="list-decimal pl-5 text-muted-foreground space-y-1">
                      {explanationOutput.activeRecallQuestions.map((question, index) => (
                        <li key={index}>{parseInlineFormatting(question)}</li>
                      ))}
                    </ul>
                     <p className="text-xs italic text-muted-foreground mt-2">(Bu soruların cevaplarını anlatımda bulabilirsin.)</p>
                  </>
                )}
              </div>
            </ScrollArea>
            <div className="mt-4 p-3 text-xs text-destructive-foreground bg-destructive/80 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>NeutralEdu AI bir yapay zekadır bu nedenle hata yapabilir, bu yüzden verdiği bilgileri doğrulayınız.</span>
            </div>
          </CardContent>
        </Card>
      )}
      {!isGenerating && !explanationOutput && !userProfileLoading && (
         <Alert className="mt-6">
          <Presentation className="h-4 w-4" />
          <AlertTitle>Anlatıma Hazır!</AlertTitle>
          <AlertDescription>
            Yukarıya bir YKS konu başlığı, anlatım seviyesi ve hoca tarzı girerek yapay zekanın sizin için detaylı bir konu anlatımı oluşturmasını sağlayın.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
