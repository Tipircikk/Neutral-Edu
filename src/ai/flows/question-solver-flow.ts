
'use server';
/**
 * @fileOverview YKS'ye hazırlanan öğrencilerin karşılaştığı akademik soruları (metin veya görsel tabanlı)
 * adım adım çözen, ilgili kavramları açıklayan ve YKS odaklı ipuçları veren uzman bir AI öğretmeni.
 *
 * - solveQuestion - Kullanıcının sorduğu bir soruyu çözme işlemini yöneten fonksiyon.
 * - SolveQuestionInput - solveQuestion fonksiyonu için giriş tipi.
 * - SolveQuestionOutput - solveQuestion fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SolveQuestionInputSchema = z.object({
  questionText: z.string().optional().describe('Öğrencinin çözülmesini istediği, YKS kapsamındaki soru metni.'),
  imageDataUri: z.string().optional().describe("Soruyla ilgili bir görselin data URI'si (Base64 formatında). 'data:<mimetype>;base64,<encoded_data>' formatında olmalıdır. Görsel, soru metni yerine veya ona ek olarak sunulabilir."),
  solutionDetailLevel: z.enum(["temel", "orta", "detayli"]).optional().default("orta").describe("İstenen çözümün detay seviyesi: 'temel' (ana adımlar, kısa cevap), 'orta' (adım açıklamaları, temel kavramlar), 'detayli' (çok ayrıntılı anlatım, derinlemesine kavramlar)."),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı."),
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi (örn: 'default_gemini_flash', 'experimental_gemini_1_5_flash', 'experimental_gemini_2_5_flash_preview_05_20')."),
  isAdmin: z.boolean().optional().describe("Kullanıcının admin olup olmadığını belirtir."),
});
export type SolveQuestionInput = z.infer<typeof SolveQuestionInputSchema>;

const SolveQuestionOutputSchema = z.object({
  solution: z.string().describe('Sorunun YKS öğrencisinin anlayacağı dilde, adım adım çözümü ve kavramsal açıklaması. Eğer çözüm üretilemiyorsa, nedenini belirten bir mesaj içermelidir.'),
  relatedConcepts: z.array(z.string()).optional().describe('Çözümle ilgili veya sorunun ait olduğu konudaki YKS için önemli 2-3 anahtar akademik kavram veya konu başlığı. Boş olabilir.'),
  examStrategyTips: z.array(z.string()).optional().describe("Bu tür soruları YKS'de çözerken kullanılabilecek stratejiler veya dikkat edilmesi gereken noktalar. Boş olabilir."),
});
export type SolveQuestionOutput = z.infer<typeof SolveQuestionOutputSchema>;

const GENERIC_USER_ERROR_MESSAGE = "AI Soru Çözücü şu anda bir sorun yaşıyor gibi görünüyor. Lütfen biraz sonra tekrar deneyin veya farklı bir soru sormayı deneyin.";

export async function solveQuestion(input: SolveQuestionInput): Promise<SolveQuestionOutput> {
  console.log(`[Question Solver Action] Entry. User input isAdmin: ${input.isAdmin}, User Plan: ${input.userPlan}, Custom Model (raw): '${input.customModelIdentifier}', Detail Level: ${input.solutionDetailLevel}`);

  if (!input.questionText && !input.imageDataUri) {
    return {
      solution: "Lütfen çözülmesini istediğiniz bir soru metni girin veya bir görsel yükleyin.",
      relatedConcepts: [],
      examStrategyTips: [],
    };
  }

  let modelToUse: string;
  const adminModelChoice = input.customModelIdentifier;

  if (typeof adminModelChoice === 'string' && adminModelChoice.trim() !== "") {
    const customIdLower = adminModelChoice.toLowerCase().trim();
    console.log(`[Question Solver Action] Admin specified customModelIdentifier (processed): '${customIdLower}' from input: '${adminModelChoice}'`);
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
            console.warn(`[Question Solver Action] Admin specified a direct Genkit model name: '${modelToUse}'. Ensure this model is supported.`);
        } else {
            console.warn(`[Question Solver Action] Admin specified an UNKNOWN customModelIdentifier: '${adminModelChoice}'. Falling back to universal default.`);
            modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
        }
        break;
    }
  } else {
    console.log(`[Question Solver Action] No valid custom model specified. Using universal default 'googleai/gemini-2.5-flash-preview-05-20' for all users.`);
    modelToUse = 'googleai/gemini-2.5-flash-preview-05-20'; // Universal default for all users
  }

  // Absolute fallback for modelToUse.
  if (typeof modelToUse !== 'string' || !modelToUse.startsWith('googleai/')) {
      console.error(`[Question Solver Action] CRITICAL FALLBACK: modelToUse was invalid ('${modelToUse}', type: ${typeof modelToUse}). Defaulting to 'googleai/gemini-2.5-flash-preview-05-20'.`);
      modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
  }
  console.log(`[Question Solver Action] Final model determined for flow: ${modelToUse}`);

  const isProUser = input.userPlan === 'pro';
  const isPremiumUser = input.userPlan === 'premium';
  const isGemini25PreviewSelected = modelToUse === 'googleai/gemini-2.5-flash-preview-05-20';

  const enrichedInput = {
    ...input, // input already contains isAdmin
    isProUser,
    isPremiumUser,
    isCustomModelSelected: !!input.customModelIdentifier,
    isGemini25PreviewSelected,
    // isAdmin: !!input.isAdmin, // Already included via ...input
    solutionDetailLevel: input.solutionDetailLevel || "orta",
  };

  try {
    const result = await questionSolverFlow(enrichedInput, modelToUse);

    // Check if the flow returned a generic error despite admin privileges
    if (input.isAdmin && result.solution === GENERIC_USER_ERROR_MESSAGE) {
        console.warn(`[Question Solver Action] Admin user received generic error from flow. Input isAdmin: ${input.isAdmin}, Flow enrichedInput.isAdmin: ${enrichedInput.isAdmin}. Overriding with admin-specific error.`);
        return {
            solution: `[Admin Gördü - Olası Admin Bayrak Uyuşmazlığı] AI Soru Çözücü (${modelToUse || 'belirlenemeyen'}) bir sorunla karşılaştı. Akış, admin olmadığınızı düşünmüş olabilir. Akış loglarını kontrol edin.`,
            relatedConcepts: ["Admin Bayrak Uyuşmazlığı"],
            examStrategyTips: ["Akış loglarını kontrol edin."],
        };
    }
    console.log("[Question Solver Action] Successfully received result from questionSolverFlow.");
    return result; // Return the direct result from the flow
  } catch (error: any) { // OUTER CATCH for solveQuestion server action
    console.error(`[Question Solver Action] CRITICAL error during server action execution (outer try-catch). Admin Flag from input: ${input.isAdmin}. Error:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    let errorMessage = 'Bilinmeyen bir sunucu hatası oluştu.';
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else if (input.isAdmin) { // Provide more details for admin if error object is not standard
        try {
            errorMessage = `Detaylandırılamayan nesne hatası (Admin): ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`;
        } catch (e) {
            errorMessage = "Detaylandırılamayan ve stringify edilemeyen nesne hatası (Admin).";
        }
    }

    const adminOuterCatchError = `[Admin Gördü - Sunucu Aksiyonu Hatası] Model: ${modelToUse || 'belirlenemeyen model'}. Detay: ${errorMessage.substring(0, 500)}`;
    const userOuterCatchError = `Soru çözümü oluşturulurken beklenmedik bir sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.`;

    return {
        solution: input.isAdmin ? adminOuterCatchError : userOuterCatchError,
        relatedConcepts: input.isAdmin ? ["Kritik Sunucu Hatası"] : [],
        examStrategyTips: input.isAdmin ? ["Tekrar deneyin"] : [],
    };
  }
}

const promptInputSchema = SolveQuestionInputSchema.extend({
    isProUser: z.boolean().optional(),
    isPremiumUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
    // isAdmin is already part of SolveQuestionInputSchema and thus enrichedInput
});

const questionSolverPrompt = ai.definePrompt({
  name: 'questionSolverPrompt',
  input: {schema: promptInputSchema},
  output: {schema: SolveQuestionOutputSchema},
  prompt: `Sen, YKS (TYT–AYT) sınavına hazırlanan öğrencilere, tüm derslerde en karmaşık soruları bile temel prensiplerine indirgeyerek, adım adım, son derece anlaşılır, pedagojik değeri yüksek ve öğrenciyi düşündürmeye teşvik eden bir şekilde çözmede uzmanlaşmış, kıdemli bir AI YKS uzman öğretmenisin.
Amacın sadece doğru cevabı vermek değil, aynı zamanda sorunun çözüm mantığını, altında yatan temel prensipleri ve YKS'de sıkça sorulan püf noktalarını vurgulamaktır.
Matematiksel sembolleri (örn: x^2, H_2O, √, π, ±, ≤, ≥) metin içinde açıkça ve anlaşılır bir şekilde kullan. Denklemleri veya önemli ifadeleri yazarken Markdown formatlamasına (örn: \`denklem\` veya \`\`\` ile kod blokları) dikkat et ve doğru kapat.

Cevapların her zaman Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isAdmin}}
(Admin Kullanıcı Notu: Şu anda admin olarak test yapıyorsunuz. Model ve detay seviyesi seçimleriniz önceliklidir.)
{{/if}}
İstenen Çözüm Detay Seviyesi: {{{solutionDetailLevel}}}.

{{#if isProUser}}
(Pro Kullanıcı Notu: Bu Pro seviyesindeki uzman çözüm, üyeliğinizin özel bir avantajıdır. Çözümlerini üst düzeyde akademik titizlikle sun. Varsa birden fazla çözüm yolunu kısaca belirt. Sorunun çözümünde kullanılan anahtar kavramları derinlemesine açıkla. Bu tür sorularla ilgili YKS'de karşılaşılabilecek farklı varyasyonlara ve genel sınav stratejilerine (örn: zaman yönetimi, eleme teknikleri) değin. Sorunun YKS'deki stratejik önemine vurgu yap.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: Daha derinlemesine açıklamalar yapmaya çalış. Varsa alternatif çözüm yollarına kısaca değin. Sorunun çözümünde kullanılan temel prensipleri ve 1-2 önemli YKS ipucunu belirt.)
{{else}}
(Ücretsiz Kullanıcı Notu: Soruyu adım adım ve anlaşılır bir şekilde çöz. Temel kavramlara değin. Çözümde 1 genel YKS ipucu ver.)
{{/if}}

{{#if isCustomModelSelected}}
  {{#if customModelIdentifier}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' seçildi.)
  {{/if}}
{{/if}}

{{#if isGemini25PreviewSelected}}
(Gemini 2.5 Flash Preview 05-20 Modeli Notu: Çözümü ana adımları ve kilit mantıksal çıkarımları vurgulayarak, olabildiğince ÖZ ama ANLAŞILIR olmalıdır. Adım adım çözüm bölümünde, gereksiz ara hesaplamaları özetle veya atla, sadece kilit adımlara odaklan. {{#if isProUser}}Pro kullanıcı için gereken derinliği ve stratejik bilgileri koruyarak{{else if isPremiumUser}}Premium kullanıcı için gereken detayları ve pratik ipuçlarını sağlayarak{{/if}} aşırı detaydan kaçın, doğrudan ve net bir çözüm sun. HIZLI YANIT VERMESİ ÖNEMLİDİR.)
{{else}}
(Diğer Model Notu: Çözümü ayrıntılı ve SATIR SATIR açıkla.)
{{/if}}

Kullanıcının girdileri aşağıdadır:
{{#if imageDataUri}}
Görsel Soru Kaynağı:
{{media url=imageDataUri}}
(Eğer görseldeki soru metin içeriyorsa, bu metni çözümüne dahil et. Görseldeki şekilleri, grafikleri veya tabloları dikkatlice analiz et.)
{{/if}}
{{#if questionText}}
Metinsel Soru/Açıklama:
{{{questionText}}}
{{/if}}

Lütfen bu soruyu/soruları analiz et ve aşağıdaki JSON formatına HARFİYEN uyacak şekilde, ÖĞRETİCİ ve ADIM ADIM bir yanıt hazırla:
Çıktın HER ZAMAN geçerli bir JSON nesnesi olmalıdır ve "solution" (string), "relatedConcepts" (string dizisi, boş olabilir) ve "examStrategyTips" (string dizisi, boş olabilir) alanlarını içermelidir.
Eğer soru çözülemiyorsa veya girdi yetersizse, "solution" alanına nedenini açıklayan bir mesaj yaz (örneğin, "Bu soru için bir çözüm üretemedim çünkü görseldeki ifadeler net değil.") ve diğer alanları boş dizi ([]) olarak bırak. ASLA null veya tanımsız bir yanıt döndürme.

İstenen Çıktı Bölümleri (bu JSON formatına uy):
1.  **solution (string, zorunlu)**:
    *   Sorunun hangi YKS dersi ve ana konusuna ait olduğunu KISACA belirt.
    *   Çözüm için gerekli TEMEL BİLGİLERİ (ana formül veya kavram) listele.
    *   Soruyu, İSTENEN ÇÖZÜM DETAY SEVİYESİNE ({{{solutionDetailLevel}}}) göre ana adımları mantığıyla birlikte, AÇIKLAYARAK çöz.
        *   'temel' seviye için: Çözümü ana adımlarıyla, çok kısa ve öz bir şekilde ver. Sonucu net belirt.
        *   'orta' seviye için: Her adımı kısa açıklamalarla destekle. Temel kavramlara değin. Sonucu net belirt.
        *   'detayli' seviye için: Her adımı mantığıyla, ara hesaplamalarla ve kullanılan formüllerle çok detaylı açıkla. {{{#if isProUser}}}Pro kullanıcıya özel olarak, varsa alternatif çözüm yollarına, sık yapılan hatalara ve konseptlere derinlemesine değin.{{{/if}}} Sonucu net bir şekilde belirt (örn: Cevap B).
    *   Her bir önemli matematiksel işlemi veya mantıksal çıkarımı net bir şekilde belirt.
    *   Eğer girdi yetersiz, anlamsız veya YKS standartlarında çözülemeyecek kadar belirsizse, bu alana "Bu soruyu çözebilmek için daha fazla bilgiye/netliğe veya görseldeki ifadenin metin olarak yazılmasına ihtiyacım var." gibi bir geri bildirim yaz.
2.  **relatedConcepts (string dizisi, isteğe bağlı, boş olabilir)**:
    *   Çözümde kullanılan veya soruyla yakından ilişkili, YKS'de bilinmesi gereken temel kavramları LİSTELE. Boş bir dizi olabilir.
3.  **examStrategyTips (string dizisi, isteğe bağlı, boş olabilir)**:
    *   Bu tür sorularla ilgili pratik YKS stratejileri veya ipuçlarını LİSTELE. Boş bir dizi olabilir.

Davranış Kuralları:
*   Eğer hem görsel hem de metin girdisi varsa, bunları birbiriyle ilişkili kabul et.
*   Yanıtını öğrencinin kolayca anlayabileceği, teşvik edici ve eğitici bir dille yaz.
*   ÇIKTININ İSTENEN JSON ŞEMASINA TAM OLARAK UYDUĞUNDAN EMİN OL. "solution" bir string, "relatedConcepts" ve "examStrategyTips" ise string dizileri (boş olabilirler) olmalıdır.
`,
});

const questionSolverFlow = ai.defineFlow(
  {
    name: 'questionSolverFlow',
    inputSchema: promptInputSchema,
    outputSchema: SolveQuestionOutputSchema,
  },
  async (enrichedInput: z.infer<typeof promptInputSchema>, modelToUseParam: string): Promise<SolveQuestionOutput> => {
    let finalModelToUse = modelToUseParam;

    console.log(`[Question Solver Flow] Entry. Admin Flag from enrichedInput: ${enrichedInput.isAdmin}, User Plan: ${enrichedInput.userPlan}, Custom Model (raw): '${enrichedInput.customModelIdentifier}', Detail Level: ${enrichedInput.solutionDetailLevel}, Model to use initially: ${finalModelToUse}`);

    if (typeof finalModelToUse !== 'string' || !finalModelToUse.startsWith('googleai/')) {
        console.warn(`[Question Solver Flow] Invalid or non-string modelToUseParam ('${finalModelToUse}', type: ${typeof finalModelToUse}) received. Defaulting to universal 'googleai/gemini-2.5-flash-preview-05-20'.`);
        finalModelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
    }
    console.log(`[Question Solver Flow] Corrected/Final model INSIDE FLOW to: ${finalModelToUse}`);

    const standardTemperature = 0.5;
    const standardSafetySettings = [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ];

    let maxOutputTokens = 4096;
    if (enrichedInput.solutionDetailLevel === 'detayli' || enrichedInput.isProUser) {
        maxOutputTokens = 8000;
    } else if (enrichedInput.solutionDetailLevel === 'orta') {
        maxOutputTokens = 4096;
    } else {
        maxOutputTokens = 2048;
    }
    if (enrichedInput.isProUser) {
        maxOutputTokens = Math.max(maxOutputTokens, 8000);
    }

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

    const loggableEnrichedInput = {...enrichedInput, imageDataUri: enrichedInput.imageDataUri ? `Image data URI provided (length: ${enrichedInput.imageDataUri.length})` : undefined};
    console.log(`[Question Solver Flow] Calling prompt with model: ${finalModelToUse} and options:`, JSON.stringify(callOptions.config), `for user plan: ${enrichedInput.userPlan}, customModel (raw): ${enrichedInput.customModelIdentifier}, detail: ${enrichedInput.solutionDetailLevel}, isAdmin: ${enrichedInput.isAdmin}`);
    console.log(`[Question Solver Flow] Input to prompt (loggableEnrichedInput):`, JSON.stringify(loggableEnrichedInput).substring(0, 1000) + (JSON.stringify(loggableEnrichedInput).length > 1000 ? "..." : ""));


    try {
      // Critical: Use enrichedInput, NOT loggableEnrichedInput for the actual prompt call
      const { output } = await questionSolverPrompt(enrichedInput, callOptions);

      if (output === null || typeof output !== 'object' || typeof output.solution !== 'string') {
        const rawOutputPreview = output === null ? "null" : (JSON.stringify(output, null, 2).substring(0, 500) + "...");
        console.error(`[Question Solver Flow] AI returned null or malformed output (not matching schema). Model: ${finalModelToUse}. Output Preview:`, rawOutputPreview, `isAdmin: ${enrichedInput.isAdmin}`);

        let errorMessageForUser: string;
        if (enrichedInput.isAdmin) {
            if (output === null) {
                errorMessageForUser = `[Admin Gördü - Akış İçi Hata] AI Modeli (${finalModelToUse}), beklenen yanıt şemasına uymayan bir çıktı üretti. Detay: Model, yanıt olarak 'null' (boş bir nesne) döndürdü. Bu genellikle modelin soruyu işleyemediği veya geçerli bir JSON oluşturamadığı anlamına gelir. Raw output: ${rawOutputPreview}`;
            } else {
                errorMessageForUser = `[Admin Gördü - Akış İçi Hata] AI Modeli (${finalModelToUse}), boş veya beklenen temel yapıda olmayan bir yanıt döndürdü. Yanıtın 'solution' alanı bir metin (string) değil veya nesne yapısı hatalı. Raw Çıktı: ${rawOutputPreview}`;
            }
        } else {
           errorMessageForUser = GENERIC_USER_ERROR_MESSAGE;
        }

        return {
            solution: errorMessageForUser,
            relatedConcepts: (output && Array.isArray(output.relatedConcepts)) ? output.relatedConcepts : (enrichedInput.isAdmin ? ["Hata (Geçersiz Çıktı Yapısı)"] : []),
            examStrategyTips: (output && Array.isArray(output.examStrategyTips)) ? output.examStrategyTips : [],
        };
      }

      console.log("[Question Solver Flow] Successfully received and validated (implicitly by Genkit) solution from AI model.");
      return {
        solution: output.solution,
        relatedConcepts: output.relatedConcepts || [],
        examStrategyTips: output.examStrategyTips || [],
      };

    } catch (promptError: any) {
      console.error(`[Question Solver Flow] INNER CATCH: CRITICAL ERROR during prompt execution with model ${finalModelToUse}. Admin Flag from enrichedInput: ${enrichedInput.isAdmin}. Error details:`, JSON.stringify(promptError, Object.getOwnPropertyNames(promptError), 2));

      let detailedAdminErrorForLog = `Genkit/AI Hatası: ${promptError?.name || 'Bilinmeyen Hata Adı'} - ${promptError?.message || 'Hata mesajı yok.'}. `;
      if (promptError?.cause) {
          try { detailedAdminErrorForLog += `Neden: ${JSON.stringify(promptError.cause)}. `; }
          catch (e) { detailedAdminErrorForLog += `Neden: (Serileştirilemedi). `; }
      }
      if (promptError?.details) { // This is where Zod errors often appear
          try { detailedAdminErrorForLog += `Detaylar: ${JSON.stringify(promptError.details)}. `; }
          catch (e) { detailedAdminErrorForLog += `Detaylar: (Serileştirilemedi). `; }
      }
      if (promptError instanceof Error && promptError.stack) {
          detailedAdminErrorForLog += `Stack (kısmi): ${promptError.stack.substring(0, 300)}...`;
      }
      if (typeof promptError === 'object' && promptError !== null && !promptError.message) {
           detailedAdminErrorForLog += ` Tam Hata Nesnesi: ${JSON.stringify(promptError, Object.getOwnPropertyNames(promptError), 2).substring(0, 500)}...`;
      }

      // Specific error message refinements for admins
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
        ? `[Admin Gördü - Akış İçi Hata] AI Soru Çözücüsü (${finalModelToUse || 'belirlenemeyen'}) bir hata ile karşılaştı. Detay: ${detailedAdminErrorForLog.substring(0,1000)}`
        : GENERIC_USER_ERROR_MESSAGE;

      return {
          solution: userVisibleMessage,
          relatedConcepts: enrichedInput.isAdmin ? ["Hata (Akış İçi Yakalama)"] : [],
          examStrategyTips: [],
      };
    }
  }
);
    

    