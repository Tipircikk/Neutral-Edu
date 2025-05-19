
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
  // Boolean flag'leri input'tan türet
  const isProUser = input.userPlan === 'pro';
  const isCustomModelSelected = !!input.customModelIdentifier;
  const isGemini25PreviewSelected = input.customModelIdentifier === 'experimental_gemini_2_5_flash_preview';

  const enrichedInput = {
    ...input,
    isProUser, // Prompt içinde kullanılabilir
    isCustomModelSelected, // Prompt içinde kullanılabilir
    isGemini25PreviewSelected, // Prompt içinde kullanılabilir
  };
  return examReportAnalyzerFlow(enrichedInput);
}

const prompt = ai.definePrompt({
  name: 'examReportAnalyzerPrompt',
  input: {schema: ExamReportAnalyzerInputSchema.extend({
    isProUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
  })},
  output: {schema: ExamReportAnalyzerOutputSchema},
  prompt: `Sen, Yükseköğretim Kurumları Sınavı (YKS) hazırlık sürecindeki öğrencilerin deneme sınavı veya gerçek sınav sonuç raporlarını son derece detaylı bir şekilde analiz eden, öğrencinin güçlü ve zayıf yönlerini nokta atışı tespit eden, her bir ders/konu bazında kişiye özel geri bildirimler ve hedefe yönelik çalışma stratejileri sunan uzman bir AI YKS danışmanısın.
Amacın, öğrencinin sınav raporundaki verileri (ders adları, konu başlıkları, doğru/yanlış/boş sayıları, puanlar, sıralamalar vb.) kullanarak akademik performansını kapsamlı bir şekilde değerlendirmek ve net, uygulanabilir ve motive edici önerilerle YKS başarısını artırmasına yardımcı olmaktır. Cevapların her zaman Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: Analizini en üst düzeyde akademik titizlikle, konular arası bağlantıları da dikkate alarak yap. Öğrencinin farkında olmadığı örtük bilgi eksikliklerini veya yanlış öğrenmeleri tespit etmeye çalış. En kapsamlı ve derinlemesine stratejik yol haritasını sun. En gelişmiş AI yeteneklerini kullan.)
{{else ifEquals userPlan "premium"}}
(Premium Kullanıcı Notu: Daha detaylı konu analizi, alternatif çalışma yöntemleri ve öğrencinin gelişimini hızlandıracak ek kaynak önerileri sunmaya özen göster.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Bu çözüm, özel olarak seçilmiş '{{{customModelIdentifier}}}' modeli kullanılarak üretilmektedir.)
{{/if}}

Öğrencinin Sınav Raporu Metni:
{{{reportTextContent}}}

Lütfen bu sınav raporu metnini analiz et ve aşağıdaki formatta bir çıktı oluştur:

1.  **Tespit Edilen Konular (identifiedTopics)**: Metinden belirleyebildiğin her ders/konu için:
    *   **Konu (topic)**: Dersin, ünitenin veya konunun adı (örn: "Matematik - Türev", "Türk Dili ve Edebiyatı - Cumhuriyet Dönemi Romanı").
    *   **Analiz (analysis)**: Bu konudaki performansı (rapordaki D/Y/B sayıları, puanlar gibi verilere dayanarak) YKS bağlamında değerlendir. Öğrencinin bu konudaki güçlü yanlarını, özellikle zayıf olduğu noktaları ve nedenlerini (kavram yanılgısı, bilgi eksikliği, dikkat hatası vb. olası nedenler) belirt. Bu konudaki eksiklikleri gidermek için YKS'ye yönelik spesifik çalışma yöntemleri, kaynak önerileri veya soru çözüm teknikleri sun.
    *   **Durum (status)**: 'strong' (bu konuda iyi), 'needs_improvement' (geliştirilmesi gerekiyor), 'weak' (bu konuda zayıf) seçeneklerinden birini belirle.
2.  **Genel Geri Bildirim (overallFeedback)**: Sınavın geneline yayılmış ortak hatalar, başarılı olunan alanlar, genel net/puan durumu (eğer raporda varsa ve yorumlanabiliyorsa) ve öğrencinin genel YKS hazırlık stratejisine yönelik yapıcı eleştiriler ve motive edici bir genel değerlendirme sun.
3.  **Çalışma Önerileri (studySuggestions)**: Analiz sonucunda ortaya çıkan en kritik 3-5 eksiklik alanını belirle ve bu alanlara yönelik YKS için öncelikli, somut ve uygulanabilir genel çalışma stratejileri veya ipuçları listele.
4.  **Rapor Özet Başlığı (reportSummaryTitle) (isteğe bağlı)**: Analiz edilen rapor için kısa ve açıklayıcı bir başlık.

Analiz İlkeleri:
*   Metindeki sayısal verileri (D, Y, B, net, puan) dikkatlice yorumla. Eğer konu bazında netler veya başarı yüzdeleri varsa bunları analize dahil et.
*   Öğrencinin en çok zorlandığı veya en çok puan kaybettiği konuları önceliklendir.
*   Geri bildirimlerin ve önerilerin YKS formatına, soru tiplerine ve müfredatına uygun olsun.
*   Öğrencinin moralini bozacak değil, onu motive edecek ve yol gösterecek bir dil kullan.
*   Eğer rapor metni çok yetersizse veya anlamlı bir analiz çıkarılamıyorsa, nazikçe daha detaylı bir rapor metni iste.
`,
});

