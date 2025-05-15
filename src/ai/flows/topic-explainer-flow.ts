'use server';
/**
 * @fileOverview Kullanıcının girdiği bir YKS konusunu derinlemesine açıklayan,
 * anahtar kavramları ve YKS için stratejik bilgileri sunan uzman bir AI YKS öğretmeni.
 *
 * - explainTopic - Konu açıklama işlemini yöneten fonksiyon.
 * - ExplainTopicInput - explainTopic fonksiyonu için giriş tipi.
 * - ExplainTopicOutput - explainTopic fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { UserProfile } from '@/types';

const ExplainTopicInputSchema = z.object({
  topicName: z.string().min(3).describe('Açıklanması istenen YKS konu başlığı (örn: "Matematik - Türev ve Uygulamaları", "Edebiyat - Milli Edebiyat Dönemi").'),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı.")
});
export type ExplainTopicInput = z.infer<typeof ExplainTopicInputSchema>;

const ExplainTopicOutputSchema = z.object({
  explanationTitle: z.string().describe("Oluşturulan konu anlatımı için bir başlık (örn: '{{{topicName}}} Detaylı Konu Anlatımı')."),
  explanation: z.string().describe('Konunun, YKS öğrencisinin anlayışını en üst düzeye çıkaracak şekilde, AI tarafından oluşturulmuş, yapılandırılmış ve kapsamlı anlatımı. Anlatım, ana tanımları, temel ilkeleri, önemli alt başlıkları, örnekleri ve YKS\'de çıkabilecek bağlantıları içermelidir.'),
  keyConcepts: z.array(z.string()).optional().describe('Anlatımda vurgulanan ve YKS için hayati öneme sahip 3-5 anahtar kavram veya terim.'),
  commonMistakes: z.array(z.string()).optional().describe("Öğrencilerin bu konuda sık yaptığı hatalar veya karıştırdığı noktalar."),
  yksTips: z.array(z.string()).optional().describe("Bu konunun YKS'deki önemi, hangi soru tiplerinde çıktığı ve çalışırken nelere dikkat edilmesi gerektiği hakkında 2-3 stratejik ipucu."),
});
export type ExplainTopicOutput = z.infer<typeof ExplainTopicOutputSchema>;

export async function explainTopic(input: ExplainTopicInput): Promise<ExplainTopicOutput> {
  return topicExplainerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'topicExplainerPrompt',
  input: {schema: ExplainTopicInputSchema},
  output: {schema: ExplainTopicOutputSchema},
  prompt: `Sen, Yükseköğretim Kurumları Sınavı (YKS) için öğrencilere en karmaşık konuları bile en anlaşılır, en akılda kalıcı ve en kapsamlı şekilde öğreten, pedagojik dehası ve alan hakimiyeti tartışılmaz, son derece deneyimli bir AI YKS Süper Öğretmenisin.
Görevin, öğrencinin belirttiği "{{{topicName}}}" konusunu A'dan Z'ye, sanki özel ders veriyormuşçasına, adım adım, tüm önemli detaylarıyla ve YKS'de başarılı olması için gereken her türlü stratejik bilgiyle birlikte açıklamaktır. Cevapların her zaman Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#ifEquals userPlan "pro"}}
Pro kullanıcılar için: Anlatımını en üst düzeyde akademik zenginlikle, konunun felsefi temellerine, diğer disiplinlerle bağlantılarına ve YKS'deki en zorlayıcı soru tiplerine odaklanarak yap. Öğrencinin sadece bilgi edinmesini değil, aynı zamanda konuyu derinlemesine sorgulamasını ve analitik düşünme becerilerini geliştirmesini sağla. En gelişmiş AI yeteneklerini kullanarak, adeta bir başyapıt niteliğinde bir konu anlatımı sun.
{{else ifEquals userPlan "premium"}}
Premium kullanıcılar için: Anlatımına daha fazla örnek, YKS'de çıkmış benzer sorulara atıflar ve konunun püf noktalarını içeren ekstra ipuçları ekle. Öğrencinin konuyu farklı açılardan görmesini sağla.
{{/ifEquals}}

Konu: {{{topicName}}}

Lütfen bu konuyu aşağıdaki format ve prensiplere uygun olarak, YKS öğrencisinin seviyesini ve ihtiyaçlarını gözeterek detaylıca açıkla:

1.  **Anlatım Başlığı (explanationTitle)**: Konuyla ilgili ilgi çekici ve açıklayıcı bir başlık. Örneğin, "{{{topicName}}} Derinlemesine Analiz ve YKS Stratejileri".
2.  **Kapsamlı Konu Anlatımı (explanation)**:
    *   **Giriş**: Konunun YKS müfredatındaki yeri, önemi ve genel bir tanıtımı.
    *   **Temel Tanımlar ve İlkeler**: Konuyla ilgili bilinmesi gereken tüm temel tanımları, formülleri, kuralları veya prensipleri açık ve net bir dille ifade et.
    *   **Alt Başlıklar ve Detaylar**: Konuyu mantıksal alt başlıklara ayırarak her birini detaylı bir şekilde, bol örnekle ve YKS'de çıkabilecek noktaları vurgulayarak açıkla.
    *   **Örnekler ve Uygulamalar**: Konuyu somutlaştırmak için YKS düzeyine uygun, çeşitli zorluk seviyelerinde örnekler ver.
    *   **Bağlantılar**: Konunun diğer YKS konularıyla (varsa) nasıl ilişkili olduğunu belirt.
    *   **Sonuç/Özet**: Anlatımın sonunda konunun ana hatlarını kısaca özetle.
3.  **Anahtar Kavramlar (keyConcepts) (isteğe bağlı)**: Konuyla ilgili en az 3-5 adet YKS için kritik öneme sahip anahtar kavramı veya terimi listele. Her birini kısaca açıkla.
4.  **Sık Yapılan Hatalar (commonMistakes) (isteğe bağlı)**: Öğrencilerin bu konuyla ilgili sınavlarda veya öğrenme sürecinde en sık yaptığı 2-3 hatayı ve bu hatalardan nasıl kaçınılacağını belirt.
5.  **YKS İpuçları ve Stratejileri (yksTips) (isteğe bağlı)**: Bu konudan YKS'de nasıl sorular gelebileceği, çalışırken nelere öncelik verilmesi gerektiği, hangi kaynaklardan faydalanılabileceği (genel türde) gibi 2-3 stratejik ipucu ver.

Anlatım Tarzı:
*   Son derece akıcı, anlaşılır ve öğrenciyi sıkmayan bir dil kullan.
*   Karmaşık ifadelerden kaçın veya mutlaka açıkla.
*   Öğrenciyi motive edici ve konuyu sevdiren bir üslup benimse.
*   YKS terminolojisine hakim ol ve doğru kullan.
*   Bilgilerin doğruluğundan ve güncelliğinden emin ol.
`,
});

const topicExplainerFlow = ai.defineFlow(
  {
    name: 'topicExplainerFlow',
    inputSchema: ExplainTopicInputSchema,
    outputSchema: ExplainTopicOutputSchema,
  },
  async (input) => {
    const modelToUse = 'googleai/gemini-2.0-flash'; 
    
    const {output} = await prompt(input, { model: modelToUse });
    if (!output || !output.explanation) {
      throw new Error("AI YKS Süper Öğretmeni, belirtilen konu için bir anlatım oluşturamadı. Lütfen konuyu kontrol edin.");
    }
    return output;
  }
);
