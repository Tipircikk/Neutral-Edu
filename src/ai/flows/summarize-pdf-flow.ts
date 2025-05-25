
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
  pdfText: z.string().min(50).describe('PDF belgesinden çıkarılan, en az 50 karakter içeren metin içeriği.'),
  summaryLength: z.enum(["short", "medium", "detailed"]).optional().default("medium").describe("İstenen açıklamanın uzunluğu: 'short' (ana hatlar), 'medium' (dengeli ve kapsamlı), 'detailed' (çok derinlemesine ve uzun)."),
  keywords: z.string().optional().describe("Açıklamanın odaklanması istenen, virgülle ayrılmış anahtar kelimeler."),
  pageRange: z.string().optional().describe("Açıklanacak sayfa aralığı, örn: '5-10'. AI, bu bilginin sağlandığı metin parçasına odaklanacaktır."),
  outputDetail: z.enum(["full", "key_points_only", "exam_tips_only", "questions_only"]).optional().default("full").describe("İstenen çıktı detayı: 'full' (tüm bölümler), 'key_points_only' (sadece anahtar noktalar), 'exam_tips_only' (sadece sınav ipuçları), 'questions_only' (sadece örnek sorular)."),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı."),
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi."),
  isAdmin: z.boolean().optional().describe("Kullanıcının admin olup olmadığını belirtir."),
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

const GENERIC_USER_ERROR_MESSAGE_PDF = "PDF Anlatıcısı şu anda bir sorun yaşıyor. Lütfen biraz sonra tekrar deneyin veya farklı bir dosya yüklemeyi deneyin.";

const DEFAULT_ERROR_OUTPUT_PDF: SummarizePdfForStudentOutput = {
  summary: GENERIC_USER_ERROR_MESSAGE_PDF,
  keyPoints: ["Hata oluştu."],
  mainIdea: "İçerik işlenirken bir sorunla karşılaşıldı.",
  examTips: [],
  practiceQuestions: [],
  formattedStudyOutput: `## Hata\n\n${GENERIC_USER_ERROR_MESSAGE_PDF}`
};


export async function summarizePdfForStudent(input: SummarizePdfForStudentInput): Promise<SummarizePdfForStudentOutput> {
  console.log(`[Summarize PDF Action] Entry. User input isAdmin: ${input.isAdmin}, User Plan: ${input.userPlan}, Custom Model (raw): '${input.customModelIdentifier}', PDF text length: ${input.pdfText?.length}`);

  let modelToUse: string;
  const adminModelChoice = input.customModelIdentifier;

  if (typeof adminModelChoice === 'string' && adminModelChoice.trim() !== "") {
    const customIdLower = adminModelChoice.toLowerCase().trim();
    console.log(`[Summarize PDF Action] Admin specified customModelIdentifier (processed): '${customIdLower}' from input: '${adminModelChoice}'`);
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
            console.warn(`[Summarize PDF Action] Admin specified a direct Genkit model name: '${modelToUse}'. Ensure this model is supported.`);
        } else {
            console.warn(`[Summarize PDF Action] Admin specified an UNKNOWN customModelIdentifier: '${adminModelChoice}'. Falling back to universal default.`);
            modelToUse = 'googleai/gemini-2.5-flash-preview-05-20'; // Universal default
        }
        break;
    }
  } else {
    console.log(`[Summarize PDF Action] No valid custom model specified. Using universal default 'googleai/gemini-2.5-flash-preview-05-20' for all users.`);
    modelToUse = 'googleai/gemini-2.5-flash-preview-05-20'; // Universal default for all users
  }

  if (typeof modelToUse !== 'string' || !modelToUse.startsWith('googleai/')) {
      console.error(`[Summarize PDF Action] CRITICAL FALLBACK: modelToUse was invalid ('${modelToUse}', type: ${typeof modelToUse}). Defaulting to 'googleai/gemini-2.5-flash-preview-05-20'.`);
      modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
  }
  console.log(`[Summarize PDF Action] Final model determined for flow: ${modelToUse}`);

  const enrichedInput = {
    ...input,
    isProUser: input.userPlan === 'pro',
    isPremiumUser: input.userPlan === 'premium',
    isCustomModelSelected: !!input.customModelIdentifier,
    isGemini25PreviewSelected: modelToUse === 'googleai/gemini-2.5-flash-preview-05-20',
    isAdmin: !!input.isAdmin,
  };

  try {
    const result = await summarizePdfForStudentFlow(enrichedInput, modelToUse);
    // Ensure the result always conforms to the schema, even if an error message is in summary
    if (!result || typeof result.summary !== 'string' || typeof result.keyPoints === 'undefined' || typeof result.mainIdea !== 'string' || typeof result.formattedStudyOutput !== 'string') {
        console.error(`[Summarize PDF Action] Flow returned malformed output. Model: ${modelToUse}. Output:`, JSON.stringify(result).substring(0,500));
        if (input.isAdmin) {
            return {
                ...DEFAULT_ERROR_OUTPUT_PDF,
                summary: `[Admin Gördü] AI Modeli (${modelToUse}) şemaya uymayan veya eksik bir yanıt döndürdü. Raw Output: ${JSON.stringify(result).substring(0,300)}...`,
                formattedStudyOutput: `## Hata\n\n[Admin Gördü] AI Modeli (${modelToUse}) şemaya uymayan veya eksik bir yanıt döndürdü. Raw Output: ${JSON.stringify(result).substring(0,300)}...`,
            };
        }
        return DEFAULT_ERROR_OUTPUT_PDF;
    }
    console.log("[Summarize PDF Action] Successfully received result from summarizePdfForStudentFlow.");
    return result;
  } catch (error: any) {
    console.error(`[Summarize PDF Action] CRITICAL error during server action execution (outer try-catch). Admin Flag from input: ${input.isAdmin}. Model: ${modelToUse}. Error:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let errorMessage = 'Bilinmeyen bir sunucu hatası oluştu.';
    if (error instanceof Error) errorMessage = error.message;
    else if (typeof error === 'string') errorMessage = error;

    const adminOuterCatchError = `[Admin Gördü - Sunucu Aksiyonu Hatası] Model: ${modelToUse}. Detay: ${errorMessage.substring(0, 500)}`;
    const userOuterCatchError = GENERIC_USER_ERROR_MESSAGE_PDF;

    return {
        ...DEFAULT_ERROR_OUTPUT_PDF,
        summary: input.isAdmin ? adminOuterCatchError : userOuterCatchError,
        formattedStudyOutput: `## Hata\n\n${input.isAdmin ? adminOuterCatchError : userOuterCatchError}`,
    };
  }
}

