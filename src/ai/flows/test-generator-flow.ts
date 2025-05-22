
'use server';
/**
 * @fileOverview YKS'ye hazırlanan öğrenciler için belirli bir konu hakkında, seçilen zorluk seviyesine ve soru sayısına göre
 * AI destekli son derece kaliteli ve YKS formatına uygun deneme testleri oluşturan uzman bir eğitim materyali geliştiricisi.
 *
 * - generateTest - Kullanıcının belirttiği konu, soru sayısı ve zorluk seviyesine göre test oluşturma işlemini yöneten fonksiyon.
 * - GenerateTestInput - generateTest fonksiyonu için giriş tipi.
 * - GenerateTestOutput - generateTest fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { UserProfile } from '@/types';

const GenerateTestInputSchema = z.object({
  topic: z.string().describe('Testin oluşturulacağı ana YKS konusu, alt başlığı veya ders materyali özeti. (Örn: "Trigonometri - Yarım Açı Formülleri", "Tanzimat Edebiyatı Romanı", "Hücre Organelleri ve Görevleri")'),
  numQuestions: z.number().min(3).max(20).default(5).describe('Testte olması istenen soru sayısı (YKS\'deki gibi genellikle çoktan seçmeli).'),
  questionTypes: z.array(z.enum(["multiple_choice", "true_false", "short_answer"])).optional().default(["multiple_choice"]).describe("İstenen soru tipleri. YKS formatı için 'multiple_choice' ağırlıklı olmalıdır."),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium").describe("Testin YKS'ye göre zorluk seviyesi: 'easy' (temel bilgi ve hatırlama), 'medium' (anlama, yorumlama, uygulama), 'hard' (analiz, sentez, ileri düzey problem çözme)."),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı."),
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi."),
});
export type GenerateTestInput = z.infer<typeof GenerateTestInputSchema>;

const QuestionSchema = z.object({
    questionText: z.string().describe("Sorunun YKS standartlarında, açık ve net ifade edilmiş metni. Soru, kesin ve tek bir doğru cevaba sahip olmalıdır."),
    questionType: z.enum(["multiple_choice", "true_false", "short_answer"]).describe("Sorunun tipi. YKS için 'multiple_choice' olmalı."),
    options: z.array(z.string()).optional().describe("Çoktan seçmeli sorular için 5 adet seçenek (A, B, C, D, E). Seçenekler mantıklı ve güçlü çeldiriciler içermeli. Sadece bir seçenek kesin doğru olmalı."),
    correctAnswer: z.string().describe("Sorunun doğru cevabı (Örn: 'A', 'Doğru', 'Fotosentez'). Çoktan seçmelide sadece seçenek harfi (A, B, C, D, E)."),
    explanation: z.string().optional().describe("Doğru cevabın neden doğru olduğuna ve diğer DÖRT seçeneğin neden yanlış olduğuna dair YKS öğrencisinin anlayacağı dilde, öğretici ve son derece detaylı bir açıklama. Açıklama, her bir adımı ve mantığı içermelidir."),
});
export type QuestionSchema = z.infer<typeof QuestionSchema>;

const GenerateTestOutputSchema = z.object({
  testTitle: z.string().describe("Oluşturulan test için konuyla ilgili, YKS'ye uygun başlık (örn: '{{{topic}}} YKS Deneme Sınavı', '{{{topic}}} İleri Seviye Testi')."),
  questions: z.array(QuestionSchema).describe('Oluşturulan YKS formatındaki test soruları listesi.'),
});
export type GenerateTestOutput = z.infer<typeof GenerateTestOutputSchema>;

export async function generateTest(input: GenerateTestInput): Promise<GenerateTestOutput> {
  console.log(`[Test Generator Action] Received input. User Plan: ${input.userPlan}, Admin Model ID: '${input.customModelIdentifier}'`);

  let modelToUse: string;

  if (input.customModelIdentifier && typeof input.customModelIdentifier === 'string' && input.customModelIdentifier.trim() !== "") {
    const customIdLower = input.customModelIdentifier.toLowerCase().trim();
    console.log(`[Test Generator Action] Admin specified customModelIdentifier: '${customIdLower}'`);
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
            console.warn(`[Test Generator Action] Admin specified a direct Genkit model name: '${modelToUse}'. Ensure this model is supported.`);
        } else {
            console.warn(`[Test Generator Action] Admin specified an UNKNOWN customModelIdentifier: '${input.customModelIdentifier}'. Falling back to universal default.`);
            modelToUse = 'googleai/gemini-2.5-flash-preview-05-20'; // Universal default
        }
        break;
    }
  } else { 
    console.log(`[Test Generator Action] No custom model specified by admin. Using universal default.`);
    modelToUse = 'googleai/gemini-2.5-flash-preview-05-20'; // Universal default
  }
  
  // Absolute fallback if modelToUse is somehow still invalid
  if (typeof modelToUse !== 'string' || !modelToUse.startsWith('googleai/')) { 
      console.error(`[Test Generator Action] CRITICAL FALLBACK: modelToUse was invalid ('${modelToUse}', type: ${typeof modelToUse}). Defaulting to gemini-2.5-flash-preview-05-20.`);
      modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
  }
  console.log(`[Test Generator Action] Final model determined for flow: ${modelToUse}`);
  
  const isProUser = input.userPlan === 'pro';
  const isPremiumUser = input.userPlan === 'premium';
  const isGemini25PreviewSelected = modelToUse === 'googleai/gemini-2.5-flash-preview-05-20';

  const enrichedInput = {
      ...input,
      questionTypes: ["multiple_choice"] as Array<"multiple_choice" | "true_false" | "short_answer">, 
      isProUser,
      isPremiumUser,
      isCustomModelSelected: !!input.customModelIdentifier,
      isGemini25PreviewSelected,
    };
  return testGeneratorFlow(enrichedInput, modelToUse);
}

const promptInputSchema = GenerateTestInputSchema.extend({
    isProUser: z.boolean().optional(),
    isPremiumUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
});

const prompt = ai.definePrompt({
  name: 'testGeneratorPrompt',
  input: {schema: promptInputSchema},
  output: {schema: GenerateTestOutputSchema},
  prompt: `Sen, YKS için öğrencilere pratik yapmaları amacıyla çeşitli konularda, YKS standartlarında ve zorluk seviyesi ayarlanmış deneme testleri hazırlayan bir AI YKS eğitim materyali uzmanısın.
Sorular ASLA belirsiz olmamalı, KESİNLİKLE TEK BİR DOĞRU CEVABA sahip olmalıdır. Çeldiriciler mantıklı ama net bir şekilde yanlış olmalıdır. Cevapların Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: Pro üyeliğinizin sunduğu bu üst düzey test oluşturma deneyimi, üyeliğinizin özel bir avantajıdır. En düşündürücü ve kapsamlı YKS sorularını oluştur. Sorular, birden fazla konuyu birleştiren, derin analitik beceriler gerektiren nitelikte olsun. Açıklamaların çok detaylı olmalı; doğru cevabın yanı sıra her bir yanlış seçeneğin neden hatalı olduğunu da ayrıntılı bir şekilde açıkla. Soru köklerinde YKS'de sıkça kullanılan çeldirici ifadelere ve püf noktalarına yer ver.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: Soruların çeşitliliğini ve açıklamaların derinliğini artır. Yanlış seçeneklerin nedenlerini de açıkla. Sorular, konunun temel ve orta düzeydeki önemli noktalarını kapsasın.)
{{else}}
(Ücretsiz Kullanıcı Notu: Konunun temel bilgilerini ölçen, anlaşılır ve net sorular oluştur. Açıklamalar doğru cevabı net bir şekilde açıklamalıdır.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' seçildi.)
{{/if}}

{{#if isGemini25PreviewSelected}}
(Gemini 2.5 Flash Preview 05-20 Modeli Notu: Yanıtların ÖZ ama ANLAŞILIR ve YKS öğrencisine doğrudan fayda sağlayacak şekilde olsun. HIZLI yanıt vermeye odaklan. {{#if isProUser}}Pro kullanıcı için gereken analitik derinliği ve kapsamlı açıklamaları koruyarak{{else if isPremiumUser}}Premium kullanıcı için gereken detaylı açıklamaları ve çeşitliliği sağlayarak{{/if}} gereksiz uzun açıklamalardan ve süslemelerden kaçın, doğrudan konuya girerek en kritik bilgileri vurgula. Sorular YKS formatına uygun, net ve tek doğru cevaplı olsun.)
{{/if}}

Kullanıcının İstekleri:
Konu: {{{topic}}}
İstenen Soru Sayısı: {{{numQuestions}}}
İstenen Soru Tipleri: Çoktan Seçmeli (5 seçenekli: A, B, C, D, E)
YKS Zorluk Seviyesi: {{{difficulty}}}

Lütfen bu bilgilere dayanarak, YKS formatına uygun bir test oluştur. Test, aşağıdaki formatta olmalıdır:
1.  **Test Başlığı**: Konuyla ilgili, YKS'ye uygun başlık.
2.  **Sorular**: Her soru için:
    *   **Soru Metni**: Açık, net, KESİNLİKLE TEK DOĞRU CEVAPLI. YKS soru köklerine benzer ifadeler kullan. Belirsizlikten ve yoruma açık ifadelerden kaçın.
    *   **Soru Tipi**: 'multiple_choice'.
    *   **Seçenekler**: 5 adet (A, B, C, D, E). Mantıklı çeldiriciler. SADECE BİR SEÇENEK KESİN DOĞRU. Diğer dördü KESİNLİKLE YANLIŞ. "Hepsi" veya "Hiçbiri" gibi seçeneklerden kaçın.
    *   **Doğru Cevap**: Sadece seçenek harfi (A, B, C, D, E).
    *   **Açıklama (zorunlu ve son derece detaylı)**: Doğru cevabın neden doğru olduğunu ve diğer DÖRT seçeneğin neden yanlış olduğunu adım adım, mantıksal ve öğretici bir şekilde açıkla. Açıklama, ilgili YKS kavramlarını ve gerekirse çözüm adımlarını içermelidir.

Genel Prensipler:
*   Anlama, yorumlama, analiz, problem çözme becerilerini ölç.
*   Belirtilen YKS zorluk seviyesine ({{{difficulty}}}) uy.
*   {{{topic}}} konusunu kapsamlı tara.
*   Dilbilgisi kusursuz ve YKS terminolojisine uygun olsun.
*   Tamamen özgün sorular üret.
*   Kesinlikle yoruma açık, birden fazla doğru cevabı olabilecek veya cevabı belirsiz sorular sorma. Sorular, net ve tek bir doğru yanıta sahip olmalıdır.
`,
});

const testGeneratorFlow = ai.defineFlow(
  {
    name: 'testGeneratorFlow',
    inputSchema: promptInputSchema,
    outputSchema: GenerateTestOutputSchema,
  },
  async (enrichedInput: z.infer<typeof promptInputSchema>, modelToUseParam: string ): Promise<GenerateTestOutput> => {
    
    let finalModelToUse = modelToUseParam;
    console.log(`[Test Generator Flow] Initial modelToUseParam: '${finalModelToUse}', type: ${typeof finalModelToUse}`);

    if (typeof finalModelToUse !== 'string' || !finalModelToUse.startsWith('googleai/')) {
        console.warn(`[Test Generator Flow] Invalid or non-string modelToUseParam ('${finalModelToUse}', type: ${typeof finalModelToUse}) received in flow. Defaulting to universal default.`);
        finalModelToUse = 'googleai/gemini-2.5-flash-preview-05-20'; // Universal default
        console.log(`[Test Generator Flow] Corrected/Defaulted model INSIDE FLOW to: ${finalModelToUse}`);
    }
    
    const standardTemperature = 0.7;
    const standardSafetySettings = [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ];
    
    let maxTokensForOutput = enrichedInput.numQuestions * 500; 
    if (enrichedInput.isProUser || enrichedInput.isPremiumUser) { 
        maxTokensForOutput = Math.max(maxTokensForOutput, 4096); 
    } else {
        maxTokensForOutput = Math.max(maxTokensForOutput, 2048); 
    }
    if (maxTokensForOutput > 8192) maxTokensForOutput = 8192; 

    const callOptions: { model: string; config?: Record<string, any> } = { 
        model: finalModelToUse,
        config: {
            temperature: standardTemperature,
            safetySettings: standardSafetySettings,
            maxOutputTokens: maxTokensForOutput,
        }
    };

    const promptInputForLog = { ...enrichedInput, resolvedModelUsed: finalModelToUse };
    console.log(`[Test Generator Flow] Using Genkit model: ${finalModelToUse} for plan: ${enrichedInput.userPlan}, customModel (raw): ${enrichedInput.customModelIdentifier}, with config: ${JSON.stringify(callOptions.config)}`);

    try {
        const {output} = await prompt(promptInputForLog, callOptions);
        if (!output || !output.questions || output.questions.length === 0) {
        console.error(`[Test Generator Flow] AI did not produce valid questions. Model: ${finalModelToUse}. Output:`, JSON.stringify(output).substring(0,300));
        throw new Error(`AI YKS Test Uzmanı (${finalModelToUse}), belirtilen konu için YKS standartlarında bir test oluşturamadı. Lütfen konu ve ayarları kontrol edin.`);
        }
        output.questions.forEach(q => {
          q.questionType = "multiple_choice"; 
          if (!q.options || q.options.length !== 5) {
              console.warn(`[Test Generator Flow] Multiple choice question "${q.questionText.substring(0,50)}..." for topic "${enrichedInput.topic}" was expected to have 5 options, but received ${q.options?.length || 0}. Prompt may need adjustment.`);
          }
        });
        return output;
    } catch (error: any) {
        console.error(`[Test Generator Flow] Error during generation with model ${finalModelToUse}. Error details:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        let errorMessage = `AI modeli (${finalModelToUse}) ile test oluşturulurken bir hata oluştu.`;
        if (error.message) {
            errorMessage += ` Detay: ${error.message.substring(0, 300)}`;
            if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
              errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen konunuzu gözden geçirin. Model: ${finalModelToUse}. Detay: ${error.message.substring(0, 150)}`;
            } else if (error.name === 'GenkitError' && error.message.includes('Schema validation failed')) {
              errorMessage = `AI modeli (${finalModelToUse}) beklenen yanıta uymayan bir çıktı üretti (Schema validation failed). Detay: ${error.message.substring(0,350)}`;
            }
        }

        return {
            testTitle: `Hata: ${errorMessage}`,
            questions: []
        };
    }
  }
);
    