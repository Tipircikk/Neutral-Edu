
'use server';
/**
 * @fileOverview Bir AI soru çözme ajanı. Görsel veya metin tabanlı soruları çözebilir.
 *
 * - solveQuestion - Kullanıcının sorduğu bir soruyu çözme işlemini yöneten fonksiyon.
 * - SolveQuestionInput - solveQuestion fonksiyonu için giriş tipi.
 * - SolveQuestionOutput - solveQuestion fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SolveQuestionInputSchema = z.object({
  questionText: z.string().optional().describe('Kullanıcının çözülmesini istediği soru metni.'),
  imageDataUri: z.string().optional().describe("Soruyla ilgili bir görselin data URI'si (Base64 formatında). 'data:<mimetype>;base64,<encoded_data>' formatında olmalıdır."),
});
export type SolveQuestionInput = z.infer<typeof SolveQuestionInputSchema>;

const SolveQuestionOutputSchema = z.object({
  solution: z.string().describe('Sorunun adım adım çözümü ve açıklaması.'),
  relatedConcepts: z.array(z.string()).optional().describe('Çözümle ilgili anahtar kavramlar veya konular.'),
  confidenceScore: z.number().optional().min(0).max(1).describe('AI\'nın çözümden ne kadar emin olduğu (0 ile 1 arasında).'),
});
export type SolveQuestionOutput = z.infer<typeof SolveQuestionOutputSchema>;

export async function solveQuestion(input: SolveQuestionInput): Promise<SolveQuestionOutput> {
  return questionSolverFlow(input);
}

const prompt = ai.definePrompt({
  name: 'questionSolverPrompt',
  input: {schema: SolveQuestionInputSchema},
  output: {schema: SolveQuestionOutputSchema},
  prompt: `Sen, öğrencilere çeşitli konulardaki soruları çözmelerinde yardımcı olan, son derece bilgili, sabırlı ve anlayışlı bir AI uzman öğretmenisin. 
Amacın sadece cevabı vermek değil, aynı zamanda sorunun nasıl çözüldüğünü adım adım açıklamak, altında yatan prensipleri vurgulamak ve öğrencinin konuyu tam olarak kavramasına yardımcı olmaktır.

Kullanıcının girdileri aşağıdadır. Lütfen bu girdilere dayanarak bir çözüm üret:

{{#if imageDataUri}}
Görsel Soru:
{{media url=imageDataUri}}
{{/if}}

{{#if questionText}}
Metinsel Soru/Açıklama:
{{{questionText}}}
{{/if}}

Lütfen bu soruyu/soruları analiz et ve aşağıdaki formatta bir yanıt hazırla:
1.  **Çözüm**: Sorunun detaylı, adım adım çözümünü ve mantığını açıkla. Eğer birden fazla çözüm yolu varsa, en yaygın veya anlaşılır olanı tercih et. Öğrencinin her adımı neden attığımızı anlamasını sağla.
2.  **İlgili Kavramlar (isteğe bağlı)**: Çözümde kullanılan veya soruyla yakından ilişkili önemli akademik kavramları listele. Bu kavramların kısa tanımlarını veya çözümle bağlantılarını ekleyebilirsin.
3.  **Güven Skoru (isteğe bağlı)**: Verdiğin çözümden ne kadar emin olduğunu 0 (emin değilim) ile 1 (çok eminim) arasında bir değerle belirt.

Davranış Kuralları:
*   Eğer hem görsel hem de metin girdisi varsa, bunları birbiriyle ilişkili kabul et ve çözümü buna göre oluştur. Metin, görseldeki soruyu açıklıyor veya ek bilgi veriyor olabilir.
*   Eğer sadece görsel varsa, görseldeki soruyu tanımla ve çöz.
*   Eğer sadece metin varsa, metindeki soruyu çöz.
*   Eğer girdi yetersiz veya anlamsızsa, nazikçe daha fazla bilgi iste veya soruyu çözemeyeceğini belirt.
*   Yanıtını öğrencinin kolayca anlayabileceği, açık, teşvik edici ve eğitici bir dille yaz. Karmaşık terminolojiden kaçın veya açıkladığından emin ol.
`,
});

const questionSolverFlow = ai.defineFlow(
  {
    name: 'questionSolverFlow',
    inputSchema: SolveQuestionInputSchema,
    outputSchema: SolveQuestionOutputSchema,
  },
  async (input) => {
    if (!input.questionText && !input.imageDataUri) {
      throw new Error("Soru çözmek için metin veya görsel sağlanmalıdır.");
    }
    const {output} = await prompt(input);
    if (!output) {
      throw new Error("AI, soru için bir çözüm ve açıklama üretemedi.");
    }
    return output;
  }
);
