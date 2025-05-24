
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
  isAdmin: z.boolean().optional().describe("Kullanıcının admin olup olmadığını belirtir."),
});
export type GenerateFlashcardsInput = z.infer<typeof GenerateFlashcardsInputSchema>;

const FlashcardSchema = z.object({
  front: z.string().describe('Bilgi kartının ön yüzü (genellikle bir soru, kavram veya terim).'),
  back: z.string().describe('Bilgi kartının arka yüzü (genellikle cevap, tanım veya açıklama).'),
  topic: z.string().optional().describe('Bilgi kartının ilgili olduğu ana konu veya alt başlık.'),
});

const GenerateFlashcardsOutputSchema = z.object({
  flashcards: z.array(FlashcardSchema).describe('Oluşturulan bilgi kartlarının listesi.'),
  summaryTitle: z.string().optional().describe('Bilgi kartlarının dayandığı metin için kısa bir başlık veya konu özeti. Eğer istenen sayıda kart üretilemediyse, nedenini buraya ekleyebilirsin.'),
});
export type GenerateFlashcardsOutput = z.infer<typeof GenerateFlashcardsOutputSchema>;

export async function generateFlashcards(input: GenerateFlashcardsInput): Promise<GenerateFlashcardsOutput> {
  console.log(`[Flashcard Generator Action] Received input. User Plan: ${input.userPlan}, Admin Model ID (raw): '${input.customModelIdentifier}', isAdmin: ${input.isAdmin}`);

  let modelToUse: string;
  const adminModelChoice: string | undefined = input.customModelIdentifier;

  if (typeof adminModelChoice === 'string' && adminModelChoice.trim() !== "") {
    const customIdLower = adminModelChoice.toLowerCase().trim();
    console.log(`[Flashcard Generator Action] Admin specified customModelIdentifier (processed): '${customIdLower}' from input: '${adminModelChoice}'`);
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
            console.warn(`[Flashcard Generator Action] Admin specified a direct Genkit model name: '${modelToUse}'. Ensure this model is supported.`);
        } else {
            console.warn(`[Flashcard Generator Action] Admin specified an UNKNOWN customModelIdentifier: '${adminModelChoice}'. Falling back to universal default.`);
            modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
        }
        break;
    }
  } else {
    console.log(`[Flashcard Generator Action] No valid custom model specified by admin (received: '${adminModelChoice}'). Using universal default 'googleai/gemini-2.5-flash-preview-05-20'.`);
    modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
  }

  // Absolute fallback if modelToUse is somehow still invalid after the logic above
  // This ensures modelToUse is always a string starting with 'googleai/' before being passed to the flow.
  if (typeof modelToUse !== 'string' || !modelToUse.startsWith('googleai/')) {
      console.error(`[Flashcard Generator Action] CRITICAL FALLBACK: modelToUse was invalid ('${modelToUse}', type: ${typeof modelToUse}). Defaulting to 'googleai/gemini-2.5-flash-preview-05-20'.`);
      modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
  }
  console.log(`[Flashcard Generator Action] Final model determined for flow: ${modelToUse}`);

  const isProUser = input.userPlan === 'pro';
  const isPremiumUser = input.userPlan === 'premium';
  // isGemini25PreviewSelected should be based on the FINAL modelToUse
  const isGemini25PreviewSelected = modelToUse === 'googleai/gemini-2.5-flash-preview-05-20';

  const enrichedInput = {
    ...input,
    isProUser,
    isPremiumUser,
    isCustomModelSelected: !!input.customModelIdentifier, // Keep original admin choice for logging/prompt
    isGemini25PreviewSelected,
    isAdmin: !!input.isAdmin,
  };
  return flashcardGeneratorFlow(enrichedInput, modelToUse);
}

const promptInputSchema = GenerateFlashcardsInputSchema.extend({
    isProUser: z.boolean().optional(),
    isPremiumUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
});

