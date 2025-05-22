
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
  console.log(`[Summarize PDF Action] Received input. Plan: ${input.userPlan}, Admin Model ID: '${input.customModelIdentifier}'`);
  
  const isProUser = input.userPlan === 'pro';
  const isPremiumUser = input.userPlan === 'premium';
  
  let modelToUse: string;

  if (input.customModelIdentifier && typeof input.customModelIdentifier === 'string' && input.customModelIdentifier.trim() !== "") {
    const customIdLower = input.customModelIdentifier.toLowerCase();
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
        if (input.customModelIdentifier.startsWith('googleai/')) {
            modelToUse = input.customModelIdentifier;
            console.warn(`[Summarize PDF Action] Admin specified a direct Genkit model name: '${modelToUse}'. Ensure this model is supported.`);
        } else {
            console.warn(`[Summarize PDF Action] Admin specified an UNKNOWN customModelIdentifier: '${input.customModelIdentifier}'. Falling back to plan-based default for plan '${input.userPlan}'.`);
            if (isProUser || isPremiumUser) {
                modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
            } else { 
                modelToUse = 'googleai/gemini-2.0-flash';
            }
        }
        break;
    }
  } else { 
    console.log(`[Summarize PDF Action] No custom model specified by admin, or identifier was invalid. Using plan-based default for plan '${input.userPlan}'.`);
    if (isProUser || isPremiumUser) {
      modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
    } else { 
      modelToUse = 'googleai/gemini-2.0-flash';
    }
  }
  
  // Absolute fallback
  if (typeof modelToUse !== 'string' || !modelToUse.startsWith('googleai/')) { 
      console.error(`[Summarize PDF Action] CRITICAL FALLBACK: modelToUse was invalid ('${modelToUse}', type: ${typeof modelToUse}). Defaulting to gemini-2.0-flash.`);
      modelToUse = 'googleai/gemini-2.0-flash';
  }
  console.log(`[Summarize PDF Action] Final model determined for flow: ${modelToUse}`);
  
  const isGemini25PreviewSelected = modelToUse === 'googleai/gemini-2.5-flash-preview-05-20';

  const enrichedInput = {
    ...input,
    isProUser,
    isPremiumUser,
    isCustomModelSelected: !!input.customModelIdentifier,
    isGemini25PreviewSelected,
  };
  return summarizePdfForStudentFlow(enrichedInput, modelToUse);
}

const promptInputSchema = SummarizePdfForStudentInputSchema.extend({
    isProUser: z.boolean().optional(),
    isPremiumUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
});

