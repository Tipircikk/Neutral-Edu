
'use server';
/**
 * @fileOverview YKS'ye hazırlanan öğrenciler için belirli bir konu hakkında, seçilen zorluk seviyesine ve soru sayısına göre
 * AI destekli son derece kaliteli ve YKS formatına uygun deneme testleri oluşturan uzman bir eğitim materyali geliştiricisi.
 *
 * - generateTest - Kullanıcının belirttiği konu, soru sayısı ve zorluk seviyesine göre test oluşturma işlemini yöneten fonksiyon.
 * - GenerateTestInput - generateTest fonksiyonu için giriş tipi.
 * - GenerateTestOutput - generateTest fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTestInputSchema = z.object({
  topic: z.string().describe('Testin oluşturulacağı ana YKS konusu, alt başlığı veya ders materyali özeti. (Örn: "Trigonometri - Yarım Açı Formülleri", "Tanzimat Edebiyatı Romanı", "Hücre Organelleri ve Görevleri")'),
  numQuestions: z.number().min(3).max(20).default(5).describe('Testte olması istenen soru sayısı (YKS\'deki gibi genellikle çoktan seçmeli).'),
  questionTypes: z.array(z.enum(["multiple_choice", "true_false", "short_answer"])).optional().default(["multiple_choice"]).describe("İstenen soru tipleri. YKS formatı için 'multiple_choice' ağırlıklı olmalıdır."),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium").describe("Testin YKS'ye göre zorluk seviyesi: 'easy' (temel bilgi ve hatırlama), 'medium' (anlama, yorumlama, uygulama), 'hard' (analiz, sentez, ileri düzey problem çözme)."),
});
export type GenerateTestInput = z.infer<typeof GenerateTestInputSchema>;

const QuestionSchema = z.object({
    questionText: z.string().describe("Sorunun YKS standartlarında, açık ve net ifade edilmiş metni."),
    questionType: z.enum(["multiple_choice", "true_false", "short_answer"]).describe("Sorunun tipi. YKS için 'multiple_choice' olmalı."),
    options: z.array(z.string()).optional().describe("Çoktan seçmeli sorular için 5 adet seçenek (A, B, C, D, E). Seçenekler mantıklı ve güçlü çeldiriciler içermeli."),
    correctAnswer: z.string().describe("Sorunun doğru cevabı (Örn: 'A', 'Doğru', 'Fotosentez'). Çoktan seçmelide sadece harf."),
    explanation: z.string().optional().describe("Doğru cevabın neden doğru olduğuna ve diğer seçeneklerin neden yanlış olduğuna dair YKS öğrencisinin anlayacağı dilde, öğretici ve detaylı bir açıklama."),
});

const GenerateTestOutputSchema = z.object({
  testTitle: z.string().describe("Oluşturulan test için konuyla ilgili, YKS'ye uygun başlık (örn: '{{{topic}}} YKS Deneme Sınavı', '{{{topic}}} İleri Seviye Testi')."),
  questions: z.array(QuestionSchema).describe('Oluşturulan YKS formatındaki test soruları listesi.'),
});
export type GenerateTestOutput = z.infer<typeof GenerateTestOutputSchema>;

export async function generateTest(input: GenerateTestInput): Promise<GenerateTestOutput> {
  return testGeneratorFlow(input);
}

const prompt = ai.definePrompt({
  name: 'testGeneratorPrompt',
  input: {schema: GenerateTestInputSchema},
  output: {schema: GenerateTestOutputSchema},
  prompt: `Sen, Yükseköğretim Kurumları Sınavı (YKS) için öğrencilerin bilgilerini pekiştirmeleri, eksiklerini görmeleri ve sınav pratiği yapmaları amacıyla çeşitli akademik konularda nokta atışı, YKS standartlarında ve zorluk seviyesi ayarlanmış deneme testleri hazırlayan, son derece deneyimli ve pedagojik derinliğe sahip bir AI YKS eğitim materyali uzmanısın.
Rolün, sadece soru yazmak değil, aynı zamanda öğrenmeyi teşvik eden, eleştirel düşünmeyi ölçen, adil ve konuyu kapsamlı bir şekilde değerlendiren, YKS'nin ruhuna uygun testler tasarlamaktır. Cevapların her zaman Türkçe olmalıdır. Premium plan kullanıcıları için, soruların çeşitliliğini ve açıklamaların derinliğini artırarak daha zengin bir deneyim sunmaya çalış.

Kullanıcının İstekleri:
Konu: {{{topic}}}
İstenen Soru Sayısı: {{{numQuestions}}}
İstenen Soru Tipleri: {{#if questionTypes}}{{#each questionTypes}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}Çoktan Seçmeli Ağırlıklı{{/if}}
YKS Zorluk Seviyesi: {{{difficulty}}}

Lütfen bu bilgilere dayanarak, tamamıyla YKS formatına ve ciddiyetine uygun bir test oluştur. Test, aşağıdaki formatta ve prensiplerde olmalıdır:
1.  **Test Başlığı**: Konuyla ilgili, öğrenciyi motive eden ve YKS'ye uygun bir başlık (örn: "{{{topic}}} - YKS Prova Sınavı ({{difficulty}} Seviye)", "{{{topic}}} Temel Kavramlar ve Uygulamalar Testi").
2.  **Sorular**: Her soru için (tamamı YKS standartlarında):
    *   **Soru Metni**: Açık, net, anlaşılır ve tek bir doğru cevaba işaret edecek şekilde ifade edilmeli. Belirsizlikten ve muğlaklıktan kesinlikle kaçınılmalı. YKS'de kullanılan soru köklerine (örneğin "hangisidir?", "hangisi söylenemez?", "çıkarılabilir?") benzer ifadeler kullanılmalı.
    *   **Soru Tipi**: Kullanıcı belirtti ise {{{questionTypes}}} tiplerini dikkate al. Belirtmediyse veya YKS için uygun değilse, tamamı 'multiple_choice' (çoktan seçmeli) olmalı.
    *   **Seçenekler (çoktan seçmeli ise)**: Mutlaka 5 adet (A, B, C, D, E) seçenek sunulmalı. Seçenekler, konuyla ilgili mantıklı ve güçlü çeldiriciler içermeli; bariz yanlış, konu dışı veya alakasız olmamalıdır. Çeldiriciler, öğrencilerin yaygın yaptığı hataları veya kavram yanılgılarını hedefleyebilir.
    *   **Doğru Cevap**: Sorunun doğru cevabı net bir şekilde (sadece seçenek harfi, örn: "A") belirtilmeli.
    *   **Açıklama (zorunlu ve detaylı)**: Her soru için, doğru cevabın neden doğru olduğuna ve diğer DÖRT seçeneğin neden yanlış olduğuna dair adım adım, mantıksal ve öğretici bir açıklama eklenmeli. Bu açıklama, öğrencinin konuyu pekiştirmesine, hatasını anlamasına ve YKS için önemli püf noktalarını öğrenmesine yardımcı olmalıdır. Açıklama, bir öğretmenin konuyu anlatış tarzında olmalıdır.

Genel Prensipler:
*   Soruları hazırlarken, sadece ezber bilgiyi değil, aynı zamanda YKS'nin gerektirdiği anlama, yorumlama, analiz, sentez, problem çözme ve eleştirel düşünme becerilerini ölçecek nitelikte olmasına azami özen göster.
*   Belirtilen YKS zorluk seviyesine ({{{difficulty}}}) tam olarak uyum sağla:
    *   'easy': Genellikle bilgi ve hatırlama düzeyinde, temel kavramları sorgulayan sorular.
    *   'medium': Anlama, yorumlama, basit problem çözme ve uygulama becerilerini ölçen, YKS ortalamasına yakın sorular.
    *   'hard': Analiz, sentez, karmaşık problem çözme, birden fazla bilgiyi birleştirme ve çıkarım yapma gerektiren, ayırt edici YKS soruları.
*   {{{topic}}} konusunu kapsamlı bir şekilde tara. Sorular, konunun farklı alt başlıklarından dengeli bir şekilde dağılmalı.
*   Soruların ve cevapların dilbilgisi açısından kusursuz ve YKS terminolojisine uygun olmasına dikkat et.
*   Çalıntı veya başka kaynaklardan doğrudan kopyalanmış soru kullanma. Tamamen özgün sorular üret.
`,
});

const testGeneratorFlow = ai.defineFlow(
  {
    name: 'testGeneratorFlow',
    inputSchema: GenerateTestInputSchema,
    outputSchema: GenerateTestOutputSchema,
  },
  async (input) => {
    // Ensure default questionTypes if not provided
    if (!input.questionTypes || input.questionTypes.length === 0) {
      input.questionTypes = ["multiple_choice"];
    }
    const {output} = await prompt(input);
    if (!output || !output.questions || output.questions.length === 0) {
      throw new Error("AI YKS Test Uzmanı, belirtilen konu için YKS standartlarında bir test oluşturamadı. Lütfen konu ve ayarları kontrol edin.");
    }
     // Ensure all multiple choice questions have 5 options
    output.questions.forEach(q => {
      if (q.questionType === "multiple_choice" && (!q.options || q.options.length !== 5)) {
        // This is a fallback, ideally the LLM respects the prompt.
        // Forcing 5 options might lead to poor quality if LLM doesn't provide them.
        // Consider throwing an error or logging if options are not as expected.
        console.warn(`Soru "${q.questionText}" için 5 seçenek bekleniyordu, ancak ${q.options?.length || 0} seçenek üretildi. LLM prompt'unu kontrol edin.`);
        // As a very basic fallback, fill with placeholders if critically needed, but this is not ideal.
        // if (!q.options) q.options = [];
        // while (q.options.length < 5) q.options.push("Eksik Seçenek");
      }
    });
    return output;
  }
);
