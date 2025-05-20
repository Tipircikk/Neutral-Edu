
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
  const isProUser = input.userPlan === 'pro';
  const isPremiumUser = input.userPlan === 'premium';
  const isCustomModelSelected = !!input.customModelIdentifier;
  const isGemini25PreviewSelected = input.customModelIdentifier === 'experimental_gemini_2_5_flash_preview_05_20';

  const enrichedInput = {
      ...input,
      questionTypes: ["multiple_choice"] as Array<"multiple_choice" | "true_false" | "short_answer">,
      isProUser,
      isPremiumUser,
      isCustomModelSelected,
      isGemini25PreviewSelected,
    };
  return testGeneratorFlow(enrichedInput);
}

const prompt = ai.definePrompt({
  name: 'testGeneratorPrompt',
  input: {schema: GenerateTestInputSchema.extend({
    isProUser: z.boolean().optional(),
    isPremiumUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
  })},
  output: {schema: GenerateTestOutputSchema},
  prompt: `Sen, YKS için öğrencilere pratik yapmaları amacıyla çeşitli konularda, YKS standartlarında ve zorluk seviyesi ayarlanmış deneme testleri hazırlayan bir AI YKS eğitim materyali uzmanısın.
Sorular ASLA belirsiz olmamalı, KESİNLİKLE TEK BİR DOĞRU CEVABA sahip olmalıdır. Çeldiriciler mantıklı ama net bir şekilde yanlış olmalıdır. Cevapların Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: En düşündürücü ve kapsamlı YKS sorularını oluştur. Sorular, birden fazla konuyu birleştiren, derin analitik beceriler gerektiren nitelikte olsun. Açıklamaların çok detaylı olmalı.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: Soruların çeşitliliğini ve açıklamaların derinliğini artır. Yanlış seçeneklerin nedenlerini de açıkla.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' kullanılıyor.)
  {{#if isGemini25PreviewSelected}}
  (Gemini 2.5 Flash Preview 05-20 Notu: Yanıtların ÖZ ama ANLAŞILIR olsun. HIZLI yanıtla.)
  {{/if}}
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
    inputSchema: GenerateTestInputSchema.extend({
        isProUser: z.boolean().optional(),
        isPremiumUser: z.boolean().optional(),
        isCustomModelSelected: z.boolean().optional(),
        isGemini25PreviewSelected: z.boolean().optional(),
    }),
    outputSchema: GenerateTestOutputSchema,
  },
  async (enrichedInput: z.infer<typeof GenerateTestInputSchema> & {isProUser?: boolean; isPremiumUser?: boolean; isCustomModelSelected?: boolean; isGemini25PreviewSelected?: boolean; questionTypes: Array<"multiple_choice" | "true_false" | "short_answer">} ): Promise<GenerateTestOutput> => {
    let modelToUse = 'googleai/gemini-1.5-flash-latest';
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
          console.warn(`[Test Generator Flow] Unknown customModelIdentifier: ${enrichedInput.customModelIdentifier}. Defaulting to ${modelToUse}`);
      }
    } else if (enrichedInput.isProUser) {
      modelToUse = 'googleai/gemini-1.5-flash-latest';
    } else {
      modelToUse = 'googleai/gemini-2.0-flash'; // Default for free/premium
    }

    callOptions.model = modelToUse;

    let maxTokensForOutput = enrichedInput.numQuestions * 500;
    if (maxTokensForOutput > 8000) maxTokensForOutput = 8000;
    if (maxTokensForOutput < 2048) maxTokensForOutput = 2048;

    if (modelToUse !== 'googleai/gemini-2.5-flash-preview-05-20') {
       callOptions.config = {
         temperature: 0.7,
         generationConfig: {
           maxOutputTokens: maxTokensForOutput
          }
        };
    } else {
      callOptions.config = { temperature: 0.7 };
    }

    console.log(`[Test Generator Flow] Using model: ${modelToUse} for plan: ${enrichedInput.userPlan}, customModel: ${enrichedInput.customModelIdentifier}`);

    try {
        const {output} = await prompt(enrichedInput, callOptions);
        if (!output || !output.questions || output.questions.length === 0) {
        throw new Error("AI YKS Test Uzmanı, belirtilen konu için YKS standartlarında bir test oluşturamadı. Lütfen konu ve ayarları kontrol edin.");
        }
        output.questions.forEach(q => {
        q.questionType = "multiple_choice";
        if (!q.options || q.options.length !== 5) {
            console.warn(`Multiple choice question "${q.questionText.substring(0,50)}..." for topic "${enrichedInput.topic}" was expected to have 5 options, but received ${q.options?.length || 0}. Prompt may need adjustment.`);
        }
        });
        return output;
    } catch (error: any) {
        console.error(`[Test Generator Flow] Error during generation with model ${modelToUse}:`, error);
        let errorMessage = `AI modeli (${modelToUse}) ile test oluşturulurken bir hata oluştu.`;
        if (error.message) {
            errorMessage += ` Detay: ${error.message.substring(0, 200)}`;
            if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
              errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen konunuzu gözden geçirin. Model: ${modelToUse}. Detay: ${error.message.substring(0, 150)}`;
            }
        }

        return {
            testTitle: `Hata: ${errorMessage}`,
            questions: []
        };
    }
  }
);
    