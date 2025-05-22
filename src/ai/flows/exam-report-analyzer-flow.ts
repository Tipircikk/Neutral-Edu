
'use server';
/**
 * @fileOverview Öğrencilerin YKS sınav raporlarını analiz eden, zayıf oldukları konuları belirleyen
 * ve kişiselleştirilmiş çalışma önerileri sunan bir AI aracı.
 *
 * - analyzeExamReport - Sınav raporu analiz işlemini yöneten fonksiyon.
 * - ExamReportAnalyzerInput - analyzeExamReport fonksiyonu için giriş tipi.
 * - ExamReportAnalyzerOutput - analyzeExamReport fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { UserProfile } from '@/types';

const ExamReportAnalyzerInputSchema = z.object({
  reportTextContent: z.string().min(100).describe('Analiz edilecek sınav raporundan çıkarılmış en az 100 karakterlik metin içeriği. Bu metin dersleri, konuları, doğru/yanlış/boş sayılarını veya puanları içermelidir.'),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı."),
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi."),
});
export type ExamReportAnalyzerInput = z.infer<typeof ExamReportAnalyzerInputSchema>;

const IdentifiedTopicSchema = z.object({
    topic: z.string().describe("Rapordan tespit edilen ders, ünite veya konu başlığı."),
    analysis: z.string().describe("Bu konudaki performansın (doğru, yanlış, boş, puan vb. bilgilere dayanarak) YKS odaklı analizi, potansiyel zayıflıklar ve bu zayıflıkları gidermek için spesifik öneriler."),
    status: z.enum(["strong", "needs_improvement", "weak"]).describe("Belirlenen konudaki genel performans durumu.")
});

const ExamReportAnalyzerOutputSchema = z.object({
  identifiedTopics: z.array(IdentifiedTopicSchema).describe('Sınav raporundan tespit edilen konular ve her biri için detaylı analiz ve öneriler.'),
  overallFeedback: z.string().describe('Sınavın geneli hakkında YKS öğrencisine yönelik yapıcı, motive edici ve kapsamlı bir geri bildirim. Genel başarı durumu, dikkat çeken noktalar ve genel strateji önerileri içerebilir.'),
  studySuggestions: z.array(z.string()).describe('Belirlenen eksikliklere ve genel performansa dayalı olarak YKS için öncelikli çalışma alanları ve genel çalışma stratejileri.'),
  reportSummaryTitle: z.string().optional().describe("Analiz edilen sınav raporu için kısa bir başlık (örn: 'AYT Matematik Deneme Analizi').")
});
export type ExamReportAnalyzerOutput = z.infer<typeof ExamReportAnalyzerOutputSchema>;

export async function analyzeExamReport(input: ExamReportAnalyzerInput): Promise<ExamReportAnalyzerOutput> {
  console.log(`[Exam Report Analyzer Action] Received input. User Plan: ${input.userPlan}, Admin Model ID (raw): '${input.customModelIdentifier}'`);

  let modelToUse: string;

  if (input.customModelIdentifier && typeof input.customModelIdentifier === 'string' && input.customModelIdentifier.trim() !== "") {
    const customIdLower = input.customModelIdentifier.toLowerCase().trim();
    console.log(`[Exam Report Analyzer Action] Admin specified customModelIdentifier: '${customIdLower}'`);
    switch (customIdLower) {
      case 'default_gemini_flash':
        modelToUse = 'googleai/gemini-2.0-flash';
        break;
      case 'experimental_gemini_1_5_flash':
        modelToUse = 'googleai/gemini-1.5-flash-latest';
        break;
      case 'experimental_gemini_2_5_flash_preview_05_20':
        modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
        break;
      default:
        if (customIdLower.startsWith('googleai/')) {
            modelToUse = customIdLower;
            console.warn(`[Exam Report Analyzer Action] Admin specified a direct Genkit model name: '${modelToUse}'. Ensure this model is supported.`);
        } else {
            console.warn(`[Exam Report Analyzer Action] Admin specified an UNKNOWN customModelIdentifier: '${input.customModelIdentifier}'. Falling back to universal default.`);
            modelToUse = 'googleai/gemini-2.5-flash-preview-05-20'; // Universal default
        }
        break;
    }
  } else {
    console.log(`[Exam Report Analyzer Action] No custom model specified by admin. Using universal default.`);
    modelToUse = 'googleai/gemini-2.5-flash-preview-05-20'; // Universal default
  }
  
  // Absolute fallback if modelToUse is somehow still invalid
  if (typeof modelToUse !== 'string' || !modelToUse.startsWith('googleai/')) { 
      console.error(`[Exam Report Analyzer Action] CRITICAL FALLBACK: modelToUse was invalid ('${modelToUse}', type: ${typeof modelToUse}). Defaulting to gemini-2.5-flash-preview-05-20.`);
      modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
  }
  console.log(`[Exam Report Analyzer Action] Final model determined for flow: ${modelToUse}`);
  
  const isProUser = input.userPlan === 'pro';
  const isPremiumUser = input.userPlan === 'premium';
  const isGemini25PreviewSelected = modelToUse === 'googleai/gemini-2.5-flash-preview-05-20';

  const enrichedInput = {
    ...input,
    isProUser,
    isPremiumUser,
    isCustomModelSelected: !!input.customModelIdentifier,
    isGemini25PreviewSelected,
  };
  return examReportAnalyzerFlow(enrichedInput, modelToUse);
}

const promptInputSchema = ExamReportAnalyzerInputSchema.extend({
    isProUser: z.boolean().optional(),
    isPremiumUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
});

const prompt = ai.definePrompt({
  name: 'examReportAnalyzerPrompt',
  input: {schema: promptInputSchema},
  output: {schema: ExamReportAnalyzerOutputSchema},
  prompt: `Sen, YKS sınav raporlarını analiz eden ve öğrencilere özel geri bildirimler sunan bir AI YKS danışmanısın. Amacın, raporu değerlendirip öğrencinin YKS başarısını artırmasına yardımcı olmaktır. Cevapların Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: Bu Pro seviyesindeki detaylı analiz ve stratejik öneriler, üyeliğinizin özel bir avantajıdır. Analizini en üst düzeyde akademik titizlikle yap. Öğrencinin farkında olmadığı örtük bilgi eksikliklerini tespit etmeye çalış. En kapsamlı stratejik yol haritasını, YKS'de sık yapılan hatalardan kaçınma yollarını, zaman yönetimi ve stresle başa çıkma tekniklerini detaylıca sun.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: Daha detaylı konu analizi yap. Belirlenen zayıflıklar için 1-2 etkili çalışma tekniği (örn: Feynman Tekniği, Pomodoro) ve genel motivasyonunu artıracak pratik ipuçları öner.)
{{else}}
(Ücretsiz Kullanıcı Notu: Analizini temel düzeyde yap. Genel çalışma alışkanlıkları ve düzenli tekrarın önemi gibi 1-2 genel YKS tavsiyesi sun.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' seçildi.)
{{/if}}

{{#if isGemini25PreviewSelected}}
(Gemini 2.5 Flash Preview 05-20 Modeli Notu: Yanıtların ÖZ ama ANLAŞILIR ve YKS öğrencisine doğrudan fayda sağlayacak şekilde olsun. HIZLI yanıt vermeye odaklan. {{#if isProUser}}Pro kullanıcı için gereken derinliği ve stratejik bilgileri koruyarak{{else if isPremiumUser}}Premium kullanıcı için gereken detayları ve pratik ipuçlarını sağlayarak{{/if}} gereksiz uzun açıklamalardan ve süslemelerden kaçın, doğrudan konuya girerek en kritik bilgileri vurgula.)
{{/if}}

Öğrencinin Sınav Raporu Metni:
{{{reportTextContent}}}

Lütfen bu raporu analiz et ve aşağıdaki formatta çıktı oluştur:

1.  **Tespit Edilen Konular (identifiedTopics)**: Her ders/konu için:
    *   **Konu (topic)**: Ders/ünite/konu adı.
    *   **Analiz (analysis)**: Performansın YKS odaklı analizi, zayıflıklar ve spesifik öneriler.
    *   **Durum (status)**: 'strong', 'needs_improvement', 'weak'.
2.  **Genel Geri Bildirim (overallFeedback)**: Sınavın geneli hakkında yapıcı, motive edici geri bildirim.
3.  **Çalışma Önerileri (studySuggestions)**: En kritik 3-5 eksiklik alanına yönelik YKS için öncelikli çalışma stratejileri.
4.  **Rapor Özet Başlığı (reportSummaryTitle) (isteğe bağlı)**: Rapor için kısa başlık.

Analiz İlkeleri:
*   Sayısal verileri (D, Y, B, net, puan) dikkatlice yorumla.
*   En çok zorlanılan veya puan kaybedilen konuları önceliklendir.
*   Geri bildirimler YKS formatına uygun olsun.
*   Motive edici bir dil kullan.
*   Rapor metni yetersizse, nazikçe daha detaylı metin iste.
`,
});

const examReportAnalyzerFlow = ai.defineFlow(
  {
    name: 'examReportAnalyzerFlow',
    inputSchema: promptInputSchema,
    outputSchema: ExamReportAnalyzerOutputSchema,
  },
  async (enrichedInput: z.infer<typeof promptInputSchema>, modelToUseParam: string ): Promise<ExamReportAnalyzerOutput> => {
    
    let finalModelToUse = modelToUseParam;
    console.log(`[Exam Report Analyzer Flow] Initial modelToUseParam: '${finalModelToUse}', type: ${typeof finalModelToUse}`);

    if (typeof finalModelToUse !== 'string' || !finalModelToUse.startsWith('googleai/')) {
        console.warn(`[Exam Report Analyzer Flow] Invalid or non-string modelToUseParam ('${finalModelToUse}', type: ${typeof finalModelToUse}) received in flow. Defaulting to universal default.`);
        finalModelToUse = 'googleai/gemini-2.5-flash-preview-05-20'; // Universal default
        console.log(`[Exam Report Analyzer Flow] Corrected/Defaulted model INSIDE FLOW to: ${finalModelToUse}`);
    }
    
    const standardTemperature = 0.6;
    const standardSafetySettings = [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ];
    const standardMaxOutputTokens = (enrichedInput.isProUser || enrichedInput.isPremiumUser) ? 8000 : 4096;

    const callOptions: { model: string; config?: Record<string, any> } = { 
      model: finalModelToUse,
      config: {
        temperature: standardTemperature,
        safetySettings: standardSafetySettings,
        maxOutputTokens: standardMaxOutputTokens, 
      }
    };
    
    const promptInputForLog = { ...enrichedInput, resolvedModelUsed: finalModelToUse };
    console.log(`[Exam Report Analyzer Flow] Using Genkit model: ${finalModelToUse} for plan: ${enrichedInput.userPlan}, customModel (raw): ${enrichedInput.customModelIdentifier}, with config: ${JSON.stringify(callOptions.config)}`);

    try {
        const {output} = await prompt(promptInputForLog, callOptions);
        if (!output || !output.identifiedTopics || output.identifiedTopics.length === 0) {
        console.error(`[Exam Report Analyzer Flow] AI did not produce valid analysis. Model: ${finalModelToUse}. Input text length: ${enrichedInput.reportTextContent.length}. Output:`, JSON.stringify(output).substring(0,300));
        throw new Error(`AI Sınav Analisti (${finalModelToUse}), bu rapor için detaylı bir analiz ve öneri üretemedi. Lütfen rapor metninin yeterli ve anlaşılır olduğundan emin olun.`);
        }
        return output;
    } catch (error: any) {
      console.error(`[Exam Report Analyzer Flow] Error during generation with model ${finalModelToUse}. Error details:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      let errorMessage = `AI modeli (${finalModelToUse}) ile sınav raporu analizi yapılırken bir hata oluştu.`;
      if (error.message) {
          errorMessage += ` Detay: ${error.message.substring(0, 300)}`;
           if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
            errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen rapor metnini kontrol edin. Model: ${finalModelToUse}. Detay: ${error.message.substring(0, 150)}`;
          } else if (error.name === 'GenkitError' && error.message.includes('Schema validation failed')) {
            errorMessage = `AI modeli (${finalModelToUse}) beklenen yanıta uymayan bir çıktı üretti (Schema validation failed). Detay: ${error.message.substring(0,350)}`;
          }
      }

      return {
          identifiedTopics: [],
          overallFeedback: errorMessage,
          studySuggestions: ["Lütfen rapor metnini kontrol edin veya daha sonra tekrar deneyin."],
          reportSummaryTitle: "Analiz Hatası"
      };
    }
  }
);
    