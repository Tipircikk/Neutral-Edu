
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

const SummarizePdfForStudentOutputSchema = z.object({
  summary: z.string().describe('The AI-powered summary of the PDF document, tailored for student comprehension.'),
});
export type SummarizePdfForStudentOutput = z.infer<typeof SummarizePdfForStudentOutputSchema>;

export async function summarizePdfForStudent(input: SummarizePdfForStudentInput): Promise<SummarizePdfForStudentOutput> {
  return summarizePdfForStudentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizePdfForStudentPrompt',
  input: {schema: SummarizePdfForStudentInputSchema},
  output: {schema: SummarizePdfForStudentOutputSchema},
  prompt: `Simplify and summarize this content for students. Break down the key points into bullet points, write the main idea, highlight potential exam questions, and optionally create example problems if needed.

Text Content: {{{pdfText}}}`,
});

const summarizePdfForStudentFlow = ai.defineFlow(
  {
    name: 'summarizePdfForStudentFlow',
    inputSchema: SummarizePdfForStudentInputSchema,
    outputSchema: SummarizePdfForStudentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
