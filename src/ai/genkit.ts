import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI()],
  // Varsayılan model tanımı kaldırıldı. Model seçimi her flow içinde yapılacak.
  // model: 'googleai/gemini-1.5-flash-latest',
});
