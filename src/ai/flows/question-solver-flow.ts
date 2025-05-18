
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

export async function solveQuestion(input: SolveQuestionInput): Promise<SolveQuestionOutput> {
  console.log("[SolveQuestion Action] Received input:", {
      hasQuestionText: !!input.questionText,
      hasImageDataUri: !!input.imageDataUri && input.imageDataUri.length > 30 ? input.imageDataUri.substring(0,30) + "..." : "No Image",
      userPlan: input.userPlan,
      customModelIdentifier: input.customModelIdentifier,
  });

  try {
    const result = await questionSolverFlow(input);

    if (!result || typeof result.solution !== 'string' || !result.relatedConcepts || !Array.isArray(result.relatedConcepts) || !result.examStrategyTips || !Array.isArray(result.examStrategyTips)) {
      console.error("[SolveQuestion Action] Flow returned invalid, null, or malformed result. Raw result:", JSON.stringify(result).substring(0, 500));
      return {
        solution: "AI akışından geçersiz veya eksik bir yanıt alındı. Lütfen tekrar deneyin veya farklı bir soru sorun. Eğer sorun devam ederse, geliştirici konsolunu kontrol edin.",
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
            errorMessage = JSON.stringify(error).substring(0, 200); 
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

const questionSolverPrompt = ai.definePrompt({
  name: 'questionSolverPrompt',
  input: {schema: SolveQuestionInputSchema},
  output: {schema: SolveQuestionOutputSchema},
  prompt: `Sen, YKS (TYT–AYT) sınavına hazırlanan öğrencilere, tüm derslerde (Matematik, Geometri, Fizik, Kimya, Biyoloji, Türkçe, Edebiyat, Tarih, Coğrafya, Felsefe vb.) en karmaşık soruları bile temel prensiplerine indirgeyerek, adım adım, son derece anlaşılır, pedagojik değeri yüksek ve öğrenciyi düşündürmeye teşvik eden bir şekilde çözmede uzmanlaşmış, YKS hazırlık sürecinin inceliklerine hakim, deneyimli ve kıdemli bir AI YKS uzman öğretmenisin.
Amacın sadece doğru cevabı vermek değil, aynı zamanda sorunun çözüm mantığını, altında yatan temel prensipleri ve YKS'de sıkça sorulan püf noktalarını vurgulamaktır. Çözümün her bir aşaması, kullanılan formüller, yapılan mantıksal çıkarımlar, nedenleriyle birlikte, sanki karşında bir öğrenci varmış ve ona konuyu öğretiyormuşsun gibi bir üslupla, SATIR SATIR açıklanmalıdır.

Matematiksel sembolleri (örneğin, üslü ifadeler için x^2, alt indisler için H_2O, karekök için √, pi için π vb.) metin içinde açıkça ve anlaşılır bir şekilde kullanmaya özen göster. Denklemleri veya önemli ifadeleri yazarken lütfen Markdown formatlamasına (örneğin, tek backtick \`denklem\` veya üçlü backtick ile kod blokları) dikkat et ve formatlamayı doğru bir şekilde kapatın.

Her çözüm şu genel formatta verilir:

## Soru Analizi
*   Sorunun hangi YKS dersi ve ana konusuna ait olduğunu KISACA belirt.
*   Çözüm için gerekli TEMEL BİLGİLERİ (ana formül veya kavram) listele.

## Çözüm Yolu (Adım Adım)
*   Soruyu ana adımları mantığıyla birlikte, AÇIKLAYARAK çöz.
*   Her bir önemli matematiksel işlemi veya mantıksal çıkarımı net bir şekilde belirt.
*   Gereksiz detay verilmez, öz ama öğretici olunur.

## Sonuç
*   Elde edilen sonucu net bir şekilde belirt (örn: Cevap B).

## Kavramlar (İsteğe Bağlı, 1-2 adet)
*   Çözümde kullanılan veya soruyla yakından ilişkili, YKS'de bilinmesi gereken 1-2 temel kavramı listele.

## YKS Strateji İpucu (İsteğe Bağlı, 1 adet)
*   Bu tür sorularla ilgili 1 adet pratik YKS stratejisi veya ipucu ver.

Davranış Kuralları:
*   Eğer hem görsel hem de metin girdisi varsa, bunların birbiriyle %100 ilişkili olduğunu ve bir bütünün parçaları olduğunu varsay. Görseldeki soruyu tanımla, metinle birleştir ve bu bütünleşik girdiye dayanarak kapsamlı bir yanıt oluştur.
*   Eğer girdi yetersiz, anlamsız veya YKS standartlarında çözülemeyecek kadar belirsizse, bunu net bir şekilde belirt. Örneğin, "Bu soruyu çözebilmek için daha fazla bilgiye/netliğe veya görseldeki ifadenin metin olarak yazılmasına ihtiyacım var." gibi bir geri bildirim ver. Kesin olmayan veya kalitesiz çözümler sunmaktan kaçın.
*   Yanıtını öğrencinin kolayca anlayabileceği, teşvik edici ve eğitici bir dille yaz.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isCustomModelSelected}}
Kullanıcının seçtiği özel model: {{{customModelIdentifier}}}.
(Admin Notu: Bu çözüm, özel olarak seçilmiş '{{{customModelIdentifier}}}' modeli kullanılarak üretilmektedir.)
  {{#if isGemini25PreviewSelected}}
  ÖZEL NOT (Gemini 2.5 Flash Preview için): Çözümü ana adımları ve kilit mantıksal çıkarımları vurgulayarak, olabildiğince ÖZ ama ANLAŞILIR olmalıdır. Aşırı detaydan kaçın, doğrudan ve net bir çözüm sun. HIZLI YANIT VERMESİ ÖNEMLİDİR.
  {{/if}}
{{/if}}

{{#if isProUser}}
(Pro Kullanıcı Notu: Çözümlerini üst düzeyde akademik titizlikle sun. Varsa birden fazla çözüm yolunu (avantaj ve dezavantajlarıyla birlikte) kısaca belirt. Sorunun çözümünde kullanılan anahtar kavramları derinlemesine açıkla. Sorunun YKS'deki stratejik önemini ve bu soru tipinin öğrenciye ne öğrettiğini tartış.)
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

Lütfen yukarıdaki girdilere ve formatlama kurallarına göre bir çözüm üret. Çözümün olabildiğince açık ve anlaşılır olmasına, ancak gereksiz yere aşırı uzun olmamasına özen göster.
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
    
    let modelToUse = 'googleai/gemini-1.5-flash-latest'; 
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
      // Free/Premium users
      modelToUse = 'googleai/gemini-1.5-flash-latest'; // Default to newer flash for better base experience
      callOptions.model = modelToUse;
      console.log(`[QuestionSolver Flow] Free/Premium user using model: ${modelToUse}`);
    }
    
    if (modelToUse !== 'googleai/gemini-2.5-flash-preview-04-17') {
      callOptions.config = {
        generationConfig: {
          maxOutputTokens: 4096, 
        }
      };
      console.log(`[QuestionSolver Flow] Using generationConfig for model ${modelToUse}:`, callOptions.config);
    } else {
      callOptions.config = {}; // No specific config for preview model to avoid errors
      console.log(`[QuestionSolver Flow] NOT using generationConfig for preview model ${modelToUse}.`);
    }

    console.log(`[QuestionSolver Flow] Calling Google prompt with model: ${callOptions.model} and options:`, JSON.stringify(callOptions.config));
    
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
      console.error(`[QuestionSolver Flow] CRITICAL ERROR during prompt execution with model ${modelToUse}:`, promptError);
      let errorMessage = `AI modeli (${modelToUse}) ile iletişimde kritik bir hata oluştu. Lütfen bir süre sonra tekrar deneyin.`;
      if (promptError?.message) {
          errorMessage += ` Detay: ${promptError.message}`;
          if (promptError.message.includes('SAFETY') || promptError.message.includes('block_reason')) {
              errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen sorunuzu gözden geçirin. Model: ${modelToUse}. Detay: ${promptError.message}`;
          } else if (promptError.message.includes('400 Bad Request') && (promptError.message.includes('generationConfig') || promptError.message.includes('generation_config'))) {
              errorMessage = `Seçilen model (${modelToUse}) bazı yapılandırma ayarlarını desteklemiyor olabilir. Geliştiriciye bildirin. Detay: ${promptError.message}`;
          } else if (promptError.message.includes('Must have a text part if there is a media part')) {
                errorMessage = `Görsel ile birlikte metin girmeniz gerekmektedir veya model bu tür bir girdiyi desteklemiyor. Model: ${modelToUse}. Detay: ${promptError.message}`;
          } else if (promptError.message.includes('500 Internal Server Error') || promptError.message.includes('internal error has occurred') || promptError.message.includes('Deadline exceeded')) {
              errorMessage = `AI modeli (${modelToUse}) dahili bir sunucu hatasıyla karşılaştı veya yanıt vermesi çok uzun sürdü. Lütfen daha sonra tekrar deneyin veya farklı bir soru/model deneyin. Detay: ${promptError.message}`;
          } else if (promptError.message.includes('504 Gateway Timeout')) {
             errorMessage = `AI modelinden (${modelToUse}) yanıt alınamadı (Zaman Aşımı). Soru çok karmaşık olabilir veya API geçici olarak yoğun olabilir. Lütfen daha basit bir soru deneyin veya daha sonra tekrar gelin. Detay: ${promptError.message}`;
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
