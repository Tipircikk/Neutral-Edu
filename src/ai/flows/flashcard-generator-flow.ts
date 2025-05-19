
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
  textContent: z.string().min(50).describe('Bilgi kartlarına dönüştürülmesi istenen en az 50 karakterlik akademik metin, tanımlar veya anahtar noktalar.'),
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
  const isCustomModelSelected = !!input.customModelIdentifier;
  const isGemini25PreviewSelected = input.customModelIdentifier === 'experimental_gemini_2_5_flash_preview';

  const enrichedInput = {
    ...input,
    isProUser,
    isCustomModelSelected,
    isGemini25PreviewSelected,
  };
  return flashcardGeneratorFlow(enrichedInput); 
}

const prompt = ai.definePrompt({
  name: 'flashcardGeneratorPrompt',
  input: {schema: GenerateFlashcardsInputSchema.extend({
    isProUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
  })},
  output: {schema: GenerateFlashcardsOutputSchema},
  prompt: `Sen, Yükseköğretim Kurumları Sınavı (YKS) için öğrencilerin kritik bilgileri hızlı ve etkili bir şekilde ezberlemelerine ve pekiştirmelerine yardımcı olmak amacıyla, verilen metinlerden YKS odaklı, kaliteli bilgi kartları (flashcards) oluşturan uzman bir AI eğitim materyali geliştiricisisin.
Amacın, metindeki en önemli tanımları, kavramları, formülleri, tarihleri veya olguları belirleyip bunları soru-cevap veya terim-tanım formatında bilgi kartlarına dönüştürmektir. Kartlar, YKS öğrencisinin seviyesine uygun, net ve akılda kalıcı olmalıdır.
Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: Bilgi kartlarını, konunun en derin ve karmaşık noktalarını sorgulayacak şekilde, çoklu bağlantılar ve ileri düzey ipuçları içerecek biçimde tasarla. Kartlar, öğrencinin analitik düşünme ve sentez yapma becerilerini en üst düzeye çıkarmalı. Bu kullanıcılar için en gelişmiş AI yeteneklerini kullan.)
{{else ifEquals userPlan "premium"}}
(Premium Kullanıcı Notu: Kartlara ek ipuçları, bağlantılı kavramlar veya YKS'de çıkabilecek alternatif soru tarzlarına göndermeler ekleyerek daha zengin içerik sun.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Bu çözüm, özel olarak seçilmiş '{{{customModelIdentifier}}}' modeli kullanılarak üretilmektedir.)
  {{#if isGemini25PreviewSelected}}
  (Gemini 2.5 Flash Preview Özel Notu: Yanıtlarını olabildiğince ÖZ ama ANLAŞILIR tut. HIZLI yanıt vermesi önemlidir.)
  {{/if}}
{{/if}}

Kullanıcının Girdileri:
Metin İçeriği:
{{{textContent}}}

İstenen Bilgi Kartı Sayısı: {{{numFlashcards}}}
YKS Zorluk Seviyesi: {{{difficulty}}}

Lütfen bu bilgilere dayanarak, aşağıdaki formatta ve prensiplerde {{numFlashcards}} adet YKS odaklı bilgi kartı oluştur:

1.  **Bilgi Kartları**: Her bir kart için:
    *   **Ön Yüz (front)**: Bir soru, YKS'de çıkabilecek bir kavram, önemli bir terim veya ezberlenmesi gereken bir bilgi kırıntısı olmalı. Açık ve net olmalı.
    *   **Arka Yüz (back)**: Ön yüzdeki sorunun cevabı, kavramın tanımı, terimin açıklaması veya bilginin detayı olmalı. Kısa, öz ve doğru bilgi içermeli. YKS öğrencisinin anlayacağı dilde olmalı.
    *   **Konu (topic) (isteğe bağlı)**: Bilgi kartının ilgili olduğu ana konu veya alt başlık.
2.  **Özet Başlık (summaryTitle) (isteğe bağlı)**: Bilgi kartlarının temel aldığı ana metin için kısa, açıklayıcı bir başlık.

Zorluk Seviyesi Ayarı ({{{difficulty}}}):
*   'easy': Genellikle temel tanımlar, basit olgular, doğrudan hatırlama gerektiren bilgiler.
*   'medium': Biraz daha yorum veya bağlantı kurma gerektiren kavramlar, önemli detaylar, YKS ortalamasına yakın bilgiler.
*   'hard': Daha karmaşık ilişkiler, spesifik ayrıntılar, analiz veya sentez gerektirebilecek bilgiler.

Genel Prensipler:
*   {{{textContent}}} içindeki en önemli ve YKS için değerli bilgileri seç.
*   Kartların ön ve arka yüzleri arasında net bir mantıksal bağlantı olsun.
*   Tekrarlayan veya çok bariz bilgilerden kaçın.
*   Bilgi kartları, öğrencinin aktif öğrenme sürecini desteklemeli.
*   Dilbilgisi ve YKS terminolojisi açısından kusursuz ol.
*   Eğer metin yeterince zengin değilse veya istenen sayıda anlamlı kart çıkarılamıyorsa, üretebildiğin kadar kaliteli kart üret; sayıyı zorlama.
`,
});

const flashcardGeneratorFlow = ai.defineFlow(
  {
    name: 'flashcardGeneratorFlow',
    inputSchema: GenerateFlashcardsInputSchema.extend({ 
        isProUser: z.boolean().optional(),
        isCustomModelSelected: z.boolean().optional(),
        isGemini25PreviewSelected: z.boolean().optional(),
    }),
    outputSchema: GenerateFlashcardsOutputSchema,
  },
  async (enrichedInput: GenerateFlashcardsInput & {isProUser?: boolean; isCustomModelSelected?: boolean; isGemini25PreviewSelected?: boolean} ): Promise<GenerateFlashcardsOutput> => {
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
        case 'experimental_gemini_2_5_flash_preview':
          modelToUse = 'googleai/gemini-2.5-flash-preview-04-17';
          break;
        default:
          console.warn(`[Flashcard Generator Flow] Unknown customModelIdentifier: ${enrichedInput.customModelIdentifier}. Defaulting to ${modelToUse}`);
      }
    } else if (enrichedInput.isProUser) { 
      modelToUse = 'googleai/gemini-1.5-flash-latest';
    }
    
    callOptions.model = modelToUse;
    
    let maxTokensForOutput = enrichedInput.numFlashcards * 200; 
    if (maxTokensForOutput > 8000) maxTokensForOutput = 8000; 
    if (maxTokensForOutput < 1024) maxTokensForOutput = 1024; 

    if (modelToUse !== 'googleai/gemini-2.5-flash-preview-04-17') {
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

    