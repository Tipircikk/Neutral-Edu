
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

const GenerateTestInputSchema = z.object({
  topic: z.string().describe('Testin oluşturulacağı ana konu veya ders materyali özeti.'),
  numQuestions: z.number().min(3).max(20).default(5).describe('Testte olması istenen soru sayısı (çoktan seçmeli, doğru/yanlış vb. karışık olabilir).'),
  questionTypes: z.array(z.enum(["multiple_choice", "true_false", "short_answer"])).optional().describe("İstenen soru tipleri. Belirtilmezse AI en uygun olanları seçer."),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium").describe("Testin zorluk seviyesi."),
});
export type GenerateTestInput = z.infer<typeof GenerateTestInputSchema>;

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
});
export type GenerateTestOutput = z.infer<typeof GenerateTestOutputSchema>;

export async function generateTest(input: GenerateTestInput): Promise<GenerateTestOutput> {
  return testGeneratorFlow(input);
}

const prompt = ai.definePrompt({
  name: 'testGeneratorPrompt',
  input: {schema: GenerateTestInputSchema},
  output: {schema: GenerateTestOutputSchema},
  prompt: `Sen, öğrencilerin bilgilerini pekiştirmeleri ve sınavlara hazırlanmaları için çeşitli akademik konularda pratik testler hazırlayan deneyimli bir AI eğitim materyali geliştiricisisin. 
Rolün, sadece soru yazmak değil, aynı zamanda öğrenmeyi teşvik eden, adil ve konuyu kapsamlı bir şekilde değerlendiren testler tasarlamaktır.

Kullanıcının İstekleri:
Konu: {{{topic}}}
İstenen Soru Sayısı: {{{numQuestions}}}
{{#if questionTypes}}İstenen Soru Tipleri: {{#each questionTypes}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}
Zorluk Seviyesi: {{{difficulty}}}

Lütfen bu bilgilere dayanarak bir test oluştur. Test, aşağıdaki formatta ve prensiplerde olmalıdır:
1.  **Test Başlığı**: Konuyla ilgili, ilgi çekici ve uygun bir başlık (örn: "{{{topic}}} Kapsamlı Değerlendirme Sınavı", "{{{topic}}} Temel Kavramlar Testi").
2.  **Sorular**: Her soru için:
    *   **Soru Metni**: Açık, net ve tek bir doğru cevaba işaret edecek şekilde ifade et. Belirsizlikten kaçın.
    *   **Soru Tipi**: 'multiple_choice', 'true_false', veya 'short_answer' tiplerinden biri olmalı. Kullanıcının belirttiği tipleri dikkate al, belirtmediyse konuya ve zorluğa en uygun çeşitliliği sağla.
    *   **Seçenekler (çoktan seçmeli ise)**: En az 3-4 seçenek sun. Seçenekler mantıklı çeldiriciler içermeli, bariz yanlış veya konu dışı olmamalıdır.
    *   **Doğru Cevap**: Sorunun doğru cevabını net bir şekilde belirt.
    *   **Açıklama (isteğe bağlı ama şiddetle tavsiye edilir)**: Doğru cevabın neden doğru olduğuna dair kısa ve öz bir açıklama ekle. Bu, öğrencinin konuyu daha iyi anlamasına yardımcı olacaktır.

Genel Prensipler:
*   Soruları hazırlarken, sadece ezber bilgiyi değil, aynı zamanda konunun anlaşılmasını, yorumlanmasını ve uygulanmasını ölçecek nitelikte olmasına özen göster.
*   Belirtilen zorluk seviyesine ({{difficulty}}) uygun sorular seç. Kolay sorular temel bilgiyi, orta seviye sorular anlama ve uygulamayı, zor sorular ise analiz ve sentez becerilerini ölçebilir.
*   Kullanıcı belirli soru tipleri istemediyse, testin dengeli olması için farklı tipleri karıştırarak kullan (örneğin, %60 çoktan seçmeli, %20 doğru/yanlış, %20 kısa cevaplı).
*   Soruların ve cevapların dilbilgisi açısından doğru ve anlaşılır olmasına dikkat et.
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
