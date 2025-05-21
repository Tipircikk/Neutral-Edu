
'use server';

/**
 * @fileOverview Kullanıcının yüklediği PDF belgelerindeki konuları derinlemesine açıklayan,
 * anahtar fikirleri, ana fikri ve isteğe bağlı olarak sınav ipuçları ile örnek soruları içeren bir AI aracı.
 *
 * - summarizePdfForStudent - PDF içeriğini detaylı açıklama sürecini yöneten fonksiyon.
 * - SummarizePdfForStudentInput - summarizePdfForStudent fonksiyonu için giriş tipi.
 * - SummarizePdfForStudentOutput - summarizePdfForStudent fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { UserProfile } from '@/types';

const SummarizePdfForStudentInputSchema = z.object({
  pdfText: z.string().describe('PDF belgesinden çıkarılan metin içeriği.'),
  summaryLength: z.enum(["short", "medium", "detailed"]).optional().default("medium").describe("İstenen açıklamanın uzunluğu: 'short' (ana hatlar), 'medium' (dengeli ve kapsamlı), 'detailed' (çok derinlemesine ve uzun)."),
  keywords: z.string().optional().describe("Açıklamanın odaklanması istenen, virgülle ayrılmış anahtar kelimeler."),
  pageRange: z.string().optional().describe("Açıklanacak sayfa aralığı, örn: '5-10'. AI, bu bilginin sağlandığı metin parçasına odaklanacaktır."),
  outputDetail: z.enum(["full", "key_points_only", "exam_tips_only", "questions_only"]).optional().default("full").describe("İstenen çıktı detayı: 'full' (tüm bölümler), 'key_points_only' (sadece anahtar noktalar), 'exam_tips_only' (sadece sınav ipuçları), 'questions_only' (sadece örnek sorular)."),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı."),
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi."),
});
export type SummarizePdfForStudentInput = z.infer<typeof SummarizePdfForStudentInputSchema>;

const SummarizePdfForStudentOutputSchema = z.object({
  summary: z.string().describe('Metindeki konunun, öğrencinin anlayışını en üst düzeye çıkaracak şekilde, AI tarafından oluşturulmuş, kapsamlı ve detaylı anlatımı.'),
  keyPoints: z.array(z.string()).describe('Konunun anlaşılması için en önemli noktaların madde işaretleri halinde listesi.'),
  mainIdea: z.string().describe('Parçanın veya konunun ana fikri veya temel tezi.'),
  examTips: z.array(z.string()).optional().describe('Konuyla ilgili, sınavlarda çıkması muhtemel kilit noktalar, tanımlar, formüller veya önemli kavramlar (isteğe bağlı).'),
  practiceQuestions: z.optional(z.array(z.object({
    question: z.string().describe("Konuyu test eden, düşündürücü soru."),
    options: z.array(z.string()).describe("Çoktan seçmeli soru için seçenekler (genellikle 4 veya 5)."),
    answer: z.string().describe("Sorunun doğru cevabı (sadece harf veya seçenek metni)."),
    explanation: z.string().optional().describe("Doğru cevap için kısa ve net bir açıklama.")
  })).describe('İçeriğe dayalı, konuyu pekiştirmek için 3-5 çoktan seçmeli alıştırma sorusu, cevap anahtarı ve açıklamalarıyla birlikte (isteğe bağlı).')),
  formattedStudyOutput: z.string().describe('Tüm istenen bölümleri (Detaylı Açıklama, Anahtar Noktalar, Ana Fikir, Sınav İpuçları, Alıştırma Soruları) net Markdown başlıkları ile içeren, doğrudan çalışma materyali olarak kullanılabilecek birleştirilmiş metin.')
});

export type SummarizePdfForStudentOutput = z.infer<typeof SummarizePdfForStudentOutputSchema>;

export async function summarizePdfForStudent(input: SummarizePdfForStudentInput): Promise<SummarizePdfForStudentOutput> {
  const isProUser = input.userPlan === 'pro';
  const isPremiumUser = input.userPlan === 'premium';
  const isCustomModelSelected = !!input.customModelIdentifier;
  const isGemini25PreviewSelected = input.customModelIdentifier === 'experimental_gemini_2_5_flash_preview_05_20';

  const enrichedInput = {
    ...input,
    isProUser,
    isPremiumUser,
    isCustomModelSelected,
    isGemini25PreviewSelected,
  };
  return summarizePdfForStudentFlow(enrichedInput);
}

const prompt = ai.definePrompt({
  name: 'detailedTopicExplainerFromPdfPrompt',
  input: {schema: SummarizePdfForStudentInputSchema.extend({
    isProUser: z.boolean().optional(),
    isPremiumUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
  })},
  output: {schema: SummarizePdfForStudentOutputSchema},
  prompt: `Sen, sana sunulan akademik metinlerdeki konuları detaylı, kapsamlı ve anlaşılır bir şekilde açıklayan, alanında otorite sahibi bir AI konu uzmanısın. Amacın, metindeki bilgileri öğretmek, temel kavramları ve prensipleri sunmaktır. Cevapların Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: Açıklamanı en üst düzeyde akademik zenginlikle, konunun felsefi temellerine ve karmaşık detaylarına değinerek yap. Çok kapsamlı bir anlatım oluştur.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: Açıklamalarını daha fazla örnekle ve önemli bağlantıları vurgulayarak zenginleştir.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' kullanılıyor.)
  {{#if isGemini25PreviewSelected}}
  (Gemini 2.5 Flash Preview 05-20 Notu: Yanıtların ÖZ ama ANLAŞILIR olsun. HIZLI yanıtla.)
  {{/if}}
{{/if}}

PDF'den çıkarılan metin verildiğinde, {{{summaryLength}}} uzunluk tercihine, {{{outputDetail}}} çıktı detayı isteğine ve varsa {{{keywords}}} veya {{{pageRange}}} bilgilerine göre, öğrenci dostu bir tonda aşağıdaki görevleri yerine getir. Çıktını, belirtilen şemaya harfiyen uyacak şekilde yapılandır.

Özel İstekler:
{{#if keywords}}- Odaklanılacak Anahtar Kelimeler: {{{keywords}}}{{/if}}
{{#if pageRange}}- Odaklanılacak Sayfa Aralığı (Kavramsal): {{{pageRange}}}{{/if}}

İstenen Çıktı Detayı: {{{outputDetail}}}

İstenen Çıktı Bölümleri:
1.  **Detaylı Konu Anlatımı (summary)**: Metindeki konuyu, {{{summaryLength}}} seçeneğine göre detay seviyesini ayarlayarak açıkla. Bu bölüm, çıktının ana gövdesi olmalı.
    *   'short': Konunun ana hatlarını ve temel tanımlarını birkaç paragrafta açıkla.
    *   'medium': Ana argümanları, önemli alt başlıkları, temel ilkeleri ve birkaç açıklayıcı örneği içeren kapsamlı bir anlatım sun.
    *   'detailed': Metnin tüm önemli yönlerini, alt başlıklarını derinlemesine, karmaşık örnekleri, diğer konularla bağlantılarını içerecek şekilde son derece uzun ve kapsamlı bir anlatım oluştur.
    Paragraflar halinde yaz ve Markdown formatlamasını (başlıklar, listeler, vurgular) kullan.
2.  **Anahtar Noktalar (keyPoints)**: Anlatılan konunun en önemli 5-10 maddesini listele. 'outputDetail' farklıysa bu bölümü atla.
3.  **Ana Fikir (mainIdea)**: Konunun veya metnin temel mesajını tek cümleyle ifade et. 'outputDetail' farklıysa bu bölümü atla.
4.  **Sınav İpuçları (examTips) (isteğe bağlı)**: Eğer 'outputDetail' 'full' veya 'exam_tips_only' ise, metinden sınavlarda çıkabilecek 4-6 kilit noktayı belirt.
5.  **Alıştırma Soruları (practiceQuestions) (isteğe bağlı)**: Eğer 'outputDetail' 'questions_only' veya 'full' ise ve içerik uygunsa, 3-5 çoktan seçmeli YKS formatında alıştırma sorusu (seçenekler, doğru cevap, açıklama) oluştur. Uygun değilse bu bölümü atla.
6.  **Formatlanmış Çalışma Çıktısı (formattedStudyOutput)**: Yukarıdaki istenen bölümleri ({{{outputDetail}}} seçeneğine göre) net Markdown başlıkları ile tek bir dizede birleştir. Örn: "## Detaylı Konu Anlatımı", "## Anahtar Noktalar" vb. Eğer 'outputDetail' örneğin 'key_points_only' ise, formattedStudyOutput sadece "## Anahtar Noktalar" başlığını ve içeriğini içermelidir.

Hedefin öğrencinin konuyu derinlemesine anlamasına yardımcı olmak. {{{summaryLength}}} 'detailed' ise cömert ol.

İşlenecek Metin:
{{{pdfText}}}`,
});

const summarizePdfForStudentFlow = ai.defineFlow(
  {
    name: 'summarizePdfForStudentFlow',
    inputSchema: SummarizePdfForStudentInputSchema.extend({
        isProUser: z.boolean().optional(),
        isPremiumUser: z.boolean().optional(),
        isCustomModelSelected: z.boolean().optional(),
        isGemini25PreviewSelected: z.boolean().optional(),
    }),
    outputSchema: SummarizePdfForStudentOutputSchema,
  },
  async (enrichedInput: z.infer<typeof SummarizePdfForStudentInputSchema> & {isProUser?: boolean; isPremiumUser?: boolean; isCustomModelSelected?: boolean; isGemini25PreviewSelected?: boolean} ): Promise<SummarizePdfForStudentOutput> => {
    let modelToUse = ''; 
    let callOptions: { model: string; config?: Record<string, any> } = { model: modelToUse };

    if (enrichedInput.customModelIdentifier) {
      switch (enrichedInput.customModelIdentifier) {
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
          console.warn(`[Summarize PDF Flow] Unknown customModelIdentifier: ${enrichedInput.customModelIdentifier}. Defaulting based on plan.`);
          if (enrichedInput.isProUser || enrichedInput.isPremiumUser) {
            modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
          } else { // Free user
            modelToUse = 'googleai/gemini-2.0-flash';
          }
          break;
      }
    } else { // No customModelIdentifier, use plan-based defaults
      if (enrichedInput.isProUser || enrichedInput.isPremiumUser) {
        modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
      } else { // Free user
        modelToUse = 'googleai/gemini-2.0-flash';
      }
    }

    callOptions.model = modelToUse;

    if (modelToUse === 'googleai/gemini-2.5-flash-preview-05_20') {
       callOptions.config = {}; 
    } else {
      callOptions.config = {
        generationConfig: {
          maxOutputTokens: enrichedInput.summaryLength === 'detailed' ? 8000 : enrichedInput.summaryLength === 'medium' ? 4096 : 2048,
        }
      };
    }

    console.log(`[Summarize PDF Flow] Using model: ${modelToUse} with input:`, { summaryLength: enrichedInput.summaryLength, outputDetail: enrichedInput.outputDetail, keywords: !!enrichedInput.keywords, pageRange: !!enrichedInput.pageRange, userPlan: enrichedInput.userPlan, customModel: enrichedInput.customModelIdentifier });

    try {
      const {output} = await prompt(enrichedInput, callOptions);
      if (!output) {
        throw new Error("AI, PDF içeriği için şemaya uygun bir açıklama üretemedi.");
      }

      const shouldHaveQuestions = enrichedInput.outputDetail === 'full' || enrichedInput.outputDetail === 'questions_only';
      if (shouldHaveQuestions && output.practiceQuestions === undefined) {
          output.practiceQuestions = [];
      }
      if (!shouldHaveQuestions) {
          output.practiceQuestions = undefined;
      }

      const shouldHaveExamTips = enrichedInput.outputDetail === 'full' || enrichedInput.outputDetail === 'exam_tips_only';
      if (shouldHaveExamTips && output.examTips === undefined) {
          output.examTips = [];
      }
      if(!shouldHaveExamTips && output.examTips !== undefined){
         output.examTips = [];
      }


      if (enrichedInput.outputDetail !== 'full' && enrichedInput.outputDetail !== 'key_points_only') {
          output.keyPoints = [];
      }

      if (enrichedInput.outputDetail === 'key_points_only' || enrichedInput.outputDetail === 'exam_tips_only' || enrichedInput.outputDetail === 'questions_only') {
          if(enrichedInput.outputDetail !== 'full' && !output.summary) output.summary = "Sadece istenen bölüm üretildi.";
          if(enrichedInput.outputDetail !== 'full' && !output.mainIdea) output.mainIdea = "Sadece istenen bölüm üretildi.";
      }

      if(!output.summary) output.summary = "Bu içerik için bir anlatım üretilemedi. Lütfen PDF'i kontrol edin veya farklı bir çıktı detayı deneyin.";
      if(!output.mainIdea) output.mainIdea = "Ana fikir belirlenemedi.";
      if(!output.keyPoints) output.keyPoints = ["Anahtar noktalar belirlenemedi."];
      if(!output.formattedStudyOutput) output.formattedStudyOutput = `## Hata\n\nİstenen detayda bir çıktı oluşturulamadı. Lütfen PDF içeriğinizi ve seçtiğiniz ayarları kontrol edin.`;


      return output;
    } catch (error: any) {
        console.error(`[Summarize PDF Flow] Error during generation with model ${modelToUse}:`, error);
        let errorMessage = `AI modeli (${modelToUse}) ile PDF özeti oluşturulurken bir hata oluştu.`;
        if (error.message) {
            errorMessage += ` Detay: ${error.message.substring(0, 200)}`;
             if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
              errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen PDF içeriğini kontrol edin. Model: ${modelToUse}. Detay: ${error.message.substring(0, 150)}`;
            }
        }
        return {
            summary: errorMessage,
            keyPoints: ["Hata oluştu."],
            mainIdea: "İçerik işlenirken bir sorunla karşılaşıldı.",
            examTips: [],
            practiceQuestions: [],
            formattedStudyOutput: `## Hata\n\n${errorMessage}`
        };
    }
  }
);
    

    