const prompt = ai.definePrompt({
  name: 'detailedTopicExplainerFromPdfPrompt',
  input: {schema: promptInputSchema},
  output: {schema: SummarizePdfForStudentOutputSchema},
  prompt: `Sen, sana sunulan akademik metinlerdeki konuları detaylı, kapsamlı ve anlaşılır bir şekilde açıklayan, alanında otorite sahibi bir AI konu uzmanısın. Amacın, metindeki bilgileri öğretmek, temel kavramları ve prensipleri sunmaktır. Cevapların Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: Bu Pro seviyesindeki kapsamlı konu anlatımı ve analizler, üyeliğinizin özel bir avantajıdır. Bu konu anlatımını en üst düzeyde akademik zenginlikle, konunun felsefi temellerine ve karmaşık detaylarına değinerek yap. Metindeki örtük bağlantıları ve çıkarımları vurgula. Sınav ipuçları ve örnek sorular bölümünde YKS'de çıkabilecek zorlayıcı ve birden fazla kazanımı ölçen sorulara odaklan. Çok kapsamlı bir anlatım oluştur.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: Açıklamalarını daha fazla örnekle ve önemli bağlantıları vurgulayarak zenginleştir. Sınav ipuçları bölümünde konunun YKS'deki önemli noktalarını, örnek sorular bölümünde ise orta düzeyde, konuyu pekiştirici sorular sun.)
{{else}}
(Ücretsiz Kullanıcı Notu: Konunun ana hatlarını ve temel tanımlarını içeren, anlaşılır bir açıklama yap. Sınav ipuçları ve örnek sorular bölümünde temel düzeyde, hatırlamaya yönelik içerikler sun.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' seçildi.)
{{/if}}

{{#if isGemini25PreviewSelected}}
(Gemini 2.5 Flash Preview 05-20 Modeli Notu: Yanıtların ÖZ ama ANLAŞILIR ve YKS öğrencisine doğrudan fayda sağlayacak şekilde olsun. HIZLI yanıt vermeye odaklan. {{#if isProUser}}Pro kullanıcı için gereken derinliği ve stratejik bilgileri koruyarak{{else if isPremiumUser}}Premium kullanıcı için gereken detayları ve pratik ipuçlarını sağlayarak{{/if}} gereksiz uzun açıklamalardan ve süslemelerden kaçın, doğrudan konuya girerek en kritik bilgileri vurgula.)
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
    inputSchema: promptInputSchema,
    outputSchema: SummarizePdfForStudentOutputSchema,
  },
  async (enrichedInput: z.infer<typeof promptInputSchema>, modelToUseParam: string ): Promise<SummarizePdfForStudentOutput> => {
    
    let finalModelToUse = modelToUseParam;
    console.log(`[Summarize PDF Flow] Initial modelToUseParam: '${finalModelToUse}', type: ${typeof finalModelToUse}`);

    if (typeof finalModelToUse !== 'string' || !finalModelToUse.startsWith('googleai/')) {
        console.warn(`[Summarize PDF Flow] Invalid or non-string modelToUseParam ('${finalModelToUse}', type: ${typeof finalModelToUse}) received in flow. Defaulting based on plan from enrichedInput.`);
        if (enrichedInput.isProUser || enrichedInput.isPremiumUser) {
            finalModelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
        } else {
            finalModelToUse = 'googleai/gemini-2.0-flash';
        }
        console.log(`[Summarize PDF Flow] Corrected/Defaulted model INSIDE FLOW to: ${finalModelToUse}`);
    }
    
    const standardTemperature = 0.6;
    const standardSafetySettings = [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ];
    
    let maxTokensForOutput = 2048; // Default for medium
    if (enrichedInput.summaryLength === 'detailed') maxTokensForOutput = 8192;
    else if (enrichedInput.summaryLength === 'short') maxTokensForOutput = 1024;
    if (enrichedInput.isProUser && enrichedInput.summaryLength === 'detailed') maxTokensForOutput = 8192; // Max for Pro detailed

    const callOptions: { model: string; config?: Record<string, any> } = { 
      model: finalModelToUse,
      config: {
        temperature: standardTemperature,
        safetySettings: standardSafetySettings,
        generationConfig: {
          maxOutputTokens: maxTokensForOutput,
        }
      }
    };
    
    const promptInputForLog = { ...enrichedInput, resolvedModelUsed: finalModelToUse };
    console.log(`[Summarize PDF Flow] Using Genkit model: ${finalModelToUse} for plan: ${enrichedInput.userPlan}, customModel (raw): ${enrichedInput.customModelIdentifier}, with config: ${JSON.stringify(callOptions.config)}`);

    try {
      const {output} = await prompt(promptInputForLog, callOptions);
      if (!output) {
        throw new Error(`AI (${finalModelToUse}), PDF içeriği için şemaya uygun bir açıklama üretemedi.`);
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

      if(!output.summary) output.summary = `Bu içerik için bir anlatım üretilemedi (${finalModelToUse}). Lütfen PDF'i kontrol edin veya farklı bir çıktı detayı deneyin.`;
      if(!output.mainIdea) output.mainIdea = "Ana fikir belirlenemedi.";
      if(!output.keyPoints) output.keyPoints = ["Anahtar noktalar belirlenemedi."];
      if(!output.formattedStudyOutput) output.formattedStudyOutput = `## Hata\n\nİstenen detayda bir çıktı oluşturulamadı (${finalModelToUse}). Lütfen PDF içeriğinizi ve seçtiğiniz ayarları kontrol edin.`;


      return output;
    } catch (error: any) {
        console.error(`[Summarize PDF Flow] Error during generation with model ${finalModelToUse}:`, error);
        let errorMessage = `AI modeli (${finalModelToUse}) ile PDF özeti oluşturulurken bir hata oluştu.`;
        if (error.message) {
            errorMessage += ` Detay: ${error.message.substring(0, 200)}`;
             if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
              errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen PDF içeriğini kontrol edin. Model: ${finalModelToUse}. Detay: ${error.message.substring(0, 150)}`;
            } else if (error.name === 'GenkitError' && error.message.includes('Schema validation failed')) {
              errorMessage = `AI modeli (${finalModelToUse}) beklenen yanıta uymayan bir çıktı üretti. Detay: ${error.message.substring(0,250)}`;
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
