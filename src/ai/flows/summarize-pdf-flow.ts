
'use server';

/**
 * @fileOverview Kullanıcının yüklediği PDF belgelerindeki konuları derinlemesine açıklayan,
 * anahtar fikirleri, ana fikri ve isteğe bağlı olarak sınav ipuçları ile örnek soruları içeren bir AI aracı.
 *
 * - summarizePdfForStudent - PDF içeriğini detaylı açıklama sürecini yöneten fonksiyon.
 * - SummarizePdfForStudentInput - summarizePdfForStudent fonksiyonu için giriş tipi.
 * - SummarizePdfForStudentOutput - summarizePdfForStudent fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { UserProfile } from '@/types';

const SummarizePdfForStudentInputSchema = z.object({
  pdfText: z.string().describe('PDF belgesinden çıkarılan metin içeriği.'),
  summaryLength: z.enum(["short", "medium", "detailed"]).optional().default("medium").describe("İstenen açıklamanın uzunluğu: 'short' (ana hatlar), 'medium' (dengeli ve kapsamlı), 'detailed' (çok derinlemesine ve uzun)."),
  keywords: z.string().optional().describe("Açıklamanın odaklanması istenen, virgülle ayrılmış anahtar kelimeler."),
  pageRange: z.string().optional().describe("Açıklanacak sayfa aralığı, örn: '5-10'. AI, bu bilginin sağlandığı metin parçasına odaklanacaktır."),
  outputDetail: z.enum(["full", "key_points_only", "exam_tips_only", "questions_only"]).optional().default("full").describe("İstenen çıktı detayı: 'full' (tüm bölümler), 'key_points_only' (sadece anahtar noktalar), 'exam_tips_only' (sadece sınav ipuçları), 'questions_only' (sadece örnek sorular)."),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı."),
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi."),
});
export type SummarizePdfForStudentInput = z.infer<typeof SummarizePdfForStudentInputSchema>;

const SummarizePdfForStudentOutputSchema = z.object({
  summary: z.string().describe('Metindeki konunun, öğrencinin anlayışını en üst düzeye çıkaracak şekilde, AI tarafından oluşturulmuş, kapsamlı ve detaylı anlatımı.'),
  keyPoints: z.array(z.string()).describe('Konunun anlaşılması için en önemli noktaların madde işaretleri halinde listesi.'),
  mainIdea: z.string().describe('Parçanın veya konunun ana fikri veya temel tezi.'),
  examTips: z.array(z.string()).optional().describe('Konuyla ilgili, sınavlarda çıkması muhtemel kilit noktalar, tanımlar, formüller veya önemli kavramlar (isteğe bağlı).'),
  practiceQuestions: z.optional(z.array(z.object({
    question: z.string().describe("Konuyu test eden, düşündürücü soru."),
    options: z.array(z.string()).describe("Çoktan seçmeli soru için seçenekler (genellikle 4 veya 5)."),
    answer: z.string().describe("Sorunun doğru cevabı (sadece harf veya seçenek metni)."),
    explanation: z.string().optional().describe("Doğru cevap için kısa ve net bir açıklama.")
  })).describe('İçeriğe dayalı, konuyu pekiştirmek için 3-5 çoktan seçmeli alıştırma sorusu, cevap anahtarı ve açıklamalarıyla birlikte (isteğe bağlı).')),
  formattedStudyOutput: z.string().describe('Tüm istenen bölümleri (Detaylı Açıklama, Anahtar Noktalar, Ana Fikir, Sınav İpuçları, Alıştırma Soruları) net Markdown başlıkları ile içeren, doğrudan çalışma materyali olarak kullanılabilecek birleştirilmiş metin.')
});

export type SummarizePdfForStudentOutput = z.infer<typeof SummarizePdfForStudentOutputSchema>;

export async function summarizePdfForStudent(input: SummarizePdfForStudentInput): Promise<SummarizePdfForStudentOutput> {
  return summarizePdfForStudentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'detailedTopicExplainerFromPdfPrompt',
  input: {schema: SummarizePdfForStudentInputSchema},
  output: {schema: SummarizePdfForStudentOutputSchema},
  prompt: `Sen, sana sunulan akademik metinlerdeki konuları son derece detaylı, kapsamlı ve anlaşılır bir şekilde açıklayan, alanında otorite sahibi bir AI konu uzmanısın. Amacın, metindeki bilgileri sadece özetlemek değil, aynı zamanda konuyu derinlemesine öğretmek, temel kavramları, prensipleri, önemli alt başlıkları, örnekleri ve (varsa) diğer disiplinler veya konularla bağlantılarıyla birlikte sunmaktır. Öğrencinin metindeki konuyu tam anlamıyla kavramasına yardımcı ol. Cevapların her zaman Türkçe dilinde olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#ifEquals userPlan "pro"}}
(Pro Kullanıcı Notu: Açıklamanı en üst düzeyde akademik zenginlikle, konunun felsefi temellerine, tarihsel gelişimine ve en karmaşık detaylarına değinerek yap. Sunduğun anlatım, bir ders kitabının ilgili bölümü kadar kapsamlı ve derinlemesine olmalı. {{{summaryLength}}} "detailed" ise, mümkün olan en uzun ve en kapsamlı çıktıyı üret. En gelişmiş AI yeteneklerini kullan.)
{{else ifEquals userPlan "premium"}}
(Premium Kullanıcı Notu: Açıklamalarını daha fazla örnekle, konunun farklı yönlerini ele alarak ve önemli bağlantıları vurgulayarak zenginleştir. {{{summaryLength}}} "detailed" ise, standart kullanıcıya göre belirgin şekilde daha uzun ve detaylı bir çıktı üret.)
{{/ifEquals}}

{{#if customModelIdentifier}}
(Admin Notu: Bu çözüm, özel olarak seçilmiş '{{{customModelIdentifier}}}' modeli kullanılarak üretilmektedir.)
{{/if}}

Bir PDF'den çıkarılan aşağıdaki metin verildiğinde, {{{summaryLength}}} uzunluk tercihine, {{{outputDetail}}} çıktı detayı isteğine ve varsa {{{keywords}}} anahtar kelimelerine veya {{{pageRange}}} sayfa aralığı bilgisine göre, öğrenci dostu, motive edici ve öğretici bir tonda aşağıdaki görevleri yerine getir. Çıktını, belirtilen şemaya harfiyen uyacak şekilde yapılandır.

Öğrencinin Özel İstekleri:
{{#if keywords}}
- Odaklanılacak Anahtar Kelimeler: {{{keywords}}} (Lütfen açıklamanı bu kelimeler etrafında şekillendir.)
{{/if}}
{{#if pageRange}}
- Odaklanılacak Sayfa Aralığı (Kavramsal): {{{pageRange}}} (Lütfen bu metnin belirtilen sayfa aralığından geldiğini varsayarak veya o aralıktaki bilgilere öncelik vererek açıklamanı yap.)
{{/if}}

İstenen Çıktı Detayı: {{{outputDetail}}}

İstenen Çıktı Bölümleri:
1.  **Detaylı Konu Anlatımı (summary)**: Metindeki konuyu, bir öğrencinin kolayca anlayabileceği, akıcı ve net bir dille, {{{summaryLength}}} seçeneğine göre detay seviyesini ayarlayarak açıkla. Bu bölüm, çıktının ana gövdesi olmalı ve çok kapsamlı olabilir.
    *   'short': Konunun sadece en kritik ana hatlarını ve temel tanımlarını birkaç paragrafta açıkla.
    *   'medium': Ana argümanları, önemli alt başlıkları, temel ilkeleri ve birkaç açıklayıcı örneği içeren dengeli ve daha kapsamlı bir anlatım sun.
    *   'detailed': Metnin tüm önemli yönlerini, alt başlıklarını derinlemesine, karmaşık örnekleri, diğer konularla bağlantılarını ve farklı bakış açılarını (varsa) içerecek şekilde son derece uzun ve kapsamlı bir anlatım oluştur. Bu seçenek en uzun çıktıyı hedeflemelidir.
    Her zaman paragraflar halinde yaz ve Markdown formatlamasını (başlıklar, alt başlıklar, listeler, vurgular) serbestçe kullan.
2.  **Anahtar Noktalar (keyPoints)**: Anlatılan konunun anlaşılması için en önemli, akılda kalıcı olması gereken bilgileri 5-10 madde halinde listele. Bunlar, öğrencinin hızlı tekrar yapmasına ve konunun iskeletini görmesine yardımcı olmalı. Eğer 'outputDetail' sadece belirli bir bölümü istiyorsa (örn: 'exam_tips_only'), bu bölümü atlayabilirsin.
3.  **Ana Fikir (mainIdea)**: Açıklanan konunun veya metnin temel mesajını, amacını veya tezini tek ve etkili bir cümleyle ifade et. "Bu metin şu konuyu detaylıca anlamak için önemlidir: ..." gibi bir giriş yapabilirsin. Eğer 'outputDetail' sadece belirli bir bölümü istiyorsa, bu bölümü atlayabilirsin.
4.  **Sınav İpuçları (examTips) (isteğe bağlı)**: Eğer 'outputDetail' 'full' veya 'exam_tips_only' ise, metinden sınavlarda soru olarak çıkma potansiyeli yüksek olan kilit tanımları, önemli tarihleri, formülleri, kavramları, neden-sonuç ilişkilerini veya karşılaştırmaları 4-6 madde halinde belirt. "Sınavlarda Bu Kısımlara Dikkat!" gibi bir başlık kullanabilirsin.
5.  **Alıştırma Soruları (practiceQuestions) (isteğe bağlı)**: Eğer içerik uygunsa ve 'outputDetail' 'questions_only' veya 'full' ise, anlatılan konuyu pekiştirmek amacıyla, YKS formatına uygun, anlamayı ve yorumlamayı ölçen 3-5 adet çoktan seçmeli soru oluştur. Her soru için:
    *   **Soru Metni**: Açık ve net olmalı.
    *   **Seçenekler**: A, B, C, D, E şeklinde 5 seçenek sun. Çeldiriciler mantıklı ve konuya yakın olmalı.
    *   **Doğru Cevap**: Sadece doğru seçeneğin harfini belirt (örn: "C").
    *   **Açıklama**: Doğru cevabın neden doğru olduğunu ve diğer seçeneklerin neden yanlış olduğunu kısaca öğrencinin anlayacağı dilde açıkla.
    Eğer içerik soru üretmeye uygun değilse veya 'outputDetail' bunu istemiyorsa, bu bölümü atla ve 'practiceQuestions' alanını boş bırak.
6.  **Formatlanmış Çalışma Çıktısı (formattedStudyOutput)**: Yukarıdaki istenen bölümleri ({{{outputDetail}}} seçeneğine göre) net Markdown formatlaması kullanarak tek bir dizede birleştir. "## Detaylı Konu Anlatımı", "## Anahtar Noktalar", "## Ana Fikir", "## Sınav İpuçları", "## Alıştırma Soruları" gibi başlıklar kullan. Bu birleştirilmiş çıktı doğrudan kullanılacaktır. Eğer 'outputDetail' örneğin 'key_points_only' ise, formattedStudyOutput sadece "## Anahtar Noktalar" başlığını ve içeriğini içermelidir.

Unutma, hedefin öğrencinin konuyu derinlemesine anlamasına ve kavramasına yardımcı olmak. Bilgiyi en sindirilebilir, en akılda kalıcı ve en kapsamlı şekilde sun. Açıklamanın uzunluğu konusunda {{{summaryLength}}} seçeneğine, özellikle 'detailed' seçildiğinde, cömert ol.

İşlenecek Metin:
{{{pdfText}}}`,
});

const summarizePdfForStudentFlow = ai.defineFlow(
  {
    name: 'summarizePdfForStudentFlow',
    inputSchema: SummarizePdfForStudentInputSchema,
    outputSchema: SummarizePdfForStudentOutputSchema,
  },
  async (input: SummarizePdfForStudentInput): Promise<SummarizePdfForStudentOutput> => {
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
          console.warn(`[Summarize PDF Flow] Unknown customModelIdentifier: ${input.customModelIdentifier}. Defaulting to ${modelToUse}`);
      }
    } else if (input.userPlan === 'pro') {
      modelToUse = 'googleai/gemini-1.5-flash-latest'; 
    }
    
    callOptions.model = modelToUse;

    if (modelToUse !== 'googleai/gemini-2.5-flash-preview-04-17') {
      callOptions.config = {
        generationConfig: {
          maxOutputTokens: input.summaryLength === 'detailed' ? 8000 : input.summaryLength === 'medium' ? 4096 : 2048,
        }
      };
    } else {
       callOptions.config = {}; 
    }

    console.log(`[Summarize PDF Flow] Using model: ${modelToUse} with input:`, { summaryLength: input.summaryLength, outputDetail: input.outputDetail, keywords: !!input.keywords, pageRange: !!input.pageRange, userPlan: input.userPlan, customModel: input.customModelIdentifier });

    try {
      const {output} = await prompt(enrichedInput, callOptions);
      if (!output) {
        throw new Error("AI, PDF içeriği için şemaya uygun bir açıklama üretemedi.");
      }

      const shouldHaveQuestions = input.outputDetail === 'full' || input.outputDetail === 'questions_only';
      if (shouldHaveQuestions && output.practiceQuestions === undefined) {
          output.practiceQuestions = [];
      }
      if (!shouldHaveQuestions) {
          output.practiceQuestions = undefined;
      }

      const shouldHaveExamTips = input.outputDetail === 'full' || input.outputDetail === 'exam_tips_only';
      if (!shouldHaveExamTips) {
          output.examTips = []; // Keep as empty array if not requested but potentially returned by schema
      }
      if (shouldHaveExamTips && output.examTips === undefined) {
          output.examTips = [];
      }

      if (input.outputDetail !== 'full' && input.outputDetail !== 'key_points_only') {
          output.keyPoints = [];
      }
      
      if (input.outputDetail === 'key_points_only' || input.outputDetail === 'exam_tips_only' || input.outputDetail === 'questions_only') {
          if(input.outputDetail !== 'full') output.summary = "Sadece istenen bölüm üretildi."; 
          if(input.outputDetail !== 'full') output.mainIdea = "Sadece istenen bölüm üretildi."; 
      }
      return output;
    } catch (error: any) {
        console.error(`[Summarize PDF Flow] Error during generation with model ${modelToUse}:`, error);
        let errorMessage = `AI modeli (${modelToUse}) ile PDF özeti oluşturulurken bir hata oluştu.`;
        if (error.message) {
            errorMessage += ` Detay: ${error.message.substring(0, 200)}`;
             if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
              errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen PDF içeriğini kontrol edin. Model: ${modelToUse}. Detay: ${error.message.substring(0, 150)}`;
            }
        }
        return {
            summary: errorMessage,
            keyPoints: ["Hata oluştu."],
            mainIdea: "İçerik işlenirken bir sorunla karşılaşıldı.",
            examTips: [],
            practiceQuestions: [],
            formattedStudyOutput: `## Hata\n\n${errorMessage}`
        };
    }
  }
);
    