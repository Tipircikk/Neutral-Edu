
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
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi (örn: 'default_gemini_flash', 'experimental_gemini_1_5_flash', 'experimental_gemini_2_5_flash_preview')."),
  // Boolean flags for Handlebars
  isProUser: z.boolean().optional(),
  isPremiumUser: z.boolean().optional(),
  isGemini25PreviewSelected: z.boolean().optional(),
  isCustomModelSelected: z.boolean().optional(),
});
export type SolveQuestionInput = z.infer<typeof SolveQuestionInputSchema>;

const SolveQuestionOutputSchema = z.object({
  solution: z.string().describe('Sorunun YKS öğrencisinin anlayacağı dilde, adım adım çözümü ve kavramsal açıklaması.'),
  relatedConcepts: z.array(z.string()).optional().describe('Çözümle ilgili veya sorunun ait olduğu konudaki YKS için önemli 2-3 anahtar akademik kavram veya konu başlığı.'),
  examStrategyTips: z.array(z.string()).optional().describe("Bu tür soruları YKS'de çözerken kullanılabilecek stratejiler veya dikkat edilmesi gereken noktalar."),
});
export type SolveQuestionOutput = z.infer<typeof SolveQuestionOutputSchema>;

// This wrapper function is called by the client (Server Action)
export async function solveQuestion(input: SolveQuestionInput): Promise<SolveQuestionOutput> {
  console.log("[SolveQuestion Action] Received input:", {
      hasQuestionText: !!input.questionText,
      hasImageDataUri: !!input.imageDataUri && input.imageDataUri.length > 30 ? input.imageDataUri.substring(0,30) + "..." : "No Image",
      userPlan: input.userPlan,
      customModelIdentifier: input.customModelIdentifier,
  });

  try {
    const result = await questionSolverFlow(input);

    // Robust check for valid result structure
    if (!result || typeof result.solution !== 'string' || !result.relatedConcepts || !Array.isArray(result.relatedConcepts) || !result.examStrategyTips || !Array.isArray(result.examStrategyTips)) {
      console.error("[SolveQuestion Action] Flow returned invalid, null, or malformed result:", JSON.stringify(result).substring(0, 500));
      return {
        solution: "AI akışından geçersiz veya eksik bir yanıt alındı. Lütfen tekrar deneyin veya farklı bir soru sorun.",
        relatedConcepts: ["Hata"],
        examStrategyTips: ["Tekrar deneyin"],
      };
    }

    console.log("[SolveQuestion Action] Successfully received result from questionSolverFlow.");
    return result;
  } catch (error: any) {
    console.error("[SolveQuestion Action] CRITICAL error during server action execution:", error);
    
    let errorMessage = 'Bilinmeyen bir sunucu hatası oluştu.';
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else {
        try {
            errorMessage = JSON.stringify(error).substring(0, 200); // Limit error message length
        } catch (stringifyError) {
            errorMessage = 'Serileştirilemeyen sunucu hata nesnesi.';
        }
    }
    
    return {
      solution: `Sunucu tarafında kritik bir hata oluştu: ${errorMessage}. Geliştirici konsolunu kontrol edin.`,
      relatedConcepts: ["Kritik Hata"],
      examStrategyTips: ["Tekrar deneyin"],
    };
  }
}

