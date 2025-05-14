
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
  prompt: `You are an AI assistant that helps students understand academic texts and prepare for exams.

Given a text extracted from a PDF, perform the following tasks in a clear and student-friendly tone. Structure your response clearly to fit the output schema.

1.  **Summary**: Summarize the text in simple language.
2.  **Key Points**: List the most important points as bullet points.
3.  **Main Idea**: Extract the main idea or topic of the passage.
4.  **Exam Tips**: Identify key parts that are likely to appear in an exam (e.g., definitions, examples, important events or formulas). List these as bullet points.
5.  **Practice Questions**: If relevant to the content, generate 3-5 multiple-choice questions (with answer keys, options, and optionally a brief explanation for the correct answer) based on the content. Make sure the questions test understanding, not just memorization. If not relevant, this field can be omitted.
6.  **Formatted Study Output**: Combine all the above sections (Summary, Key Points, Main Idea, Exam Tips, and Practice Questions if generated) into a single string with clear Markdown formatting. Use headings like "## Özet", "## Anahtar Noktalar", "## Ana Fikir", "## Sınav İpuçları", "## Alıştırma Soruları". This combined output will be used directly.

Text to be processed:
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
    // The prompt now asks for the formattedStudyOutput directly.
    // We still expect the individual fields to be populated by the LLM as per the schema.
    // If only formattedStudyOutput is needed, we can simplify the output schema,
    // but for now, we'll assume the model tries to fill all.
    return output;
  }
);

