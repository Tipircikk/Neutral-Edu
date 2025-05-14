
'use server';
/**
 * @fileOverview Bir AI soru çözme ajanı.
 *
 * - solveQuestion - Kullanıcının sorduğu bir soruyu çözme işlemini yöneten fonksiyon.
 * - SolveQuestionInput - solveQuestion fonksiyonu için giriş tipi.
 * - SolveQuestionOutput - solveQuestion fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Bu şema, kullanıcıdan alınacak soruyu tanımlar.
const SolveQuestionInputSchema = z.object({
  questionText: z.string().describe('Kullanıcının çözülmesini istediği soru metni.'),
  // Gerekirse, sorunun bağlamı (örneğin, hangi dersle ilgili olduğu) veya ek materyaller (resim URL'si gibi) eklenebilir.
  // context: z.string().optional().describe('Sorunun ait olduğu konu veya ders bağlamı.'),
  // image_url: z.string().optional().url().describe('Soruyla ilgili bir resmin URLsi (eğer varsa).')
});
export type SolveQuestionInput = z.infer<typeof SolveQuestionInputSchema>;

// Bu şema, AI'nın üreteceği çözümü ve açıklamayı tanımlar.
const SolveQuestionOutputSchema = z.object({
  solution: z.string().describe('Sorunun adım adım çözümü ve açıklaması.'),
  relatedConcepts: z.array(z.string()).optional().describe('Çözümle ilgili anahtar kavramlar veya konular.'),
  confidenceScore: z.number().optional().min(0).max(1).describe('AI\'nın çözümden ne kadar emin olduğu (0 ile 1 arasında).'),
});
export type SolveQuestionOutput = z.infer<typeof SolveQuestionOutputSchema>;

export async function solveQuestion(input: SolveQuestionInput): Promise<SolveQuestionOutput> {
  // TODO: Kullanıcı kotasını ve yetkilendirmesini burada kontrol et.
  return questionSolverFlow(input);
}

const prompt = ai.definePrompt({
  name: 'questionSolverPrompt',
  input: {schema: SolveQuestionInputSchema},
  output: {schema: SolveQuestionOutputSchema},
  prompt: `Sen öğrencilere çeşitli konulardaki soruları çözmelerinde yardımcı olan uzman bir AI asistanısın.
Amacın, sadece cevabı vermek değil, aynı zamanda sorunun nasıl çözüldüğünü adım adım açıklamak ve ilgili kavramları belirtmektir.

Kullanıcının Sorusu:
{{{questionText}}}

Lütfen bu soruyu çöz ve aşağıdaki formatta bir yanıt hazırla:
1.  **Çözüm**: Sorunun detaylı, adım adım çözümünü ve mantığını açıkla. Eğer birden fazla çözüm yolu varsa, en yaygın veya anlaşılır olanı tercih et.
2.  **İlgili Kavramlar (isteğe bağlı)**: Çözümde kullanılan veya soruyla yakından ilişkili önemli akademik kavramları listele.
3.  **Güven Skoru (isteğe bağlı)**: Verdiğin çözümden ne kadar emin olduğunu 0 (emin değilim) ile 1 (çok eminim) arasında bir değerle belirt.

Yanıtını öğrencinin kolayca anlayabileceği, açık ve eğitici bir dille yaz.
`,
});

const questionSolverFlow = ai.defineFlow(
  {
    name: 'questionSolverFlow',
    inputSchema: SolveQuestionInputSchema,
    outputSchema: SolveQuestionOutputSchema,
  },
  async (input) => {
    // Burada Genkit prompt'unu çağırıyoruz.
    const {output} = await prompt(input);
    if (!output) {
      throw new Error("AI, soru için bir çözüm ve açıklama üretemedi.");
    }
    return output;
  }
);

// Örnek Kullanım (Geliştirme için):
/*
async function testSolveQuestion() {
  try {
    const result = await solveQuestion({ questionText: "Bir dik üçgenin hipotenüsü 13 cm, bir dik kenarı 5 cm ise diğer dik kenarı kaç cm'dir?" });
    console.log("AI Çözümü:", result.solution);
    if (result.relatedConcepts) {
      console.log("İlgili Kavramlar:", result.relatedConcepts.join(", "));
    }
  } catch (error) {
    console.error("Soru çözme testi sırasında hata:", error);
  }
}
// testSolveQuestion();
*/

    