
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
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı."),
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi (örn: 'default_gemini_flash', 'experimental_gemini_1_5_flash', 'experimental_gemini_2_5_flash_preview_05_20')."),
});
export type SolveQuestionInput = z.infer<typeof SolveQuestionInputSchema>;

const SolveQuestionOutputSchema = z.object({
  solution: z.string().describe('Sorunun YKS öğrencisinin anlayacağı dilde, adım adım çözümü ve kavramsal açıklaması. Eğer çözüm üretilemiyorsa, nedenini belirten bir mesaj içermelidir.'),
  relatedConcepts: z.array(z.string()).optional().describe('Çözümle ilgili veya sorunun ait olduğu konudaki YKS için önemli 2-3 anahtar akademik kavram veya konu başlığı. Boş olabilir.'),
  examStrategyTips: z.array(z.string()).optional().describe("Bu tür soruları YKS'de çözerken kullanılabilecek stratejiler veya dikkat edilmesi gereken noktalar. Boş olabilir."),
});
export type SolveQuestionOutput = z.infer<typeof SolveQuestionOutputSchema>;

export async function solveQuestion(input: SolveQuestionInput): Promise<SolveQuestionOutput> {
  console.log(`[Question Solver Action] Received input. User Plan: ${input.userPlan}, Admin Model ID (raw): '${input.customModelIdentifier}', HasText: ${!!input.questionText}, HasImage: ${!!input.imageDataUri}`);

  if (!input.questionText && !input.imageDataUri) {
    return {
      solution: "Lütfen çözülmesini istediğiniz bir soru metni girin veya bir görsel yükleyin.",
      relatedConcepts: [],
      examStrategyTips: [],
    };
  }
  
  let modelToUse: string;

  if (input.customModelIdentifier && typeof input.customModelIdentifier === 'string' && input.customModelIdentifier.trim() !== "") {
    const customIdLower = input.customModelIdentifier.toLowerCase().trim();
    console.log(`[Question Solver Action] Admin specified customModelIdentifier: '${customIdLower}'`);
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
            console.warn(`[Question Solver Action] Admin specified an UNKNOWN customModelIdentifier: '${input.customModelIdentifier}'. Falling back to universal default for ALL users.`);
            modelToUse = 'googleai/gemini-2.5-flash-preview-05-20'; 
        }
        break;
    }
  } else { 
    console.log(`[Question Solver Action] No custom model specified by admin. Falling back to universal default for ALL users.`);
    modelToUse = 'googleai/gemini-2.5-flash-preview-05-20'; // Universal default for all users
  }
  
  if (typeof modelToUse !== 'string' || !modelToUse.startsWith('googleai/')) { 
      console.error(`[Question Solver Action] CRITICAL FALLBACK: modelToUse was invalid ('${modelToUse}', type: ${typeof modelToUse}). Defaulting to googleai/gemini-2.0-flash.`);
      modelToUse = 'googleai/gemini-2.0-flash'; // Absolute fallback
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
  };

  try {
    const result = await questionSolverFlow(enrichedInput, modelToUse);

    if (!result || typeof result.solution !== 'string' || !Array.isArray(result.relatedConcepts) || !Array.isArray(result.examStrategyTips)) {
      const errorDetail = !result ? "AI akışından tanımsız yanıt alındı." : 
                          typeof result.solution !== 'string' ? "Çözüm metni (solution) eksik veya geçersiz." :
                          !Array.isArray(result.relatedConcepts) ? "İlgili kavramlar (relatedConcepts) bir dizi değil." :
                          !Array.isArray(result.examStrategyTips) ? "Sınav ipuçları (examStrategyTips) bir dizi değil." :
                          "Bilinmeyen yapısal hata.";
      console.error(`[Question Solver Action] Flow returned invalid, null, or malformed result. Model: ${modelToUse}. Details: ${errorDetail}. Raw result:`, JSON.stringify(result).substring(0, 500));
      return {
        solution: `AI akışından (${modelToUse}) geçersiz veya eksik bir yanıt alındı. ${errorDetail}. Lütfen tekrar deneyin veya farklı bir soru sorun.`,
        relatedConcepts: result?.relatedConcepts || ["Hata"],
        examStrategyTips: result?.examStrategyTips || ["Tekrar deneyin"],
      };
    }
    console.log("[Question Solver Action] Successfully received result from questionSolverFlow.");
    return result;
  } catch (error: any) {
    console.error("[Question Solver Action] CRITICAL error during server action execution (outer try-catch):", error);
    let errorMessage = 'Bilinmeyen bir sunucu hatası oluştu.';
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }
    return {
      solution: `Sunucu tarafında kritik bir hata oluştu (${modelToUse || 'belirlenemeyen model'}): ${errorMessage.substring(0,200)}.`,
      relatedConcepts: ["Kritik Hata"],
      examStrategyTips: ["Tekrar deneyin"],
    };
  }
}

