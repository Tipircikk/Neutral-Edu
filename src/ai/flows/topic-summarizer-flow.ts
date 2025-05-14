
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

const SummarizeTopicInputSchema = z.object({
  inputText: z.string().describe('Özetlenecek konu başlığı veya doğrudan metin içeriği.'),
  summaryLength: z.enum(["short", "medium", "detailed"]).optional().default("medium").describe("İstenen özetin uzunluğu."),
  outputFormat: z.enum(["paragraph", "bullet_points"]).optional().default("paragraph").describe("Özetin çıktı formatı: Paragraf veya madde işaretleri."),
});
export type SummarizeTopicInput = z.infer<typeof SummarizeTopicInputSchema>;

const SummarizeTopicOutputSchema = z.object({
  topicSummary: z.string().describe('Konunun veya metnin AI tarafından oluşturulmuş özeti.'),
  keyConcepts: z.array(z.string()).optional().describe('Özette vurgulanan anahtar kavramlar veya terimler.'),
  sourceReliability: z.string().optional().describe('Eğer girdi bir konu başlığı ise, AI\'nın bu konudaki genel bilgiye ne kadar güvendiği hakkında kısa bir not (örneğin, "Genel kabul görmüş bilgi", "Spekülatif konu").'),
});
export type SummarizeTopicOutput = z.infer<typeof SummarizeTopicOutputSchema>;

export async function summarizeTopic(input: SummarizeTopicInput): Promise<SummarizeTopicOutput> {
  return topicSummarizerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'topicSummarizerPrompt',
  input: {schema: SummarizeTopicInputSchema},
  output: {schema: SummarizeTopicOutputSchema},
  prompt: `Sen, karmaşık konuları ve uzun metinleri öğrencilerin hızla ve etkili bir şekilde anlayabileceği özlü özetlere dönüştürme konusunda uzmanlaşmış bir AI bilgi sentezleyicisisin. 
Görevin, bilginin özünü damıtmak, en kritik noktaları belirlemek ve öğrencinin zamandan tasarruf etmesini sağlamaktır.

Özetlenecek Girdi:
{{{inputText}}}

Lütfen bu girdiyi analiz et ve aşağıdaki formatta, istenen detay seviyesine ({{summaryLength}}) ve çıktı formatına ({{outputFormat}}) uygun bir yanıt hazırla:

1.  **Konu Özeti**: Girdinin açık, anlaşılır ve özlü bir özeti. {{summaryLength}} uzunluğa göre, "short" ise birkaç kilit cümle, "medium" ise ana argümanları içeren bir paragraf, "detailed" ise alt başlıkları da kapsayan daha kapsamlı bir özet sun. {{outputFormat}} formatını dikkate alarak, paragraf veya madde işaretleri şeklinde sun.
2.  **Anahtar Kavramlar (isteğe bağlı)**: Özette geçen veya konuyu anlamak için kritik öneme sahip 3-5 temel kavramı veya terimi listele. Bu, öğrencinin odaklanması gereken terminolojiyi belirlemesine yardımcı olur.
3.  **Kaynak Güvenilirliği / Bilgi Notu (isteğe bağlı, eğer girdi bir konu başlığı ise)**: Eğer girdi doğrudan bir metin değil de bir konu başlığı ise, bu konudaki bilgilerin genel geçerliliği veya niteliği hakkında kısa bir yorum yap (örn: "Bu konu hakkında genel ve yaygın bilimsel konsensüs bulunmaktadır.", "Bu konu daha çok teorik ve çeşitli yorumlara açıktır.", "Bu, hızla gelişen yeni bir araştırma alanıdır.").

Yanıtını hazırlarken, öğrencinin konuyu temel düzeyde hızla kavramasına ve gerekirse daha derinlemesine araştırma yapması için sağlam bir başlangıç noktası oluşturmasına yardımcı ol. Aşırı teknik jargondan kaçın veya gerekli ise kısaca açıkla.
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
