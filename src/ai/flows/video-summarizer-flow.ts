
'use server';
/**
 * @fileOverview YouTube videolarındaki eğitimsel içeriği özetleyen bir AI aracı.
 *
 * - summarizeVideo - YouTube video özetleme işlemini yöneten fonksiyon.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';


const VideoSummarizerInputSchema = z.object({
  youtubeUrl: z.string().url({ message: "Lütfen geçerli bir YouTube video URL'si girin." }).describe('Özetlenmesi istenen YouTube videosunun URL adresi.'),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı."),
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi."),
});

const EnrichedVideoSummarizerInputSchema = VideoSummarizerInputSchema.extend({
    isProUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
});

type VideoSummarizerInput = z.infer<typeof VideoSummarizerInputSchema>; 

const VideoSummarizerOutputSchema = z.object({
  videoTitle: z.string().optional().describe('AI tarafından bulunabilirse videonun başlığı.'),
  summary: z.string().optional().describe('Videonun eğitimsel içeriğinin özeti.'),
  keyPoints: z.array(z.string()).optional().describe('Videodan çıkarılan anahtar noktalar.'),
  warnings: z.array(z.string()).optional().describe('Özetleme işlemiyle ilgili uyarılar (örn: Videoya erişilemedi, transkript bulunamadı).'),
});
type VideoSummarizerOutput = z.infer<typeof VideoSummarizerOutputSchema>;

export async function summarizeVideo(input: VideoSummarizerInput): Promise<VideoSummarizerOutput> {
  const isProUser = input.userPlan === 'pro';
  const isCustomModelSelected = !!input.customModelIdentifier;
  const isGemini25PreviewSelected = input.customModelIdentifier === 'experimental_gemini_2_5_flash_preview';

  const enrichedInputForPrompt = {
    ...input,
    isProUser,
    isCustomModelSelected,
    isGemini25PreviewSelected,
  };
  return videoSummarizerFlow(enrichedInputForPrompt);
}

const videoSummarizerPrompt = ai.definePrompt({
  name: 'videoSummarizerPrompt',
  input: {schema: EnrichedVideoSummarizerInputSchema}, 
  output: {schema: VideoSummarizerOutputSchema},
  prompt: `Sen, YouTube videolarındaki eğitimsel içeriği (özellikle YKS'ye hazırlanan öğrenciler için) analiz edip özetleyen uzman bir AI eğitim asistanısın.
Görevin, verilen YouTube video URL'sindeki içeriği (başlık, açıklama ve eğer erişebiliyorsan transkript veya sesli içeriğin metin dökümü üzerinden) değerlendirerek öğrenci için en önemli bilgileri çıkarmaktır.

Kullanıcının Üyelik Planı: {{{userPlan}}}
{{#if isProUser}}
(Pro Kullanıcılar İçin: Özetini, videonun en derin ve nüanslı noktalarını yakalayacak şekilde, konular arası bağlantıları da dikkate alarak yap. Öğrencinin videodan maksimum faydayı sağlaması için en kapsamlı ve stratejik içgörüleri sun. {{#if isCustomModelSelected}}En gelişmiş AI yeteneklerini ve seçilen '{{{customModelIdentifier}}}' modelini kullan.{{else}}En gelişmiş AI yeteneklerini kullan.{{/if}})
{{else ifEquals userPlan "premium"}}
(Premium Kullanıcılar İçin: Daha detaylı bir özet, ek örnekler ve videonun farklı açılardan değerlendirilmesini sunmaya özen göster. {{#if isCustomModelSelected}}Seçilen '{{{customModelIdentifier}}}' modelini kullan.{{/if}})
{{else}}
({{{userPlan}}} Kullanıcılar İçin: Videonun ana eğitimsel mesajını ve temel çıkarımlarını özetle. {{#if isCustomModelSelected}}Seçilen '{{{customModelIdentifier}}}' modelini kullan.{{/if}})
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Bu çözüm, özel olarak seçilmiş '{{{customModelIdentifier}}}' modeli kullanılarak üretilmektedir.)
  {{#if isGemini25PreviewSelected}}
  (Gemini 2.5 Flash Preview Özel Notu: Verilen YouTube URL'sindeki videonun BAŞLIĞINI ve AÇIKLAMASINI analiz et. Eğer erişebiliyorsan TRANSKRİPTİNE odaklan. Bu bilgilerden yola çıkarak videonun ANA EĞİTİMSEL konusunu, en önemli 2-3 ANAHTAR ÖĞRENİM NOKTASINI ve genel bir ÖZETİNİ kısa, net ve YKS öğrencisine faydalı olacak şekilde çıkar. HIZLI yanıt vermesi önemlidir.)
  {{/if}}
{{/if}}

İşlenecek YouTube Video URL'si:
{{{youtubeUrl}}}

Lütfen bu videoyu analiz et ve aşağıdaki formatta bir çıktı oluştur:

1.  **Video Başlığı (videoTitle) (isteğe bağlı)**: Eğer videonun başlığını belirleyebiliyorsan buraya yaz.
2.  **Özet (summary) (isteğe bağlı)**: Videonun ana eğitimsel mesajını, anlatılan konuyu ve önemli çıkarımları içeren, öğrencinin anlayacağı dilde bir özet.
3.  **Anahtar Noktalar (keyPoints) (isteğe bağlı)**: Videoda vurgulanan en önemli 3-5 anahtar kavram, tanım, formül veya öğrenilmesi gereken bilgi.
4.  **Uyarılar (warnings) (isteğe bağlı)**: Eğer videoya erişirken, içeriğini işlerken (örn: transkript bulamama, içeriğin özetlemeye uygun olmaması) bir sorunla karşılaşırsan veya özetin kalitesi hakkında bir çekincen varsa, bu durumu burada açıkla. Örneğin: "Video transkriptine erişilemediği için özet, videonun başlık ve açıklamasına göre yapılmıştır.", "Bu video daha çok görsel içerikli olduğu için metinsel özeti sınırlıdır."

Eğer video içeriğine (transkript, başlık, açıklama vb.) erişemiyorsan veya anlamlı bir eğitimsel özet çıkaramıyorsan, 'summary' ve 'keyPoints' alanlarını boş bırakarak 'warnings' alanında bu durumu açıkça belirt. Öncelikli hedefin, YKS öğrencileri için ders niteliğindeki videolardan faydalı bilgiler çıkarmaktır.
`,
});

const videoSummarizerFlow = ai.defineFlow(
  {
    name: 'videoSummarizerFlow',
    inputSchema: EnrichedVideoSummarizerInputSchema, 
    outputSchema: VideoSummarizerOutputSchema,
  },
  async (enrichedInput: z.infer<typeof EnrichedVideoSummarizerInputSchema>): Promise<VideoSummarizerOutput> => { 
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
          console.warn(`[Video Summarizer Flow] Unknown customModelIdentifier: ${enrichedInput.customModelIdentifier}. Defaulting to ${modelToUse}`);
      }
    } else if (enrichedInput.isProUser) { 
      modelToUse = 'googleai/gemini-1.5-flash-latest';
    }
    
    callOptions.model = modelToUse;
    
    // For video summarizer, let's avoid sending generationConfig by default for any Google model for now
    // as it might be causing issues, especially if the model has specific ways of handling media.
    callOptions.config = {}; 
    
    console.log(`[Video Summarizer Flow] Using model: ${modelToUse} for plan: ${enrichedInput.userPlan}, customModel: ${enrichedInput.customModelIdentifier} with callOptions:`, JSON.stringify(callOptions));

    try {
      const {output} = await prompt(enrichedInput, callOptions); 
      
      if (!output) {
         console.warn(`[Video Summarizer Flow] AI model (${modelToUse}) returned null or undefined output.`);
        return {
          warnings: [`Yapay zeka modeli (${modelToUse}) bir yanıt üretemedi.`]
        };
      }
      
      if (!output.summary && (!output.keyPoints || output.keyPoints.length === 0) && (!output.warnings || output.warnings.length === 0)) {
         return {
          ...output,
          warnings: [...(output.warnings || []), `Video içeriği (${modelToUse} ile) özetlenemedi veya erişilemedi. Lütfen URL'yi kontrol edin veya farklı bir video deneyin.`]
        };
      }
      return output;
    } catch (error: any) {
      console.error(`[Video Summarizer Flow] CRITICAL error during prompt execution with model ${modelToUse}:`, error);
      let errorMessage = `Video özetlenirken sunucu tarafında beklenmedik bir hata oluştu (Model: ${modelToUse}).`;
      if (error.message) {
        errorMessage += ` Detay: ${error.message.substring(0, 250)}`;
        if (error.message.includes('Invalid JSON payload')) {
            errorMessage += ` (JSON Hatası algılandı. Geliştiriciye bildirin.)`;
        } else if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
            errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen video içeriğini kontrol edin. Model: ${modelToUse}. Detay: ${error.message.substring(0, 150)}`;
        }
      }
      
      return {
        warnings: [errorMessage]
      };
    }
  }
);

    