const promptInputSchema = SolveQuestionInputSchema.extend({
    isProUser: z.boolean().optional(),
    isPremiumUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
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
{{#if isProUser}}
(Pro Kullanıcı Notu: Bu Pro seviyesindeki uzman çözüm, üyeliğinizin özel bir avantajıdır. Çözümlerini üst düzeyde akademik titizlikle sun. Varsa birden fazla çözüm yolunu kısaca belirt. Sorunun çözümünde kullanılan anahtar kavramları derinlemesine açıkla. Bu tür sorularla ilgili YKS'de karşılaşılabilecek farklı varyasyonlara ve genel sınav stratejilerine (örn: zaman yönetimi, eleme teknikleri) değin. Sorunun YKS'deki stratejik önemine vurgu yap.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: Daha derinlemesine açıklamalar yapmaya çalış. Varsa alternatif çözüm yollarına kısaca değin. Sorunun çözümünde kullanılan temel prensipleri ve 1-2 önemli YKS ipucunu belirt.)
{{else}}
(Ücretsiz Kullanıcı Notu: Soruyu adım adım ve anlaşılır bir şekilde çöz. Temel kavramlara değin. Çözümde 1 genel YKS ipucu ver.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' seçildi.)
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
Eğer soru çözülemiyorsa veya girdi yetersizse, "solution" alanına nedenini açıklayan bir mesaj yaz ve diğer alanları boş dizi ([]) olarak bırak. ASLA null veya tanımsız bir yanıt döndürme.

İstenen Çıktı Bölümleri (bu JSON formatına uy):
1.  **solution (string, zorunlu)**:
    *   Sorunun hangi YKS dersi ve ana konusuna ait olduğunu KISACA belirt.
    *   Çözüm için gerekli TEMEL BİLGİLERİ (ana formül veya kavram) listele.
    *   Soruyu ana adımları mantığıyla birlikte, AÇIKLAYARAK çöz.
    *   Her bir önemli matematiksel işlemi veya mantıksal çıkarımı net bir şekilde belirt.
    *   Elde edilen sonucu net bir şekilde belirt (örn: Cevap B).
    *   Eğer girdi yetersiz, anlamsız veya YKS standartlarında çözülemeyecek kadar belirsizse, bu alana "Bu soruyu çözebilmek için daha fazla bilgiye/netliğe veya görseldeki ifadenin metin olarak yazılmasına ihtiyacım var." gibi bir geri bildirim yaz.
2.  **relatedConcepts (string dizisi, isteğe bağlı, boş olabilir)**:
    *   Çözümde kullanılan veya soruyla yakından ilişkili, YKS'de bilinmesi gereken temel kavramları LİSTELE.
3.  **examStrategyTips (string dizisi, isteğe bağlı, boş olabilir)**:
    *   Bu tür sorularla ilgili pratik YKS stratejileri veya ipuçlarını LİSTELE.

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
    console.log(`[Question Solver Flow] Initial modelToUseParam: '${finalModelToUse}', type: ${typeof finalModelToUse}`);

    if (typeof finalModelToUse !== 'string' || !finalModelToUse.startsWith('googleai/')) {
        const fallbackModel = enrichedInput.isProUser || enrichedInput.isPremiumUser ? 'googleai/gemini-2.5-flash-preview-05-20' : 'googleai/gemini-2.0-flash';
        console.warn(`[Question Solver Flow] Invalid or non-string modelToUseParam ('${finalModelToUse}', type: ${typeof finalModelToUse}) received in flow. Defaulting to ${fallbackModel} based on plan.`);
        finalModelToUse = fallbackModel;
    }
    console.log(`[Question Solver Flow] Corrected/Final model INSIDE FLOW to: ${finalModelToUse}`);
    
    const standardTemperature = 0.5; 
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
    console.log(`[Question Solver Flow] Calling prompt with model: ${finalModelToUse} and options:`, JSON.stringify(callOptions.config), `for plan: ${enrichedInput.userPlan}, customModel (raw): ${enrichedInput.customModelIdentifier}`);

    try {
      const { output } = await questionSolverPrompt(promptInputForLog, callOptions);

      if (!output) {
        console.error(`[Question Solver Flow] AI returned null output. Model: ${finalModelToUse}. Input text: ${enrichedInput.questionText?.substring(0,100)}, Image provided: ${!!enrichedInput.imageDataUri}`);
        return {
            solution: `AI YKS Uzmanı (${finalModelToUse}) bu soru için bir çözüm üretemedi (null yanıt). Lütfen girdilerinizi kontrol edin veya farklı bir soru deneyin.`,
            relatedConcepts: ["Yanıt Yok Hatası"],
            examStrategyTips: [],
        };
      }
      if (typeof output.solution !== 'string' || !Array.isArray(output.relatedConcepts) || !Array.isArray(output.examStrategyTips)) {
        console.error(`[Question Solver Flow] AI did not produce a valid output matching the schema. Model: ${finalModelToUse}. Output received:`, JSON.stringify(output).substring(0,300)+"...");
        return {
            solution: `AI YKS Uzmanı (${finalModelToUse}), bu soru için beklenen formatta bir çözüm üretemedi. Yanıt formatı hatalı. Lütfen girdilerinizi kontrol edin veya farklı bir soru deneyin.`,
            relatedConcepts: output?.relatedConcepts || ["Yanıt Formatı Hatası"],
            examStrategyTips: output?.examStrategyTips || [],
        };
      }
      console.log("[Question Solver Flow] Successfully received solution from AI model.");
      return {
        solution: output.solution,
        relatedConcepts: output.relatedConcepts || [], // Ensure arrays even if undefined
        examStrategyTips: output.examStrategyTips || [], // Ensure arrays even if undefined
      };

    } catch (promptError: any) {
      console.error(`[Question Solver Flow] CRITICAL ERROR during prompt execution with model ${finalModelToUse}. Error details:`, JSON.stringify(promptError, Object.getOwnPropertyNames(promptError), 2));
      
      let errorMessage = `AI modeli (${finalModelToUse}) ile iletişimde bir hata oluştu.`;
      if (promptError?.message) {
          if (promptError.message.includes('400 Bad Request') && (promptError.message.includes('generationConfig') || promptError.message.includes('generation_config'))) {
              errorMessage = `Seçilen model (${finalModelToUse}) bazı yapılandırma ayarlarını desteklemiyor olabilir. Detay: ${promptError.message.substring(0,150)}`;
          } else if (promptError.message.includes('SAFETY') || promptError.message.includes('block_reason') || (promptError.cause as any)?.message?.includes('SAFETY')) {
              errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen sorunuzu gözden geçirin. Model: ${finalModelToUse}. Detay: ${promptError.message.substring(0,150)}`;
          } else if (promptError.message.includes('Must have a text part if there is a media part')) {
                errorMessage = `Görsel ile birlikte metin girmeniz gerekmektedir veya model (${finalModelToUse}) bu tür bir girdiyi desteklemiyor. Detay: ${promptError.message.substring(0,150)}`;
          } else if (promptError.message.includes('500 Internal Server Error') || promptError.message.includes('internal error has occurred') || promptError.message.includes('Deadline exceeded') || promptError.message.includes('504 Gateway Timeout')) {
              errorMessage = `AI modeli (${finalModelToUse}) yanıt vermesi çok uzun sürdü veya dahili bir sunucu hatasıyla karşılaştı. Lütfen daha sonra tekrar deneyin veya farklı bir soru/model deneyin. Detay: ${promptError.message.substring(0,150)}`;
          } else if (promptError.name === 'GenkitError' && promptError.message.includes('Schema validation failed')){
              let zodErrorDetails = "";
              if (promptError.details && Array.isArray(promptError.details)) {
                zodErrorDetails = promptError.details.map((d: any) => `[${d.path?.join('.') || 'root'}]: ${d.message}`).join('; ');
              }
              errorMessage = `AI modeli (${finalModelToUse}) beklenen yanıt şemasına uymayan bir çıktı üretti (Schema validation failed). Detay: ${zodErrorDetails || promptError.message.substring(0,350)}.`;
          } else {
             errorMessage += ` Detay: ${promptError.message.substring(0,300)}`;
          }
      } else if (typeof promptError === 'string') {
        errorMessage += ` Detay: ${promptError.substring(0,300)}`;
      }

      return {
          solution: errorMessage,
          relatedConcepts: ["Model Hatası"],
          examStrategyTips: [],
      };
    }
  }
);
    

    