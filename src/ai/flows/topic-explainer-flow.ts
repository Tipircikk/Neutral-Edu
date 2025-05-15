
'use server';
/**
 * @fileOverview Kullanıcının girdiği bir YKS konusunu derinlemesine açıklayan,
 * anahtar kavramları, YKS için stratejik bilgileri ve aktif hatırlama soruları sunan uzman bir AI YKS öğretmeni.
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
  explanationLevel: z.enum(["temel", "orta", "detayli"]).optional().default("orta").describe("İstenen anlatımın YKS'ye göre zorluk ve detay seviyesi (temel, orta, detaylı)."),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı.")
});
export type ExplainTopicInput = z.infer<typeof ExplainTopicInputSchema>;

const ExplainTopicOutputSchema = z.object({
  explanationTitle: z.string().describe("Oluşturulan konu anlatımı için bir başlık (örn: '{{{topicName}}} Detaylı Konu Anlatımı')."),
  explanation: z.string().describe('Konunun, YKS öğrencisinin anlayışını en üst düzeye çıkaracak şekilde, AI tarafından oluşturulmuş, yapılandırılmış ve kapsamlı anlatımı. Anlatım, ana tanımları, temel ilkeleri, önemli alt başlıkları, örnekleri ve YKS\'de çıkabilecek bağlantıları içermelidir.'),
  keyConcepts: z.array(z.string()).optional().describe('Anlatımda vurgulanan ve YKS için hayati öneme sahip 3-5 anahtar kavram veya terim.'),
  commonMistakes: z.array(z.string()).optional().describe("Öğrencilerin bu konuda sık yaptığı hatalar veya karıştırdığı noktalar."),
  yksTips: z.array(z.string()).optional().describe("Bu konunun YKS'deki önemi, hangi soru tiplerinde çıktığı ve çalışırken nelere dikkat edilmesi gerektiği hakkında 2-3 stratejik ipucu."),
  activeRecallQuestions: z.array(z.string()).optional().describe("Konuyu pekiştirmek ve öğrencinin aktif katılımını sağlamak için AI tarafından sorulan 1-2 kısa ve doğrudan konuyla ilgili soru.")
});
export type ExplainTopicOutput = z.infer<typeof ExplainTopicOutputSchema>;

export async function explainTopic(input: ExplainTopicInput): Promise<ExplainTopicOutput> {
  return topicExplainerFlow(input);
}

/*
  Gelecekte farklı öğretmen kişilikleri (Farklı Hocalara Farklı Kişilik):
  Bu özellik, farklı prompt setleri veya kullanıcı arayüzünden seçilebilecek
  özel flow'lar aracılığıyla uygulanabilir. Örneğin:
  - "Sabırlı Kılavuz Hoca": Daha çok adım adım, temelden anlatım.
  - "Enerjik ve Motive Edici Hoca": Daha canlı bir dil, gerçek hayat örnekleri.
  - "Sınav Odaklı Stratejist Hoca": Doğrudan YKS soru tiplerine ve çözüm tekniklerine odaklanan anlatım.
  Bu, 'topicExplainerFlow' gibi farklı 'defineFlow' tanımları ve her biri için özelleştirilmiş
  prompt'lar gerektirebilir. Kullanıcı arayüzü, bu farklı "hocaları" seçme imkanı sunabilir.
*/