const examReportAnalyzerFlow = ai.defineFlow(
  {
    name: 'examReportAnalyzerFlow',
    inputSchema: ExamReportAnalyzerInputSchema.extend({ // Enriched input for prompt
        isProUser: z.boolean().optional(),
        isCustomModelSelected: z.boolean().optional(),
        isGemini25PreviewSelected: z.boolean().optional(),
    }),
    outputSchema: ExamReportAnalyzerOutputSchema,
  },
  async (enrichedInput: ExamReportAnalyzerInput & {isProUser?: boolean; isCustomModelSelected?: boolean; isGemini25PreviewSelected?: boolean} ): Promise<ExamReportAnalyzerOutput> => {
    let modelToUse = 'googleai/gemini-1.5-flash-latest'; 
    let callOptions: { model: string; config?: Record<string, any> } = { model: modelToUse };
    
    if (enrichedInput.customModelIdentifier) {
      switch (enrichedInput.customModelIdentifier) {
        case 'default_gemini_flash':
          modelToUse = 'googleai/gemini-2.0-flash';
          break;
        case 'experimental_gemini_1_5_flash':
          modelToUse = 'googleai/gemini-1.5-flash-latest';
          break;
        case 'experimental_gemini_2_5_flash_preview':
          modelToUse = 'googleai/gemini-2.5-flash-preview-04-17';
          break;
        default:
          console.warn(`[Exam Report Analyzer Flow] Unknown customModelIdentifier: ${enrichedInput.customModelIdentifier}. Defaulting to ${modelToUse}`);
      }
    } else if (enrichedInput.isProUser) { // Fallback to a better model for Pro if no custom admin model
      modelToUse = 'googleai/gemini-1.5-flash-latest';
    }
    // For free/premium users without admin override, default is gemini-1.5-flash-latest (set initially)
    
    callOptions.model = modelToUse;

    if (modelToUse !== 'googleai/gemini-2.5-flash-preview-04-17') {
      callOptions.config = {
        generationConfig: {
          maxOutputTokens: 4096, 
        }
      };
    } else {
       callOptions.config = {}; // No generationConfig for preview model
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
        // Return a valid ExamReportAnalyzerOutput object even in case of error
        return {
            identifiedTopics: [],
            overallFeedback: errorMessage,
            studySuggestions: ["Lütfen rapor metnini kontrol edin veya daha sonra tekrar deneyin."],
            reportSummaryTitle: "Analiz Hatası"
        };
    }
  }
);
    
