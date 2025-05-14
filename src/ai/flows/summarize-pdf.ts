
'use server';

/**
 * @fileOverview Summarizes a PDF document for student comprehension, including simplified explanations,
 * key ideas in bullet points, main idea, potential exam questions, and relevant examples.
 *
 * - summarizePdfForStudent - A function that handles the PDF summarization process.
 * - SummarizePdfForStudentInput - The input type for the summarizePdfForStudent function.
 * - SummarizePdfForStudentOutput - The return type for the summarizePdfForStudent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizePdfForStudentInputSchema = z.object({
  pdfText: z.string().describe('The text content extracted from the PDF document.'),
});
export type SummarizePdfForStudentInput = z.infer<typeof SummarizePdfForStudentInputSchema>;

// Output schema matching the detailed prompt requirements
const SummarizePdfForStudentOutputSchema = z.object({
  summary: z.string().describe('A summary of the text in simple language.'),
  keyPoints: z.array(z.string()).describe('A list of the most important points as bullet points.'),
  mainIdea: z.string().describe('The main idea or topic of the passage.'),
  examTips: z.array(z.string()).describe('Key parts likely to appear in an exam (definitions, examples, etc.).'),
  practiceQuestions: z.optional(z.array(z.object({
    question: z.string(),
    options: z.array(z.string()),
    answer: z.string(),
    explanation: z.string().optional().describe("Brief explanation for the answer.")
  })).describe('3-5 multiple-choice questions with answer keys, testing understanding.')),
  formattedStudyOutput: z.string().describe('The complete, formatted text suitable for a study PDF, including all sections with clear headings.')
});

export type SummarizePdfForStudentOutput = z.infer<typeof SummarizePdfForStudentOutputSchema>;

export async function summarizePdfForStudent(input: SummarizePdfForStudentInput): Promise<SummarizePdfForStudentOutput> {
  return summarizePdfForStudentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizePdfForStudentPrompt',
  input: {schema: SummarizePdfForStudentInputSchema},
  output: {schema: SummarizePdfForStudentOutputSchema},
  prompt: `Sen, öğrencilerin akademik metinleri anlamalarına ve sınavlara hazırlanmalarına yardımcı olan uzman bir AI eğitim asistanısın. 
Görevn, karmaşık bilgileri basitleştirmek ve öğrencilerin öğrenme süreçlerini desteklemektir.

Bir PDF'den çıkarılan aşağıdaki metin verildiğinde, öğrenci dostu ve teşvik edici bir tonda aşağıdaki görevleri yerine getir. Yanıtını, çıktı şemasına uyacak şekilde açıkça yapılandır.

1.  **Özet**: Metni basit ve anlaşılır bir dille özetle. Öğrencinin konuyu genel hatlarıyla kavramasını sağla.
2.  **Anahtar Noktalar**: En önemli noktaları madde işaretleri halinde listele. Bu, öğrencinin hızlı bir tekrar yapmasına yardımcı olmalı.
3.  **Ana Fikir**: Parçanın ana fikrini veya konusunu çıkar. Tek bir cümleyle konunun özünü belirt.
4.  **Sınav İpuçları**: Sınavda çıkması muhtemel kilit bölümleri (örneğin tanımlar, önemli örnekler, formüller, tarihler) madde işaretleri halinde belirt.
5.  **Alıştırma Soruları (isteğe bağlı)**: Eğer içerikle ilgiliyse, anlama düzeyini test eden 3-5 adet çoktan seçmeli soru (cevap anahtarı, seçenekler ve isteğe bağlı olarak doğru cevap için kısa bir açıklama ile birlikte) oluştur. Sorular sadece ezberi değil, konunun anlaşılmasını ölçmelidir. İçerik uygun değilse, bu alan atlanabilir.
6.  **Formatlanmış Çalışma Çıktısı**: Yukarıdaki tüm bölümleri (Özet, Anahtar Noktalar, Ana Fikir, Sınav İpuçları ve Alıştırma Soruları - eğer oluşturulduysa) net Markdown formatlaması kullanarak tek bir dizede birleştir. "## Özet", "## Anahtar Noktalar", "## Ana Fikir", "## Sınav İpuçları", "## Alıştırma Soruları" gibi başlıklar kullan. Bu birleştirilmiş çıktı doğrudan kullanılacaktır.

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
      throw new Error("AI failed to generate a response that matches the schema.");
    }
    return output;
  }
);
