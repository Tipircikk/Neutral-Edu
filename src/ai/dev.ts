import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-pdf-flow.ts';
import '@/ai/flows/question-solver-flow.ts';
import '@/ai/flows/test-generator-flow.ts';
import '@/ai/flows/topic-summarizer-flow.ts';
import '@/ai/flows/flashcard-generator-flow.ts';
import '@/ai/flows/exam-report-analyzer-flow.ts';
import '@/ai/flows/study-plan-generator-flow.ts';
import '@/ai/flows/topic-explainer-flow.ts';
import '@/ai/flows/video-summarizer-flow.ts'; // Added new flow
