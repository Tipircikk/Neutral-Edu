
'use server';
/**
 * @fileOverview Belirli bir konu hakkında AI destekli testler oluşturan bir ajan.
 *
 * - generateTest - Kullanıcının belirttiği konu ve soru sayısına göre test oluşturma işlemini yöneten fonksiyon.
 * - GenerateTestInput - generateTest fonksiyonu için giriş tipi.
 * - GenerateTestOutput - generateTest fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Kullanıcıdan alınacak test konusunu ve istenen soru sayısını tanımlar.
const GenerateTestInputSchema = z.object({
  topic: z.string().describe('Testin oluşturulacağı ana konu veya ders materyali özeti.'),
  numQuestions: z.number().min(3).max(20).default(5).describe('Testte olması istenen soru sayısı (çoktan seçmeli, doğru/yanlış vb. karışık olabilir).'),
  questionTypes: z.array(z.enum(["multiple_choice", "true_false", "short_answer"])).optional().describe("İstenen soru tipleri. Belirtilmezse AI en uygun olanları seçer."),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium").describe("Testin zorluk seviyesi."),
});
export type GenerateTestInput = z.infer<typeof GenerateTestInputSchema>;

// AI'nın üreteceği testin yapısını tanımlar.
// Her soru için soru metni, seçenekler (eğer varsa), doğru cevap ve kısa bir açıklama içerebilir.
const QuestionSchema = z.object({
    questionText: z.string().describe("Sorunun metni."),
    questionType: z.enum(["multiple_choice", "true_false", "short_answer"]).describe("Sorunun tipi."),
    options: z.array(z.string()).optional().describe("Çoktan seçmeli sorular için seçenekler."),
    correctAnswer: z.string().describe("Sorunun doğru cevabı."),
    explanation: z.string().optional().describe("Doğru cevap için kısa bir açıklama."),
});

const GenerateTestOutputSchema = z.object({
  testTitle: z.string().describe("Oluşturulan test için başlık (örn: '{topic} Değerlendirme Testi')."),
  questions: z.array(QuestionSchema).describe('Oluşturulan test soruları listesi.'),
  // testBody: z.string().describe("Oluşturulan testin tamamı, sorular ve cevap anahtarı ile birlikte formatlanmış metin.") // Veya daha yapısal
});
export type GenerateTestOutput = z.infer<typeof GenerateTestOutputSchema>;

export async function generateTest(input: GenerateTestInput): Promise<GenerateTestOutput> {
  // TODO: Kullanıcı kotasını ve yetkilendirmesini burada kontrol et.
  return testGeneratorFlow(input);
}

const prompt = ai.definePrompt({
  name: 'testGeneratorPrompt',
  input: {schema: GenerateTestInputSchema},
  output: {schema: GenerateTestOutputSchema},
  prompt: `Sen öğrencilere yönelik, belirli bir akademik konuda pratik testler hazırlayan uzman bir AI eğitim asistanısın.
Amacın, öğrencilerin konuyu ne kadar anladığını ölçmelerine yardımcı olacak, çeşitli ve düşündürücü sorular üretmektir.

Kullanıcının İstekleri:
Konu: {{{topic}}}
İstenen Soru Sayısı: {{{numQuestions}}}
{{#if questionTypes}}İstenen Soru Tipleri: {{#each questionTypes}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}
Zorluk Seviyesi: {{{difficulty}}}

Lütfen bu bilgilere dayanarak bir test oluştur. Test, aşağıdaki formatta olmalıdır:
1.  **Test Başlığı**: Konuyla ilgili uygun bir başlık (örn: "{{{topic}}} Değerlendirme Testi").
2.  **Sorular**: Her soru için:
    *   **Soru Metni**: Açık ve net bir şekilde soruyu ifade et.
    *   **Soru Tipi**: 'multiple_choice', 'true_false', veya 'short_answer' tiplerinden biri.
    *   **Seçenekler (isteğe bağlı)**: Eğer soru çoktan seçmeliyse, en az 3-4 seçenek sun.
    *   **Doğru Cevap**: Sorunun doğru cevabını belirt.
    *   **Açıklama (isteğe bağlı)**: Doğru cevabın neden doğru olduğuna dair kısa bir açıklama ekle.

Soruları hazırlarken, sadece ezber bilgiyi değil, aynı zamanda konunun anlaşılmasını ve uygulanmasını ölçecek nitelikte olmasına özen göster. Belirtilen zorluk seviyesine uygun sorular seç.
Eğer kullanıcı belirli soru tipleri istemediyse, konuya en uygun olanları sen belirle (çoktan seçmeli, doğru/yanlış, kısa cevaplı gibi).
`,
});

const testGeneratorFlow = ai.defineFlow(
  {
    name: 'testGeneratorFlow',
    inputSchema: GenerateTestInputSchema,
    outputSchema: GenerateTestOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output || !output.questions || output.questions.length === 0) {
      throw new Error("AI, belirtilen konu için bir test oluşturamadı.");
    }
    return output;
  }
);

// Örnek Kullanım (Geliştirme için):
/*
async function testGenerateTest() {
  try {
    const result = await generateTest({ 
        topic: "Hücre Organelleri ve Görevleri", 
        numQuestions: 5,
        difficulty: "medium",
        // questionTypes: ["multiple_choice", "true_false"] 
    });
    console.log("Test Başlığı:", result.testTitle);
    result.questions.forEach((q, index) => {
        console.log(`\nSoru ${index + 1} (${q.questionType}): ${q.questionText}`);
        if(q.options) console.log("Seçenekler:", q.options.join(" | "));
        console.log("Doğru Cevap:", q.correctAnswer);
        if(q.explanation) console.log("Açıklama:", q.explanation);
    });
  } catch (error) {
    console.error("Test oluşturma testi sırasında hata:", error);
  }
}
// testGenerateTest();
*/

    