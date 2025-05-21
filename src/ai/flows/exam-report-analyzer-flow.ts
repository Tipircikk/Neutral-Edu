
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

  const isProUser = input.userPlan === 'pro';
  const isPremiumUser = input.userPlan === 'premium';
  const isCustomModelSelected = !!input.customModelIdentifier;
  
  let modelToUse = '';
  if (input.customModelIdentifier) {
    switch (input.customModelIdentifier) {
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
        console.warn(`[Exam Report Analyzer Flow] Unknown customModelIdentifier: ${input.customModelIdentifier}. Defaulting based on plan.`);
        if (isProUser || isPremiumUser) {
          modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
        } else { 
          modelToUse = 'googleai/gemini-2.0-flash';
        }
        break;
    }
  } else { 
    if (isProUser || isPremiumUser) {
      modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
    } else { 
      modelToUse = 'googleai/gemini-2.0-flash';
    }
  }
  const isGemini25PreviewSelected = modelToUse === 'googleai/gemini-2.5-flash-preview-05-20';

  const enrichedInput = {
    ...input,
    isProUser,
    isPremiumUser,
    isCustomModelSelected,
    isGemini25PreviewSelected,
  };
  return examReportAnalyzerFlow(enrichedInput, modelToUse);
}

const prompt = ai.definePrompt({
  name: 'examReportAnalyzerPrompt',
  input: {schema: ExamReportAnalyzerInputSchema.extend({
    isProUser: z.boolean().optional(),
    isPremiumUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
  })},
  output: {schema: ExamReportAnalyzerOutputSchema},
  prompt: `Sen, YKS sınav raporlarını analiz eden ve öğrencilere özel geri bildirimler sunan bir AI YKS danışmanısın. Amacın, raporu değerlendirip öğrencinin YKS başarısını artırmasına yardımcı olmaktır. Cevapların Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: Analizini en üst düzeyde akademik titizlikle yap. Öğrencinin farkında olmadığı örtük bilgi eksikliklerini tespit etmeye çalış. En kapsamlı stratejik yol haritasını, YKS'de sık yapılan hatalardan kaçınma yollarını, zaman yönetimi ve stresle başa çıkma tekniklerini detaylıca sun.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: Daha detaylı konu analizi yap. Belirlenen zayıflıklar için 1-2 etkili çalışma tekniği (örn: Feynman Tekniği, Pomodoro) ve genel motivasyonunu artıracak pratik ipuçları öner.)
{{else}}
(Ücretsiz Kullanıcı Notu: Analizini temel düzeyde yap. Genel çalışma alışkanlıkları ve düzenli tekrarın önemi gibi 1-2 genel YKS tavsiyesi sun.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' kullanılıyor.)
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
    inputSchema: ExamReportAnalyzerInputSchema.extend({
        isProUser: z.boolean().optional(),
        isPremiumUser: z.boolean().optional(),
        isCustomModelSelected: z.boolean().optional(),
        isGemini25PreviewSelected: z.boolean().optional(),
    }),
    outputSchema: ExamReportAnalyzerOutputSchema,
  },
  async (enrichedInput: z.infer<typeof ExamReportAnalyzerInputSchema> & {isProUser?: boolean; isPremiumUser?: boolean; isCustomModelSelected?: boolean; isGemini25PreviewSelected?: boolean}, modelToUse: string ): Promise<ExamReportAnalyzerOutput> => {
    
    let callOptions: { model: string; config?: Record<string, any> } = { model: modelToUse };

    if (modelToUse === 'googleai/gemini-2.5-flash-preview-05-20') {
      callOptions.config = {}; 
    } else {
       callOptions.config = {
        generationConfig: {
          maxOutputTokens: 4096, 
        }
      };
    }

    console.log(`[Exam Report Analyzer Flow] Using model: ${modelToUse} for plan: ${enrichedInput.userPlan}, customModel: ${enrichedInput.customModelIdentifier}`);

    try {
        const {output} = await prompt(enrichedInput, callOptions);
        if (!output || !output.identifiedTopics || output.identifiedTopics.length === 0) {
        throw new Error("AI Sınav Analisti, bu rapor için detaylı bir analiz ve öneri üretemedi. Lütfen rapor metninin yeterli ve anlaşılır olduğundan emin olun.");
        }
        return output;
    } catch (error: any) {
        console.error(`[Exam Report Analyzer Flow] Error during generation with model ${modelToUse}:`, error);
        let errorMessage = `AI modeli (${modelToUse}) ile sınav raporu analizi yapılırken bir hata oluştu.`;
        if (error.message) {
            errorMessage += ` Detay: ${error.message.substring(0, 200)}`;
             if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
              errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen rapor metnini kontrol edin. Model: ${modelToUse}. Detay: ${error.message.substring(0, 150)}`;
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
    

    

    
