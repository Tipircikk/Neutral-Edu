
'use server';
/**
 * @fileOverview Kullanıcının girdiği bir konuyu veya metni AI kullanarak özetleyen bir ajan.
 *
 * - summarizeTopic - Konu veya metin özetleme işlemini yöneten fonksiyon.
 * - SummarizeTopicInput - summarizeTopic fonksiyonu için giriş tipi.
 * - SummarizeTopicOutput - summarizeTopic fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Kullanıcının özetlenmesini istediği konuyu veya metni alır.
const SummarizeTopicInputSchema = z.object({
  inputText: z.string().describe('Özetlenecek konu başlığı veya doğrudan metin içeriği.'),
  summaryLength: z.enum(["short", "medium", "detailed"]).optional().default("medium").describe("İstenen özetin uzunluğu."),
  outputFormat: z.enum(["paragraph", "bullet_points"]).optional().default("paragraph").describe("Özetin çıktı formatı: Paragraf veya madde işaretleri."),
});
export type SummarizeTopicInput = z.infer<typeof SummarizeTopicInputSchema>;

// AI'nın üreteceği konu özetinin yapısını tanımlar.
const SummarizeTopicOutputSchema = z.object({
  topicSummary: z.string().describe('Konunun veya metnin AI tarafından oluşturulmuş özeti.'),
  keyConcepts: z.array(z.string()).optional().describe('Özette vurgulanan anahtar kavramlar veya terimler.'),
  sourceReliability: z.string().optional().describe('Eğer girdi bir konu başlığı ise, AI\'nın bu konudaki genel bilgiye ne kadar güvendiği hakkında kısa bir not (örneğin, "Genel kabul görmüş bilgi", "Spekülatif konu").'),
});
export type SummarizeTopicOutput = z.infer<typeof SummarizeTopicOutputSchema>;

export async function summarizeTopic(input: SummarizeTopicInput): Promise<SummarizeTopicOutput> {
  // TODO: Kullanıcı kotasını ve yetkilendirmesini burada kontrol et.
  return topicSummarizerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'topicSummarizerPrompt',
  input: {schema: SummarizeTopicInputSchema},
  output: {schema: SummarizeTopicOutputSchema},
  prompt: `Sen karmaşık konuları ve uzun metinleri öğrencilerin kolayca anlayabileceği şekilde özetleyen uzman bir AI eğitim asistanısın.
Amacın, girilen konu veya metnin özünü yakalayarak, ana fikirlerini ve önemli detaylarını {{summaryLength}} uzunluğunda ve {{outputFormat}} formatında sunmaktır.

Özetlenecek Girdi:
{{{inputText}}}

Lütfen bu girdiyi analiz et ve aşağıdaki formatta bir yanıt hazırla:
1.  **Konu Özeti**: Girdinin açık, anlaşılır ve eğitici bir dille yazılmış özeti. İstenen uzunluğa ({{summaryLength}}) ve formata ({{outputFormat}}) dikkat et.
2.  **Anahtar Kavramlar (isteğe bağlı)**: Özette geçen veya konuyla ilgili bilinmesi gereken temel kavramları listele.
3.  **Kaynak Güvenilirliği (isteğe bağlı, eğer girdi bir konu başlığı ise)**: Eğer girdi sadece bir konu başlığı ise (doğrudan metin değilse), bu konudaki bilgilerin genel geçerliliği hakkında kısa bir yorum yap (örn: "Bu konu hakkında genel ve yaygın bilgi bulunmaktadır.", "Bu konu daha çok teorik ve yoruma açıktır.").

Yanıtını hazırlarken, öğrencinin konuyu temel düzeyde kavramasına ve daha derinlemesine araştırma yapması için bir başlangıç noktası oluşturmasına yardımcı ol.
`,
});

const topicSummarizerFlow = ai.defineFlow(
  {
    name: 'topicSummarizerFlow',
    inputSchema: SummarizeTopicInputSchema,
    outputSchema: SummarizeTopicOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output || !output.topicSummary) {
      throw new Error("AI, belirtilen konu veya metin için bir özet oluşturamadı.");
    }
    return output;
  }
);

// Örnek Kullanım (Geliştirme için):
/*
async function testSummarizeTopic() {
  try {
    const result = await summarizeTopic({ 
        inputText: "Kuantum bilgisayarlarının çalışma prensipleri ve gelecekteki potansiyel uygulamaları.",
        summaryLength: "medium",
        outputFormat: "bullet_points"
    });
    console.log("Konu Özeti:", result.topicSummary);
    if (result.keyConcepts) {
      console.log("Anahtar Kavramlar:", result.keyConcepts.join(", "));
    }
     if (result.sourceReliability) {
      console.log("Kaynak Güvenilirliği Notu:", result.sourceReliability);
    }
  } catch (error) {
    console.error("Konu özetleme testi sırasında hata:", error);
  }
}
// testSummarizeTopic();
*/

    