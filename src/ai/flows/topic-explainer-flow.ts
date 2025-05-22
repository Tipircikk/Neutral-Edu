
'use server';
/**
 * @fileOverview Kullanıcının girdiği bir YKS konusunu derinlemesine açıklayan,
 * anahtar kavramları, YKS için stratejik bilgileri ve aktif hatırlama soruları sunan uzman bir AI YKS öğretmeni.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { GoogleGenerativeAI } from "@google/genai";
import { Buffer } from 'buffer'; // Node.js Buffer
import type { UserProfile } from '@/types';


// Helper types for WAV conversion
interface WavConversionOptions {
  numChannels : number;
  sampleRate: number;
  bitsPerSample: number;
}


const ExplainTopicInputSchema = z.object({
  topicName: z.string().min(3).describe('Açıklanması istenen YKS konu başlığı (örn: "Matematik - Türev ve Uygulamaları", "Edebiyat - Milli Edebiyat Dönemi").'),
  explanationLevel: z.enum(["temel", "orta", "detayli"]).optional().default("orta").describe("İstenen anlatımın YKS'ye göre zorluk ve detay seviyesi (temel, orta, detaylı)."),
  teacherPersona: z.enum(["samimi", "eglenceli", "ciddi", "ozel"]).optional().default("samimi").describe("İstenen hoca anlatım tarzı: 'samimi', 'eglenceli', 'ciddi' veya 'ozel' (kullanıcı tanımlı)."),
  customPersonaDescription: z.string().optional().describe("Eğer 'teacherPersona' olarak 'ozel' seçildiyse, kullanıcının istediği hoca kişiliğinin detaylı açıklaması."),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı."),
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi."),
  generateTts: z.boolean().optional().describe("Adminler için sesli anlatım oluşturulup oluşturulmayacağı."),
});
export type ExplainTopicInput = z.infer<typeof ExplainTopicInputSchema>;

const ExplainTopicOutputSchema = z.object({
  explanationTitle: z.string().describe("Oluşturulan konu anlatımı için bir başlık (örn: '{{{topicName}}} Detaylı Konu Anlatımı')."),
  explanation: z.string().describe('Konunun, YKS öğrencisinin anlayışını en üst düzeye çıkaracak şekilde, AI tarafından oluşturulmuş, yapılandırılmış ve kapsamlı anlatımı. Anlatım, ana tanımları, temel ilkeleri, önemli alt başlıkları, örnekleri ve YKS\'de çıkabilecek bağlantıları içermelidir. Matematiksel ifadeler (örn: x^2, H_2O, √, π) metin içinde okunabilir şekilde belirtilmelidir.'),
  keyConcepts: z.array(z.string()).optional().describe('Anlatımda vurgulanan ve YKS için hayati öneme sahip 3-5 anahtar kavram veya terim.'),
  commonMistakes: z.array(z.string()).optional().describe("Öğrencilerin bu konuda sık yaptığı hatalar veya karıştırdığı noktalar."),
  yksTips: z.array(z.string()).optional().describe("Bu konunun YKS'deki önemi, hangi soru tiplerinde çıktığı ve çalışırken nelere dikkat edilmesi gerektiği hakkında 2-3 stratejik ipucu."),
  activeRecallQuestions: z.array(z.string()).optional().describe("Konuyu pekiştirmek ve öğrencinin aktif katılımını sağlamak için AI tarafından sorulan 2-3 çeşitli (kısa cevaplı, boşluk doldurma, doğru/yanlış vb.) ve doğrudan konuyla ilgili soru."),
  audioDataUri: z.string().optional().describe("Konu anlatımının seslendirilmiş halinin data URI'si (Base64, MP3 veya WAV)."),
  ttsError: z.string().optional().describe("Sesli anlatım oluşturulurken bir hata oluşursa kullanıcıya gösterilecek mesaj."),
});
export type ExplainTopicOutput = z.infer<typeof ExplainTopicOutputSchema>;

const defaultErrorOutput: ExplainTopicOutput = {
  explanationTitle: "Hata: Konu Anlatımı Oluşturulamadı",
  explanation: "Konu anlatımı oluşturulurken beklenmedik bir sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin veya destek ile iletişime geçin.",
  keyConcepts: [],
  commonMistakes: [],
  yksTips: [],
  activeRecallQuestions: [],
  ttsError: undefined,
  audioDataUri: undefined,
};

// Function to parse MimeType for WAV conversion
function parseMimeType(mimeType : string): WavConversionOptions {
  console.log(`[TTS parseMimeType] Received mimeType: "${mimeType}"`);
  const [fileType, ...params] = mimeType.split(';').map(s => s.trim());
  const [_discard, format] = fileType.split('/'); // _discard as first part of fileType (e.g. 'audio') is not used

  const options : Partial<WavConversionOptions> = {
    numChannels: 1, // Default to 1 channel
    bitsPerSample: 16, // Default to 16 bits
    sampleRate: 24000, // Default to 24kHz
  };

  if (format && format.toLowerCase().startsWith('l')) { // Ensure case-insensitivity for L16/l16
    const bits = parseInt(format.slice(1), 10);
    if (!isNaN(bits) && bits > 0) {
      options.bitsPerSample = bits;
    } else {
      console.warn(`[TTS parseMimeType] Could not parse bitsPerSample from format: ${format}. Defaulting to ${options.bitsPerSample}.`);
    }
  }

  for (const param of params) {
    const [key, value] = param.split('=').map(s => s.trim().toLowerCase()); // Ensure key is also lowercased
    if (key === 'rate') {
      const rateValue = parseInt(value, 10);
      if(!isNaN(rateValue) && rateValue > 0) {
        options.sampleRate = rateValue;
      } else {
         console.warn(`[TTS parseMimeType] Invalid rate value: ${value}. Defaulting sampleRate to ${options.sampleRate}.`);
      }
    } else if (key === 'channels') {
      const channelsValue = parseInt(value, 10);
      if(!isNaN(channelsValue) && channelsValue > 0) {
        options.numChannels = channelsValue;
      } else {
        console.warn(`[TTS parseMimeType] Invalid channels value: ${value}. Defaulting numChannels to ${options.numChannels}.`);
      }
    }
  }
  console.log(`[TTS parseMimeType] Final determined options:`, JSON.stringify(options));
  return options as WavConversionOptions;
}

// Function to create WAV header
function createWavHeader(dataLength: number, options: WavConversionOptions): Buffer {
  console.log(`[TTS createWavHeader] Creating WAV header with DataLength: ${dataLength}, Options:`, JSON.stringify(options));
  const { numChannels, sampleRate, bitsPerSample } = options;

  if (!numChannels || !sampleRate || !bitsPerSample || numChannels <= 0 || sampleRate <= 0 || bitsPerSample <= 0) {
      const errorMsg = `[TTS createWavHeader] Invalid options for WAV header creation: numChannels=${numChannels}, sampleRate=${sampleRate}, bitsPerSample=${bitsPerSample}`;
      console.error(errorMsg);
      throw new Error(errorMsg); // Throw error to be caught by caller
  }

  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);

  return buffer;
}

// Function to convert raw audio data to WAV Data URI
async function convertToWavDataUri(base64RawData: string, mimeType: string): Promise<string | null> {
  try {
    console.log(`[TTS convertToWavDataUri] Starting WAV conversion for mimeType: ${mimeType}`);
    const options = parseMimeType(mimeType);

    if (!options.sampleRate || options.sampleRate <= 0 || !options.bitsPerSample || options.bitsPerSample <= 0 || !options.numChannels || options.numChannels <= 0) {
        console.error("[TTS convertToWavDataUri] CRITICAL: Missing or invalid parameters from parseMimeType for WAV conversion.", options);
        return null;
    }

    const rawDataBuffer = Buffer.from(base64RawData, 'base64');
    const wavHeader = createWavHeader(rawDataBuffer.length, options);
    const wavBuffer = Buffer.concat([wavHeader, rawDataBuffer]);
    const wavBase64 = wavBuffer.toString('base64');
    console.log("[TTS convertToWavDataUri] Successfully converted to WAV data URI.");
    return `data:audio/wav;base64,${wavBase64}`;
  } catch (error) {
    console.error("[TTS convertToWavDataUri] Error during WAV conversion:", error);
    return null;
  }
}


// Function to synthesize speech using GoogleGenAI
async function synthesizeSpeechWithGoogleGenAI(textToSynthesize: string, persona?: string): Promise<string | { error: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const errorMsg = "Gemini API anahtarı bulunamadı (GEMINI_API_KEY). Lütfen .env dosyasını kontrol edin.";
    console.error("[TTS Generation] CRITICAL:", errorMsg);
    return { error: errorMsg };
  }
  console.log(`[TTS Generation] Using API Key (last 5 chars): ...${apiKey.slice(-5)}`);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const ttsModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro-preview-tts" });

    const ttsRequestConfig = {
      temperature: 0.7,
      responseModalities: ['audio'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: "Rasalgethi", // Using one of the suggested voices
          }
        }
      },
    };
    console.log("[TTS Generation] Full request payload to generateContentStream:", JSON.stringify({ config: ttsRequestConfig, contents: [{ role: 'user', parts: [{ text: textToSynthesize }] }] }, null, 2));

    const result = await ttsModel.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: textToSynthesize }] }],
      generationConfig: ttsRequestConfig as any,
    });

    let audioBase64: string | null = null;
    let audioMimeType: string | null = null;
    let chunkIndex = 0;

    for await (const chunk of result.stream) {
      console.log(`[TTS Generation] Received chunk ${chunkIndex}.`);
      // console.log(`[TTS Generation] Full chunk ${chunkIndex} content (raw):`, JSON.stringify(chunk, null, 2)); // Very verbose

      if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content && chunk.candidates[0].content.parts && chunk.candidates[0].content.parts[0]) {
        const part = chunk.candidates[0].content.parts[0];
        if (part.inlineData && part.inlineData.data && part.inlineData.mimeType) {
          audioBase64 = part.inlineData.data;
          audioMimeType = part.inlineData.mimeType;
          console.log(`[TTS Generation] SUCCESS: Found inlineData in chunk ${chunkIndex}. MimeType: "${audioMimeType}", Data length (base64): ${audioBase64.length}`);
          break; 
        } else {
          console.warn(`[TTS Generation] Chunk ${chunkIndex}, Part 0 does NOT have expected inlineData with data and mimeType. Part content:`, JSON.stringify(part, null, 2));
        }
      } else {
        console.warn(`[TTS Generation] Chunk ${chunkIndex} does not have expected structure (candidates[0].content.parts[0]). Full chunk:`, JSON.stringify(chunk).substring(0, 500) + "...");
      }
      chunkIndex++;
    }

    if (audioBase64 && audioMimeType) {
      if (audioMimeType.toLowerCase().startsWith('audio/l16')) {
        console.log("[TTS Generation] Raw L16 audio detected, attempting WAV conversion.");
        const wavDataUri = await convertToWavDataUri(audioBase64, audioMimeType);
        if (!wavDataUri) {
            return { error: "Ham ses verisi WAV formatına dönüştürülemedi." };
        }
        return wavDataUri;
      } else if (audioMimeType.toLowerCase().startsWith('audio/')) {
        console.log(`[TTS Generation] Received directly playable audio format: ${audioMimeType}.`);
        return `data:${audioMimeType};base64,${audioBase64}`;
      } else {
        console.error(`[TTS Generation] Unknown audio mimeType received: ${audioMimeType}. Cannot process.`);
        return { error: `Bilinmeyen ses formatı alındı: ${audioMimeType}` };
      }
    } else {
      console.error("[TTS Generation] CRITICAL: No audio data (inlineData) found in any stream chunks from Gemini API.");
      return { error: "Gemini API'sinden ses verisi (inlineData) alınamadı. Model, API anahtarı veya yapılandırma sorunu olabilir." };
    }

  } catch (error: any) {
    console.error("[TTS Generation] Error during speech synthesis with GoogleGenAI:", error);
    let detail = error.message;
    if (error.stack) detail += `\nStack: ${error.stack}`;
    return { error: `Google GenAI ile ses sentezlenirken bir hata oluştu. Detay: ${detail.substring(0, 300)}` };
  }
}


export async function explainTopic(input: ExplainTopicInput): Promise<ExplainTopicOutput> {
  console.log("[ExplainTopic Action - Start] Received input. CustomModelIdentifier:", input.customModelIdentifier, "UserPlan:", input.userPlan, "TopicName:", input.topicName, "GenerateTTS:", input.generateTts);
  
  const isProUser = input.userPlan === 'pro';
  const isPremiumUser = input.userPlan === 'premium';

  let modelToUseForText = '';
  const adminSelectedModelRaw = typeof input.customModelIdentifier === 'string' ? input.customModelIdentifier.trim() : undefined;
  
  if (adminSelectedModelRaw && adminSelectedModelRaw.startsWith('googleai/')) {
    modelToUseForText = adminSelectedModelRaw;
  } else if (adminSelectedModelRaw) {
    const customIdLower = adminSelectedModelRaw.toLowerCase();
    switch (customIdLower) {
      case 'default_gemini_flash': modelToUseForText = 'googleai/gemini-2.0-flash'; break;
      case 'experimental_gemini_1_5_flash': modelToUseForText = 'googleai/gemini-1.5-flash-latest'; break;
      case 'experimental_gemini_2_5_flash_preview_05_20': modelToUseForText = 'googleai/gemini-2.5-flash-preview-05-20'; break;
      default:
        console.warn(`[ExplainTopic Action] Unknown customModelIdentifier: '${adminSelectedModelRaw}'. Defaulting based on plan '${input.userPlan}'.`);
        if (isProUser || isPremiumUser) modelToUseForText = 'googleai/gemini-2.5-flash-preview-05-20';
        else modelToUseForText = 'googleai/gemini-2.0-flash';
        break;
    }
  } else {
    if (isProUser || isPremiumUser) modelToUseForText = 'googleai/gemini-2.5-flash-preview-05-20';
    else modelToUseForText = 'googleai/gemini-2.0-flash';
  }
  
  if (!modelToUseForText || typeof modelToUseForText !== 'string' || !modelToUseForText.startsWith('googleai/')) {
    console.error(`[ExplainTopic Action] CRITICAL FALLBACK: modelToUseForText became invalid ('${modelToUseForText}'). Forcing to default gemini-2.0-flash.`);
    modelToUseForText = 'googleai/gemini-2.0-flash';
  }
  console.log(`[ExplainTopic Action] Determined final modelToUseForText for Genkit flow: ${modelToUseForText}`);
  
  const enrichedInputForTextPrompt = {
    ...input,
    isProUser,
    isPremiumUser,
    isCustomModelSelected: !!input.customModelIdentifier && typeof input.customModelIdentifier === 'string' && input.customModelIdentifier.trim() !== "",
    isGemini25PreviewSelected: modelToUseForText === 'googleai/gemini-2.5-flash-preview-05-20',
    isPersonaSamimi: input.teacherPersona === 'samimi',
    isPersonaEglenceli: input.teacherPersona === 'eglenceli',
    isPersonaCiddi: input.teacherPersona === 'ciddi',
    isPersonaOzel: input.teacherPersona === 'ozel',
  };

  let flowOutput: Omit<ExplainTopicOutput, 'audioDataUri' | 'ttsError'>;
  let audioDataUri: string | undefined = undefined;
  let ttsErrorMessage: string | undefined = undefined;

  const textGenStartTime = Date.now();
  try {
    console.log("[ExplainTopic Action] Calling topicExplainerFlow with model:", modelToUseForText);
    flowOutput = await topicExplainerFlow(enrichedInputForTextPrompt, modelToUseForText);
    console.log("[ExplainTopic Action] topicExplainerFlow returned. Output (partial):", flowOutput.explanationTitle, flowOutput.explanation?.substring(0,50));

    if (input.generateTts && flowOutput.explanation && !flowOutput.explanation.startsWith("AI modeli") && !flowOutput.explanation.startsWith("Konu anlatımı oluşturulurken") && flowOutput.explanation.trim().length > 10) {
      console.log("[ExplainTopic Action] TTS generation requested. Text length:", flowOutput.explanation.length);
      const ttsStartTime = Date.now();
      try {
          const ttsResult = await Promise.race([
              synthesizeSpeechWithGoogleGenAI(flowOutput.explanation, input.teacherPersona),
              new Promise((_, reject) => setTimeout(() => reject(new Error("TTS_TIMEOUT")), 45000)) // 45-second timeout for TTS
          ]);

          if (ttsResult && typeof ttsResult === 'object' && 'error' in ttsResult) {
              ttsErrorMessage = (ttsResult as { error: string }).error;
              console.error("[ExplainTopic Action] TTS generation failed with specific error:", ttsErrorMessage);
          } else if (typeof ttsResult === 'string') {
              audioDataUri = ttsResult;
              console.log("[ExplainTopic Action] TTS successfully generated.");
          } else {
              ttsErrorMessage = "Sesli anlatım oluşturulamadı (bilinmeyen TTS dönüş tipi veya zaman aşımı sonrası tanımsız sonuç).";
              console.warn("[ExplainTopic Action] TTS generation returned unexpected type:", ttsResult);
          }
      } catch (error: any) {
          if (error.message === "TTS_TIMEOUT") {
              ttsErrorMessage = "Sesli anlatım oluşturma işlemi zaman aşımına uğradı (45 saniye). Lütfen daha kısa bir metinle veya daha sonra tekrar deneyin.";
              console.error("[ExplainTopic Action] TTS generation timed out.");
          } else {
              ttsErrorMessage = `Sesli anlatım oluşturulurken bir hata oluştu: ${error.message}`;
              console.error("[ExplainTopic Action] TTS generation failed:", error);
          }
      }
      const ttsEndTime = Date.now();
      console.log(`[ExplainTopic Action] TTS processing took ${ttsEndTime - ttsStartTime}ms`);
    } else if (input.generateTts) {
      if (!flowOutput.explanation || flowOutput.explanation.trim().length <= 10) {
        ttsErrorMessage = "Sesli anlatım için yeterli metin yok (metin çok kısa veya boş).";
        console.warn("[ExplainTopic Action] TTS requested but explanation was too short or missing.");
      } else if (flowOutput.explanation.startsWith("AI modeli") || flowOutput.explanation.startsWith("Konu anlatımı oluşturulurken")){
         ttsErrorMessage = "Metin anlatımı sırasında bir hata oluştuğu için sesli anlatım oluşturulmadı.";
         console.warn("[ExplainTopic Action] TTS not attempted due to error in text generation.");
      }
    }

    if (!flowOutput || typeof flowOutput.explanation !== 'string' || flowOutput.explanation.trim().length === 0) {
       console.error("[ExplainTopic Action] Flow output is invalid or explanation is empty. FlowOutput:", flowOutput);
        return {
            ...defaultErrorOutput,
            explanationTitle: flowOutput?.explanationTitle || `Hata: ${input.topicName || 'Bilinmeyen Konu'}`,
            explanation: flowOutput?.explanation || "Yapay zeka geçerli bir konu anlatımı üretemedi.",
            ttsError: input.generateTts ? (ttsErrorMessage || "Metin anlatımı üretilemediği için sesli anlatım da oluşturulamadı.") : undefined,
        };
    }

    return { 
        ...flowOutput,
        audioDataUri,
        ttsError: ttsErrorMessage 
    };

  } catch (error: any) {
    console.error("[ExplainTopic Action] CRITICAL error during server action execution (outer try-catch):", error);
    let errorMessage = `Konu anlatımı oluşturulurken sunucuda kritik bir hata oluştu.`;
    if (error instanceof Error && error.message) {
        errorMessage += ` Detay: ${error.message.substring(0,200)}`;
    } else if (typeof error === 'string') {
        errorMessage += ` Detay: ${error.substring(0,200)}`;
    }
    return {
        ...defaultErrorOutput,
        explanationTitle: `Sunucu Hatası: ${input.topicName || 'Konu Belirtilmemiş'}`,
        explanation: errorMessage,
        ttsError: input.generateTts ? "Sesli anlatım oluşturulamadı (ana işlemde kritik hata)." : undefined,
    };
  } finally {
    const textGenEndTime = Date.now();
    console.log(`[ExplainTopic Action] Total text generation part (topicExplainerFlow call) took ${textGenEndTime - textGenStartTime}ms`);
  }
}

const TopicExplainerPromptInputSchema = ExplainTopicInputSchema.extend({
    isProUser: z.boolean().optional(),
    isPremiumUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
    isPersonaSamimi: z.boolean().optional(),
    isPersonaEglenceli: z.boolean().optional(),
    isPersonaCiddi: z.boolean().optional(),
    isPersonaOzel: z.boolean().optional(),
});


const topicExplainerPrompt = ai.definePrompt({
  name: 'topicExplainerPrompt',
  input: {schema: TopicExplainerPromptInputSchema},
  output: {schema: ExplainTopicOutputSchema.omit({ audioDataUri: true, ttsError: true })},
  prompt: `Sen, YKS konularını öğrencilere en iyi şekilde öğreten, en karmaşık konuları bile en anlaşılır, en akılda kalıcı ve en kapsamlı şekilde öğreten, pedagojik dehası ve alan hakimiyeti tartışılmaz, son derece deneyimli bir AI YKS Süper Öğretmenisin.
Görevin, öğrencinin belirttiği "{{{topicName}}}" konusunu, seçtiği "{{{explanationLevel}}}" detay seviyesine ve "{{{teacherPersona}}}" hoca tarzına uygun olarak, adım adım ve YKS stratejileriyle açıklamaktır.
Anlatımın sonunda, konuyu pekiştirmek için 2-3 çeşitli ve konuyla ilgili aktif hatırlama sorusu sor.
Matematiksel ifadeleri (örn: x^2, H_2O, √, π, ±, ≤, ≥) metin içinde okunabilir şekilde belirt. Cevapların Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: Bu, bir Pro kullanıcısı için en üst düzey bir anlatımdır. "{{{topicName}}}" konusunu, YKS'deki en zorlayıcı soru tiplerini, UZMAN SEVİYESİNDE derinlemesine stratejileri (örn: zaman yönetimi, eleme teknikleri, soru kökü analizi, farklı çözüm yolları, en sık karşılaşılan çeldirici türleri), öğrencilerin sıklıkla düştüğü TUZAKLARI ve bu tuzaklardan kaçınma yöntemlerini, konunun diğer disiplinlerle olan KARMAŞIK BAĞLANTILARINI ve YKS'deki güncel soru trendlerini içerecek şekilde, son derece kapsamlı ve akademik bir zenginlikle açıkla. Anlatımın, YKS'de zirveyi hedefleyen bir öğrencinin ihtiyaç duyacağı tüm detayları, BENZERSİZ İÇGÖRÜLERİ ve uzman bakış açılarını barındırmalıdır. {{{explanationLevel}}} seviyesini "detayli" kabul et ve sıradan bir anlatımın çok ötesine geçerek adeta bir USTA DERSİ niteliğinde olmalıdır. YKS ipuçları bölümünde, en az 3-4 kapsamlı, uygulanabilir ve sıra dışı strateji, kritik zaman yönetimi teknikleri ve en sık yapılan hatalardan kaçınma yolları hakkında detaylı tavsiyeler ver. Bu konunun YKS'deki stratejik önemini ve farklı soru formatlarında nasıl karşına çıkabileceğini vurgula. En gelişmiş AI yeteneklerini kullanarak, akılda kalıcı ve öğretici bir başyapıt sun. Özellikle konunun mantığını ve "neden"lerini derinlemesine irdele. Çıktıların kapsamlı ve detaylı olmalı. Örneğin, bir matematik konusunda sadece formülü vermek yerine, formülün ispatına veya geometrik yorumuna da değinebilirsin. Tarih konusunda, olayın sadece sonucunu değil, uzun vadeli etkilerini ve farklı bakış açılarını da sunabilirsin.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: {{{explanationLevel}}} seviyesine ve seçilen hoca tarzına uygun olarak, anlatımına daha fazla örnek, YKS'de çıkmış benzer sorulara atıflar ve 1-2 etkili çalışma tekniği (örn: Feynman Tekniği, Pomodoro) ile birlikte ekstra ipuçları ekle. YKS ipuçları bölümünde 2-3 pratik strateji ve önemli bir yaygın hatadan bahset. Konuyu orta-üst seviyede detaylandır. Anahtar kavramları ve YKS'deki önemlerini vurgula. Çıktıların dengeli ve bilgilendirici olmalı.)
{{else}}
(Ücretsiz Kullanıcı Notu: Anlatımını {{{explanationLevel}}} seviyesine uygun, temel ve anlaşılır tut. YKS ipuçları bölümünde 1-2 genel geçerli tavsiye ver. Konunun ana hatlarını ve en temel tanımlarını sun. Çıktıların temel düzeyde ve net olmalı.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' kullanılıyor.)
{{/if}}

{{#if isGemini25PreviewSelected}}
(Gemini 2.5 Flash Preview 05-20 Modeli Notu: Yanıtların ÖZ ama ANLAŞILIR ve YKS öğrencisine doğrudan fayda sağlayacak şekilde olsun. HIZLI yanıt vermeye odaklan. {{#if isProUser}}Pro kullanıcı için gereken derinliği, stratejik bilgileri ve uzman seviyesindeki içgörüleri koruyarak{{else if isPremiumUser}}Premium kullanıcı için gereken detayları, pratik ipuçlarını ve etkili çalışma tekniklerini sağlayarak{{/if}} gereksiz uzun açıklamalardan ve süslemelerden kaçın, doğrudan konuya girerek en kritik bilgileri vurgula.)
{{/if}}

Hoca Tarzı ({{{teacherPersona}}}):
{{#if isPersonaOzel}}
  {{#if customPersonaDescription}}
Kullanıcının Tanımladığı Özel Kişilik: "{{{customPersonaDescription}}}"
Anlatımını bu özel tanıma göre, YKS uzmanlığını koruyarak şekillendir.
  {{else}}
(Özel kişilik tanımı boş, varsayılan samimi tarza geçiliyor.) Samimi ve Destekleyici Hoca Tarzı: Öğrenciyle empati kur, motive et, karmaşık konuları sabırla ve anlaşılır örneklerle açıkla.
  {{/if}}
{{else if isPersonaSamimi}}
Samimi ve Destekleyici Hoca Tarzı: Öğrenciyle empati kur, motive et, karmaşık konuları sabırla ve anlaşılır örneklerle açıkla.
{{else if isPersonaEglenceli}}
Eğlenceli ve Motive Edici Hoca Tarzı: Konuyu esprili bir dille, ilginç benzetmelerle ve günlük hayattan örneklerle anlat. Enerjik ve pozitif ol.
{{else if isPersonaCiddi}}
Ciddi ve Odaklı Hoca Tarzı: Konuyu doğrudan, net ve akademik bir dille anlat. Gereksiz detaylardan kaçın.
{{/if}}

Anlatım Seviyesi ({{{explanationLevel}}}):
*   'temel': Konunun en temel kavramları, ana tanımları.
*   'orta': Temel tanımlar, önemli alt başlıklar, birkaç temel örnek ve YKS soru tiplerine değiniler.
*   'detayli': Konunun tüm yönleri, derinlemesine alt başlıklar, karmaşık örnekler, diğer konularla bağlantılar, YKS soru tipleri ve çözüm stratejileri.

Konu: {{{topicName}}}

Lütfen bu konuyu aşağıdaki formatta, seçilen "{{{explanationLevel}}}" seviyesine, "{{{teacherPersona}}}" tarzına ve YKS ihtiyaçlarına göre açıkla:

1.  **Anlatım Başlığı (explanationTitle)**: Konuyla ilgili ilgi çekici başlık.
2.  **Kapsamlı Konu Anlatımı (explanation)**:
    *   Giriş: Konunun YKS'deki yeri ve önemi.
    *   Temel Tanımlar ve İlkeler: Açık ve net ifadeler.
    *   Alt Başlıklar ve Detaylar: Mantıksal alt başlıklarla, bol örnekle açıkla.
    *   Örnekler ve Uygulamalar: YKS düzeyine uygun örnekler.
    *   Sonuç/Özet: Ana hatları özetle.
3.  **Anahtar Kavramlar (keyConcepts) (isteğe bağlı, seviyeye göre)**: 3-5 kritik YKS kavramı listele.
4.  **Sık Yapılan Hatalar (commonMistakes) (isteğe bağlı, 'orta' ve 'detayli' seviyede)**: 2-3 yaygın hata ve kaçınma yolları.
5.  **YKS İpuçları ve Stratejileri (yksTips) (isteğe bağlı, seviyeye göre)**: Planına göre 1-4 stratejik YKS ipucu.
6.  **Aktif Hatırlama Soruları (activeRecallQuestions)**: 2-3 çeşitli (kısa cevaplı, boşluk doldurma, doğru/yanlış vb.) ve konuyla ilgili soru sor.

Dilbilgisi ve YKS terminolojisine dikkat et. Bilgilerin doğru ve güncel olduğundan emin ol.
`,
});

const topicExplainerFlow = ai.defineFlow(
  {
    name: 'topicExplainerFlow',
    inputSchema: TopicExplainerPromptInputSchema,
    outputSchema: ExplainTopicOutputSchema.omit({ audioDataUri: true, ttsError: true }),
  },
  async (enrichedInputFromAction: z.infer<typeof TopicExplainerPromptInputSchema>, modelToUseForTextParam: string ): Promise<Omit<ExplainTopicOutput, 'audioDataUri' | 'ttsError'>> => {
    
    let finalModelToUse = modelToUseForTextParam;
    console.log(`[Topic Explainer Flow - Initial Check] Received modelToUseForTextParam: '${finalModelToUse}' from explainTopic action. Enriched Input - Plan: ${enrichedInputFromAction.userPlan}, Custom Model ID (from input): ${enrichedInputFromAction.customModelIdentifier}`);

    // Defensive check for modelToUseForTextParam right at the beginning of the flow
    if (!finalModelToUse || typeof finalModelToUse !== 'string' || !finalModelToUse.startsWith('googleai/')) {
        console.warn(`[Topic Explainer Flow] Invalid or unexpected modelToUseForTextParam ('${finalModelToUse}') received. Defaulting based on plan.`);
        if (enrichedInputFromAction.isProUser || enrichedInputFromAction.isPremiumUser) {
            finalModelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
        } else {
            finalModelToUse = 'googleai/gemini-2.0-flash';
        }
        console.log(`[Topic Explainer Flow] Corrected/Defaulted model INSIDE FLOW to: ${finalModelToUse}`);
    }

    let callOptions: { model: string; config?: Record<string, any> } = { model: finalModelToUse };

    const safetySettings = [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ];

    if (finalModelToUse === 'googleai/gemini-2.5-flash-preview-05-20') {
        callOptions.config = { temperature: 0.7, safetySettings };
    } else {
      callOptions.config = {
        temperature: 0.7,
        generationConfig: {
          maxOutputTokens: enrichedInputFromAction.explanationLevel === 'detayli' ? 8192 : enrichedInputFromAction.explanationLevel === 'orta' ? 4096 : 2048,
        },
        safetySettings
      };
    }

    console.log(`[Topic Explainer Flow - Text Gen] Using Genkit model: ${finalModelToUse} with config: ${JSON.stringify(callOptions.config)} for plan: ${enrichedInputFromAction.userPlan}, customModel (resolved for prompt): ${finalModelToUse}, level: ${enrichedInputFromAction.explanationLevel}, persona: ${enrichedInputFromAction.teacherPersona}`);

    try {
        const {output} = await topicExplainerPrompt(enrichedInputFromAction, callOptions);
        if (!output || !output.explanation) {
          const errorMsg = `AI YKS Süper Öğretmeniniz, belirtilen konu ("${enrichedInputFromAction.topicName}") için bir anlatım oluşturamadı. Kullanılan Model: ${finalModelToUse}. Lütfen konuyu ve ayarları kontrol edin veya farklı bir model deneyin.`;
          console.error("[Topic Explainer Flow - Text Gen] AI did not produce a valid explanation. Output:", JSON.stringify(output).substring(0,500));
          return {
            explanationTitle: `Anlatım Hatası: ${enrichedInputFromAction.topicName || 'Bilinmeyen Konu'}`,
            explanation: errorMsg,
            keyConcepts: ["Hata oluştu."],
            commonMistakes: [],
            yksTips: [],
            activeRecallQuestions: ["AI yanıt üretemedi, lütfen tekrar deneyin."]
          };
        }
        console.log(`[Topic Explainer Flow - Text Gen] Successfully generated text explanation for topic: "${enrichedInputFromAction.topicName}"`);
        return {
            explanationTitle: output.explanationTitle,
            explanation: output.explanation,
            keyConcepts: output.keyConcepts || [],
            commonMistakes: output.commonMistakes || [],
            yksTips: output.yksTips || [],
            activeRecallQuestions: output.activeRecallQuestions || [],
        };
    } catch (error: any) {
        console.error(`[Topic Explainer Flow - Text Gen] CRITICAL error during Genkit prompt execution with model ${finalModelToUse} for topic "${enrichedInputFromAction.topicName}":`, error);
        let errorMessage = `AI modeli (${finalModelToUse}) ile "${enrichedInputFromAction.topicName}" konusu için anlatım oluşturulurken bir Genkit/AI hatası oluştu.`;
        if (error instanceof Error && error.message) {
            errorMessage += ` Detay: ${error.message.substring(0, 250)}`;
            if (error.message.includes('SAFETY') || error.message.includes('block_reason') || (error.cause as any)?.message?.includes('SAFETY')) {
              errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen konunuzu gözden geçirin. Model: ${finalModelToUse}. Detay: ${error.message.substring(0, 150)}`;
            } else if (error.message.includes('400 Bad Request') && (error.message.includes('generationConfig') || error.message.includes('generation_config'))) {
               errorMessage = `Seçilen model (${finalModelToUse}) bazı yapılandırma ayarlarını desteklemiyor olabilir. Model: ${finalModelToUse}. Detay: ${error.message.substring(0,150)}`;
            } else if (error.message.includes('Handlebars')) {
               errorMessage = `AI şablonunda bir hata oluştu. Geliştiriciye bildirin. Model: ${finalModelToUse}. Detay: ${error.message.substring(0,150)}`;
            } else if (error.message.includes('NOT_FOUND') || error.message.includes('sentinelNoopStreamingCallback')) { 
                errorMessage = `Kritik hata: Model '${finalModelToUse}' bulunamadı veya geçersiz. Lütfen admin panelinden geçerli bir model seçin veya varsayılanı kullanın. Detay: ${error.message.substring(0,150)}`;
            }
        }
        return {
            explanationTitle: `Kritik Anlatım Hatası: ${enrichedInputFromAction.topicName || 'Bilinmeyen Konu'}`,
            explanation: errorMessage,
            keyConcepts: ["Kritik hata oluştu."],
            commonMistakes: [],
            yksTips: [],
            activeRecallQuestions: ["AI yanıt üretemedi, lütfen farklı bir model deneyin veya destek ile iletişime geçin."]
        };
    }
  }
);
