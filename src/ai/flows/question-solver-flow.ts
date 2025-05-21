
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
  solution: z.string().describe('Sorunun YKS öğrencisinin anlayacağı dilde, adım adım çözümü ve kavramsal açıklaması.'),
  relatedConcepts: z.array(z.string()).optional().describe('Çözümle ilgili veya sorunun ait olduğu konudaki YKS için önemli 2-3 anahtar akademik kavram veya konu başlığı.'),
  examStrategyTips: z.array(z.string()).optional().describe("Bu tür soruları YKS'de çözerken kullanılabilecek stratejiler veya dikkat edilmesi gereken noktalar."),
});
export type SolveQuestionOutput = z.infer<typeof SolveQuestionOutputSchema>;

const defaultErrorOutput: SolveQuestionOutput = {
  solution: "Beklenmedik bir sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.",
  relatedConcepts: [],
  examStrategyTips: []
};

export async function solveQuestion(input: SolveQuestionInput): Promise<SolveQuestionOutput> {
  console.log("[SolveQuestion Action] Received input:", {
      hasQuestionText: !!input.questionText,
      hasImageDataUri: !!input.imageDataUri && input.imageDataUri.length > 30 ? input.imageDataUri.substring(0,30) + "..." : "No Image",
      userPlan: input.userPlan,
      customModelIdentifier: input.customModelIdentifier,
  });

  if (!input.questionText && !input.imageDataUri) {
    return {
      solution: "Lütfen çözülmesini istediğiniz bir soru metni girin veya bir görsel yükleyin.",
      relatedConcepts: [],
      examStrategyTips: [],
    };
  }

  try {
    const result = await questionSolverFlow(input);

    if (!result || typeof result.solution !== 'string' || !Array.isArray(result.relatedConcepts) || !Array.isArray(result.examStrategyTips)) {
      console.error("[SolveQuestion Action] Flow returned invalid, null, or malformed result. Raw result:", JSON.stringify(result).substring(0, 500));
      return {
        solution: "AI akışından geçersiz veya eksik bir yanıt alındı. Lütfen tekrar deneyin veya farklı bir soru sorun.",
        relatedConcepts: result?.relatedConcepts || ["Hata"],
        examStrategyTips: result?.examStrategyTips || ["Tekrar deneyin"],
      };
    }
    console.log("[SolveQuestion Action] Successfully received result from questionSolverFlow.");
    return result;
  } catch (error: any) {
    console.error("[SolveQuestion Action] CRITICAL error during server action execution (outer try-catch):", error);
    let errorMessage = 'Bilinmeyen bir sunucu hatası oluştu.';
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else {
        try {
            errorMessage = JSON.stringify(error).substring(0, 200);
        } catch (stringifyError) {
            errorMessage = 'Serileştirilemeyen sunucu hata nesnesi.';
        }
    }
    return {
      solution: `Sunucu tarafında kritik bir hata oluştu: ${errorMessage}.`,
      relatedConcepts: ["Kritik Hata"],
      examStrategyTips: ["Tekrar deneyin"],
    };
  }
}

