
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
import type { UserProfile } from '@/types'; // Import UserProfile type

const SummarizePdfForStudentInputSchema = z.object({
  pdfText: z.string().describe('PDF belgesinden çıkarılan metin içeriği.'),
  summaryLength: z.enum(["short", "medium", "detailed"]).optional().default("medium").describe("İstenen özetin uzunluğu: 'short' (çok kısa), 'medium' (dengeli), 'detailed' (kapsamlı)."),
  keywords: z.string().optional().describe("Özetin odaklanması istenen, virgülle ayrılmış anahtar kelimeler."),
  pageRange: z.string().optional().describe("Özetlenecek sayfa aralığı, örn: '5-10'. AI, bu bilginin sağlandığı metin parçasına odaklanacaktır."),
  outputDetail: z.enum(["full", "key_points_only", "exam_tips_only", "questions_only"]).optional().default("full").describe("İstenen özet çıktısının detayı: 'full' (tüm bölümler), 'key_points_only' (sadece anahtar noktalar), 'exam_tips_only' (sadece sınav ipuçları), 'questions_only' (sadece örnek sorular)."),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı.")
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
  formattedStudyOutput: z.string().describe('Tüm istenen bölümleri (Özet, Anahtar Noktalar, Ana Fikir, Sınav İpuçları, Alıştırma Soruları) net Markdown başlıkları ile içeren, doğrudan çalışma PDF\'si olarak kullanılabilecek birleştirilmiş metin.')
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
Kullanıcının üyelik planı: {{{userPlan}}}.
{{#ifEquals userPlan "pro"}}
Pro kullanıcılar için: En derinlemesine analizleri, en kapsamlı içgörüleri ve en gelişmiş yorumları sun. Metnin altındaki gizli bağlantıları ve çıkarımları ortaya koy. Cevaplarında en üst düzeyde uzmanlık ve detay sergilemek için en gelişmiş AI yeteneklerini kullan.
{{else ifEquals userPlan "premium"}}
Premium kullanıcılar için: Kapsamlı analizler ve derinlemesine içgörüler sunmaya çalış. Standart kullanıcıya göre daha detaylı ve zenginleştirilmiş bir içerik sağla.
{{/ifEquals}}

Bir PDF'den çıkarılan aşağıdaki metin verildiğinde, {{summaryLength}} uzunluk tercihine, {{outputDetail}} çıktı detayı isteğine ve varsa {{keywords}} anahtar kelimelerine veya {{pageRange}} sayfa aralığı bilgisine göre, öğrenci dostu, motive edici ve YKS'ye odaklı bir tonda aşağıdaki görevleri yerine getir. Çıktını, belirtilen şemaya harfiyen uyacak şekilde yapılandır.

Öğrencinin Özel İstekleri:
{{#if keywords}}
- Odaklanılacak Anahtar Kelimeler: {{{keywords}}} (Lütfen özetini bu kelimeler etrafında şekillendir.)
{{/if}}
{{#if pageRange}}
- Odaklanılacak Sayfa Aralığı (Kavramsal): {{{pageRange}}} (Lütfen bu metnin belirtilen sayfa aralığından geldiğini varsayarak veya o aralıktaki bilgilere öncelik vererek özetle.)
{{/if}}

İstenen Çıktı Detayı: {{{outputDetail}}}

İstenen Çıktı Bölümleri:
1.  **Özet (Paragraf Formatında)**: Metni, bir YKS öğrencisinin kolayca anlayabileceği, akıcı ve net bir dille özetle. {{summaryLength}} seçeneğine göre özetin detay seviyesini ayarla. Eğer 'outputDetail' sadece belirli bir bölümü istiyorsa (örn: 'key_points_only'), bu bölümü atlayabilir veya çok kısa tutabilirsin.
    *   'short': Konunun sadece en kritik özünü birkaç cümleyle ver.
    *   'medium': Ana argümanları ve önemli alt başlıkları içeren dengeli bir özet sun.
    *   'detailed': Metnin tüm önemli yönlerini kapsayan, daha kapsamlı bir özet oluştur.
    Her zaman paragraflar halinde yaz.
2.  **Anahtar Noktalar (Madde İşaretleri)**: Metindeki YKS için en önemli, akılda kalıcı olması gereken bilgileri 5-7 madde halinde listele. Bunlar, öğrencinin hızlı tekrar yapmasına ve konunun iskeletini görmesine yardımcı olmalı. Eğer 'outputDetail' sadece belirli bir bölümü istiyorsa (örn: 'exam_tips_only'), bu bölümü atlayabilirsin.
3.  **Ana Fikir**: Parçanın YKS açısından temel mesajını veya konusunu tek ve etkili bir cümleyle ifade et. "Bu metin YKS'de şu konuyu anlamak için önemlidir: ..." gibi bir giriş yapabilirsin. Eğer 'outputDetail' sadece belirli bir bölümü istiyorsa, bu bölümü atlayabilirsin.
4.  **YKS Sınav İpuçları (Madde İşaretleri)**: Metinden YKS'de soru olarak çıkma potansiyeli yüksek olan kilit tanımları, önemli tarihleri, formülleri, kavramları, neden-sonuç ilişkilerini veya karşılaştırmaları 4-6 madde halinde belirt. "YKS'de Bu Kısımlara Dikkat!" gibi bir başlık kullanabilirsin. Eğer 'outputDetail' sadece belirli bir bölümü istiyorsa (örn: 'key_points_only'), bu bölümü atlayabilirsin.
5.  **YKS Tarzı Alıştırma Soruları (isteğe bağlı ama şiddetle tavsiye edilir)**: Eğer içerik uygunsa ve 'outputDetail' 'questions_only' veya 'full' ise, metindeki bilgileri kullanarak YKS formatına uygun, anlamayı ve yorumlamayı ölçen 3-5 adet çoktan seçmeli soru oluştur. Her soru için:
    *   **Soru Metni**: Açık ve net olmalı.
    *   **Seçenekler**: A, B, C, D, E şeklinde 5 seçenek sun. Çeldiriciler mantıklı ve konuya yakın olmalı.
    *   **Doğru Cevap**: Sadece doğru seçeneğin harfini belirt (örn: "C").
    *   **Açıklama**: Doğru cevabın neden doğru olduğunu ve diğer seçeneklerin neden yanlış olduğunu kısaca YKS öğrencisinin anlayacağı dilde açıkla.
    Eğer içerik soru üretmeye uygun değilse veya 'outputDetail' bunu istemiyorsa, bu bölümü atla ve 'practiceQuestions' alanını boş bırak.
6.  **Formatlanmış Çalışma Çıktısı**: Yukarıdaki istenen bölümleri ({{{outputDetail}}} seçeneğine göre) net Markdown formatlaması kullanarak tek bir dizede birleştir. "## Özet", "## Anahtar Noktalar", "## Ana Fikir", "## YKS Sınav İpuçları", "## YKS Tarzı Alıştırma Soruları" gibi başlıklar kullan. Bu birleştirilmiş çıktı doğrudan kullanılacaktır. Eğer 'outputDetail' örneğin 'key_points_only' ise, formattedStudyOutput sadece "## Anahtar Noktalar" başlığını ve içeriğini içermelidir.

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
    let modelToUse = 'googleai/gemini-2.0-flash'; // Default for free/premium
    if (input.userPlan === 'pro') {
      modelToUse = 'googleai/gemini-1.5-flash-latest'; // Was gemini-1.5-pro-latest, changed due to rate limits
    }

    const {output} = await prompt(input, { model: modelToUse });
    if (!output) {
      throw new Error("AI, PDF özeti için şemaya uygun bir yanıt üretemedi.");
    }

    // Ensure practiceQuestions is an empty array if not provided by LLM and 'full' or 'questions_only' output is expected.
    const shouldHaveQuestions = input.outputDetail === 'full' || input.outputDetail === 'questions_only';
    if (shouldHaveQuestions && output.practiceQuestions === undefined) {
        output.practiceQuestions = [];
    }
    // Remove practiceQuestions if not requested
    if (!shouldHaveQuestions) {
        output.practiceQuestions = undefined;
    }

    // Clear other fields based on outputDetail, LLM might not always respect this perfectly
    if (input.outputDetail !== 'full' && input.outputDetail !== 'key_points_only') {
        output.keyPoints = [];
    }
     if (input.outputDetail !== 'full' && input.outputDetail !== 'exam_tips_only') {
        output.examTips = []; 
    }
    if (input.outputDetail === 'key_points_only' || input.outputDetail === 'exam_tips_only' || input.outputDetail === 'questions_only') {
        if(input.outputDetail !== 'full') output.summary = "Sadece istenen bölüm üretildi."; 
        if(input.outputDetail !== 'full') output.mainIdea = "Sadece istenen bölüm üretildi."; 
    }
    return output;
  }
);
