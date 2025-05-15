
import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-pdf.ts';
import '@/ai/flows/question-solver-flow.ts';
import '@/ai/flows/test-generator-flow.ts';
import '@/ai/flows/topic-summarizer-flow.ts';
import '@/ai/flows/flashcard-generator-flow.ts'; // Added new flow
    
