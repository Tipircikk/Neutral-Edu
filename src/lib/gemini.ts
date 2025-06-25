import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (typeof apiKey !== 'string' || !apiKey) {
  throw new Error("VITE_GEMINI_API_KEY, .env dosyasında ayarlanmamış veya boş. Lütfen doğru şekilde ayarlandığından ve sunucuyu yeniden başlattığınızdan emin olun.");
}

const ai = new GoogleGenAI({ apiKey: apiKey });

export const modelName = "gemini-2.5-flash";

export default ai; 