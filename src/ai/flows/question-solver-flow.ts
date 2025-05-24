
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

export async function solveQuestion(input: SolveQuestionInput): Promise<SolveQuestionOutput> {
  console.log(`[Question Solver Action] Received input. Admin Model ID (raw): '${input.customModelIdentifier}', HasText: ${!!input.questionText}, HasImage: ${!!input.imageDataUri}, IsAdmin: ${!!input.isAdmin}, DetailLevel: ${input.solutionDetailLevel}`);

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
    console.log(`[Question Solver Action] No valid custom model specified by admin. Using universal default 'googleai/gemini-2.5-flash-preview-05-20' for all users.`);
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
    ...input,
    isProUser,
    isPremiumUser,
    isCustomModelSelected: !!input.customModelIdentifier,
    isGemini25PreviewSelected,
    isAdmin: !!input.isAdmin, 
    solutionDetailLevel: input.solutionDetailLevel || "orta",
  };

  try {
    const result = await questionSolverFlow(enrichedInput, modelToUse);

    if (!result || typeof result.solution !== 'string' || (result.relatedConcepts && !Array.isArray(result.relatedConcepts)) || (result.examStrategyTips && !Array.isArray(result.examStrategyTips))) {
      const errorDetail = !result ? "AI akışından tanımsız yanıt alındı." : 
                          typeof result.solution !== 'string' ? "Çözüm metni (solution) eksik veya geçersiz." :
                          (result.relatedConcepts && !Array.isArray(result.relatedConcepts)) ? "İlgili kavramlar (relatedConcepts) bir dizi değil." :
                          (result.examStrategyTips && !Array.isArray(result.examStrategyTips)) ? "Sınav ipuçları (examStrategyTips) bir dizi değil." :
                          "Bilinmeyen yapısal hata.";
      console.error(`[Question Solver Action] Flow returned invalid, null, or malformed result. Model: ${modelToUse}. Details: ${errorDetail}. Raw result:`, JSON.stringify(result).substring(0, 500));
      
      const adminErrorMessage = `AI akışından (${modelToUse}) geçersiz veya eksik bir yanıt alındı (Admin Gördü). ${errorDetail}. Lütfen tekrar deneyin veya farklı bir soru sorun.`;
      const userErrorMessage = `AI Soru Çözücü şu anda bir sorun yaşıyor gibi görünüyor. Lütfen biraz sonra tekrar deneyin veya farklı bir soru sormayı deneyin.`;

      return {
          solution: input.isAdmin ? adminErrorMessage : userErrorMessage,
          relatedConcepts: (result && Array.isArray(result.relatedConcepts)) ? result.relatedConcepts : (input.isAdmin ? ["Hata"] : []),
          examStrategyTips: (result && Array.isArray(result.examStrategyTips)) ? result.examStrategyTips : (input.isAdmin ? ["Tekrar deneyin"] : []),
      };
    }
    console.log("[Question Solver Action] Successfully received result from questionSolverFlow.");
    return {
        solution: result.solution,
        relatedConcepts: result.relatedConcepts || [],
        examStrategyTips: result.examStrategyTips || [],
    };
  } catch (error: any) {
    console.error("[Question Solver Action] CRITICAL error during server action execution (outer try-catch):", error);
    let errorMessage = 'Bilinmeyen bir sunucu hatası oluştu.';
    if (error instanceof Error) {
        errorMessage = error.message;
         if (input.isAdmin && error.stack) {
            errorMessage += `\nStack (Admin): ${error.stack.substring(0, 300)}...`;
        }
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else if (input.isAdmin) {
        try {
            errorMessage = `Detaylandırılamayan nesne hatası (Admin): ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`;
        } catch (e) {
            errorMessage = "Detaylandırılamayan ve stringify edilemeyen nesne hatası (Admin).";
        }
    }
    
    const adminOuterCatchError = `Sunucu tarafında kritik bir hata oluştu (Admin Gördü - Model: ${modelToUse || 'belirlenemeyen model'}): ${errorMessage}`;
    const userOuterCatchError = `Soru çözümü oluşturulurken beklenmedik bir sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.`;
    return {
        solution: input.isAdmin ? adminOuterCatchError : userOuterCatchError,
        relatedConcepts: input.isAdmin ? ["Kritik Hata"] : [],
        examStrategyTips: input.isAdmin ? ["Tekrar deneyin"] : [],
    };
  }
}

