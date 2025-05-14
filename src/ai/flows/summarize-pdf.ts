
'use server';

/**
 * @fileOverview YKS'ye hazırlanan öğrencilere yönelik PDF belgelerini özetleyen, basitleştirilmiş açıklamalar, 
 * madde işaretleriyle anahtar fikirler, ana fikir, potansiyel sınav soruları ve ilgili örnekler içeren bir AI ajanı.
 *
 * - summarizePdfForStudent - PDF özetleme sürecini yöneten fonksiyon.
 * - SummarizePdfForStudentInput - summarizePdfForStudent fonksiyonu için giriş tipi.
 * - SummarizePdfForStudentOutput - summarizePdfForStudent fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizePdfForStudentInputSchema = z.object({
  pdfText: z.string().describe('PDF belgesinden çıkarılan metin içeriği.'),
  summaryLength: z.enum(["short", "medium", "detailed"]).default("medium").describe("İstenen özetin uzunluğu: 'short' (çok kısa), 'medium' (dengeli), 'detailed' (kapsamlı).")
});
export type SummarizePdfForStudentInput = z.infer<typeof SummarizePdfForStudentInputSchema>;

const SummarizePdfForStudentOutputSchema = z.object({
  summary: z.string().describe('Metnin YKS öğrencisi için basit ve anlaşılır bir dille özeti.'),
  keyPoints: z.array(z.string()).describe('En önemli noktaların madde işaretleri halinde listesi.'),
  mainIdea: z.string().describe('Parçanın ana fikri veya YKS bağlamındaki temel konusu.'),
  examTips: z.array(z.string()).describe('YKS\'de çıkması muhtemel kilit bölümler (tanımlar, örnekler, formüller, tarihler, önemli kavramlar).'),
  practiceQuestions: z.optional(z.array(z.object({
    question: z.string().describe("YKS formatına uygun, konuyu test eden soru."),
    options: z.array(z.string()).describe("Çoktan seçmeli soru için seçenekler (genellikle 4 veya 5)."),
    answer: z.string().describe("Sorunun doğru cevabı (sadece harf veya seçenek metni)."),
    explanation: z.string().optional().describe("Doğru cevap için YKS düzeyinde kısa ve net bir açıklama.")
  })).describe('İçeriğe dayalı, YKS formatında 3-5 çoktan seçmeli alıştırma sorusu, cevap anahtarı ve açıklamalarıyla birlikte.')),
  formattedStudyOutput: z.string().describe('Tüm bölümleri (Özet, Anahtar Noktalar, Ana Fikir, Sınav İpuçları, Alıştırma Soruları) net Markdown başlıkları ile içeren, doğrudan çalışma PDF\'si olarak kullanılabilecek birleştirilmiş metin.')
});

export type SummarizePdfForStudentOutput = z.infer<typeof SummarizePdfForStudentOutputSchema>;

export async function summarizePdfForStudent(input: SummarizePdfForStudentInput): Promise<SummarizePdfForStudentOutput> {
  return summarizePdfForStudentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizePdfForStudentPrompt',
  input: {schema: SummarizePdfForStudentInputSchema},
  output: {schema: SummarizePdfForStudentOutputSchema},
  prompt: `Sen, Yükseköğretim Kurumları Sınavı (YKS) için öğrencilere akademik metinleri en etkili şekilde anlamaları ve sınava nokta atışı hazırlanmaları konusunda yardımcı olan, son derece deneyimli ve uzman bir AI YKS koçusun. 
Görevin, karmaşık bilgileri YKS formatına ve öğrenci seviyesine uygun şekilde basitleştirmek, önemli noktaları vurgulamak ve öğrencinin konuyu derinlemesine kavramasını sağlamaktır. Cevapların her zaman YKS öğrencisinin bakış açısıyla, onun için en faydalı olacak şekilde ve Türkçe dilinde olmalıdır.

Bir PDF'den çıkarılan aşağıdaki metin verildiğinde, {{summaryLength}} uzunluk tercihine göre, öğrenci dostu, motive edici ve YKS'ye odaklı bir tonda aşağıdaki görevleri yerine getir. Çıktını, belirtilen şemaya harfiyen uyacak şekilde yapılandır.

1.  **Özet (Paragraf Formatında)**: Metni, bir YKS öğrencisinin kolayca anlayabileceği, akıcı ve net bir dille özetle. {{summaryLength}} seçeneğine göre özetin detay seviyesini ayarla:
    *   'short': Konunun sadece en kritik özünü birkaç cümleyle ver.
    *   'medium': Ana argümanları ve önemli alt başlıkları içeren dengeli bir özet sun.
    *   'detailed': Metnin tüm önemli yönlerini kapsayan, daha kapsamlı bir özet oluştur.
    Her zaman paragraflar halinde yaz.
2.  **Anahtar Noktalar (Madde İşaretleri)**: Metindeki YKS için en önemli, akılda kalıcı olması gereken bilgileri 5-7 madde halinde listele. Bunlar, öğrencinin hızlı tekrar yapmasına ve konunun iskeletini görmesine yardımcı olmalı.
3.  **Ana Fikir**: Parçanın YKS açısından temel mesajını veya konusunu tek ve etkili bir cümleyle ifade et. "Bu metin YKS'de şu konuyu anlamak için önemlidir: ..." gibi bir giriş yapabilirsin.
4.  **YKS Sınav İpuçları (Madde İşaretleri)**: Metinden YKS'de soru olarak çıkma potansiyeli yüksek olan kilit tanımları, önemli tarihleri, formülleri, kavramları, neden-sonuç ilişkilerini veya karşılaştırmaları 4-6 madde halinde belirt. "YKS'de Bu Kısımlara Dikkat!" gibi bir başlık kullanabilirsin.
5.  **YKS Tarzı Alıştırma Soruları (isteğe bağlı ama şiddetle tavsiye edilir)**: Eğer içerik uygunsa, metindeki bilgileri kullanarak YKS formatına uygun, anlamayı ve yorumlamayı ölçen 3-5 adet çoktan seçmeli soru oluştur. Her soru için:
    *   **Soru Metni**: Açık ve net olmalı.
    *   **Seçenekler**: A, B, C, D, E şeklinde 5 seçenek sun. Çeldiriciler mantıklı ve konuya yakın olmalı.
    *   **Doğru Cevap**: Sadece doğru seçeneğin harfini belirt (örn: "C").
    *   **Açıklama**: Doğru cevabın neden doğru olduğunu ve diğer seçeneklerin neden yanlış olduğunu kısaca YKS öğrencisinin anlayacağı dilde açıkla.
    Eğer içerik soru üretmeye uygun değilse, bu bölümü atla ve `practiceQuestions` alanını boş bırak.
6.  **Formatlanmış Çalışma Çıktısı**: Yukarıdaki tüm bölümleri (Özet, Anahtar Noktalar, Ana Fikir, YKS Sınav İpuçları ve Alıştırma Soruları - eğer oluşturulduysa) net Markdown formatlaması kullanarak tek bir dizede birleştir. "## Özet", "## Anahtar Noktalar", "## Ana Fikir", "## YKS Sınav İpuçları", "## YKS Tarzı Alıştırma Soruları" gibi başlıklar kullan. Bu birleştirilmiş çıktı doğrudan kullanılacaktır.

Unutma, hedefin öğrencinin YKS'de başarılı olmasına yardımcı olmak. Bilgiyi en sindirilebilir ve en akılda kalıcı şekilde sun.

İşlenecek Metin:
{{{pdfText}}}`,
});

const summarizePdfForStudentFlow = ai.defineFlow(
  {
    name: 'summarizePdfForStudentFlow',
    inputSchema: SummarizePdfForStudentInputSchema,
    outputSchema: SummarizePdfForStudentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error("AI, PDF özeti için şemaya uygun bir yanıt üretemedi.");
    }
    // Ensure practiceQuestions is an array, even if empty, if not provided by AI but schema expects it.
     if (output.practiceQuestions === undefined && SummarizePdfForStudentOutputSchema.shape.practiceQuestions.isOptional() === false) {
        output.practiceQuestions = [];
    }
    return output;
  }
);
