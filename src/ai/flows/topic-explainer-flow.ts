
'use server';
/**
 * @fileOverview Kullanıcının girdiği bir YKS konusunu derinlemesine açıklayan,
 * anahtar kavramları, YKS için stratejik bilgileri ve aktif hatırlama soruları sunan uzman bir AI YKS öğretmeni.
 * İsteğe bağlı olarak, adminler için metni seslendirme (TTS) özelliği de içerir.
 *
 * - explainTopic - Konu açıklama işlemini yöneten fonksiyon.
 * - ExplainTopicInput - explainTopic fonksiyonu için giriş tipi.
 * - ExplainTopicOutput - explainTopic fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { GoogleGenAI, type Content } from '@google/genai';
import { Buffer } from 'buffer'; // Node.js Buffer

// Helper types for WAV conversion
interface WavConversionOptions {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}

// Helper function to parse mimeType for WAV conversion
function parseMimeType(mimeType: string): WavConversionOptions {
  console.log(`[TTS parseMimeType] Received mimeType: "${mimeType}"`);
  const parts = mimeType.split(';').map(s => s.trim());
  const [fileTypeDirty] = parts; 
  const fileType = fileTypeDirty ? fileTypeDirty.toLowerCase() : ""; 
  const paramsArray = parts.slice(1); 

  // Default options, these are critical for WAV header
  const options: WavConversionOptions = {
    numChannels: 1, 
    bitsPerSample: 16, 
    sampleRate: 24000, 
  };

  if (fileType) {
    const [_, format] = fileType.split('/'); 
    if (format && format.toLowerCase().startsWith('l')) { // L16, L24 etc. (Linear PCM)
      const bits = parseInt(format.slice(1), 10);
      if (!isNaN(bits) && bits > 0) {
        options.bitsPerSample = bits;
        console.log(`[TTS parseMimeType] Parsed bitsPerSample: ${bits} from format: ${format}`);
      } else {
        console.warn(`[TTS parseMimeType] Could not parse valid bits from format: "${format}". Using default bitsPerSample: ${options.bitsPerSample}`);
      }
    } else {
      console.log(`[TTS parseMimeType] Format "${format}" does not start with 'l'. Using default bitsPerSample: ${options.bitsPerSample}`);
    }
  } else {
    console.warn(`[TTS parseMimeType] fileType is missing in mimeType: "${mimeType}". Using default bitsPerSample: ${options.bitsPerSample}`);
  }

  for (const param of paramsArray) {
    const [keyDirty, valueDirty] = param.split('=').map(s => s.trim());
    const key = keyDirty.toLowerCase(); // Ensure case-insensitivity for keys
    const value = valueDirty;

    if (key === 'rate' && value) {
      const parsedRate = parseInt(value, 10);
      if (!isNaN(parsedRate) && parsedRate > 0) {
        options.sampleRate = parsedRate;
        console.log(`[TTS parseMimeType] Parsed sampleRate: ${parsedRate} for key: "${key}"`);
      } else {
         console.warn(`[TTS parseMimeType] Could not parse valid rate from value: "${value}" for key: "${key}". Using default sampleRate: ${options.sampleRate}`);
      }
    } else if (key === 'channels' && value) {
      const parsedChannels = parseInt(value, 10);
      if (!isNaN(parsedChannels) && parsedChannels > 0) {
        options.numChannels = parsedChannels;
        console.log(`[TTS parseMimeType] Parsed numChannels: ${parsedChannels} for key: "${key}"`);
      } else {
        console.warn(`[TTS parseMimeType] Could not parse valid channels from value: "${value}" for key: "${key}". Using default numChannels: ${options.numChannels}`);
      }
    }
  }
  
  console.log(`[TTS parseMimeType] Final determined options for "${mimeType}": ${JSON.stringify(options)}`);
  return options;
}


// Helper function to create WAV header
function createWavHeader(dataLength: number, options: WavConversionOptions): Buffer {
  const {
    numChannels,
    sampleRate,
    bitsPerSample,
  } = options;
  console.log(`[TTS createWavHeader] Creating WAV header with DataLength: ${dataLength}, Options: ${JSON.stringify(options)}`);

  if (!numChannels || !sampleRate || !bitsPerSample || numChannels <= 0 || sampleRate <= 0 || bitsPerSample <= 0) {
    console.error(`[TTS createWavHeader] Invalid options for WAV header creation: ${JSON.stringify(options)}. Cannot create header.`);
    throw new Error("Invalid options for WAV header creation.");
  }

  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);                      // ChunkID
  buffer.writeUInt32LE(36 + dataLength, 4);     // ChunkSize
  buffer.write('WAVE', 8);                      // Format
  buffer.write('fmt ', 12);                     // Subchunk1ID
  buffer.writeUInt32LE(16, 16);                 // Subchunk1Size (PCM)
  buffer.writeUInt16LE(1, 20);                  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);        // NumChannels
  buffer.writeUInt32LE(sampleRate, 24);         // SampleRate
  buffer.writeUInt32LE(byteRate, 28);           // ByteRate
  buffer.writeUInt16LE(blockAlign, 32);         // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34);      // BitsPerSample
  buffer.write('data', 36);                     // Subchunk2ID
  buffer.writeUInt32LE(dataLength, 40);         // Subchunk2Size
  console.log("[TTS createWavHeader] WAV header created successfully.");
  return buffer;
}

// Helper function to convert raw audio data (base64) to WAV data URI
function convertToWavDataUri(base64RawData: string, mimeType: string): string | null {
  console.log(`[TTS convertToWavDataUri] Attempting WAV conversion for mimeType: ${mimeType}, Base64 Data Length: ${base64RawData.length}`);
  try {
    const options = parseMimeType(mimeType);
    // Critical check for WAV parameters before proceeding
    if (!options.sampleRate || options.sampleRate <= 0 || 
        !options.bitsPerSample || options.bitsPerSample <= 0 ||
        !options.numChannels || options.numChannels <= 0) {
        console.error(`[TTS WAV Conversion] CRITICAL: Missing or invalid parameters after parsing mimeType: "${mimeType}". Cannot convert to WAV. Parsed Options: ${JSON.stringify(options)}`);
        return `data:${mimeType};base64,${base64RawData}`; // Return original if params are bad
    }
    const rawDataBuffer = Buffer.from(base64RawData, 'base64');
    console.log(`[TTS convertToWavDataUri] Raw data buffer length: ${rawDataBuffer.length}`);
    const wavHeader = createWavHeader(rawDataBuffer.length, options);
    const fullWavBuffer = Buffer.concat([wavHeader, rawDataBuffer]);
    const wavBase64 = fullWavBuffer.toString('base64');
    console.log("[TTS convertToWavDataUri] Successfully converted to WAV data URI. WAV Base64 Length: " + wavBase64.length);
    return `data:audio/wav;base64,${wavBase64}`;
  } catch (error) {
    console.error("[TTS WAV Conversion] Error converting to WAV:", error);
    return `data:${mimeType};base64,${base64RawData}`; // Return original on error as a fallback
  }
}

async function synthesizeSpeechWithGoogleGenAI(text: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[TTS Generation] FATAL: GEMINI_API_KEY is not set in environment variables. Cannot proceed with TTS.");
    return null;
  }
  console.log("[TTS Generation] GEMINI_API_KEY found and will be used.");

  if (!text || text.trim().length === 0) {
    console.warn("[TTS Generation] Input text is empty. Skipping TTS generation.");
    return null;
  }
   if (text.trim().length < 10) { // Increased minimum length slightly
    console.warn(`[TTS Generation] Input text is very short (length: ${text.trim().length}). This might affect TTS quality or cause issues. Text: "${text}"`);
  }

  try {
    const genAI = new GoogleGenAI(apiKey);
    const ttsModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro-preview-tts" }); 

    // @ts-ignore - Allow pass-through of custom config keys
    const ttsRequestConfig = {
      responseModalities: ['AUDIO'], // Forcing AUDIO only as per Gemini example
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Puck' } // Using one of the suggested voices like Puck
        }
      },
    };
    
    const contents: Content[] = [{ role: 'user', parts: [{ text }] }];
    
    console.log(`[TTS Generation] Sending request to Gemini TTS model (gemini-2.5-pro-preview-tts) with voice: Puck. Text length to synthesize: ${text.length}. First 50 chars: "${text.substring(0,50)}..."`);
    console.log("[TTS Generation] Request Config:", JSON.stringify(ttsRequestConfig));
    
    const result = await ttsModel.generateContentStream({ contents, generationConfig: ttsRequestConfig });

    let audioBase64: string | null = null;
    let audioMimeType: string | null = null;
    let chunkIndex = 0;

    for await (const chunk of result.stream) {
      console.log(`[TTS Generation] Received chunk ${chunkIndex}. Full chunk object:`, JSON.stringify(chunk).substring(0, 500) + "...");
      if (chunk.candidates && chunk.candidates[0]?.content?.parts?.[0]) {
        const part = chunk.candidates[0].content.parts[0];
        // @ts-ignore
        if (part.inlineData && part.inlineData.mimeType && part.inlineData.data) {
          // @ts-ignore
          audioMimeType = part.inlineData.mimeType;
          // @ts-ignore
          audioBase64 = part.inlineData.data;
          console.log(`[TTS Generation] SUCCESS: Found inlineData in chunk ${chunkIndex}. MimeType: "${audioMimeType}", Base64 Data Length: ${audioBase64?.length}`);
          break; // Found audio data, no need to process further chunks for this part
        } else {
          // @ts-ignore
          console.log(`[TTS Generation] Chunk ${chunkIndex} part does not contain complete inlineData. Part content:`, JSON.stringify(part).substring(0,300) + "...");
        }
      } else {
         console.log(`[TTS Generation] Chunk ${chunkIndex} does not have expected structure (candidates/content/parts).`);
      }
      chunkIndex++;
    }
    
    if (audioBase64 && audioMimeType) {
      console.log(`[TTS Generation] Audio data processing. MimeType: ${audioMimeType}`);
      const lowerMimeType = audioMimeType.toLowerCase();
      if (lowerMimeType === 'audio/mpeg' || lowerMimeType === 'audio/mp3') {
        console.log("[TTS Generation] Audio is MP3/MPEG. Returning as data URI.");
        return `data:${audioMimeType};base64,${audioBase64}`;
      } else if (lowerMimeType.includes('audio/l16') || lowerMimeType.includes('audio/raw')) {
        console.log("[TTS Generation] Raw audio format detected (e.g., L16), attempting WAV conversion.");
        return convertToWavDataUri(audioBase64, audioMimeType);
      } else {
         console.warn(`[TTS Generation] Received audio with unhandled playable mimeType: "${audioMimeType}". Returning as is. This might not be playable directly.`);
         return `data:${audioMimeType};base64,${audioBase64}`;
      }
    } else {
      console.error("[TTS Generation] CRITICAL: No audio data (inlineData with mimeType and data) found after processing all chunks from Gemini TTS model stream.");
      return null;
    }

  } catch (error: any) {
    console.error("[TTS Generation] CRITICAL Error during speech synthesis with GoogleGenAI:", error);
    if (error.message) console.error("[TTS Generation] Error message:", error.message);
    if (error.stack) console.error("[TTS Generation] Error stack:", error.stack);
    if (error.details) console.error("[TTS Generation] Error details:", error.details); // Gemini specific error details
    return null;
  }
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
  audioDataUri: z.string().optional().describe("Konu anlatımının seslendirilmiş halinin data URI'si (Base64, MP3 veya WAV).")
});
export type ExplainTopicOutput = z.infer<typeof ExplainTopicOutputSchema>;

const defaultErrorOutput: ExplainTopicOutput = {
  explanationTitle: "Hata: Konu Anlatımı Oluşturulamadı",
  explanation: "Konu anlatımı oluşturulurken beklenmedik bir sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin veya destek ile iletişime geçin.",
  keyConcepts: [],
  commonMistakes: [],
  yksTips: [],
  activeRecallQuestions: []
};

export async function explainTopic(input: ExplainTopicInput): Promise<ExplainTopicOutput> {
  console.log("[ExplainTopic Action] Received input:", { 
    topicName: input.topicName, 
    userPlan: input.userPlan, 
    customModelIdentifier: input.customModelIdentifier, 
    generateTts: input.generateTts,
    explanationLevel: input.explanationLevel,
    teacherPersona: input.teacherPersona 
  });

  let modelToUseForText = '';
  const isProUser = input.userPlan === 'pro';
  const isPremiumUser = input.userPlan === 'premium';

  if (input.customModelIdentifier && typeof input.customModelIdentifier === 'string' && input.customModelIdentifier.startsWith('googleai/')) {
      modelToUseForText = input.customModelIdentifier;
      console.log(`[ExplainTopic Action] Admin explicitly selected Genkit model: ${modelToUseForText}`);
  } else if (input.customModelIdentifier && typeof input.customModelIdentifier === 'string') {
      switch (input.customModelIdentifier.toLowerCase()) {
          case 'default_gemini_flash': modelToUseForText = 'googleai/gemini-2.0-flash'; break;
          case 'experimental_gemini_1_5_flash': modelToUseForText = 'googleai/gemini-1.5-flash-latest'; break;
          case 'experimental_gemini_2_5_flash_preview_05_20': modelToUseForText = 'googleai/gemini-2.5-flash-preview-05-20'; break;
          default:
              console.warn(`[ExplainTopic Action] Unknown customModelIdentifier string: '${input.customModelIdentifier}'. Defaulting based on plan.`);
              if (isProUser || isPremiumUser) modelToUseForText = 'googleai/gemini-2.5-flash-preview-05-20';
              else modelToUseForText = 'googleai/gemini-2.0-flash';
              break;
      }
  } else { 
      console.log(`[ExplainTopic Action] No valid custom model ID provided by admin. Using plan-based default.`);
      if (isProUser || isPremiumUser) modelToUseForText = 'googleai/gemini-2.5-flash-preview-05-20';
      else modelToUseForText = 'googleai/gemini-2.0-flash';
  }
  
  if (!modelToUseForText || !modelToUseForText.startsWith('googleai/')) {
    console.error(`[ExplainTopic Action] CRITICAL: modelToUseForText became invalid ('${modelToUseForText}') after all checks. Forcing fallback to general default. Original customId: '${input.customModelIdentifier}'`);
    modelToUseForText = 'googleai/gemini-2.0-flash'; // General fallback
  }
  console.log(`[ExplainTopic Action] Determined final modelToUseForText for Genkit flow: ${modelToUseForText}`);
  
  const isGemini25FlashPreviewSelectedForText = modelToUseForText === 'googleai/gemini-2.5-flash-preview-05-20';

  const enrichedInput = {
    ...input,
    isProUser,
    isPremiumUser,
    isCustomModelSelected: !!input.customModelIdentifier,
    isGemini25PreviewSelected: isGemini25FlashPreviewSelectedForText, 
    isPersonaSamimi: input.teacherPersona === 'samimi',
    isPersonaEglenceli: input.teacherPersona === 'eglenceli',
    isPersonaCiddi: input.teacherPersona === 'ciddi',
    isPersonaOzel: input.teacherPersona === 'ozel',
  };
  
  try {
    let flowOutput = await topicExplainerFlow(enrichedInput, modelToUseForText);

    let audioDataUri: string | null = null;
    // TTS is generated if input.generateTts is true (client ensures only admin can set this)
    // AND text explanation was successfully generated and is not trivial.
    // For now, let's allow TTS for any plan if admin requests it, for testing.
    // We can restrict by plan later if needed: && (isProUser || isPremiumUser || input.userPlan === 'admin_override_for_tts_test')
    if (input.generateTts && input.userPlan && flowOutput.explanation && flowOutput.explanation.trim().length > 10) {
      console.log("[ExplainTopic Action] TTS generation requested by admin. Synthesizing speech for explanation...");
      audioDataUri = await synthesizeSpeechWithGoogleGenAI(flowOutput.explanation);
      if (audioDataUri) {
        console.log("[ExplainTopic Action] TTS audio URI generated and will be added to output.");
      } else {
        console.warn("[ExplainTopic Action] TTS audio URI generation failed or returned null. Proceeding without audio.");
      }
    } else {
        if (input.generateTts) {
            console.log(`[ExplainTopic Action] TTS generation skipped. Reason: generateTts flag is true, but explanation might be too short or missing. Explanation length: ${flowOutput.explanation?.trim().length || 0}`);
        }
    }

    return { ...flowOutput, audioDataUri: audioDataUri ?? undefined };

  } catch (error: any) {
    console.error("[ExplainTopic Action] CRITICAL error during server action execution (outer try-catch):", error);
    let errorMessage = 'Konu anlatımı oluşturulurken sunucuda beklenmedik bir hata oluştu.';
    if (error instanceof Error && error.message) {
        errorMessage = error.message;
    }
    return {
        ...defaultErrorOutput,
        explanationTitle: `Sunucu Hatası: ${input.topicName || 'Konu Belirtilmemiş'}`,
        explanation: `Konu anlatımı oluşturulurken sunucuda kritik bir hata oluştu. Detay: ${errorMessage}. Lütfen daha sonra tekrar deneyin.`
    };
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
  output: {schema: ExplainTopicOutputSchema.omit({ audioDataUri: true })},
  prompt: `Sen, YKS konularını öğrencilere en iyi şekilde öğreten, en karmaşık konuları bile en anlaşılır, en akılda kalıcı ve en kapsamlı şekilde öğreten, pedagojik dehası ve alan hakimiyeti tartışılmaz, son derece deneyimli bir AI YKS Süper Öğretmenisin.
Görevin, öğrencinin belirttiği "{{{topicName}}}" konusunu, seçtiği "{{{explanationLevel}}}" detay seviyesine ve "{{{teacherPersona}}}" hoca tarzına uygun olarak, adım adım ve YKS stratejileriyle açıklamaktır.
Anlatımın sonunda, konuyu pekiştirmek için 2-3 çeşitli ve konuyla ilgili aktif hatırlama sorusu sor.
Matematiksel ifadeleri (örn: x^2, H_2O, √, π, ±, ≤, ≥) metin içinde okunabilir şekilde belirt. Cevapların Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: Bu, bir Pro kullanıcısı için en üst düzey bir anlatımdır. "{{{topicName}}}" konusunu, YKS'deki en zorlayıcı soru tiplerini, derinlemesine ve UZMAN SEVİYESİNDE stratejileri, öğrencilerin sıklıkla düştüğü TUZAKLARI ve bunlardan kaçınma yollarını, konunun diğer disiplinlerle olan KARMAŞIK BAĞLANTILARINI içerecek şekilde, son derece kapsamlı ve akademik bir zenginlikle açıkla. Anlatımın, YKS'de zirveyi hedefleyen bir öğrencinin ihtiyaç duyacağı tüm detayları, BENZERSİZ İÇGÖRÜLERİ ve uzman bakış açılarını barındırmalıdır. {{{explanationLevel}}} seviyesini "detayli" kabul et ve sıradan bir anlatımın çok ötesine geçerek adeta bir USTA DERSİ niteliğinde olmalıdır. YKS ipuçları bölümünde, en az 3-4 kapsamlı, uygulanabilir ve sıra dışı strateji, kritik zaman yönetimi teknikleri ve en sık yapılan hatalardan kaçınma yolları hakkında detaylı tavsiyeler ver. Bu konunun YKS'deki stratejik önemini ve farklı soru formatlarında nasıl karşına çıkabileceğini vurgula. En gelişmiş AI yeteneklerini kullanarak, akılda kalıcı ve öğretici bir başyapıt sun.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: {{{explanationLevel}}} seviyesine ve seçilen hoca tarzına uygun olarak, anlatımına daha fazla örnek, YKS'de çıkmış benzer sorulara atıflar ve 1-2 etkili çalışma tekniği (örn: Feynman Tekniği, Pomodoro) ile birlikte ekstra ipuçları ekle. YKS ipuçları bölümünde 2-3 pratik strateji ve önemli bir yaygın hatadan bahset. Konuyu orta-üst seviyede detaylandır.)
{{else}}
(Ücretsiz Kullanıcı Notu: Anlatımını {{{explanationLevel}}} seviyesine uygun, temel ve anlaşılır tut. YKS ipuçları bölümünde 1-2 genel geçerli tavsiye ver.)
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
    outputSchema: ExplainTopicOutputSchema.omit({ audioDataUri: true }),
  },
  async (enrichedInput: z.infer<typeof TopicExplainerPromptInputSchema>, modelToUseForTextParam: string ): Promise<Omit<ExplainTopicOutput, 'audioDataUri'>> => {
    
    let finalModelToUse = modelToUseForTextParam; 
    console.log(`[Topic Explainer Flow - Initial Model] Received modelToUseForTextParam: '${finalModelToUse}' from explainTopic action.`);
    console.log(`[Topic Explainer Flow - Input Check] Enriched Input:`, {userPlan: enrichedInput.userPlan, customModelId: enrichedInput.customModelIdentifier, isPro: enrichedInput.isProUser, isPremium: enrichedInput.isPremiumUser, isGemini25SelectedForText: enrichedInput.isGemini25PreviewSelected});

    if (!finalModelToUse || typeof finalModelToUse !== 'string' || !finalModelToUse.startsWith('googleai/')) {
        console.warn(`[Topic Explainer Flow] CRITICAL FALLBACK: modelToUseForTextParam ('${finalModelToUse}') was invalid INSIDE the flow. Determining default based on plan from enrichedInput.`);
        if (enrichedInput.isProUser || enrichedInput.isPremiumUser) {
            finalModelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
        } else {
            finalModelToUse = 'googleai/gemini-2.0-flash';
        }
        console.log(`[Topic Explainer Flow] Corrected/Defaulted model INSIDE FLOW to: ${finalModelToUse}`);
    }

    let callOptions: { model: string; config?: Record<string, any> } = { model: finalModelToUse };

    if (finalModelToUse === 'googleai/gemini-2.5-flash-preview-05-20') {
        callOptions.config = { temperature: 0.7 }; 
    } else {
      callOptions.config = {
        generationConfig: {
          maxOutputTokens: enrichedInput.explanationLevel === 'detayli' ? 8192 : enrichedInput.explanationLevel === 'orta' ? 4096 : 2048,
        }
      };
    }

    console.log(`[Topic Explainer Flow - Text Gen] Using Genkit model: ${finalModelToUse} with config: ${JSON.stringify(callOptions.config)} for plan: ${enrichedInput.userPlan}, customModel: ${enrichedInput.customModelIdentifier}, level: ${enrichedInput.explanationLevel}, persona: ${enrichedInput.teacherPersona}`);

    try {
        const {output} = await topicExplainerPrompt(enrichedInput, callOptions);
        if (!output || !output.explanation) {
          const errorMsg = `AI YKS Süper Öğretmeniniz, belirtilen konu ("${enrichedInput.topicName}") için bir anlatım oluşturamadı. Kullanılan Model: ${finalModelToUse}. Lütfen konuyu ve ayarları kontrol edin veya farklı bir model deneyin.`;
          console.error("[Topic Explainer Flow - Text Gen] AI did not produce a valid explanation. Output:", JSON.stringify(output).substring(0,500));
          return {
            explanationTitle: `Anlatım Hatası: ${enrichedInput.topicName || 'Bilinmeyen Konu'}`,
            explanation: errorMsg,
            keyConcepts: ["Hata oluştu."],
            commonMistakes: [],
            yksTips: [],
            activeRecallQuestions: ["AI yanıt üretemedi, lütfen tekrar deneyin."]
          };
        }
        console.log(`[Topic Explainer Flow - Text Gen] Successfully generated text explanation for topic: "${enrichedInput.topicName}"`);
        return {
            explanationTitle: output.explanationTitle,
            explanation: output.explanation,
            keyConcepts: output.keyConcepts || [],
            commonMistakes: output.commonMistakes || [],
            yksTips: output.yksTips || [],
            activeRecallQuestions: output.activeRecallQuestions || [],
        };
    } catch (error: any) {
        console.error(`[Topic Explainer Flow - Text Gen] CRITICAL error during Genkit prompt execution with model ${finalModelToUse} for topic "${enrichedInput.topicName}":`, error);
        let errorMessage = `AI modeli (${finalModelToUse}) ile "${enrichedInput.topicName}" konusu için anlatım oluşturulurken bir Genkit/AI hatası oluştu.`;
        if (error instanceof Error && error.message) {
            errorMessage += ` Detay: ${error.message.substring(0, 250)}`;
            if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
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
            explanationTitle: `Kritik Anlatım Hatası: ${enrichedInput.topicName || 'Bilinmeyen Konu'}`,
            explanation: errorMessage,
            keyConcepts: ["Kritik hata oluştu."],
            commonMistakes: [],
            yksTips: [],
            activeRecallQuestions: ["AI yanıt üretemedi, lütfen farklı bir model deneyin veya destek ile iletişime geçin."]
        };
    }
  }
);
