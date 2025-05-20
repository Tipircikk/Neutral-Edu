
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
  return topicSummarizerFlow(enrichedInput);
}

const prompt = ai.definePrompt({
  name: 'topicSummarizerPrompt',
  input: {schema: SummarizeTopicInputSchema.extend({
    isProUser: z.boolean().optional(),
    isPremiumUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
  })},
  output: {schema: SummarizeTopicOutputSchema},
  prompt: `Sen, YKS için öğrencilere karmaşık konuları ve uzun metinleri hızla özümseten, bilginin özünü damıtan, en kritik noktaları belirleyen ve YKS bağlantılarını kuran uzman bir AI YKS danışmanısın.
Görevin, {{{inputText}}} girdisini (bu bir YKS konu başlığı veya metin olabilir) analiz etmek ve YKS'de başarılı olmasına yardımcı olacak şekilde, {{{summaryLength}}} uzunluğuna ve {{{outputFormat}}} formatına uygun bir yanıt hazırlamaktır. Cevapların Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: {{{inputText}}} konusunu/metnini en ince ayrıntılarına kadar analiz et. Konunun felsefi temellerine, tarihsel gelişimine ve YKS dışındaki akademik dünyadaki yerine dahi değin. En kapsamlı ve düşündürücü özeti sun.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: Özetlerin derinliğini artır, daha fazla bağlantı kur ve konuyu daha geniş bir perspektiften ele al.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' kullanılıyor.)
  {{#if isGemini25PreviewSelected}}
  (Gemini 2.5 Flash Preview 05-20 Notu: Yanıtların ÖZ ama ANLAŞILIR olsun. HIZLI yanıtla.)
  {{/if}}
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
    inputSchema: SummarizeTopicInputSchema.extend({
        isProUser: z.boolean().optional(),
        isPremiumUser: z.boolean().optional(),
        isCustomModelSelected: z.boolean().optional(),
        isGemini25PreviewSelected: z.boolean().optional(),
    }),
    outputSchema: SummarizeTopicOutputSchema,
  },
  async (enrichedInput: z.infer<typeof SummarizeTopicInputSchema> & {isProUser?: boolean; isPremiumUser?: boolean; isCustomModelSelected?: boolean; isGemini25PreviewSelected?: boolean} ): Promise<SummarizeTopicOutput> => {
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
          console.warn(`[Topic Summarizer Flow] Unknown customModelIdentifier: ${enrichedInput.customModelIdentifier}. Defaulting to ${modelToUse}`);
      }
    } else if (enrichedInput.isProUser) {
      modelToUse = 'googleai/gemini-1.5-flash-latest';
    } else {
      modelToUse = 'googleai/gemini-2.0-flash'; // Default for free/premium
    }

    callOptions.model = modelToUse;

    let maxTokensForOutput = 2048; // Default for medium
    if (enrichedInput.summaryLength === 'detailed') maxTokensForOutput = 8000;
    else if (enrichedInput.summaryLength === 'short') maxTokensForOutput = 1024;


    if (modelToUse !== 'googleai/gemini-2.5-flash-preview-05-20') {
      callOptions.config = {
        generationConfig: {
          maxOutputTokens: maxTokensForOutput,
        }
      };
    } else {
        callOptions.config = {};
    }

    console.log(`[Topic Summarizer Flow] Using model: ${modelToUse} for plan: ${enrichedInput.userPlan}, customModel: ${enrichedInput.customModelIdentifier}`);

    try {
        const {output} = await prompt(enrichedInput, callOptions);
        if (!output || !output.topicSummary) {
        throw new Error("AI YKS Danışmanı, belirtilen konu veya metin için YKS odaklı bir özet oluşturamadı. Lütfen girdiyi kontrol edin.");
        }
        return output;
    } catch (error: any) {
        console.error(`[Topic Summarizer Flow] Error during generation with model ${modelToUse}:`, error);
        let errorMessage = `AI modeli (${modelToUse}) ile konu özeti oluşturulurken bir hata oluştu.`;
        if (error.message) {
            errorMessage += ` Detay: ${error.message.substring(0, 200)}`;
             if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
              errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen konunuzu gözden geçirin. Model: ${modelToUse}. Detay: ${error.message.substring(0, 150)}`;
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
    