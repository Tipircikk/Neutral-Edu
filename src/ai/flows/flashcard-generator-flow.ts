
'use server';
/**
 * @fileOverview Kullanıcının girdiği metinden YKS'ye yönelik etkileşimli bilgi kartları (flashcards) oluşturan bir AI aracı.
 *
 * - generateFlashcards - Bilgi kartı oluşturma işlemini yöneten fonksiyon.
 * - GenerateFlashcardsInput - generateFlashcards fonksiyonu için giriş tipi.
 * - GenerateFlashcardsOutput - generateFlashcards fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { UserProfile } from '@/types';

const GenerateFlashcardsInputSchema = z.object({
  textContent: z.string().min(20).describe('Bilgi kartlarına dönüştürülmesi istenen en az 20 karakterlik akademik metin, tanımlar veya anahtar noktalar.'),
  numFlashcards: z.number().min(3).max(15).optional().default(5).describe('Oluşturulması istenen bilgi kartı sayısı (3-15 arası).'),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium").describe("Bilgi kartlarının YKS'ye göre zorluk seviyesi."),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı."),
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi."),
});
export type GenerateFlashcardsInput = z.infer<typeof GenerateFlashcardsInputSchema>;

const FlashcardSchema = z.object({
  front: z.string().describe('Bilgi kartının ön yüzü (genellikle bir soru, kavram veya terim).'),
  back: z.string().describe('Bilgi kartının arka yüzü (genellikle cevap, tanım veya açıklama).'),
  topic: z.string().optional().describe('Bilgi kartının ilgili olduğu ana konu veya alt başlık.'),
});

const GenerateFlashcardsOutputSchema = z.object({
  flashcards: z.array(FlashcardSchema).describe('Oluşturulan bilgi kartlarının listesi.'),
  summaryTitle: z.string().optional().describe('Bilgi kartlarının dayandığı metin için kısa bir başlık veya konu özeti.'),
});
export type GenerateFlashcardsOutput = z.infer<typeof GenerateFlashcardsOutputSchema>;

export async function generateFlashcards(input: GenerateFlashcardsInput): Promise<GenerateFlashcardsOutput> {
  console.log(`[Flashcard Generator Action] Received input. customModelIdentifier: ${input.customModelIdentifier}, userPlan: ${input.userPlan}`);

  const isProUser = input.userPlan === 'pro';
  const isPremiumUser = input.userPlan === 'premium';
  
  let modelToUse = '';
  if (input.customModelIdentifier) {
    switch (input.customModelIdentifier) {
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
        // If customModelIdentifier is a direct genkit model name (e.g. from an old admin setting)
        if (typeof input.customModelIdentifier === 'string' && input.customModelIdentifier.startsWith('googleai/')) {
            modelToUse = input.customModelIdentifier;
        } else {
            console.warn(`[Flashcard Generator Action] Admin specified an UNKNOWN customModelIdentifier: '${input.customModelIdentifier}'. Falling back to plan-based default.`);
            if (isProUser || isPremiumUser) {
            modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
            } else {
            modelToUse = 'googleai/gemini-2.0-flash';
            }
        }
        break;
    }
  } else { // No custom model ID specified by admin, or it was empty
    if (isProUser || isPremiumUser) {
      modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
    } else {
      modelToUse = 'googleai/gemini-2.0-flash';
    }
  }
  
  // Final check to ensure modelToUse is a valid string
  if (typeof modelToUse !== 'string' || !modelToUse.startsWith('googleai/')) { 
      console.error(`[Flashcard Generator Action] CRITICAL FALLBACK: modelToUse became invalid ('${modelToUse}', type: ${typeof modelToUse}). Forcing to default gemini-2.0-flash.`);
      modelToUse = 'googleai/gemini-2.0-flash';
  }
  console.log(`[Flashcard Generator Action] Final model determined for flow: ${modelToUse}`);

  const isGemini25PreviewSelected = modelToUse === 'googleai/gemini-2.5-flash-preview-05-20';

  const enrichedInput = {
    ...input,
    isProUser,
    isPremiumUser,
    isCustomModelSelected: !!input.customModelIdentifier,
    isGemini25PreviewSelected,
  };
  return flashcardGeneratorFlow(enrichedInput, modelToUse);
}

const prompt = ai.definePrompt({
  name: 'flashcardGeneratorPrompt',
  input: {schema: GenerateFlashcardsInputSchema.extend({
    isProUser: z.boolean().optional(),
    isPremiumUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
  })},
  output: {schema: GenerateFlashcardsOutputSchema},
  prompt: `Sen, YKS'ye hazırlanan öğrenciler için verilen metinlerden kaliteli bilgi kartları (flashcards) oluşturan bir AI eğitim materyali geliştiricisisin. Amacın, metindeki önemli bilgileri soru-cevap formatında kartlara dönüştürmektir. Kartlar net ve akılda kalıcı olmalıdır. Cevapların Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: Bu Pro seviyesindeki gelişmiş özellik, üyeliğinizin özel bir avantajıdır. Bilgi kartlarını konunun derin ve karmaşık noktalarını sorgulayacak şekilde, analitik düşünmeyi teşvik edici biçimde tasarla. Gerekirse, kartların arka yüzüne ek olarak, bilginin YKS'deki önemi veya sık yapılan hatalar gibi kısa notlar ekleyebilirsin.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: Kartlara ek ipuçları veya bağlantılı kavramlar ekleyerek içeriği zenginleştir. Arka yüzdeki açıklamaları biraz daha detaylandır.)
{{else}}
(Ücretsiz Kullanıcı Notu: Temel kavramları ve tanımları içeren, anlaşılır ve net bilgi kartları oluştur.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' seçildi, sonuçta '{{modelToUse}}' kullanılacak.)
{{/if}}

{{#if isGemini25PreviewSelected}}
(Gemini 2.5 Flash Preview 05-20 Modeli Notu: Yanıtların ÖZ ama ANLAŞILIR ve YKS öğrencisine doğrudan fayda sağlayacak şekilde olsun. HIZLI yanıt vermeye odaklan. {{#if isProUser}}Pro kullanıcı için gereken derinliği ve analitik sorgulamayı koruyarak{{else if isPremiumUser}}Premium kullanıcı için gereken zenginleştirilmiş içeriği sağlayarak{{/if}} gereksiz uzun açıklamalardan ve süslemelerden kaçın, doğrudan konuya girerek en kritik bilgileri vurgula.)
{{/if}}

Kullanıcının Girdileri:
Metin İçeriği:
{{{textContent}}}

İstenen Bilgi Kartı Sayısı: {{{numFlashcards}}}
YKS Zorluk Seviyesi: {{{difficulty}}}

Lütfen bu bilgilere dayanarak, aşağıdaki formatta {{numFlashcards}} adet YKS odaklı bilgi kartı oluştur:

1.  **Bilgi Kartları**: Her kart için:
    *   **Ön Yüz (front)**: Soru, kavram veya terim.
    *   **Arka Yüz (back)**: Cevap, tanım veya açıklama.
    *   **Konu (topic) (isteğe bağlı)**: İlgili ana konu.
2.  **Özet Başlık (summaryTitle) (isteğe bağlı)**: Metin için kısa başlık.

Zorluk Seviyesi Ayarı ({{{difficulty}}}):
*   'easy': Temel tanımlar, basit olgular.
*   'medium': Yorum veya bağlantı gerektiren kavramlar, önemli detaylar.
*   'hard': Karmaşık ilişkiler, spesifik ayrıntılar, analiz gerektiren bilgiler.

Genel Prensipler:
*   Metindeki en önemli ve YKS için değerli bilgileri seç.
*   Ön ve arka yüz arasında net mantıksal bağlantı olsun.
*   Tekrarlayan veya çok bariz bilgilerden kaçın.
*   Dilbilgisi ve YKS terminolojisi doğru olsun.
*   Metin yetersizse, üretebildiğin kadar kaliteli kart üret.
`,
});

const flashcardGeneratorFlow = ai.defineFlow(
  {
    name: 'flashcardGeneratorFlow',
    inputSchema: GenerateFlashcardsInputSchema.extend({
        isProUser: z.boolean().optional(),
        isPremiumUser: z.boolean().optional(),
        isCustomModelSelected: z.boolean().optional(),
        isGemini25PreviewSelected: z.boolean().optional(),
    }),
    outputSchema: GenerateFlashcardsOutputSchema,
  },
  async (enrichedInput: z.infer<typeof GenerateFlashcardsInputSchema> & {isProUser?: boolean; isPremiumUser?: boolean; isCustomModelSelected?: boolean; isGemini25PreviewSelected?: boolean}, modelToUseParam: string ): Promise<GenerateFlashcardsOutput> => {
    
    let finalModelToUse = modelToUseParam;
    console.log(`[Flashcard Generator Flow] Received modelToUseParam: '${modelToUseParam}', type: ${typeof modelToUseParam}`);

    if (typeof finalModelToUse !== 'string' || !finalModelToUse.startsWith('googleai/')) {
        console.warn(`[Flashcard Generator Flow] Invalid or non-string modelToUseParam ('${finalModelToUse}', type: ${typeof finalModelToUse}) received in flow. Defaulting based on plan.`);
        if (enrichedInput.isProUser || enrichedInput.isPremiumUser) {
            finalModelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
        } else {
            finalModelToUse = 'googleai/gemini-2.0-flash';
        }
        console.log(`[Flashcard Generator Flow] Corrected/Defaulted model INSIDE FLOW to: ${finalModelToUse}`);
    }
    
    let callOptions: { model: string; config?: Record<string, any> } = { model: finalModelToUse };

    let maxTokensForOutput = (enrichedInput.numFlashcards || 5) * 200;
    if (maxTokensForOutput > 8000) maxTokensForOutput = 8000;
    if (maxTokensForOutput < 1024) maxTokensForOutput = 1024;

    if (finalModelToUse === 'googleai/gemini-2.5-flash-preview-05-20') {
        callOptions.config = {};
    } else {
      callOptions.config = {
        generationConfig: {
          maxOutputTokens: maxTokensForOutput,
        }
      };
    }

    const promptInputForLog = { ...enrichedInput, modelToUse: finalModelToUse };
    console.log(`[Flashcard Generator Flow] Using Genkit model: ${finalModelToUse} for plan: ${enrichedInput.userPlan}, customModel (raw): ${enrichedInput.customModelIdentifier}, with config: ${JSON.stringify(callOptions.config)}`);

    try {
        const {output} = await prompt(promptInputForLog, callOptions);
        if (!output || !output.flashcards || output.flashcards.length === 0) {
          console.error(`[Flashcard Generator Flow] AI did not produce valid flashcards. Model: ${finalModelToUse}. Input text length: ${enrichedInput.textContent.length}. Num cards: ${enrichedInput.numFlashcards}. Output:`, JSON.stringify(output).substring(0,300));
          throw new Error(`AI YKS Bilgi Kartı Uzmanı (${finalModelToUse}), belirtilen metin için bilgi kartı oluşturamadı. Lütfen metni ve ayarları kontrol edin.`);
        }
        return output;
    } catch (error: any) {
        console.error(`[Flashcard Generator Flow] Error during generation with model ${finalModelToUse}:`, error);
        let errorMessage = `AI modeli (${finalModelToUse}) ile bilgi kartı oluşturulurken bir hata oluştu.`;
        if (error.message) {
            errorMessage += ` Detay: ${error.message.substring(0, 200)}`;
            if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
              errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen konunuzu gözden geçirin. Model: ${finalModelToUse}. Detay: ${error.message.substring(0, 150)}`;
            } else if (error.name === 'GenkitError' && error.message.includes('Schema validation failed')) {
              errorMessage = `AI modeli (${finalModelToUse}) beklenen yanıta uymayan bir çıktı üretti. Detay: ${error.message.substring(0,250)}`;
            } else if (error.message.includes('startsWith is not a function')) {
                errorMessage = `Model belirleme hatası (startsWith). Lütfen admin ile iletişime geçin. Detay: ${error.message.substring(0,150)}`;
            }
        }

        return {
            flashcards: [],
            summaryTitle: `Hata: ${errorMessage}`
        };
    }
  }
);

