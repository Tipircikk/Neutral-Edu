
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
  const isCustomModelSelected = !!input.customModelIdentifier;
  const isGemini25PreviewSelected = input.customModelIdentifier === 'experimental_gemini_2_5_flash_preview';

  const enrichedInput = {
    ...input,
    isProUser,
    isCustomModelSelected,
    isGemini25PreviewSelected,
  };
  return topicSummarizerFlow(enrichedInput);
}

const prompt = ai.definePrompt({
  name: 'topicSummarizerPrompt',
  input: {schema: SummarizeTopicInputSchema.extend({
    isProUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
  })},
  output: {schema: SummarizeTopicOutputSchema},
  prompt: `Sen, Yükseköğretim Kurumları Sınavı (YKS) için öğrencilere karmaşık akademik konuları ve uzun metinleri en hızlı ve etkili şekilde özümsetme, bilginin özünü damıtma, en kritik noktaları belirleme ve YKS bağlantılarını kurma konusunda uzmanlaşmış, son derece bilgili ve pedagojik yetenekleri gelişmiş bir AI YKS danışmanısın.
Görevin, {{{inputText}}} girdisini (bu bir YKS konu başlığı veya doğrudan bir metin olabilir) derinlemesine analiz etmek ve öğrencinin YKS'de başarılı olmasına yardımcı olacak şekilde, seçilen {{{summaryLength}}} uzunluğuna ve {{{outputFormat}}} çıktı formatına uygun, kapsamlı bir yanıt hazırlamaktır. Cevapların her zaman Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: {{{inputText}}} konusunu veya metnini, bir üniversite profesörünün titizliğiyle, en ince ayrıntılarına kadar analiz et. Konunun felsefi temellerine, tarihsel gelişimine ve YKS dışındaki akademik dünyadaki yerine dahi değin. En kapsamlı, en derin ve en düşündürücü özeti sunmak için en gelişmiş AI yeteneklerini kullan. Metindeki örtük anlamları, farklı disiplinlerle olan kesişimlerini ve konunun YKS ötesindeki akademik önemini dahi analizine dahil et.)
{{else ifEquals userPlan "premium"}}
(Premium Kullanıcı Notu: Özetlerin derinliğini artır, daha fazla bağlantı kur, farklı bakış açıları sun ve konuyu daha geniş bir perspektiften ele al. Standart kullanıcıya göre daha zenginleştirilmiş ve detaylı bir içerik sağla.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Bu çözüm, özel olarak seçilmiş '{{{customModelIdentifier}}}' modeli kullanılarak üretilmektedir.)
{{/if}}

İstenen Çıktı Bölümleri:
1.  **Konu Özeti (topicSummary)**: Girdinin açık, anlaşılır, akıcı ve YKS odaklı bir özeti. {{{summaryLength}}} uzunluğa göre detay seviyesini ayarla:
    *   'short': Konunun YKS için en can alıcı noktalarını içeren 2-3 cümlelik bir özet.
    *   'medium': Ana argümanları, önemli tanımları ve YKS için kritik alt başlıkları içeren, dengeli ve öğretici bir metin.
    *   'detailed': Konunun tüm önemli yönlerini, örneklerini ve YKS'de çıkabilecek detaylarını içeren daha kapsamlı, yapılandırılmış bir özet.
    İstenen çıktı formatı '{{{outputFormat}}}' olacak şekilde sun. Eğer 'bullet_points' seçildiyse, her maddeyi açıklayıcı ve YKS'ye yönelik bilgilerle zenginleştir. 'paragraph' seçildiyse, akıcı paragraflar kullan.
2.  **Anahtar Kavramlar (keyConcepts) (isteğe bağlı)**: Özette geçen veya konuyu anlamak için YKS'de kesinlikle bilinmesi gereken 3-5 temel kavramı, terimi, formülü veya önemli ismi listele. Her bir anahtar kavram için:
    *   Kavramın kendisi.
    *   YKS öğrencisinin anlayacağı dilde, kısa ve net bir tanımı/açıklaması.
    *   Bu kavramın YKS'deki önemi veya hangi tür sorularda karşımıza çıkabileceği hakkında bir not.
3.  **YKS Bağlantıları ve Stratejileri (yksConnections) (isteğe bağlı)**: Bu konunun YKS müfredatındaki diğer konularla nasıl bir ilişkisi olduğunu veya YKS'de bu konuyla ilgili soruları çözerken dikkat edilmesi gereken 2-3 önemli strateji veya püf noktası belirt.
4.  **Kaynak Güvenilirliği / Bilgi Notu (sourceReliability) (isteğe bağlı, eğer girdi bir konu başlığı ise)**: Eğer girdi doğrudan bir metin değil de bir konu başlığı ise, bu konudaki bilgilerin YKS açısından genel geçerliliği, müfredattaki yeri ve kaynakların güvenilirliği hakkında kısa bir yorum yap.

Yanıtını hazırlarken, öğrencinin konuyu temelden başlayarak en ileri YKS seviyesine kadar hızla kavramasına ve gerekirse daha derinlemesine araştırma yapması için sağlam bir başlangıç noktası oluşturmasına yardımcı ol. Aşırı teknik jargondan kaçın veya YKS öğrencisi için gerekli ise mutlaka açıkla. Bilgilerin doğruluğundan ve YKS'ye uygunluğundan emin ol.
`,
});

const topicSummarizerFlow = ai.defineFlow(
  {
    name: 'topicSummarizerFlow',
    inputSchema: SummarizeTopicInputSchema.extend({ // Enriched input for prompt
        isProUser: z.boolean().optional(),
        isCustomModelSelected: z.boolean().optional(),
        isGemini25PreviewSelected: z.boolean().optional(),
    }),
    outputSchema: SummarizeTopicOutputSchema,
  },
  async (enrichedInput: SummarizeTopicInput & {isProUser?: boolean; isCustomModelSelected?: boolean; isGemini25PreviewSelected?: boolean} ): Promise<SummarizeTopicOutput> => {
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
          console.warn(`[Topic Summarizer Flow] Unknown customModelIdentifier: ${enrichedInput.customModelIdentifier}. Defaulting to ${modelToUse}`);
      }
    } else if (enrichedInput.isProUser) { // Fallback to a better model for Pro if no custom admin model
      modelToUse = 'googleai/gemini-1.5-flash-latest';
    }
    // For free/premium users without admin override, default is gemini-1.5-flash-latest (set initially)

    callOptions.model = modelToUse;

    let maxTokensForOutput = 2048; // Default for medium
    if (enrichedInput.summaryLength === 'detailed') maxTokensForOutput = 8000; // Cap for most models
    else if (enrichedInput.summaryLength === 'short') maxTokensForOutput = 1024;


    if (modelToUse !== 'googleai/gemini-2.5-flash-preview-04-17') {
      callOptions.config = {
        generationConfig: {
          maxOutputTokens: maxTokensForOutput,
        }
      };
    } else {
        callOptions.config = {}; // No generationConfig for preview model
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
        // Return a valid SummarizeTopicOutput object even in case of error
        return {
            topicSummary: errorMessage,
            keyConcepts: [],
            yksConnections: [],
            sourceReliability: "Hata oluştu, güvenilirlik değerlendirilemedi."
        };
    }
  }
);
    