const promptInputSchema = SummarizePdfForStudentInputSchema.extend({
    isProUser: z.boolean().optional(),
    isPremiumUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
    // isAdmin is already part of SummarizePdfForStudentInputSchema
});

const prompt = ai.definePrompt({
  name: 'detailedTopicExplainerFromPdfPrompt',
  input: {schema: promptInputSchema},
  output: {schema: SummarizePdfForStudentOutputSchema},
  prompt: `Sen, sana sunulan akademik metinlerdeki konuları detaylı, kapsamlı ve anlaşılır bir şekilde açıklayan, alanında otorite sahibi bir AI konu uzmanısın. Amacın, metindeki bilgileri öğretmek, temel kavramları ve prensipleri sunmaktır. Cevapların Türkçe olmalıdır.
ÇIKTIN HER ZAMAN SummarizePdfForStudentOutputSchema ile tanımlanmış JSON formatına HARFİYEN UYMALIDIR. ASLA null veya tanımsız bir yanıt döndürme. Eğer bir hata oluşursa veya istenen bilgiyi üretemezsen bile, "summary", "keyPoints", "mainIdea" ve "formattedStudyOutput" alanlarını içeren geçerli bir JSON nesnesi döndür. Örneğin, "summary" alanına bir hata mesajı yazabilir, "keyPoints" alanını boş bir dizi ([]) olarak ayarlayabilirsin.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isAdmin}}
(Admin Kullanıcı Notu: Şu anda admin olarak test yapıyorsunuz. Model ve detay seviyesi seçimleriniz önceliklidir.)
{{/if}}
{{#if isProUser}}
(Pro Kullanıcı Notu: Bu Pro seviyesindeki kapsamlı konu anlatımı ve analizler, üyeliğinizin özel bir avantajıdır. Bu konu anlatımını en üst düzeyde akademik zenginlikle, konunun felsefi temellerine ve karmaşık detaylarına değinerek yap. Metindeki örtük bağlantıları ve çıkarımları vurgula. Sınav ipuçları ve örnek sorular bölümünde YKS'de çıkabilecek zorlayıcı ve birden fazla kazanımı ölçen sorulara odaklan. Çok kapsamlı bir anlatım oluştur.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: Açıklamalarını daha fazla örnekle ve önemli bağlantıları vurgulayarak zenginleştir. Sınav ipuçları bölümünde konunun YKS'deki önemli noktalarını, örnek sorular bölümünde ise orta düzeyde, konuyu pekiştirici sorular sun.)
{{else}}
(Ücretsiz Kullanıcı Notu: Konunun ana hatlarını ve temel tanımlarını içeren, anlaşılır bir açıklama yap. Sınav ipuçları ve örnek sorular bölümünde temel düzeyde, hatırlamaya yönelik içerikler sun.)
{{/if}}

{{#if isCustomModelSelected}}
  {{#if customModelIdentifier}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' seçildi.)
  {{/if}}
{{/if}}

{{#if isGemini25PreviewSelected}}
(Gemini 2.5 Flash Preview 05-20 Modeli Notu: Yanıtların ÖZ ama ANLAŞILIR ve YKS öğrencisine doğrudan fayda sağlayacak şekilde olsun. HIZLI yanıt vermeye odaklan. {{#if isProUser}}Pro kullanıcı için gereken derinliği ve stratejik bilgileri koruyarak{{else if isPremiumUser}}Premium kullanıcı için gereken detayları ve pratik ipuçlarını sağlayarak{{/if}} gereksiz uzun açıklamalardan ve süslemelerden kaçın, doğrudan konuya girerek en kritik bilgileri vurgula. Çıktın HER ZAMAN geçerli bir JSON nesnesi olmalıdır.)
{{/if}}

PDF'den çıkarılan metin verildiğinde, {{{summaryLength}}} uzunluk tercihine, {{{outputDetail}}} çıktı detayı isteğine ve varsa {{{keywords}}} veya {{{pageRange}}} bilgilerine göre, öğrenci dostu bir tonda aşağıdaki görevleri yerine getir. Çıktını, belirtilen şemaya harfiyen uyacak şekilde yapılandır.

Özel İstekler:
{{#if keywords}}- Odaklanılacak Anahtar Kelimeler: {{{keywords}}}{{/if}}
{{#if pageRange}}- Odaklanılacak Sayfa Aralığı (Kavramsal): {{{pageRange}}}{{/if}}

İstenen Çıktı Detayı: {{{outputDetail}}}

İstenen Çıktı Bölümleri (JSON formatına uygun olarak):
1.  **summary (string, zorunlu)**: Metindeki konuyu, {{{summaryLength}}} seçeneğine göre detay seviyesini ayarlayarak açıkla.
    *   'short': Konunun ana hatlarını ve temel tanımlarını birkaç paragrafta açıkla.
    *   'medium': Ana argümanları, önemli alt başlıkları, temel ilkeleri ve birkaç açıklayıcı örneği içeren kapsamlı bir anlatım sun.
    *   'detailed': Metnin tüm önemli yönlerini, alt başlıklarını derinlemesine, karmaşık örnekleri, diğer konularla bağlantılarını içerecek şekilde son derece uzun ve kapsamlı bir anlatım oluştur.
    Paragraflar halinde yaz ve Markdown formatlamasını (başlıklar, listeler, vurgular) kullan. Eğer bir anlatım üretemiyorsan, bu alana bir hata mesajı yaz.
2.  **keyPoints (string dizisi, zorunlu)**: Anlatılan konunun en önemli 5-10 maddesini listele. 'outputDetail' farklıysa veya üretemiyorsan, bu bölümü boş bir dizi ([]) olarak ayarla.
3.  **mainIdea (string, zorunlu)**: Konunun veya metnin temel mesajını tek cümleyle ifade et. Eğer bir ana fikir belirleyemiyorsan, bu alana "Ana fikir belirlenemedi." gibi bir mesaj yaz.
4.  **examTips (string dizisi, isteğe bağlı)**: Eğer 'outputDetail' 'full' veya 'exam_tips_only' ise, metinden sınavlarda çıkabilecek 4-6 kilit noktayı belirt. Yoksa veya üretemiyorsan, bu alanı boş bir dizi ([]) olarak ayarla veya hiç dahil etme.
5.  **practiceQuestions (isteğe bağlı, Question nesneleri dizisi)**: Eğer 'outputDetail' 'questions_only' veya 'full' ise ve içerik uygunsa, 3-5 çoktan seçmeli YKS formatında alıştırma sorusu (seçenekler, doğru cevap, açıklama) oluştur. Uygun değilse veya üretemiyorsan, bu alanı boş bir dizi ([]) olarak ayarla veya hiç dahil etme.
6.  **formattedStudyOutput (string, zorunlu)**: Yukarıdaki istenen bölümleri ({{{outputDetail}}} seçeneğine göre) net Markdown başlıkları ile tek bir dizede birleştir. Örn: "## Detaylı Konu Anlatımı", "## Anahtar Noktalar" vb. Eğer 'outputDetail' örneğin 'key_points_only' ise, formattedStudyOutput sadece "## Anahtar Noktalar" başlığını ve içeriğini içermelidir. Eğer genel bir hata oluştuysa, bu alana da bir hata mesajı yaz.

Hedefin öğrencinin konuyu derinlemesine anlamasına yardımcı olmak. {{{summaryLength}}} 'detailed' ise cömert ol.
HER ZAMAN ŞEMAYA UYGUN BİR JSON NESNESİ DÖNDÜR.

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
    console.log(`[Summarize PDF Flow] Entry. Admin Flag from enrichedInput: ${enrichedInput.isAdmin}, User Plan: ${enrichedInput.userPlan}, Custom Model (raw): '${enrichedInput.customModelIdentifier}', Model to use initially: ${finalModelToUse}`);

    if (typeof finalModelToUse !== 'string' || !finalModelToUse.startsWith('googleai/')) {
        console.warn(`[Summarize PDF Flow] Invalid or non-string modelToUseParam ('${finalModelToUse}', type: ${typeof finalModelToUse}) received. Defaulting to universal 'googleai/gemini-2.5-flash-preview-05-20'.`);
        finalModelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
    }
    console.log(`[Summarize PDF Flow] Corrected/Final model INSIDE FLOW to: ${finalModelToUse}`);
    
    const standardTemperature = 0.6;
    const standardSafetySettings = [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ];
    
    let maxOutputTokens = 4096; 
    if (enrichedInput.summaryLength === 'detailed') maxOutputTokens = 8192;
    else if (enrichedInput.summaryLength === 'short') maxOutputTokens = 2048;
    
    if (enrichedInput.isProUser && enrichedInput.summaryLength === 'detailed') maxOutputTokens = 8192; 
    else if (enrichedInput.isProUser) maxOutputTokens = Math.max(maxOutputTokens, 4096);

    if (finalModelToUse.includes('flash')) {
        maxOutputTokens = Math.min(maxOutputTokens, 8192);
    }

    const callOptions: { model: string; config?: Record<string, any> } = { 
      model: finalModelToUse,
      config: {
        temperature: standardTemperature,
        safetySettings: standardSafetySettings,
        maxOutputTokens: maxOutputTokens,
      }
    };
    
    const loggableEnrichedInput = {...enrichedInput, pdfText: enrichedInput.pdfText ? `PDF text provided (length: ${enrichedInput.pdfText.length})` : undefined};
    console.log(`[Summarize PDF Flow] Calling prompt with model: ${finalModelToUse} and options:`, JSON.stringify(callOptions.config), `for user plan: ${enrichedInput.userPlan}, customModel (raw): ${enrichedInput.customModelIdentifier}, isAdmin: ${enrichedInput.isAdmin}`);
    console.log(`[Summarize PDF Flow] Input to prompt (loggableEnrichedInput):`, JSON.stringify(loggableEnrichedInput).substring(0, 1000) + (JSON.stringify(loggableEnrichedInput).length > 1000 ? "..." : ""));

    try {
      const {output} = await prompt(enrichedInput, callOptions);

      if (output === null || typeof output !== 'object' || typeof output.summary !== 'string' || typeof output.formattedStudyOutput !== 'string') {
        const rawOutputPreview = output === null ? "null" : (JSON.stringify(output, null, 2).substring(0, 500) + "...");
        console.error(`[Summarize PDF Flow] AI returned null or malformed output (not matching schema). Model: ${finalModelToUse}. Output Preview:`, rawOutputPreview, `isAdmin: ${enrichedInput.isAdmin}`);
        
        let errorMessageForUser: string;
        if (enrichedInput.isAdmin) {
            if (output === null) {
                errorMessageForUser = `[Admin Gördü - Akış İçi Hata] AI Modeli (${finalModelToUse}), beklenen yanıt şemasına uymayan bir çıktı üretti. Detay: Model, yanıt olarak 'null' (boş bir nesne) döndürdü. Raw output: ${rawOutputPreview}`;
            } else {
                errorMessageForUser = `[Admin Gördü - Akış İçi Hata] AI Modeli (${finalModelToUse}), boş veya beklenen temel yapıda olmayan bir yanıt döndürdü. Yanıtın 'summary' veya 'formattedStudyOutput' alanı bir metin (string) değil veya nesne yapısı hatalı. Raw Çıktı: ${rawOutputPreview}`;
            }
        } else {
           errorMessageForUser = GENERIC_USER_ERROR_MESSAGE_PDF;
        }

        return {
            summary: errorMessageForUser,
            keyPoints: (output && Array.isArray(output.keyPoints)) ? output.keyPoints : [],
            mainIdea: (output && typeof output.mainIdea === 'string') ? output.mainIdea : "Ana fikir belirlenemedi.",
            examTips: (output && Array.isArray(output.examTips)) ? output.examTips : [],
            practiceQuestions: (output && Array.isArray(output.practiceQuestions)) ? output.practiceQuestions : [],
            formattedStudyOutput: `## Hata\n\n${errorMessageForUser}`
        };
      }
      
      // Ensure optional arrays are present if requested, otherwise make them undefined for schema
      const shouldHaveQuestions = enrichedInput.outputDetail === 'full' || enrichedInput.outputDetail === 'questions_only';
      output.practiceQuestions = shouldHaveQuestions ? (output.practiceQuestions || []) : undefined;

      const shouldHaveExamTips = enrichedInput.outputDetail === 'full' || enrichedInput.outputDetail === 'exam_tips_only';
      output.examTips = shouldHaveExamTips ? (output.examTips || []) : undefined;

      if (enrichedInput.outputDetail !== 'full' && enrichedInput.outputDetail !== 'key_points_only') {
          output.keyPoints = [];
      } else {
          output.keyPoints = output.keyPoints || [];
      }
      
      console.log("[Summarize PDF Flow] Successfully received and validated (implicitly by Genkit) output from AI model.");
      return output;

    } catch (promptError: any) {
        console.error(`[Summarize PDF Flow] INNER CATCH: CRITICAL ERROR during prompt execution with model ${finalModelToUse}. Admin Flag from enrichedInput: ${enrichedInput.isAdmin}. Error details:`, JSON.stringify(promptError, Object.getOwnPropertyNames(promptError), 2));

        let detailedAdminErrorForLog = `Genkit/AI Hatası: ${promptError?.name || 'Bilinmeyen Hata Adı'} - ${promptError?.message || 'Hata mesajı yok.'}. `;
        if (promptError?.cause) {
            try { detailedAdminErrorForLog += `Neden: ${JSON.stringify(promptError.cause)}. `; }
            catch (e) { detailedAdminErrorForLog += `Neden: (Serileştirilemedi). `; }
        }
        if (promptError?.details) { 
            try { detailedAdminErrorForLog += `Detaylar: ${JSON.stringify(promptError.details)}. `; }
            catch (e) { detailedAdminErrorForLog += `Detaylar: (Serileştirilemedi). `; }
        }
        
        if (promptError?.name === 'GenkitError' && promptError?.message?.includes('Schema validation failed')) {
            let zodErrors = "Şema Doğrulama Hatası.";
            if (promptError.details && Array.isArray(promptError.details)) {
                zodErrors = promptError.details.map((detail: any) => `[${detail.path?.join('.') || 'root'}]: ${detail.message}`).join('; ');
            }
            detailedAdminErrorForLog = `AI modeli (${finalModelToUse}) gelen yanıt beklenen şemayla uyuşmuyor: ${zodErrors.substring(0, 400)}. Raw Prompt Error Details: ${JSON.stringify(promptError.details).substring(0,300)}`;
        } else if (promptError?.message?.includes('SAFETY') || promptError?.message?.includes('block_reason')) {
            detailedAdminErrorForLog = `İçerik güvenlik filtrelerine takılmış olabilir. Model: ${finalModelToUse}. Detay: ${promptError.message.substring(0, 200)}`;
        }

        const userVisibleMessage = enrichedInput.isAdmin
            ? `[Admin Gördü - Akış İçi Hata] AI PDF Anlatıcısı (${finalModelToUse}) bir hata ile karşılaştı. Detay: ${detailedAdminErrorForLog.substring(0,1000)}`
            : GENERIC_USER_ERROR_MESSAGE_PDF;

        return {
            ...DEFAULT_ERROR_OUTPUT_PDF,
            summary: userVisibleMessage,
            formattedStudyOutput: `## Hata\n\n${userVisibleMessage}`,
        };
    }
  }
);
    
