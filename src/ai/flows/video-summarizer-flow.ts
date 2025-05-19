
'use server';
/**
 * @fileOverview YouTube videolarındaki eğitimsel içeriği özetleyen bir AI aracı.
 *
 * - summarizeVideo - YouTube video özetleme işlemini yöneten fonksiyon.
 * - VideoSummarizerInput - summarizeVideo fonksiyonu için giriş tipi.
 * - VideoSummarizerOutput - summarizeVideo fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { UserProfile } from '@/types';

export const VideoSummarizerInputSchema = z.object({
  youtubeUrl: z.string().url({ message: "Lütfen geçerli bir YouTube video URL'si girin." }).describe('Özetlenmesi istenen YouTube videosunun URL adresi.'),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı."),
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi."),
});
export type VideoSummarizerInput = z.infer<typeof VideoSummarizerInputSchema>;

export const VideoSummarizerOutputSchema = z.object({
  videoTitle: z.string().optional().describe('AI tarafından bulunabilirse videonun başlığı.'),
  summary: z.string().optional().describe('Videonun eğitimsel içeriğinin özeti.'),
  keyPoints: z.array(z.string()).optional().describe('Videodan çıkarılan anahtar noktalar.'),
  warnings: z.array(z.string()).optional().describe('Özetleme işlemiyle ilgili uyarılar (örn: Videoya erişilemedi, transkript bulunamadı).'),
});
export type VideoSummarizerOutput = z.infer<typeof VideoSummarizerOutputSchema>;

export async function summarizeVideo(input: VideoSummarizerInput): Promise<VideoSummarizerOutput> {
  return videoSummarizerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'videoSummarizerPrompt',
  input: {schema: VideoSummarizerInputSchema},
  output: {schema: VideoSummarizerOutputSchema},
  prompt: `Sen, YouTube videolarındaki eğitimsel içeriği (özellikle YKS'ye hazırlanan öğrenciler için) analiz edip özetleyen uzman bir AI eğitim asistanısın.
Görevin, verilen YouTube video URL'sindeki içeriği (başlık, açıklama ve eğer erişebiliyorsan transkript veya sesli içeriğin metin dökümü üzerinden) değerlendirerek öğrenci için en önemli bilgileri çıkarmaktır.

Kullanıcının Üyelik Planı: {{{userPlan}}}
{{#ifEquals userPlan "pro"}}
(Pro Kullanıcılar İçin: Özetini, videonun en derin ve nüanslı noktalarını yakalayacak şekilde, konular arası bağlantıları da dikkate alarak yap. Öğrencinin videodan maksimum faydayı sağlaması için en kapsamlı ve stratejik içgörüleri sun.)
{{else ifEquals userPlan "premium"}}
(Premium Kullanıcılar İçin: Daha detaylı bir özet, ek örnekler ve videonun farklı açılardan değerlendirilmesini sunmaya özen göster.)
{{/ifEquals}}

{{#if customModelIdentifier}}
(Admin Notu: Bu çözüm, özel olarak seçilmiş '{{{customModelIdentifier}}}' modeli kullanılarak üretilmektedir.)
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
    inputSchema: VideoSummarizerInputSchema,
    outputSchema: VideoSummarizerOutputSchema,
  },
  async (input: VideoSummarizerInput): Promise<VideoSummarizerOutput> => {
    let modelToUse = 'googleai/gemini-1.5-flash-latest'; // Varsayılan
    let callOptions: { model: string; config?: Record<string, any> } = { model: modelToUse };

    const isCustomModelSelected = !!input.customModelIdentifier;
    const isProUser = input.userPlan === 'pro';
    const isGemini25PreviewSelected = input.customModelIdentifier === 'experimental_gemini_2_5_flash_preview';

    const enrichedInput = {
      ...input,
      isProUser,
      isCustomModelSelected,
      isGemini25PreviewSelected,
    };

    if (input.customModelIdentifier) {
      switch (input.customModelIdentifier) {
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
          console.warn(`[Video Summarizer Flow] Unknown customModelIdentifier: ${input.customModelIdentifier}. Defaulting to ${modelToUse}`);
      }
    } else if (input.userPlan === 'pro') {
      modelToUse = 'googleai/gemini-1.5-flash-latest';
    }

    callOptions.model = modelToUse;

    if (modelToUse !== 'googleai/gemini-2.5-flash-preview-04-17') {
      callOptions.config = {
        generationConfig: {
          maxOutputTokens: 4096,
        }
      };
    } else {
        callOptions.config = {};
    }
    
    console.log(`[Video Summarizer Flow] Using model: ${modelToUse} for plan: ${input.userPlan}, customModel: ${input.customModelIdentifier}`);

    try {
      const {output} = await prompt(enrichedInput, callOptions);
      if (!output) {
        return {
          warnings: ["Yapay zeka modelinden bir yanıt alınamadı."]
        };
      }
      if (!output.summary && (!output.keyPoints || output.keyPoints.length === 0) && (!output.warnings || output.warnings.length === 0)) {
         return {
          ...output,
          warnings: [...(output.warnings || []), "Video içeriği özetlenemedi veya erişilemedi. Lütfen URL'yi kontrol edin veya farklı bir video deneyin."]
        };
      }
      return output;
    } catch (error: any) {
      console.error(`[Video Summarizer Flow] CRITICAL error during prompt execution with model ${modelToUse}:`, error);
      let errorMessage = "Video özetlenirken sunucu tarafında beklenmedik bir hata oluştu.";
      if (error.message) {
        errorMessage += ` Detay: ${error.message.substring(0, 200)}`;
      }
      return {
        warnings: [errorMessage]
      };
    }
  }
);
    