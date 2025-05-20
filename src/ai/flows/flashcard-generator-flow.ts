
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
  return flashcardGeneratorFlow(enrichedInput);
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
  prompt: `Sen, YKS'ye hazırlanan öğrenciler için verilen metinlerden kaliteli bilgi kartları (flashcards) oluşturan bir AI eğitim materyali geliştiricisisin. Amacın, metindeki önemli bilgileri soru-cevap formatında kartlara dönüştürmektir. Kartlar net ve akılda kalıcı olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: Bilgi kartlarını, konunun derin ve karmaşık noktalarını sorgulayacak şekilde, analitik düşünmeyi teşvik edici biçimde tasarla.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: Kartlara ek ipuçları veya bağlantılı kavramlar ekleyerek içeriği zenginleştir.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' kullanılıyor.)
  {{#if isGemini25PreviewSelected}}
  (Gemini 2.5 Flash Preview 05-20 Notu: Yanıtların ÖZ ama ANLAŞILIR olsun. HIZLI yanıtla.)
  {{/if}}
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
  async (enrichedInput: z.infer<typeof GenerateFlashcardsInputSchema> & {isProUser?: boolean; isPremiumUser?: boolean; isCustomModelSelected?: boolean; isGemini25PreviewSelected?: boolean} ): Promise<GenerateFlashcardsOutput> => {
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
          console.warn(`[Flashcard Generator Flow] Unknown customModelIdentifier: ${enrichedInput.customModelIdentifier}. Defaulting to ${modelToUse}`);
      }
    } else if (enrichedInput.isProUser) {
      modelToUse = 'googleai/gemini-1.5-flash-latest';
    } else {
      modelToUse = 'googleai/gemini-2.0-flash'; // Default for free/premium
    }

    callOptions.model = modelToUse;

    let maxTokensForOutput = (enrichedInput.numFlashcards || 5) * 200;
    if (maxTokensForOutput > 8000) maxTokensForOutput = 8000;
    if (maxTokensForOutput < 1024) maxTokensForOutput = 1024;

    if (modelToUse !== 'googleai/gemini-2.5-flash-preview-05-20') {
      callOptions.config = {
        generationConfig: {
          maxOutputTokens: maxTokensForOutput,
        }
      };
    } else {
        callOptions.config = {};
    }

    console.log(`[Flashcard Generator Flow] Using model: ${modelToUse} for plan: ${enrichedInput.userPlan}, customModel: ${enrichedInput.customModelIdentifier}`);

    try {
        const {output} = await prompt(enrichedInput, callOptions);
        if (!output || !output.flashcards || output.flashcards.length === 0) {
        throw new Error("AI YKS Bilgi Kartı Uzmanı, belirtilen metin için bilgi kartı oluşturamadı. Lütfen metni ve ayarları kontrol edin.");
        }
        return output;
    } catch (error: any) {
        console.error(`[Flashcard Generator Flow] Error during generation with model ${modelToUse}:`, error);
        let errorMessage = `AI modeli (${modelToUse}) ile bilgi kartı oluşturulurken bir hata oluştu.`;
        if (error.message) {
            errorMessage += ` Detay: ${error.message.substring(0, 200)}`;
            if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
              errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen konunuzu gözden geçirin. Model: ${modelToUse}. Detay: ${error.message.substring(0, 150)}`;
            }
        }

        return {
            flashcards: [],
            summaryTitle: `Hata: ${errorMessage}`
        };
    }
  }
);
    