const questionSolverPrompt = ai.definePrompt({
  name: 'questionSolverPrompt',
  input: {schema: SolveQuestionInputSchema.extend({
    isProUser: z.boolean().optional(),
    isPremiumUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
  })},
  output: {schema: SolveQuestionOutputSchema},
  prompt: `Sen, YKS (TYT–AYT) sınavına hazırlanan öğrencilere, tüm derslerde en karmaşık soruları bile temel prensiplerine indirgeyerek, adım adım, son derece anlaşılır, pedagojik değeri yüksek ve öğrenciyi düşündürmeye teşvik eden bir şekilde çözmede uzmanlaşmış, kıdemli bir AI YKS uzman öğretmenisin.
Amacın sadece doğru cevabı vermek değil, aynı zamanda sorunun çözüm mantığını, altında yatan temel prensipleri ve YKS'de sıkça sorulan püf noktalarını vurgulamaktır.
Matematiksel sembolleri (örn: x^2, H_2O, √, π, ±, ≤, ≥) metin içinde açıkça ve anlaşılır bir şekilde kullan. Denklemleri veya önemli ifadeleri yazarken Markdown formatlamasına (örn: \`denklem\` veya \`\`\` ile kod blokları) dikkat et ve doğru kapat.

Cevapların her zaman Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isCustomModelSelected}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' kullanılıyor.)
{{/if}}

{{#if isProUser}}
(Pro Kullanıcı Notu: Çözümlerini üst düzeyde akademik titizlikle sun. Varsa birden fazla çözüm yolunu kısaca belirt. Sorunun çözümünde kullanılan anahtar kavramları derinlemesine açıkla. Sorunun YKS'deki stratejik önemine değin.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: Daha derinlemesine açıklamalar yapmaya çalış, varsa alternatif çözüm yollarına kısaca değin.)
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

Lütfen bu soruyu/soruları analiz et ve aşağıdaki formatta, ÖĞRETİCİ ve ADIM ADIM bir yanıt hazırla:

Soru Analizi:
*   Sorunun hangi YKS dersi ve ana konusuna ait olduğunu KISACA belirt.
*   Çözüm için gerekli TEMEL BİLGİLERİ (ana formül veya kavram) listele.

Çözüm Yolu (Adım Adım):
*   Soruyu ana adımları mantığıyla birlikte, AÇIKLAYARAK çöz.
*   Her bir önemli matematiksel işlemi veya mantıksal çıkarımı net bir şekilde belirt.
*   {{#if isGemini25PreviewSelected}}
    (Gemini 2.5 Flash Preview 05-20 Notu: Çözümü ana adımları ve kilit mantıksal çıkarımları vurgulayarak, olabildiğince ÖZ ama ANLAŞILIR olmalıdır. Aşırı detaydan kaçın, doğrudan ve net bir çözüm sun. HIZLI YANIT VERMESİ ÖNEMLİDİR.)
    {{else}}
    Ayrıntılı ve SATIR SATIR açıkla.
    {{/if}}

Sonuç:
*   Elde edilen sonucu net bir şekilde belirt (örn: Cevap B).

Kavramlar (İsteğe Bağlı, 1-2 adet):
*   Çözümde kullanılan veya soruyla yakından ilişkili, YKS'de bilinmesi gereken 1-2 temel kavramı listele.

YKS Strateji İpucu (İsteğe Bağlı, 1 adet):
*   Bu tür sorularla ilgili 1 adet pratik YKS stratejisi veya ipucu ver.

Davranış Kuralları:
*   Eğer hem görsel hem de metin girdisi varsa, bunları birbiriyle ilişkili kabul et.
*   Girdi yetersiz, anlamsız veya YKS standartlarında çözülemeyecek kadar belirsizse, bunu net bir şekilde belirt. Örneğin, "Bu soruyu çözebilmek için daha fazla bilgiye/netliğe veya görseldeki ifadenin metin olarak yazılmasına ihtiyacım var." gibi bir geri bildirim ver. Kesin olmayan veya kalitesiz çözümler sunmaktan kaçın.
*   Yanıtını öğrencinin kolayca anlayabileceği, teşvik edici ve eğitici bir dille yaz.
`,
});

