
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
  const [fileType, ...params] = mimeType.split(';').map(s => s.trim().toLowerCase()); // Ensure case-insensitivity for keys
  const [_, format] = fileType.split('/');

  const options: Partial<WavConversionOptions> = {
    numChannels: 1, // Default to mono
  };

  if (format && format.startsWith('l')) { // Ensure 'l' is lowercase for comparison
    const bits = parseInt(format.slice(1), 10);
    if (!isNaN(bits)) {
      options.bitsPerSample = bits;
    }
  }

  for (const param of params) {
    const [key, value] = param.split('=').map(s => s.trim());
    if (key === 'rate' && value) {
      const parsedRate = parseInt(value, 10);
      if (!isNaN(parsedRate)) options.sampleRate = parsedRate;
    } else if (key === 'channels' && value) {
      const parsedChannels = parseInt(value, 10);
      if (!isNaN(parsedChannels)) options.numChannels = parsedChannels;
    }
  }
  // Provide defaults if not parsed
  if (!options.bitsPerSample) options.bitsPerSample = 16; // Common default
  if (!options.sampleRate) options.sampleRate = 24000; // Common default for speech
  if (!options.numChannels) options.numChannels = 1;

  return options as WavConversionOptions;
}

// Helper function to create WAV header
function createWavHeader(dataLength: number, options: WavConversionOptions): Buffer {
  const {
    numChannels,
    sampleRate,
    bitsPerSample,
  } = options;

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

  return buffer;
}

// Helper function to convert raw audio data (base64) to WAV data URI
function convertToWavDataUri(base64RawData: string, mimeType: string): string | null {
  try {
    const options = parseMimeType(mimeType);
    if (!options.sampleRate || !options.bitsPerSample || !options.numChannels) {
        console.warn(`[TTS WAV Conversion] Missing critical parameters from mimeType: ${mimeType}. Cannot convert to WAV. Options: ${JSON.stringify(options)}`);
        return `data:${mimeType};base64,${base64RawData}`; // Fallback
    }
    const rawDataBuffer = Buffer.from(base64RawData, 'base64');
    const wavHeader = createWavHeader(rawDataBuffer.length, options);
    const fullWavBuffer = Buffer.concat([wavHeader, rawDataBuffer]);
    const wavBase64 = fullWavBuffer.toString('base64');
    return `data:audio/wav;base64,${wavBase64}`;
  } catch (error) {
    console.error("[TTS WAV Conversion] Error converting to WAV:", error);
    return `data:${mimeType};base64,${base64RawData}`; // Fallback
  }
}