// prompt definition
const questionSolverPrompt = ai.definePrompt({
  name: 'questionSolverPrompt',
  input: {schema: SolveQuestionInputSchema},
  output: {schema: SolveQuestionOutputSchema},
  prompt: `Sen, YKS (TYT–AYT) sınavına hazırlanan öğrencilere rehberlik eden uzman bir AI öğretmensin. Her soruda sadece doğru cevabı vermekle kalmaz, öğrenciyi adım adım, temel kavramlarla ve mantıksal açıklamalarla yönlendirirsin.

Her çözüm şu formatta verilir:

Soru Analizi:
- Hangi dersten, hangi konudan?
- Gerekli temel bilgi/formül nedir?

Çözüm Yolu (Adım Adım):
- Her adım mantığıyla açıklanır.
- Gereksiz detay verilmez, öz ama öğretici olunur.

Sonuç:
- Net cevap belirtilir (örn. Cevap B).

Kavramlar (İsteğe Bağlı):
- Soruyla ilgili 1-2 önemli YKS kavramı.

YKS Strateji İpucu (İsteğe Bağlı):
- Bu tarz sorularda işe yarayan kısa bir taktik.

Kurallar:
- Görsel varsa, metinle birlikte analiz edilir.
- Bilgi eksikse varsayım yapılmaz, ek bilgi istenir.
- Anlatım açık, motive edici ve pedagojik olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isCustomModelSelected}}
Kullanıcının seçtiği özel model: {{{customModelIdentifier}}}.
(Admin Notu: Bu çözüm, özel olarak seçilmiş '{{{customModelIdentifier}}}' modeli kullanılarak üretilmektedir.)
  {{#if isGemini25PreviewSelected}}
  ÖZEL NOT (Gemini 2.5 Flash Preview için): Çözümü ana adımları ve kilit mantıksal çıkarımları vurgulayarak, olabildiğince ÖZ ama ANLAŞILIR olmalıdır. Aşırı detaydan kaçın, doğrudan ve net bir çözüm sun. HIZLI YANIT VERMESİ ÖNEMLİDİR.
  {{/if}}
{{/if}}

{{#if isProUser}}
(Pro Kullanıcı Notu: Çözümlerini üst düzeyde akademik titizlikle sun. Varsa birden fazla çözüm yolunu kısaca belirt. Sorunun çözümünde kullanılan anahtar kavramları detaylıca açıkla. Sorunun YKS'deki stratejik önemine değin.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: Daha derinlemesine açıklamalar yapmaya çalış, varsa alternatif çözüm yollarına kısaca değin.)
{{/if}}

Kullanıcının girdileri aşağıdadır:
{{#if imageDataUri}}
Görsel Soru Kaynağı:
{{media url=imageDataUri}}
{{/if}}
{{#if questionText}}
Metinsel Soru/Açıklama:
{{{questionText}}}
{{/if}}

Lütfen yukarıdaki girdilere ve formatlama kurallarına göre bir çözüm üret.
`,
});