const promptInputSchema = SolveQuestionInputSchema.extend({
    isProUser: z.boolean().optional(),
    isPremiumUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
    // isAdmin is already part of SolveQuestionInputSchema
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

    console.log(`[Question Solver Flow] Entry. isAdmin: ${enrichedInput.isAdmin}, User Plan: ${enrichedInput.userPlan}, Custom Model (raw): '${enrichedInput.customModelIdentifier}', Detail Level: ${enrichedInput.solutionDetailLevel}, Model to use initially: ${finalModelToUse}`);
    
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
    
    let maxTokensForOutput = 4096; 
    if (enrichedInput.solutionDetailLevel === 'detayli' || enrichedInput.isProUser) {
        maxTokensForOutput = 8000; 
    } else if (enrichedInput.solutionDetailLevel === 'orta') {
        maxTokensForOutput = 4096;
    } else { 
        maxTokensForOutput = 2048;
    }
    if (enrichedInput.isProUser) {
        maxTokensForOutput = Math.max(maxTokensForOutput, 8000);
    }
    
    if (finalModelToUse.includes('flash')) {
      maxTokensForOutput = Math.min(maxTokensForOutput, 8192); 
    }

    const callOptions: { model: string; config?: Record<string, any> } = { 
      model: finalModelToUse,
      config: {
        temperature: standardTemperature,
        safetySettings: standardSafetySettings,
        maxOutputTokens: maxTokensForOutput, 
      }
    };
    
    // Log the input being sent to the prompt, but without potentially very long imageDataUri for brevity
    const loggableEnrichedInput = {...enrichedInput, imageDataUri: enrichedInput.imageDataUri ? `Image data URI provided (length: ${enrichedInput.imageDataUri.length})` : undefined};
    console.log(`[Question Solver Flow] Calling prompt with model: ${finalModelToUse} and options:`, JSON.stringify(callOptions.config), `for user plan: ${enrichedInput.userPlan}, customModel (raw): ${enrichedInput.customModelIdentifier}, detail: ${enrichedInput.solutionDetailLevel}`);
    console.log(`[Question Solver Flow] Input to prompt (loggableEnrichedInput):`, JSON.stringify(loggableEnrichedInput).substring(0, 1000) + (JSON.stringify(loggableEnrichedInput).length > 1000 ? "..." : ""));


    try {
      const { output } = await questionSolverPrompt(enrichedInput, callOptions);

      if (output === null || typeof output !== 'object' || typeof output.solution !== 'string') {
        const rawOutputPreview = output === null ? "null" : (JSON.stringify(output, null, 2).substring(0, 500) + "...");
        console.error(`[Question Solver Flow] AI returned null or malformed output (not matching schema). Model: ${finalModelToUse}. Output Preview:`, rawOutputPreview);
        
        let errorMessageForUser: string;
        if (enrichedInput.isAdmin) {
            if (output === null) {
                errorMessageForUser = `AI Modeli (${finalModelToUse}), beklenen yanıt şemasına uymayan bir çıktı üretti (Admin Gördü). Detay: Model, yanıt olarak 'null' (boş bir nesne) döndürdü. Bu genellikle modelin soruyu işleyemediği veya geçerli bir JSON oluşturamadığı anlamına gelir. Lütfen girdiyi ve prompt'u kontrol edin. Raw output: ${rawOutputPreview}`;
            } else {
                errorMessageForUser = `AI Modeli (${finalModelToUse}), boş veya beklenen temel yapıda olmayan bir yanıt döndürdü (Admin Gördü). Yanıtın 'solution' alanı bir metin (string) değil veya nesne yapısı hatalı. Raw Çıktı: ${rawOutputPreview}`;
            }
        } else {
           errorMessageForUser = `AI Soru Çözücü şu anda bir sorun yaşıyor gibi görünüyor. Lütfen biraz sonra tekrar deneyin veya farklı bir soru sormayı deneyin.`;
        }
        
        return {
            solution: errorMessageForUser,
            relatedConcepts: (output && Array.isArray(output.relatedConcepts)) ? output.relatedConcepts : [], 
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
      console.error(`[Question Solver Flow] INNER CATCH: CRITICAL ERROR during prompt execution with model ${finalModelToUse}. Error details:`, JSON.stringify(promptError, Object.getOwnPropertyNames(promptError), 2));
      
      let simpleErrorMsg: string;

      if (enrichedInput.isAdmin) {
        simpleErrorMsg = `Genkit/AI Error (Admin): ${promptError?.name || 'Unknown Name'} - ${promptError?.message || 'No message provided by error object.'}. `;
        if (promptError?.cause) {
            try {
                simpleErrorMsg += `Cause: ${JSON.stringify(promptError.cause)}. `;
            } catch (e) { simpleErrorMsg += `Cause: (Unserializable). `; }
        }
        if (promptError?.details) {
            try {
                simpleErrorMsg += `Details: ${JSON.stringify(promptError.details)}. `;
            } catch (e) { simpleErrorMsg += `Details: (Unserializable). `; }
        }
        if (promptError instanceof Error && promptError.stack) {
            simpleErrorMsg += `Stack (partial): ${promptError.stack.substring(0, 300)}...`;
        }
        if (typeof promptError === 'object' && promptError !== null && !promptError.message) {
             simpleErrorMsg += ` Full Error Object (Admin): ${JSON.stringify(promptError, Object.getOwnPropertyNames(promptError), 2).substring(0, 500)}...`;
        }

      } else {
        // Non-admin generic message is set outside this simpleErrorMsg construction
        simpleErrorMsg = "Bilinmeyen bir Genkit/AI hatası oluştu."; // Fallback, this shouldn't be shown to non-admins directly
      }
      
      // Specific error message refinements for admins (even if simpleErrorMsg was already detailed)
      if (enrichedInput.isAdmin) {
        if (promptError?.name === 'GenkitError' && promptError?.message?.includes('Schema validation failed')) {
            let zodErrors = "Şema Doğrulama Hatası.";
            if (promptError.details && Array.isArray(promptError.details)) {
                zodErrors = promptError.details.map((detail: any) => `[${detail.path?.join('.') || 'root'}]: ${detail.message}`).join('; ');
            }
            simpleErrorMsg = `AI modeli (${finalModelToUse}) gelen yanıt beklenen şemayla uyuşmuyor (Admin Gördü): ${zodErrors.substring(0, 400)}`;
        } else if (promptError?.message?.includes('SAFETY') || promptError?.message?.includes('block_reason')) {
            simpleErrorMsg = `İçerik güvenlik filtrelerine takılmış olabilir (Admin Gördü). Model: ${finalModelToUse}. Detay: ${promptError.message.substring(0, 200)}`;
        }
      }


      const userVisibleMessage = enrichedInput.isAdmin 
        ? `AI Soru Çözücüsü (${finalModelToUse || 'belirlenemeyen'}) bir hata ile karşılaştı. Detay (Admin): ${simpleErrorMsg}`
        : `AI Soru Çözücü şu anda bir sorun yaşıyor gibi görünüyor. Lütfen biraz sonra tekrar deneyin veya farklı bir soru sormayı deneyin.`;

      return {
          solution: userVisibleMessage,
          relatedConcepts: enrichedInput.isAdmin ? ["Hata"] : [],
          examStrategyTips: [],
      };
    }
  }
);
    

    