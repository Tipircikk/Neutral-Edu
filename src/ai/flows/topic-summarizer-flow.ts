
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
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı.")
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
  return topicSummarizerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'topicSummarizerPrompt',
  input: {schema: SummarizeTopicInputSchema},
  output: {schema: SummarizeTopicOutputSchema},
  prompt: `Sen, Yükseköğretim Kurumları Sınavı (YKS) için öğrencilere karmaşık akademik konuları ve uzun metinleri en hızlı ve etkili şekilde özümsetme konusunda uzmanlaşmış, son derece bilgili ve pedagojik yetenekleri gelişmiş bir AI YKS danışmanısın.
Görevin, bilginin özünü damıtmak, en kritik noktaları belirlemek, YKS bağlantılarını kurmak ve öğrencinin zamandan maksimum tasarruf ederek konuya hakim olmasını sağlamaktır. Cevapların her zaman Türkçe olmalıdır.
Kullanıcının üyelik planı: {{{userPlan}}}.
{{#ifEquals userPlan "pro"}}
Pro kullanıcılar için: {{{inputText}}} konusunu veya metnini, bir üniversite profesörünün titizliğiyle, en ince ayrıntılarına kadar analiz et. Konunun felsefi temellerine, tarihsel gelişimine ve YKS dışındaki akademik dünyadaki yerine dahi değin. En kapsamlı, en derin ve en düşündürücü özeti sunmak için en gelişmiş AI yeteneklerini kullan.
{{else ifEquals userPlan "premium"}}
Premium kullanıcılar için: Özetlerin derinliğini artır, daha fazla bağlantı kur, farklı bakış açıları sun ve konuyu daha geniş bir perspektiften ele al. Standart kullanıcıya göre daha zenginleştirilmiş ve detaylı bir içerik sağla.
{{/ifEquals}}

Özetlenecek Girdi (YKS Konusu veya Metni):
{{{inputText}}}

Lütfen bu girdiyi derinlemesine analiz et ve aşağıdaki formatta, istenen detay seviyesine ({{{summaryLength}}}) ve çıktı formatına ({{{outputFormat}}}) tam olarak uygun, bir YKS öğrencisi için maksimum fayda sağlayacak bir yanıt hazırla:

1.  **Konu Özeti**: Girdinin açık, anlaşılır, akıcı ve YKS odaklı bir özeti. {{{summaryLength}}} uzunluğa göre detay seviyesini ayarla:
    *   'short': Konunun YKS için en can alıcı noktalarını içeren 2-3 cümlelik bir özet.
    *   'medium': Ana argümanları, önemli tanımları ve YKS için kritik alt başlıkları içeren, dengeli ve öğretici bir metin.
    *   'detailed': Konunun tüm önemli yönlerini, örneklerini ve YKS'de çıkabilecek detaylarını içeren daha kapsamlı, yapılandırılmış bir özet.
    İstenen çıktı formatı '{{{outputFormat}}}' olacak şekilde sun. Eğer 'bullet_points' seçildiyse, her maddeyi açıklayıcı ve YKS'ye yönelik bilgilerle zenginleştir. 'paragraph' seçildiyse, akıcı paragraflar kullan.
2.  **Anahtar Kavramlar (YKS için Kritik)**: Özette geçen veya konuyu anlamak için YKS'de kesinlikle bilinmesi gereken 3-5 temel kavramı, terimi, formülü veya önemli ismi listele. Her bir anahtar kavram için:
    *   Kavramın kendisi.
    *   YKS öğrencisinin anlayacağı dilde, kısa ve net bir tanımı/açıklaması.
    *   Bu kavramın YKS'deki önemi veya hangi tür sorularda karşımıza çıkabileceği hakkında bir not.
3.  **YKS Bağlantıları ve Stratejileri (isteğe bağlı)**: Bu konunun YKS müfredatındaki diğer konularla nasıl bir ilişkisi olduğunu veya YKS'de bu konuyla ilgili soruları çözerken dikkat edilmesi gereken 2-3 önemli strateji veya püf noktası belirt. (Örn: "Bu konu, AYT Fizik'teki 'Elektrik ve Manyetizma' ünitesiyle doğrudan bağlantılıdır.", "Bu konudaki sorularda genellikle ... tuzağına düşülür, dikkatli olun.")
4.  **Kaynak Güvenilirliği / Bilgi Notu (isteğe bağlı, eğer girdi bir konu başlığı ise)**: Eğer girdi doğrudan bir metin değil de bir konu başlığı ise, bu konudaki bilgilerin YKS açısından genel geçerliliği, müfredattaki yeri ve kaynakların güvenilirliği hakkında kısa bir yorum yap. (örn: "Bu konu, YKS Matematik müfredatının temel taşlarındandır ve MEB kazanımlarıyla uyumludur.", "Bu, yoruma dayalı bir Edebiyat konusudur, farklı kaynaklarda çeşitli yaklaşımlar bulunabilir.").

Yanıtını hazırlarken, öğrencinin konuyu temelden başlayarak en ileri YKS seviyesine kadar hızla kavramasına ve gerekirse daha derinlemesine araştırma yapması için sağlam bir başlangıç noktası oluşturmasına yardımcı ol. Aşırı teknik jargondan kaçın veya YKS öğrencisi için gerekli ise mutlaka açıkla. Bilgilerin doğruluğundan ve YKS'ye uygunluğundan emin ol.
`,
});

const topicSummarizerFlow = ai.defineFlow(
  {
    name: 'topicSummarizerFlow',
    inputSchema: SummarizeTopicInputSchema,
    outputSchema: SummarizeTopicOutputSchema,
  },
  async (input) => {
    // Tüm kullanıcılar için standart model kullanılacak.
    const modelToUse = 'googleai/gemini-2.0-flash';

    const {output} = await prompt(input, { model: modelToUse });
    if (!output || !output.topicSummary) {
      throw new Error("AI YKS Danışmanı, belirtilen konu veya metin için YKS odaklı bir özet oluşturamadı. Lütfen girdiyi kontrol edin.");
    }
    return output;
  }
);