async function synthesizeSpeechWithGoogleGenAI(text: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[TTS Generation] GEMINI_API_KEY is not set in environment variables.");
    return null;
  }

  try {
    const genAI = new GoogleGenAI(apiKey);
    const ttsModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro-preview-tts" });

    // @ts-ignore - Allow pass-through of custom config keys if the endpoint expects them
    const ttsRequestConfig = {
      temperature: 0.7, 
      responseModalities: ['AUDIO'], 
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Puck' } 
        }
      },
    };

    const contents: Content[] = [{ role: 'user', parts: [{ text }] }];
    
    console.log("[TTS Generation] Sending request to Gemini TTS model (gemini-2.5-pro-preview-tts) with voice: Puck...");
    
    const result = await ttsModel.generateContentStream({ contents, generationConfig: ttsRequestConfig });

    let audioBase64: string | null = null;
    let audioMimeType: string | null = null;

    for await (const chunk of result.stream) {
      if (chunk.candidates && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
        const part = chunk.candidates[0].content.parts[0];
        // @ts-ignore 
        if (part.inlineData) {
          // @ts-ignore
          audioMimeType = part.inlineData.mimeType;
          // @ts-ignore
          audioBase64 = part.inlineData.data;
          break; 
        }
      }
    }
    
    if (audioBase64 && audioMimeType) {
      console.log(`[TTS Generation] Received audio data. MimeType: ${audioMimeType}`);
      if (audioMimeType.toLowerCase() === 'audio/mpeg' || audioMimeType.toLowerCase() === 'audio/mp3') {
        return `data:${audioMimeType};base64,${audioBase64}`;
      } else if (audioMimeType.toLowerCase().includes('audio/l16') || audioMimeType.toLowerCase().includes('audio/raw')) {
        console.log("[TTS Generation] Raw audio format detected, attempting WAV conversion.");
        return convertToWavDataUri(audioBase64, audioMimeType);
      } else {
         console.warn(`[TTS Generation] Received audio with unexpected mimeType: ${audioMimeType}. Returning as is.`);
         return `data:${audioMimeType};base64,${audioBase64}`;
      }
    } else {
      console.warn("[TTS Generation] No audio data found in the response from Gemini TTS model.");
      return null;
    }

  } catch (error) {
    console.error("[TTS Generation] Error generating speech with GoogleGenAI:", error);
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
  console.log("[ExplainTopic Action] Received input:", { topicName: input.topicName, userPlan: input.userPlan, customModelIdentifier: input.customModelIdentifier, generateTts: input.generateTts });

  try {
    const isProUser = input.userPlan === 'pro';
    const isPremiumUser = input.userPlan === 'premium';
    let modelToUseForText = '';

    console.log("[ExplainTopic Action] Initial input.customModelIdentifier:", input.customModelIdentifier, "User Plan:", input.userPlan);

    if (input.customModelIdentifier && typeof input.customModelIdentifier === 'string') {
        if (input.customModelIdentifier.startsWith('googleai/')) {
            modelToUseForText = input.customModelIdentifier;
        } else {
            switch (input.customModelIdentifier.toLowerCase()) {
                case 'default_gemini_flash': modelToUseForText = 'googleai/gemini-2.0-flash'; break;
                case 'experimental_gemini_1_5_flash': modelToUseForText = 'googleai/gemini-1.5-flash-latest'; break;
                case 'experimental_gemini_2_5_flash_preview_05_20': modelToUseForText = 'googleai/gemini-2.5-flash-preview-05-20'; break;
                default:
                    console.warn(`[ExplainTopic Action] Unknown or invalid customModelIdentifier: '${input.customModelIdentifier}'. Defaulting based on plan.`);
                    if (isProUser || isPremiumUser) modelToUseForText = 'googleai/gemini-2.5-flash-preview-05-20';
                    else modelToUseForText = 'googleai/gemini-2.0-flash';
                    break;
            }
        }
    } else { 
        console.log(`[ExplainTopic Action] No customModelIdentifier provided or invalid type. Defaulting based on plan.`);
        if (isProUser || isPremiumUser) modelToUseForText = 'googleai/gemini-2.5-flash-preview-05-20';
        else modelToUseForText = 'googleai/gemini-2.0-flash';
    }
    
    if (!modelToUseForText || !modelToUseForText.startsWith('googleai/')) {
      console.error(`[ExplainTopic Action] CRITICAL: modelToUseForText became invalid ('${modelToUseForText}') despite checks. Forcing fallback. Original customId: '${input.customModelIdentifier}'`);
      modelToUseForText = 'googleai/gemini-2.0-flash';
    }
    console.log(`[ExplainTopic Action] Determined modelToUseForText for Genkit flow: ${modelToUseForText}`);
    
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
    
    let flowOutput = await topicExplainerFlow(enrichedInput, modelToUseForText);

    let audioDataUri: string | null = null;
    // Allow TTS for admin, pro, or premium users if requested. Free users cannot request TTS for now.
    if (input.generateTts && (isProUser || isPremiumUser /* || userProfile?.isAdmin - userProfile not directly available here */) && flowOutput.explanation) {
      console.log("[ExplainTopic Action] TTS requested by eligible user. Synthesizing speech for explanation...");
      audioDataUri = await synthesizeSpeechWithGoogleGenAI(flowOutput.explanation);
      if (audioDataUri) {
        console.log("[ExplainTopic Action] TTS audio URI generated and added to output.");
      } else {
        console.warn("[ExplainTopic Action] TTS audio URI generation failed. Proceeding without audio.");
      }
    }

    return { ...flowOutput, audioDataUri: audioDataUri ?? undefined };

  } catch (error: any) {
    console.error("[ExplainTopic Action] CRITICAL error during server action execution (outer try-catch):", error);
    let errorMessage = 'Bilinmeyen bir sunucu hatası oluştu.';
    if (error instanceof Error) {
        errorMessage = error.message;
    } // Removed complex error message construction that might include the faulty model name
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
(Pro Kullanıcı Notu: Anlatımını en üst düzeyde akademik zenginlikle, konunun felsefi temellerine ve YKS'deki zorlayıcı soru tiplerine odaklanarak yap. {{{explanationLevel}}} seviyesini "detayli" kabul et ve daha derinlemesine bir bakış açısı sun. YKS ipuçları bölümünde, en az 3-4 kapsamlı strateji, sık yapılan hatalar ve zaman yönetimi gibi konularda detaylı tavsiyeler ver. En gelişmiş AI yeteneklerini kullanarak, adeta bir başyapıt niteliğinde bir konu anlatımı sun.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: {{{explanationLevel}}} seviyesine ve seçilen hoca tarzına uygun olarak, anlatımına daha fazla örnek, YKS'de çıkmış benzer sorulara atıflar ve ekstra ipuçları ekle. YKS ipuçları bölümünde 2-3 pratik strateji ve önemli bir yaygın hatadan bahset.)
{{else}}
(Ücretsiz Kullanıcı Notu: Anlatımını {{{explanationLevel}}} seviyesine uygun, temel ve anlaşılır tut. YKS ipuçları bölümünde 1-2 genel geçerli tavsiye ver.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' kullanılıyor.)
{{/if}}

{{#if isGemini25PreviewSelected}}
(Gemini 2.5 Flash Preview 05-20 Modeli Notu: Yanıtların ÖZ ama ANLAŞILIR ve YKS öğrencisine doğrudan fayda sağlayacak şekilde olsun. HIZLI yanıt vermeye odaklan. {{#if isProUser}}Pro kullanıcı için gereken derinliği ve stratejik bilgileri koruyarak{{else if isPremiumUser}}Premium kullanıcı için gereken detayları ve pratik ipuçlarını sağlayarak{{/if}} gereksiz uzun açıklamalardan ve süslemelerden kaçın, doğrudan konuya girerek en kritik bilgileri vurgula.)
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

    // Sanitize/Validate finalModelToUse right at the beginning of the flow
    if (!finalModelToUse || typeof finalModelToUse !== 'string' || !finalModelToUse.startsWith('googleai/')) {
        console.warn(`[Topic Explainer Flow] Received invalid model parameter: '${finalModelToUse}'. Defaulting based on plan from enrichedInput.`);
        const { isProUser, isPremiumUser } = enrichedInput; 
        if (isProUser || isPremiumUser) {
            finalModelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
        } else {
            finalModelToUse = 'googleai/gemini-2.0-flash';
        }
        console.log(`[Topic Explainer Flow] Corrected model to: ${finalModelToUse}`);
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

    console.log(`[Topic Explainer Flow - Text Gen] Using model: ${finalModelToUse} with config: ${JSON.stringify(callOptions.config)} for plan: ${enrichedInput.userPlan}, customModel: ${enrichedInput.customModelIdentifier}, level: ${enrichedInput.explanationLevel}, persona: ${enrichedInput.teacherPersona}`);

    try {
        const {output} = await topicExplainerPrompt(enrichedInput, callOptions);
        if (!output || !output.explanation) {
          console.error("[Topic Explainer Flow - Text Gen] AI did not produce a valid explanation. Output:", JSON.stringify(output).substring(0,500));
          throw new Error(`AI YKS Süper Öğretmeniniz, belirtilen konu ("${enrichedInput.topicName}") için bir anlatım oluşturamadı. Kullanılan Model: ${finalModelToUse}. Lütfen konuyu ve ayarları kontrol edin veya farklı bir model deneyin.`);
        }
        return {
            explanationTitle: output.explanationTitle,
            explanation: output.explanation,
            keyConcepts: output.keyConcepts || [],
            commonMistakes: output.commonMistakes || [],
            yksTips: output.yksTips || [],
            activeRecallQuestions: output.activeRecallQuestions || [],
        };
    } catch (error: any) {
        // Use finalModelToUse for the error message here as it's the sanitized version
        console.error(`[Topic Explainer Flow - Text Gen] INNER CRITICAL error during generation with model ${finalModelToUse} for topic "${enrichedInput.topicName}":`, error);
        if (error instanceof Error) {
           let errorMessage = `AI modeli (${finalModelToUse}) ile "${enrichedInput.topicName}" konusu için anlatım oluşturulurken bir Genkit/AI hatası oluştu.`;
           if (error.message) {
                errorMessage += ` Detay: ${error.message.substring(0, 250)}`;
                if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
                  errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen konunuzu gözden geçirin. Model: ${finalModelToUse}. Detay: ${error.message.substring(0, 150)}`;
                } else if (error.message.includes('400 Bad Request') && (error.message.includes('generationConfig') || error.message.includes('generation_config'))) {
                   errorMessage = `Seçilen model (${finalModelToUse}) bazı yapılandırma ayarlarını desteklemiyor olabilir. Model: ${finalModelToUse}. Detay: ${error.message.substring(0,150)}`;
                } else if (error.message.includes('Handlebars')) {
                   errorMessage = `AI şablonunda bir hata oluştu. Geliştiriciye bildirin. Model: ${finalModelToUse}. Detay: ${error.message.substring(0,150)}`;
                } else if (error.message.includes('NOT_FOUND') || error.message.includes('sentinelNoopStreamingCallback')) {
                    errorMessage = `AI modeli (${finalModelToUse}) bulunamadı veya yapılandırması hatalı. Lütfen admin panelinden geçerli bir model seçin veya varsayılanı kullanın. Detay: ${error.message.substring(0,150)}`;
                }
            }
            throw new Error(errorMessage); 
        } else {
            throw new Error(`AI modeli (${finalModelToUse}) ile "${enrichedInput.topicName}" konusu için anlatım oluşturulurken bilinmeyen bir Genkit/AI hatası oluştu.`);
        }
    }
  }
);
