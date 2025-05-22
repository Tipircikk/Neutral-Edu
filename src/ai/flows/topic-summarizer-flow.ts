
'use server';
/**
 * @fileOverview Kullanıcının girdiği bir YKS konusunu veya akademik metni, YKS öğrencisinin ihtiyaçlarına göre
 * derinlemesine analiz edip özetleyen, anahtar kavramları ve YKS için stratejik bilgileri sunan uzman bir AI bilgi sentezleyicisi.
 *
 * - summarizeTopic - Konu veya metin özetleme işlemini yöneten fonksiyon.
 * - SummarizeTopicInput - summarizeTopic fonksiyonu için giriş tipi.
 * - SummarizeTopicOutput - summarizeTopic fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { UserProfile } from '@/types';

const SummarizeTopicInputSchema = z.object({
  inputText: z.string().describe('Özetlenecek YKS konu başlığı (örn: "Organik Kimyada İzomeri", "Servet-i Fünun Dönemi Şiiri") veya doğrudan akademik metin içeriği.'),
  summaryLength: z.enum(["short", "medium", "detailed"]).optional().default("medium").describe("İstenen özetin YKS öğrencisi için ideal uzunluğu: 'short' (ana hatlar), 'medium' (dengeli ve kapsamlı), 'detailed' (çok derinlemesine)."),
  outputFormat: z.enum(["paragraph", "bullet_points"]).optional().default("paragraph").describe("Özetin çıktı formatı: 'paragraph' (akıcı metin) veya 'bullet_points' (maddeler halinde)."),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı."),
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi."),
});
export type SummarizeTopicInput = z.infer<typeof SummarizeTopicInputSchema>;

const SummarizeTopicOutputSchema = z.object({
  topicSummary: z.string().describe('Konunun veya metnin, YKS öğrencisinin anlayışını en üst düzeye çıkaracak şekilde, AI tarafından oluşturulmuş, yapılandırılmış ve kapsamlı özeti.'),
  keyConcepts: z.array(z.string()).optional().describe('Özette vurgulanan ve YKS için hayati öneme sahip 3-5 anahtar kavram, terim veya formül. Her birinin kısa bir YKS odaklı açıklamasıyla birlikte.'),
  yksConnections: z.array(z.string()).optional().describe("Bu konunun YKS'deki diğer konularla bağlantıları veya hangi soru tiplerinde karşımıza çıkabileceğine dair 2-3 ipucu."),
  sourceReliability: z.string().optional().describe('Eğer girdi bir konu başlığı ise, AI\'nın bu konudaki genel bilgiye ve YKS müfredatındaki yerine ne kadar güvendiği hakkında kısa bir not (örn: "YKS\'nin temel konularından biridir, güvenilir kaynaklardan teyit edilmiştir.", "Bu konu YKS\'de daha az sıklıkta çıkar, yoruma açıktır.").'),
});
export type SummarizeTopicOutput = z.infer<typeof SummarizeTopicOutputSchema>;

export async function summarizeTopic(input: SummarizeTopicInput): Promise<SummarizeTopicOutput> {
  console.log(`[Topic Summarizer Action] Received input. User Plan: ${input.userPlan}, Admin Model ID: '${input.customModelIdentifier}'`);

  let modelToUse: string;

  if (input.customModelIdentifier && typeof input.customModelIdentifier === 'string' && input.customModelIdentifier.trim() !== "") {
    const customIdLower = input.customModelIdentifier.toLowerCase().trim();
    console.log(`[Topic Summarizer Action] Admin specified customModelIdentifier: '${customIdLower}'`);
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
            console.warn(`[Topic Summarizer Action] Admin specified a direct Genkit model name: '${modelToUse}'. Ensure this model is supported.`);
        } else {
            console.warn(`[Topic Summarizer Action] Admin specified an UNKNOWN customModelIdentifier: '${input.customModelIdentifier}'. Falling back to universal default.`);
            modelToUse = 'googleai/gemini-2.5-flash-preview-05-20'; // Universal default
        }
        break;
    }
  } else { 
    console.log(`[Topic Summarizer Action] No custom model specified by admin. Using universal default.`);
    modelToUse = 'googleai/gemini-2.5-flash-preview-05-20'; // Universal default
  }
  
  // Absolute fallback if modelToUse is somehow still invalid
  if (typeof modelToUse !== 'string' || !modelToUse.startsWith('googleai/')) { 
      console.error(`[Topic Summarizer Action] CRITICAL FALLBACK: modelToUse was invalid ('${modelToUse}', type: ${typeof modelToUse}). Defaulting to gemini-2.5-flash-preview-05-20.`);
      modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
  }
  console.log(`[Topic Summarizer Action] Final model determined for flow: ${modelToUse}`);
  
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
  return topicSummarizerFlow(enrichedInput, modelToUse);
}

const promptInputSchema = SummarizeTopicInputSchema.extend({
    isProUser: z.boolean().optional(),
    isPremiumUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
});

const prompt = ai.definePrompt({
  name: 'topicSummarizerPrompt',
  input: {schema: promptInputSchema},
  output: {schema: SummarizeTopicOutputSchema},
  prompt: `Sen, YKS için öğrencilere karmaşık konuları ve uzun metinleri hızla özümseten, bilginin özünü damıtan, en kritik noktaları belirleyen ve YKS bağlantılarını kuran uzman bir AI YKS danışmanısın.
Görevin, {{{inputText}}} girdisini (bu bir YKS konu başlığı veya metin olabilir) analiz etmek ve YKS'de başarılı olmasına yardımcı olacak şekilde, {{{summaryLength}}} uzunluğuna ve {{{outputFormat}}} formatına uygun bir yanıt hazırlamaktır. Cevapların Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: Bu Pro seviyesindeki derinlemesine analiz ve özetleme, üyeliğinizin özel bir avantajıdır. {{{inputText}}} konusunu/metnini en ince ayrıntılarına kadar analiz et. Konunun felsefi temellerine, tarihsel gelişimine ve YKS dışındaki akademik dünyadaki yerine dahi değin. Anahtar kavramları ve YKS bağlantılarını en kapsamlı şekilde sun. Özetin, konuyu derinlemesine anlamayı sağlayacak zenginlikte olsun.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: Özetlerin derinliğini artır, daha fazla bağlantı kur ve konuyu daha geniş bir perspektiften ele al. Anahtar kavramları ve YKS bağlantılarını detaylı bir şekilde açıkla.)
{{else}}
(Ücretsiz Kullanıcı Notu: Konunun/metnin ana hatlarını içeren, anlaşılır ve temel bir özet sun. Anahtar kavramları ve YKS bağlantılarını kısaca belirt.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' seçildi.)
{{/if}}

{{#if isGemini25PreviewSelected}}
(Gemini 2.5 Flash Preview 05-20 Modeli Notu: Yanıtların ÖZ ama ANLAŞILIR ve YKS öğrencisine doğrudan fayda sağlayacak şekilde olsun. HIZLI yanıt vermeye odaklan. {{#if isProUser}}Pro kullanıcı için gereken derinliği ve kapsamlı analizi koruyarak{{else if isPremiumUser}}Premium kullanıcı için gereken detaylı bağlantıları ve açıklamaları sağlayarak{{/if}} gereksiz uzun açıklamalardan ve süslemelerden kaçın, doğrudan konuya girerek en kritik bilgileri vurgula.)
{{/if}}

İstenen Çıktı Bölümleri:
1.  **Konu Özeti (topicSummary)**: Girdinin açık, anlaşılır, YKS odaklı özeti. {{{summaryLength}}} uzunluğa ve '{{{outputFormat}}}' formatına göre ayarla.
2.  **Anahtar Kavramlar (keyConcepts) (isteğe bağlı)**: YKS için 3-5 temel kavram, terim, formül. Her birinin kısa YKS odaklı açıklaması.
3.  **YKS Bağlantıları ve Stratejileri (yksConnections) (isteğe bağlı)**: Konunun YKS'deki diğer konularla ilişkisi veya 2-3 YKS stratejisi.
4.  **Kaynak Güvenilirliği / Bilgi Notu (sourceReliability) (isteğe bağlı, eğer girdi bir konu başlığı ise)**: Konunun YKS açısından geçerliliği hakkında kısa yorum.

Bilgilerin doğruluğundan ve YKS'ye uygunluğundan emin ol.
`,
});

const topicSummarizerFlow = ai.defineFlow(
  {
    name: 'topicSummarizerFlow',
    inputSchema: promptInputSchema,
    outputSchema: SummarizeTopicOutputSchema,
  },
  async (enrichedInput: z.infer<typeof promptInputSchema>, modelToUseParam: string ): Promise<SummarizeTopicOutput> => {
    
    let finalModelToUse = modelToUseParam;
    console.log(`[Topic Summarizer Flow] Initial modelToUseParam: '${finalModelToUse}', type: ${typeof finalModelToUse}`);

    if (typeof finalModelToUse !== 'string' || !finalModelToUse.startsWith('googleai/')) {
        console.warn(`[Topic Summarizer Flow] Invalid or non-string modelToUseParam ('${finalModelToUse}', type: ${typeof finalModelToUse}) received in flow. Defaulting to universal default.`);
        finalModelToUse = 'googleai/gemini-2.5-flash-preview-05-20'; // Universal default
        console.log(`[Topic Summarizer Flow] Corrected/Defaulted model INSIDE FLOW to: ${finalModelToUse}`);
    }
    
    const standardTemperature = 0.6;
    const standardSafetySettings = [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ];
    
    let maxTokensForOutput = 2048; 
    if (enrichedInput.summaryLength === 'detailed') maxTokensForOutput = 8192;
    else if (enrichedInput.summaryLength === 'short') maxTokensForOutput = 1024;
     if ((enrichedInput.isProUser || enrichedInput.isPremiumUser) && enrichedInput.summaryLength === 'detailed') {
        maxTokensForOutput = 8192; 
    } else if (enrichedInput.isProUser || enrichedInput.isPremiumUser) {
        maxTokensForOutput = Math.max(maxTokensForOutput, 4096); 
    }


    const callOptions: { model: string; config?: Record<string, any> } = { 
        model: finalModelToUse,
        config: {
            temperature: standardTemperature,
            safetySettings: standardSafetySettings,
            maxOutputTokens: maxTokensForOutput,
        }
    };

    const promptInputForLog = { ...enrichedInput, resolvedModelUsed: finalModelToUse };
    console.log(`[Topic Summarizer Flow] Using Genkit model: ${finalModelToUse} for plan: ${enrichedInput.userPlan}, customModel (raw): ${enrichedInput.customModelIdentifier}, with config: ${JSON.stringify(callOptions.config)}`);

    try {
        const {output} = await prompt(promptInputForLog, callOptions);
        if (!output || !output.topicSummary) {
        console.error(`[Topic Summarizer Flow] AI did not produce valid summary. Model: ${finalModelToUse}. Output:`, JSON.stringify(output).substring(0,300));
        throw new Error(`AI YKS Danışmanı (${finalModelToUse}), belirtilen konu veya metin için YKS odaklı bir özet oluşturamadı. Lütfen girdiyi kontrol edin.`);
        }
        return output;
    } catch (error: any) {
        console.error(`[Topic Summarizer Flow] Error during generation with model ${finalModelToUse}. Error details:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        let errorMessage = `AI modeli (${finalModelToUse}) ile konu özeti oluşturulurken bir hata oluştu.`;
        if (error.message) {
            errorMessage += ` Detay: ${error.message.substring(0, 300)}`;
             if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
              errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen konunuzu gözden geçirin. Model: ${finalModelToUse}. Detay: ${error.message.substring(0, 150)}`;
            } else if (error.name === 'GenkitError' && error.message.includes('Schema validation failed')) {
              errorMessage = `AI modeli (${finalModelToUse}) beklenen yanıta uymayan bir çıktı üretti (Schema validation failed). Detay: ${error.message.substring(0,350)}`;
            }
        }

        return {
            topicSummary: errorMessage,
            keyConcepts: [],
            yksConnections: [],
            sourceReliability: "Hata oluştu, güvenilirlik değerlendirilemedi."
        };
    }
  }
);
    