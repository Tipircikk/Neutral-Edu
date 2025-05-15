
'use server';
/**
 * @fileOverview Öğrencilerin YKS sınav raporlarını analiz eden, zayıf oldukları konuları belirleyen
 * ve kişiselleştirilmiş çalışma önerileri sunan bir AI aracı.
 *
 * - analyzeExamReport - Sınav raporu analiz işlemini yöneten fonksiyon.
 * - ExamReportAnalyzerInput - analyzeExamReport fonksiyonu için giriş tipi.
 * - ExamReportAnalyzerOutput - analyzeExamReport fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { UserProfile } from '@/types';

const ExamReportAnalyzerInputSchema = z.object({
  reportTextContent: z.string().min(100).describe('Analiz edilecek sınav raporundan çıkarılmış en az 100 karakterlik metin içeriği. Bu metin dersleri, konuları, doğru/yanlış/boş sayılarını veya puanları içermelidir.'),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı.")
});
export type ExamReportAnalyzerInput = z.infer<typeof ExamReportAnalyzerInputSchema>;

const IdentifiedTopicSchema = z.object({
    topic: z.string().describe("Rapordan tespit edilen ders, ünite veya konu başlığı."),
    analysis: z.string().describe("Bu konudaki performansın (doğru, yanlış, boş, puan vb. bilgilere dayanarak) YKS odaklı analizi, potansiyel zayıflıklar ve bu zayıflıkları gidermek için spesifik öneriler."),
    status: z.enum(["strong", "needs_improvement", "weak"]).describe("Belirlenen konudaki genel performans durumu.")
});

const ExamReportAnalyzerOutputSchema = z.object({
  identifiedTopics: z.array(IdentifiedTopicSchema).describe('Sınav raporundan tespit edilen konular ve her biri için detaylı analiz ve öneriler.'),
  overallFeedback: z.string().describe('Sınavın geneli hakkında YKS öğrencisine yönelik yapıcı, motive edici ve kapsamlı bir geri bildirim. Genel başarı durumu, dikkat çeken noktalar ve genel strateji önerileri içerebilir.'),
  studySuggestions: z.array(z.string()).describe('Belirlenen eksikliklere ve genel performansa dayalı olarak YKS için öncelikli çalışma alanları ve genel çalışma stratejileri.'),
  reportSummaryTitle: z.string().optional().describe("Analiz edilen sınav raporu için kısa bir başlık (örn: 'AYT Matematik Deneme Analizi').")
});
export type ExamReportAnalyzerOutput = z.infer<typeof ExamReportAnalyzerOutputSchema>;

export async function analyzeExamReport(input: ExamReportAnalyzerInput): Promise<ExamReportAnalyzerOutput> {
  return examReportAnalyzerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'examReportAnalyzerPrompt',
  input: {schema: ExamReportAnalyzerInputSchema},
  output: {schema: ExamReportAnalyzerOutputSchema},
  prompt: `Sen, Yükseköğretim Kurumları Sınavı (YKS) hazırlık sürecindeki öğrencilerin deneme sınavı veya gerçek sınav sonuç raporlarını son derece detaylı bir şekilde analiz eden, öğrencinin güçlü ve zayıf yönlerini nokta atışı tespit eden, her bir ders/konu bazında kişiye özel geri bildirimler ve hedefe yönelik çalışma stratejileri sunan uzman bir AI YKS danışmanısın.
Amacın, öğrencinin sınav raporundaki verileri (ders adları, konu başlıkları, doğru/yanlış/boş sayıları, puanlar, sıralamalar vb.) kullanarak akademik performansını kapsamlı bir şekilde değerlendirmek ve net, uygulanabilir ve motive edici önerilerle YKS başarısını artırmasına yardımcı olmaktır. Cevapların her zaman Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#ifEquals userPlan "pro"}}
Pro kullanıcılar için: Analizini en üst düzeyde akademik titizlikle, konular arası bağlantıları da dikkate alarak yap. Öğrencinin farkında olmadığı örtük bilgi eksikliklerini veya yanlış öğrenmeleri tespit etmeye çalış. En kapsamlı ve derinlemesine stratejik yol haritasını sun. En gelişmiş AI yeteneklerini kullan.
{{else ifEquals userPlan "premium"}}
Premium kullanıcılar için: Daha detaylı konu analizi, alternatif çalışma yöntemleri ve öğrencinin gelişimini hızlandıracak ek kaynak önerileri sunmaya özen göster.
{{/ifEquals}}

Öğrencinin Sınav Raporu Metni:
{{{reportTextContent}}}

Lütfen bu sınav raporu metnini analiz et ve aşağıdaki formatta bir çıktı oluştur:

1.  **Tespit Edilen Konular (identifiedTopics)**: Metinden belirleyebildiğin her ders/konu için:
    *   **Konu (topic)**: Dersin, ünitenin veya konunun adı (örn: "Matematik - Türev", "Türk Dili ve Edebiyatı - Cumhuriyet Dönemi Romanı").
    *   **Analiz (analysis)**: Bu konudaki performansı (rapordaki D/Y/B sayıları, puanlar gibi verilere dayanarak) YKS bağlamında değerlendir. Öğrencinin bu konudaki güçlü yanlarını, özellikle zayıf olduğu noktaları ve nedenlerini (kavram yanılgısı, bilgi eksikliği, dikkat hatası vb. olası nedenler) belirt. Bu konudaki eksiklikleri gidermek için YKS'ye yönelik spesifik çalışma yöntemleri, kaynak önerileri veya soru çözüm teknikleri sun.
    *   **Durum (status)**: 'strong' (bu konuda iyi), 'needs_improvement' (geliştirilmesi gerekiyor), 'weak' (bu konuda zayıf) seçeneklerinden birini belirle.
2.  **Genel Geri Bildirim (overallFeedback)**: Sınavın geneline yayılmış ortak hatalar, başarılı olunan alanlar, genel net/puan durumu (eğer raporda varsa ve yorumlanabiliyorsa) ve öğrencinin genel YKS hazırlık stratejisine yönelik yapıcı eleştiriler ve motive edici bir genel değerlendirme sun.
3.  **Çalışma Önerileri (studySuggestions)**: Analiz sonucunda ortaya çıkan en kritik 3-5 eksiklik alanını belirle ve bu alanlara yönelik YKS için öncelikli, somut ve uygulanabilir genel çalışma stratejileri veya ipuçları listele.
4.  **Rapor Özet Başlığı (reportSummaryTitle) (isteğe bağlı)**: Analiz edilen rapor için kısa ve açıklayıcı bir başlık.

Analiz İlkeleri:
*   Metindeki sayısal verileri (D, Y, B, net, puan) dikkatlice yorumla. Eğer konu bazında netler veya başarı yüzdeleri varsa bunları analize dahil et.
*   Öğrencinin en çok zorlandığı veya en çok puan kaybettiği konuları önceliklendir.
*   Geri bildirimlerin ve önerilerin YKS formatına, soru tiplerine ve müfredatına uygun olsun.
*   Öğrencinin moralini bozacak değil, onu motive edecek ve yol gösterecek bir dil kullan.
*   Eğer rapor metni çok yetersizse veya anlamlı bir analiz çıkarılamıyorsa, nazikçe daha detaylı bir rapor metni iste.
`,
});

const examReportAnalyzerFlow = ai.defineFlow(
  {
    name: 'examReportAnalyzerFlow',
    inputSchema: ExamReportAnalyzerInputSchema,
    outputSchema: ExamReportAnalyzerOutputSchema,
  },
  async (input) => {
    const modelToUse = 'googleai/gemini-2.0-flash'; // Varsayılan model

    // Kullanıcı planına göre model seçimi (eğer pro plan için farklı model kullanılacaksa)
    // if (input.userPlan === 'pro') {
    //   modelToUse = 'googleai/gemini-1.5-flash-latest'; // veya pro için belirlenen model
    // }
    
    const {output} = await prompt(input, { model: modelToUse });
    if (!output || !output.identifiedTopics || output.identifiedTopics.length === 0) {
      throw new Error("AI Sınav Analisti, bu rapor için detaylı bir analiz ve öneri üretemedi. Lütfen rapor metninin yeterli ve anlaşılır olduğundan emin olun.");
    }
    return output;
  }
);