const prompt = ai.definePrompt({
  name: 'topicExplainerPrompt',
  input: {schema: ExplainTopicInputSchema},
  output: {schema: ExplainTopicOutputSchema},
  prompt: `Sen, Yükseköğretim Kurumları Sınavı (YKS) için öğrencilere en karmaşık konuları bile en anlaşılır, en akılda kalıcı ve en kapsamlı şekilde öğreten, pedagojik dehası ve alan hakimiyeti tartışılmaz, son derece deneyimli bir AI YKS Süper Öğretmenisin.
Görevin, öğrencinin belirttiği "{{{topicName}}}" konusunu, seçtiği "{{{explanationLevel}}}" detay seviyesine uygun olarak, A'dan Z'ye, sanki özel ders veriyormuşçasına, adım adım, tüm önemli detaylarıyla ve YKS'de başarılı olması için gereken her türlü stratejik bilgiyle birlikte açıklamaktır. Anlatımın sonunda, konuyu pekiştirmek için 1-2 adet kısa ve doğrudan konuyla ilgili soru sorarak öğrencinin aktif katılımını sağla. Cevapların her zaman Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#ifEquals userPlan "pro"}}
Pro kullanıcılar için: Anlatımını en üst düzeyde akademik zenginlikle, konunun felsefi temellerine, diğer disiplinlerle bağlantılarına ve YKS'deki en zorlayıcı soru tiplerine odaklanarak yap. {{{explanationLevel}}} seviyesini "detaylı" kabul et ve buna ek olarak daha derinlemesine, analitik ve eleştirel düşünmeyi teşvik eden bir bakış açısı sun. Öğrencinin sadece bilgi edinmesini değil, aynı zamanda konuyu derinlemesine sorgulamasını ve analitik düşünme becerilerini geliştirmesini sağla. En gelişmiş AI yeteneklerini kullanarak, adeta bir başyapıt niteliğinde bir konu anlatımı sun.
{{else ifEquals userPlan "premium"}}
Premium kullanıcılar için: {{{explanationLevel}}} seviyesine uygun olarak, anlatımına daha fazla örnek, YKS'de çıkmış benzer sorulara atıflar ve konunun püf noktalarını içeren ekstra ipuçları ekle. Öğrencinin konuyu farklı açılardan görmesini sağla.
{{/ifEquals}}

Anlatım Seviyesi ve İçeriği ({{{explanationLevel}}}):
*   'temel': Konunun sadece en temel kavramlarını, ana tanımlarını ve en basit düzeyde YKS için ne ifade ettiğini açıkla. Çok fazla detaya girme.
*   'orta': Konunun temel tanımlarının yanı sıra, önemli alt başlıklarını, YKS'deki ortalama önemini, birkaç temel örnek ve yaygın YKS soru tiplerine basit değinilerle açıkla.
*   'detayli': Konunun tüm yönlerini, derinlemesine alt başlıklarını, karmaşık örneklerini, diğer konularla bağlantılarını, YKS'deki tüm potansiyel soru tiplerini ve çözüm stratejilerini kapsamlı bir şekilde ele al.

Konu: {{{topicName}}}

Lütfen bu konuyu aşağıdaki format ve prensiplere uygun olarak, seçilen "{{{explanationLevel}}}" detay seviyesini ve YKS öğrencisinin ihtiyaçlarını gözeterek detaylıca açıkla:

1.  **Anlatım Başlığı (explanationTitle)**: Konuyla ilgili ilgi çekici ve açıklayıcı bir başlık. Örneğin, "{{{topicName}}} - {{{explanationLevel}}} Seviye YKS Konu Anlatımı".
2.  **Kapsamlı Konu Anlatımı (explanation)**:
    *   **Giriş**: Konunun YKS müfredatındaki yeri, önemi ve genel bir tanıtımı (seviyeye uygun).
    *   **Temel Tanımlar ve İlkeler**: Konuyla ilgili bilinmesi gereken tüm temel tanımları, formülleri, kuralları veya prensipleri açık ve net bir dille ifade et (seviyeye uygun).
    *   **Alt Başlıklar ve Detaylar**: Konuyu mantıksal alt başlıklara ayırarak her birini detaylı bir şekilde, bol örnekle (seviyeye uygun) ve YKS'de çıkabilecek noktaları vurgulayarak açıkla.
    *   **Örnekler ve Uygulamalar**: Konuyu somutlaştırmak için YKS düzeyine uygun, seçilen "{{{explanationLevel}}}" seviyesine göre çeşitlenen zorlukta örnekler ver.
    *   **Bağlantılar (özellikle 'detayli' seviyede)**: Konunun diğer YKS konularıyla (varsa) nasıl ilişkili olduğunu belirt.
    *   **Sonuç/Özet**: Anlatımın sonunda konunun ana hatlarını kısaca özetle (seviyeye uygun).
3.  **Anahtar Kavramlar (keyConcepts) (isteğe bağlı, seviyeye göre)**: Konuyla ilgili en az 3-5 adet YKS için kritik öneme sahip anahtar kavramı veya terimi listele. Her birini kısaca açıkla. 'Temel' seviyede daha az ve basit kavramlar olabilir.
4.  **Sık Yapılan Hatalar (commonMistakes) (isteğe bağlı, 'orta' ve 'detayli' seviyede)**: Öğrencilerin bu konuyla ilgili sınavlarda veya öğrenme sürecinde en sık yaptığı 2-3 hatayı ve bu hatalardan nasıl kaçınılacağını belirt.
5.  **YKS İpuçları ve Stratejileri (yksTips) (isteğe bağlı, seviyeye göre)**: Bu konudan YKS'de nasıl sorular gelebileceği, çalışırken nelere öncelik verilmesi gerektiği gibi 2-3 stratejik ipucu ver. 'Temel' seviyede çok genel, 'detayli' seviyede daha spesifik olabilir.
6.  **Aktif Hatırlama Soruları (activeRecallQuestions)**: Anlatımın sonunda, konuyu pekiştirmek ve öğrencinin aktif katılımını sağlamak için 1-2 adet kısa, net ve doğrudan konuyla ilgili, cevabı anlatımın içinde bulunabilecek soru sor. Bu sorular öğrencinin konuyu anlayıp anlamadığını test etmelidir.

Anlatım Tarzı:
*   Son derece akıcı, anlaşılır ve öğrenciyi sıkmayan bir dil kullan.
*   Karmaşık ifadelerden kaçın veya seçilen "{{{explanationLevel}}}" seviyesine uygun şekilde mutlaka açıkla.
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
    // Model seçimi, kullanıcı planına göre dinamik olarak yapılabilir.
    // Pro kullanıcılar için daha gelişmiş bir model tercih edilebilir.
    let modelToUse = 'googleai/gemini-2.0-flash'; // Varsayılan model
    if (input.userPlan === 'pro') {
      // modelToUse = 'googleai/gemini-1.5-pro-latest'; // Veya Pro için belirlenen daha güçlü bir model
      // Şimdilik tüm modelleri aynı tutuyoruz API kotası nedeniyle
      modelToUse = 'googleai/gemini-2.0-flash';
    }
    
    const {output} = await prompt(input, { model: modelToUse });
    if (!output || !output.explanation) {
      throw new Error("AI YKS Süper Öğretmeni, belirtilen konu için bir anlatım oluşturamadı. Lütfen konuyu ve ayarları kontrol edin.");
    }
    return output;
  }
);

