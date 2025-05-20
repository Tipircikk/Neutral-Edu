
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
    isPremiumUser: z.boolean().optional(),
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
  const isPremiumUser = input.userPlan === 'premium';
  const isCustomModelSelected = !!input.customModelIdentifier;
  const isGemini25PreviewSelected = input.customModelIdentifier === 'experimental_gemini_2_5_flash_preview_05_20';

  const enrichedInputForPrompt = {
    ...input,
    isProUser,
    isPremiumUser,
    isCustomModelSelected,
    isGemini25PreviewSelected,
  };
  return videoSummarizerFlow(enrichedInputForPrompt);
}

const videoSummarizerPrompt = ai.definePrompt({
  name: 'videoSummarizerPrompt',
  input: {schema: EnrichedVideoSummarizerInputSchema},
  output: {schema: VideoSummarizerOutputSchema},
  prompt: `Sen, YouTube videolarındaki eğitimsel içeriği (özellikle YKS öğrencileri için) analiz edip özetleyen bir AI eğitim asistanısın.
Görevin, verilen YouTube video URL'sindeki içeriği (başlık, açıklama, varsa transkript) değerlendirerek öğrenci için önemli bilgileri çıkarmaktır.

Kullanıcının Üyelik Planı: {{{userPlan}}}
{{#if isProUser}}
(Pro Kullanıcı Notu: Özetini, videonun derin noktalarını yakalayacak, konular arası bağlantıları da dikkate alarak yap. En kapsamlı içgörüleri sun.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: Daha detaylı bir özet ve videonun farklı açılardan değerlendirilmesini sun.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' kullanılıyor.)
  {{#if isGemini25PreviewSelected}}
  (Gemini 2.5 Flash Preview 05-20 Notu: Verilen YouTube URL'sindeki videonun BAŞLIĞINI ve AÇIKLAMASINI analiz et. Eğer erişebiliyorsan TRANSKRİPTİNE odaklan. Bu bilgilerden yola çıkarak videonun ANA EĞİTİMSEL konusunu, en önemli 2-3 ANAHTAR ÖĞRENİM NOKTASINI ve genel bir ÖZETİNİ kısa, net ve YKS öğrencisine faydalı olacak şekilde çıkar. Hızlı yanıt vermesi önemlidir.)
  {{/if}}
{{/if}}

İşlenecek YouTube Video URL'si:
{{{youtubeUrl}}}

Lütfen bu videoyu analiz et ve aşağıdaki formatta bir çıktı oluştur:

1.  **Video Başlığı (videoTitle) (isteğe bağlı)**: Videonun başlığı.
2.  **Özet (summary) (isteğe bağlı)**: Videonun ana eğitimsel mesajını ve önemli çıkarımlarını içeren özet.
3.  **Anahtar Noktalar (keyPoints) (isteğe bağlı)**: Videoda vurgulanan 3-5 anahtar kavram.
4.  **Uyarılar (warnings) (isteğe bağlı)**: Videoya erişirken veya işlerken bir sorunla karşılaşırsan (örn: transkript bulamama), bu durumu açıkla.

Eğitimsel özet çıkaramıyorsan, 'summary' ve 'keyPoints' alanlarını boş bırakarak 'warnings' alanında durumu belirt.
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
        case 'experimental_gemini_2_5_flash_preview_05_20':
          modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
          break;
        default:
          console.warn(`[Video Summarizer Flow] Unknown customModelIdentifier: ${enrichedInput.customModelIdentifier}. Defaulting to ${modelToUse}`);
      }
    } else if (enrichedInput.isProUser) {
      modelToUse = 'googleai/gemini-1.5-flash-latest';
    } else {
      modelToUse = 'googleai/gemini-2.0-flash'; // Default for free/premium
    }

    callOptions.model = modelToUse;
    callOptions.config = {}; // Avoid sending generationConfig for video summarizer for now, as it might cause issues with some models.

    console.log(`[Video Summarizer Flow] Using model: ${modelToUse} for plan: ${enrichedInput.userPlan}, customModel: ${enrichedInput.customModelIdentifier} with callOptions:`, JSON.stringify(callOptions.config));

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
        if (error.message.includes('Invalid JSON payload') || error.message.includes('Unknown name "config"')) {
            errorMessage = `AI modeli (${modelToUse}) ile iletişimde bir yapılandırma sorunu oluştu (Geçersiz JSON veya bilinmeyen config).`;
        } else if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
            errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen video içeriğini kontrol edin. Model: ${modelToUse}. Detay: ${error.message.substring(0, 150)}`;
        } else if (error.message.includes('400 Bad Request')) {
             errorMessage = `AI modeli (${modelToUse}) isteği işleyemedi (400 Bad Request). Video URL'si veya model uyumluluğunu kontrol edin. Detay: ${error.message.substring(0,150)}`;
        }
      }

      return {
        warnings: [errorMessage]
      };
    }
  }
);
    