const prompt = ai.definePrompt({
  name: 'flashcardGeneratorPrompt',
  input: {schema: promptInputSchema },
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
(Admin Notu: Özel model '{{{customModelIdentifier}}}' seçildi.)
{{/if}}

{{#if isGemini25PreviewSelected}}
(Gemini 2.5 Flash Preview 05-20 Modeli Notu: JSON ŞEMASINA HARFİYEN UY! Yanıtların ÖZ ama ANLAŞILIR ve YKS öğrencisine doğrudan fayda sağlayacak şekilde olsun. HIZLI yanıt vermeye odaklan. {{#if isProUser}}Pro kullanıcı için gereken derinliği ve analitik sorgulamayı koruyarak{{else if isPremiumUser}}Premium kullanıcı için gereken zenginleştirilmiş içeriği sağlayarak{{/if}} gereksiz uzun açıklamalardan ve süslemelerden kaçın, doğrudan konuya girerek en kritik bilgileri vurgula. Çıktın HER ZAMAN geçerli bir JSON nesnesi olmalıdır ve "flashcards" adlı bir dizi içermelidir. Tam olarak istenen sayıda ({{{numFlashcards}}}) kartı JSON dizisine eklemeye özen göster.)
{{/if}}

Kullanıcının Girdileri:
Metin İçeriği:
{{{textContent}}}

İstenen Bilgi Kartı Sayısı: {{{numFlashcards}}}
YKS Zorluk Seviyesi: {{{difficulty}}}

Lütfen bu bilgilere dayanarak, aşağıdaki formatta TAM OLARAK {{{numFlashcards}}} adet YKS odaklı bilgi kartı oluştur. Eğer bu mümkün değilse, mümkün olan en fazla sayıda (en fazla {{{numFlashcards}}} adet) kartı oluştur ve neden daha az oluşturulduğunu (örneğin, 'Metin {{{numFlashcards}}} adet kart için yeterli değildi, X adet üretildi.') 'summaryTitle' alanının sonuna kısa bir not olarak ekleyebilirsin.

1.  **Bilgi Kartları (flashcards)**: Her kart için:
    *   **Ön Yüz (front)**: Soru, kavram veya terim.
    *   **Arka Yüz (back)**: Cevap, tanım veya açıklama.
    *   **Konu (topic) (isteğe bağlı)**: İlgili ana konu.
2.  **Özet Başlık (summaryTitle) (isteğe bağlı)**: Metin için kısa başlık. Eğer istenen sayıda kart üretilemediyse, nedenini buraya ekleyebilirsin.

Zorluk Seviyesi Ayarı ({{{difficulty}}}):
*   'easy': Temel tanımlar, basit olgular.
*   'medium': Yorum veya bağlantı gerektiren kavramlar, önemli detaylar.
*   'hard': Karmaşık ilişkiler, spesifik ayrıntılar, analiz gerektiren bilgiler.

Genel Prensipler:
*   Metindeki en önemli ve YKS için değerli bilgileri seç.
*   Ön ve arka yüz arasında net mantıksal bağlantı olsun.
*   Tekrarlayan veya çok bariz bilgilerden kaçın.
*   Dilbilgisi ve YKS terminolojisi doğru olsun.
*   Metin yetersizse, üretebildiğin kadar kaliteli kart üret ve bu durumu 'summaryTitle' sonunda belirt.
*   ÇIKTININ İSTENEN JSON ŞEMASINA TAM OLARAK UYDUĞUNDAN EMİN OL. "flashcards" alanı bir dizi olmalıdır ve mümkünse {{{numFlashcards}}} eleman içermelidir.
`,
});

const flashcardGeneratorFlow = ai.defineFlow(
  {
    name: 'flashcardGeneratorFlow',
    inputSchema: promptInputSchema,
    outputSchema: GenerateFlashcardsOutputSchema,
  },
  async (enrichedInput: z.infer<typeof promptInputSchema>, modelToUseParam: string ): Promise<GenerateFlashcardsOutput> => {
    
    let finalModelToUse = modelToUseParam;
    console.log(`[Flashcard Generator Flow] Initial modelToUseParam: '${finalModelToUse}', type: ${typeof finalModelToUse}`);

    if (typeof finalModelToUse !== 'string' || !finalModelToUse.startsWith('googleai/')) {
        console.warn(`[Flashcard Generator Flow] Invalid or non-string modelToUseParam ('${finalModelToUse}', type: ${typeof finalModelToUse}) received in flow. Defaulting to universal default 'googleai/gemini-2.5-flash-preview-05-20'.`);
        finalModelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
        console.log(`[Flashcard Generator Flow] Corrected/Defaulted model INSIDE FLOW to: ${finalModelToUse}`);
    }
    
    const standardTemperature = 0.7;
    const standardSafetySettings = [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ];
    
    let maxTokensForOutput = (enrichedInput.numFlashcards || 5) * 300; 
    if (enrichedInput.isProUser || enrichedInput.isPremiumUser) {
        maxTokensForOutput = Math.max(maxTokensForOutput, 4096); 
    } else {
        maxTokensForOutput = Math.max(maxTokensForOutput, 2048); 
    }

    if (finalModelToUse === 'googleai/gemini-2.5-flash-preview-05-20') {
        maxTokensForOutput = Math.min(maxTokensForOutput, 4096); 
        console.log(`[Flashcard Generator Flow] Model is ${finalModelToUse}. Capping maxOutputTokens to ${maxTokensForOutput}.`);
    } else if (finalModelToUse === 'googleai/gemini-1.5-flash-latest' || finalModelToUse === 'googleai/gemini-2.0-flash' ) {
         maxTokensForOutput = Math.min(maxTokensForOutput, 8192); 
    } else {
        maxTokensForOutput = Math.min(maxTokensForOutput, 8192); 
    }


    const callOptions: { model: string; config?: Record<string, any> } = { 
        model: finalModelToUse,
        config: {
            temperature: standardTemperature,
            safetySettings: standardSafetySettings,
            // No generationConfig wrapper for Genkit, maxOutputTokens is direct
            maxOutputTokens: maxTokensForOutput,
        }
    };

    const promptInputForLog = { ...enrichedInput, resolvedModelUsed: finalModelToUse, calculatedMaxOutputTokens: maxTokensForOutput };
    console.log(`[Flashcard Generator Flow] Using Genkit model: ${finalModelToUse} for plan: ${enrichedInput.userPlan}, customModel (raw): ${enrichedInput.customModelIdentifier}, with config: ${JSON.stringify(callOptions.config)}`);

    try {
        const {output} = await prompt(promptInputForLog, callOptions);
        if (!output || !output.flashcards || !Array.isArray(output.flashcards)) { 
          console.error(`[Flashcard Generator Flow] AI did not produce valid flashcards or flashcards is not an array. Model: ${finalModelToUse}. Input text length: ${enrichedInput.textContent.length}. Num cards requested: ${enrichedInput.numFlashcards}. Output:`, JSON.stringify(output, null, 2).substring(0,500));
          if (output === null) { // Specifically check for null
             // User is not admin, return generic error
            if (!enrichedInput.isAdmin) {
                 return {
                    flashcards: [],
                    summaryTitle: `AI modeli (${finalModelToUse}) bilgi kartı oluşturamadı (null yanıt). Sunucu yoğun olabilir veya beklenmedik bir hata oluştu. Lütfen biraz sonra tekrar deneyin veya farklı bir girdi kullanmayı deneyin.`
                 };
            }
             // Admin sees more technical detail
             throw new Error(`AI modeli (${finalModelToUse}), belirtilen metin için 'null' yanıt döndürdü. Bu genellikle modelin JSON şemasını üretemediği veya bir API sorunu olduğu anlamına gelir.`);
          }
           // User is not admin, return generic error
          if (!enrichedInput.isAdmin) {
            return {
                flashcards: [],
                summaryTitle: `AI modeli (${finalModelToUse}) bilgi kartı oluşturamadı. Sunucu yoğun olabilir veya beklenmedik bir hata oluştu. Lütfen biraz sonra tekrar deneyin veya farklı bir girdi kullanmayı deneyin.`
            };
          }
          // Admin sees more technical detail
          throw new Error(`AI modeli (${finalModelToUse}), belirtilen metin için bilgi kartı oluşturamadı veya 'flashcards' alanı bir dizi değil. Lütfen metni ve ayarları kontrol edin.`);
        }
        
        if (output.flashcards.length < (enrichedInput.numFlashcards || 0)) {
            console.warn(`[Flashcard Generator Flow] AI generated ${output.flashcards.length} flashcards, but ${enrichedInput.numFlashcards} were requested. Model: ${finalModelToUse}. Text length: ${enrichedInput.textContent.length}.`);
        }
        return output;
    } catch (error: any) {
        console.error(`[Flashcard Generator Flow] Error during generation with model ${finalModelToUse}. Error details:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        let errorMessage = `AI modeli (${finalModelToUse}) ile bilgi kartı oluşturulurken bir hata oluştu.`;

        if (enrichedInput.isAdmin) { // Admin sees more detailed errors
            if (error.message) {
                errorMessage += ` Detay: ${error.message.substring(0, 350)}`;
                if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
                  errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir (Admin Gördü). Lütfen konunuzu gözden geçirin. Model: ${finalModelToUse}. Detay: ${error.message.substring(0, 150)}`;
                } else if (error.name === 'GenkitError' && error.message.includes('Schema validation failed')) {
                  errorMessage = `AI modeli (${finalModelToUse}) beklenen yanıta uymayan bir çıktı üretti (Schema validation failed - Admin Gördü). Detay: ${error.message.substring(0,350)}`;
                } else if (error.message.includes('400 Bad Request') && error.message.includes("Unknown name \"generationConfig\"")) {
                   // This error shouldn't happen now as generationConfig wrapper is removed. Kept for posterity.
                  errorMessage = `AI modeli (${finalModelToUse}) yapılandırmada 'generationConfig' anahtarını tanımadı (Admin Gördü). MaxOutputTokens doğrudan config altında olmalı. Detay: ${error.message.substring(0,250)}`;
                } else if (error.message.includes('400 Bad Request')) { 
                  errorMessage = `AI modeli (${finalModelToUse}) geçersiz bir istek aldığını belirtti (400 Bad Request - Admin Gördü). İstek parametrelerini kontrol edin. Model: ${finalModelToUse}, Token Limiti: ${maxTokensForOutput}. Detay: ${error.message.substring(0,250)}`;
                }
            }
        } else { // Non-admin users see a generic message
             errorMessage = `Bilgi kartları oluşturulurken bir sorunla karşılaşıldı (${finalModelToUse}). Sunucu yoğun olabilir veya beklenmedik bir hata oluştu. Lütfen biraz sonra tekrar deneyin veya farklı bir girdi kullanmayı deneyin.`;
        }

        return {
            flashcards: [],
            summaryTitle: `Hata: ${errorMessage}`
        };
    }
  }
);
    

    