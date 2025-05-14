'use server';

/**
 * @fileOverview Summarizes a PDF document for student comprehension, including simplified explanations,
 * key ideas in bullet points, potential exam questions, and relevant examples.
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
  prompt: `You are an AI assistant specialized in summarizing PDF documents for students.

  Given the text content of a PDF document, your task is to generate a comprehensive summary that aids student comprehension.
  The summary should include the following elements:

  - Simplified Explanations: Explain complex concepts in a clear and easy-to-understand manner.
  - Key Ideas in Bullet Points: Present the main ideas and arguments of the document in a concise bullet-point list.
  - Potential Exam Questions: Include a few potential exam questions related to the content of the document.
  - Relevant Examples (if needed): Provide relevant examples to illustrate key concepts and ideas, only when necessary. You should decide if examples are needed.

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