const questionSolverFlow = ai.defineFlow(
  {
    name: 'questionSolverFlow',
    inputSchema: SolveQuestionInputSchema,
    outputSchema: SolveQuestionOutputSchema,
  },
  async (rawInput): Promise<SolveQuestionOutput> => {
    console.log("[QuestionSolver Flow] Flow started. Raw Input received:", {
      hasQuestionText: !!rawInput.questionText,
      hasImageDataUri: !!rawInput.imageDataUri && rawInput.imageDataUri.length > 30 ? rawInput.imageDataUri.substring(0,30) + "..." : "No Image",
      userPlan: rawInput.userPlan,
      customModelIdentifier: rawInput.customModelIdentifier
    });

    const input: SolveQuestionInput = {
      ...rawInput,
      isProUser: rawInput.userPlan === 'pro',
      isPremiumUser: rawInput.userPlan === 'premium',
      isGemini25PreviewSelected: rawInput.customModelIdentifier === 'experimental_gemini_2_5_flash_preview',
      isCustomModelSelected: !!rawInput.customModelIdentifier,
    };

    if (!input.questionText && !input.imageDataUri) {
      console.warn("[QuestionSolver Flow] No question text or image data provided by user.");
      return {
        solution: "Soru çözmek için lütfen bir metin girin veya bir görsel yükleyin.",
        relatedConcepts: [],
        examStrategyTips: [],
      };
    }
    
    let modelToUse = 'googleai/gemini-1.5-flash-latest'; // Varsayılan
    let callOptions: { model: string; config?: Record<string, any> } = { model: modelToUse };

    if (input.customModelIdentifier && input.isProUser) { 
      console.log(`[QuestionSolver Flow] Admin attempting to use custom model: ${input.customModelIdentifier}`);
      if (input.customModelIdentifier === 'default_gemini_flash') {
        modelToUse = 'googleai/gemini-2.0-flash';
      } else if (input.customModelIdentifier === 'experimental_gemini_1_5_flash') {
           modelToUse = 'googleai/gemini-1.5-flash-latest'; 
      } else if (input.customModelIdentifier === 'experimental_gemini_2_5_flash_preview') {
          modelToUse = 'googleai/gemini-2.5-flash-preview-04-17';
      }
      callOptions.model = modelToUse;
      console.log(`[QuestionSolver Flow] Admin selected model: ${modelToUse}`);
    } else if (input.isProUser) {
      modelToUse = 'googleai/gemini-1.5-flash-latest'; 
      callOptions.model = modelToUse;
      console.log(`[QuestionSolver Flow] Pro user using model: ${modelToUse}`);
    } else {
      modelToUse = 'googleai/gemini-1.5-flash-latest'; // Free/Premium için varsayılan
      callOptions.model = modelToUse;
      console.log(`[QuestionSolver Flow] Free/Premium user using model: ${modelToUse}`);
    }
    
    // Sadece gemini-2.5-flash-preview-04-17 modeli için generationConfig gönderme
    if (modelToUse !== 'googleai/gemini-2.5-flash-preview-04-17') {
      callOptions.config = {
        generationConfig: {
          maxOutputTokens: 4096, 
        }
      };
      console.log(`[QuestionSolver Flow] Using generationConfig for model ${modelToUse}:`, callOptions.config);
    } else {
      callOptions.config = {}; // Preview modeli için boş config
      console.log(`[QuestionSolver Flow] NOT using generationConfig for preview model ${modelToUse}.`);
    }

    console.log(`[QuestionSolver Flow] Calling Google prompt with model: ${callOptions.model} and options:`, callOptions);
    
    try {
      const { output } = await questionSolverPrompt(input, callOptions); 
      
      if (!output || typeof output.solution !== 'string') {
        console.error("[QuestionSolver Flow] AI (Google model) did not produce a valid solution matching the schema. Output received:", JSON.stringify(output).substring(0,300)+"...");
        return {
            solution: `AI YKS Uzmanı (${modelToUse}), bu soru için bir çözüm ve detaylı açıklama üretemedi veya yanıt formatı beklenmedik. Lütfen girdilerinizi kontrol edin veya farklı bir soru deneyin. Model: ${modelToUse}`,
            relatedConcepts: output?.relatedConcepts || ["Yanıt Formatı Hatası"],
            examStrategyTips: output?.examStrategyTips || [],
        };
      }
      console.log("[QuestionSolver Flow] Successfully received solution from Google model.");
      return {
        solution: output.solution,
        relatedConcepts: output.relatedConcepts || [],
        examStrategyTips: output.examStrategyTips || [],
      };

    } catch (promptError: any) {
      console.error(`[QuestionSolver Flow] Error during prompt execution with model ${modelToUse}:`, promptError);
      let errorMessage = `AI modeli (${modelToUse}) ile iletişimde bir hata oluştu.`;
      if (promptError?.message) {
          errorMessage += ` Detay: ${promptError.message}`;
          if (promptError.message.includes('SAFETY') || promptError.message.includes('block_reason')) {
              errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen sorunuzu gözden geçirin. Model: ${modelToUse}. Detay: ${promptError.message}`;
          } else if (promptError.message.includes('400 Bad Request') && (promptError.message.includes('generationConfig') || promptError.message.includes('generation_config'))) {
              errorMessage = `Seçilen model (${modelToUse}) bazı yapılandırma ayarlarını desteklemiyor olabilir. Geliştiriciye bildirin. Detay: ${promptError.message}`;
          } else if (promptError.message.includes('Must have a text part if there is a media part')) {
                errorMessage = `Görsel ile birlikte metin girmeniz gerekmektedir veya model bu tür bir girdiyi desteklemiyor. Model: ${modelToUse}. Detay: ${promptError.message}`;
          } else if (promptError.message.includes('500 Internal Server Error') || promptError.message.includes('internal error has occurred')) {
              errorMessage = `AI modeli (${modelToUse}) dahili bir sunucu hatasıyla karşılaştı. Lütfen daha sonra tekrar deneyin veya farklı bir soru/model deneyin. Detay: ${promptError.message}`;
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