const questionSolverFlow = ai.defineFlow(
  {
    name: 'questionSolverFlow',
    inputSchema: SolveQuestionInputSchema,
    outputSchema: SolveQuestionOutputSchema,
  },
  async (input): Promise<SolveQuestionOutput> => {
    console.log("[QuestionSolver Flow] Flow started. Raw Input received:", {
      hasQuestionText: !!input.questionText,
      hasImageDataUri: !!input.imageDataUri && input.imageDataUri.length > 30 ? input.imageDataUri.substring(0,30) + "..." : "No Image",
      userPlan: input.userPlan,
      customModelIdentifier: input.customModelIdentifier
    });

    let modelToUse = ''; // Default will be set based on plan
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

    if (enrichedInput.customModelIdentifier) {
      console.log(`[QuestionSolver Flow] Admin attempting to use custom model: ${enrichedInput.customModelIdentifier}`);
      switch (enrichedInput.customModelIdentifier) {
        case 'default_gemini_flash': // This refers to Gemini 2.0 Flash
          modelToUse = 'googleai/gemini-2.0-flash';
          break;
        case 'experimental_gemini_1_5_flash':
          modelToUse = 'googleai/gemini-1.5-flash-latest';
          break;
        case 'experimental_gemini_2_5_flash_preview_05_20':
          modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
          break;
        default:
          console.warn(`[QuestionSolver Flow] Unknown customModelIdentifier: ${enrichedInput.customModelIdentifier}. Defaulting based on plan.`);
           if (enrichedInput.isProUser || enrichedInput.isPremiumUser) {
            modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
          } else { // Free user
            modelToUse = 'googleai/gemini-2.0-flash';
          }
          break;
      }
      console.log(`[QuestionSolver Flow] Admin selected model: ${modelToUse}`);
    } else { // No customModelIdentifier, use plan-based defaults
      if (enrichedInput.isProUser || enrichedInput.isPremiumUser) {
        modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
        console.log(`[QuestionSolver Flow] Pro/Premium user using model: ${modelToUse}`);
      } else { // Free user
        modelToUse = 'googleai/gemini-2.0-flash'; 
        console.log(`[QuestionSolver Flow] Free user using model: ${modelToUse}`);
      }
    }

    let callOptions: { model: string; config?: Record<string, any> } = { model: modelToUse };

    if (modelToUse === 'googleai/gemini-2.5-flash-preview-05_20') {
      callOptions.config = {}; // Gemini 2.5 Flash Preview might not need or support maxOutputTokens
      console.log(`[QuestionSolver Flow] NOT using generationConfig for preview model ${modelToUse}.`);
    } else {
       callOptions.config = {
        generationConfig: {
          maxOutputTokens: 4096, // Default for other models
        }
      };
      console.log(`[QuestionSolver Flow] Using generationConfig for model ${modelToUse}:`, callOptions.config);
    }
    
    console.log(`[QuestionSolver Flow] Calling prompt with model: ${callOptions.model} and options:`, JSON.stringify(callOptions.config));

    try {
      const { output } = await questionSolverPrompt(enrichedInput, callOptions);

      if (!output || typeof output.solution !== 'string') {
        console.error("[QuestionSolver Flow] AI did not produce a valid solution matching the schema. Output received:", JSON.stringify(output).substring(0,300)+"...");
        return {
            solution: `AI YKS Uzmanı (${modelToUse}), bu soru için bir çözüm ve detaylı açıklama üretemedi veya yanıt formatı beklenmedik. Lütfen girdilerinizi kontrol edin veya farklı bir soru deneyin. Model: ${modelToUse}`,
            relatedConcepts: output?.relatedConcepts || ["Yanıt Formatı Hatası"],
            examStrategyTips: output?.examStrategyTips || [],
        };
      }
      console.log("[QuestionSolver Flow] Successfully received solution from AI model.");
      return {
        solution: output.solution,
        relatedConcepts: output.relatedConcepts || [],
        examStrategyTips: output.examStrategyTips || [],
      };

    } catch (promptError: any) {
      console.error(`[QuestionSolver Flow] CRITICAL ERROR during prompt execution with model ${modelToUse}:`, promptError);
      let errorMessage = `AI modeli (${modelToUse}) ile iletişimde bir hata oluştu.`;
      if (promptError?.message) {
          if (promptError.message.includes('400 Bad Request') && (promptError.message.includes('generationConfig') || promptError.message.includes('generation_config'))) {
              errorMessage = `Seçilen model (${modelToUse}) bazı yapılandırma ayarlarını desteklemiyor olabilir. Model: ${modelToUse}. Detay: ${promptError.message.substring(0,150)}`;
          } else if (promptError.message.includes('SAFETY') || promptError.message.includes('block_reason')) {
              errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen sorunuzu gözden geçirin. Model: ${modelToUse}. Detay: ${promptError.message.substring(0,150)}`;
          } else if (promptError.message.includes('Must have a text part if there is a media part')) {
                errorMessage = `Görsel ile birlikte metin girmeniz gerekmektedir veya model bu tür bir girdiyi desteklemiyor. Model: ${modelToUse}. Detay: ${promptError.message.substring(0,150)}`;
          } else if (promptError.message.includes('500 Internal Server Error') || promptError.message.includes('internal error has occurred') || promptError.message.includes('Deadline exceeded') || promptError.message.includes('504 Gateway Timeout')) {
              errorMessage = `AI modeli (${modelToUse}) yanıt vermesi çok uzun sürdü veya dahili bir sunucu hatasıyla karşılaştı (örn: 504 Zaman Aşımı). Lütfen daha sonra tekrar deneyin veya farklı bir soru/model deneyin. Detay: ${promptError.message.substring(0,150)}`;
          } else if (promptError.name === 'GenkitError' && promptError.message.includes('Schema validation failed')){
              errorMessage = `AI modeli (${modelToUse}) beklenen yanıt şemasına uymayan bir çıktı üretti. Lütfen farklı bir soru deneyin veya modelin yanıtını kontrol edin. Detay: ${promptError.message.substring(0,150)}`;
          } else {
             errorMessage += ` Detay: ${promptError.message.substring(0,200)}`;
          }
      }
      return {
          solution: errorMessage,
          relatedConcepts: ["Model Hatası"],
          examStrategyTips: [],
      };
    }
  }
);
    

    
