
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
import type { UserProfile } from '@/types';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

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
  audioDataUri: z.string().optional().describe("Konu anlatımının seslendirilmiş halinin data URI'si (Base64, MP3).")
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

async function synthesizeSpeech(text: string): Promise<string | null> {
  // TTS istemcisini oluştur. GOOGLE_APPLICATION_CREDENTIALS çevre değişkeninin ayarlı olduğundan emin ol.
  const ttsClient = new TextToSpeechClient();

  const request = {
    input: { text: text },
    voice: { languageCode: 'tr-TR', name: 'tr-TR-Wavenet-A' }, // Diğer sesleri deneyebilirsin: tr-TR-Wavenet-B, C, D, E
    audioConfig: { audioEncoding: 'MP3' as const }, // MP3 formatında çıktı
  };

  try {
    console.log("[Synthesize Speech] Sending TTS request...");
    const [response] = await ttsClient.synthesizeSpeech(request);
    console.log("[Synthesize Speech] TTS response received.");
    if (response.audioContent) {
      const audioBase64 = Buffer.from(response.audioContent as Uint8Array).toString('base64');
      return `data:audio/mpeg;base64,${audioBase64}`;
    }
    console.warn("[Synthesize Speech] TTS response did not contain audio content.");
    return null;
  } catch (error) {
    console.error("[Synthesize Speech] ERROR:", error);
    return null;
  }
}


export async function explainTopic(input: ExplainTopicInput): Promise<ExplainTopicOutput> {
  try {
    const isProUser = input.userPlan === 'pro';
    const isPremiumUser = input.userPlan === 'premium';
    const isCustomModelSelected = !!input.customModelIdentifier;

    let modelToUse = '';
    if (input.customModelIdentifier) {
      switch (input.customModelIdentifier) {
        case 'default_gemini_flash':
          modelToUse = 'googleai/gemini-2.0-flash';
          break;
        case 'experimental_gemini_1_5_flash':
          modelToUse = 'googleai/gemini-1.5-flash-latest';
          break;
        case 'experimental_gemini_2_5_flash_preview_05_20':
          modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
          break;
        default:
          console.warn(`[Topic Explainer Flow] Unknown customModelIdentifier: ${input.customModelIdentifier}. Defaulting based on plan.`);
          if (isProUser || isPremiumUser) {
            modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
          } else {
            modelToUse = 'googleai/gemini-2.0-flash';
          }
          break;
      }
    } else {
      if (isProUser || isPremiumUser) {
        modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
      } else {
        modelToUse = 'googleai/gemini-2.0-flash';
      }
    }
    
    if (!modelToUse) { 
      console.error("[Topic Explainer Flow] modelToUse was unexpectedly empty after selection logic. Defaulting based on plan.");
      if (isProUser || isPremiumUser) {
        modelToUse = 'googleai/gemini-2.5-flash-preview-05-20';
      } else {
        modelToUse = 'googleai/gemini-2.0-flash';
      }
    }
    
    const isGemini25PreviewSelected = modelToUse === 'googleai/gemini-2.5-flash-preview-05-20';

    const enrichedInput = {
      ...input,
      isProUser,
      isPremiumUser,
      isCustomModelSelected,
      isGemini25PreviewSelected, 
      isPersonaSamimi: input.teacherPersona === 'samimi',
      isPersonaEglenceli: input.teacherPersona === 'eglenceli',
      isPersonaCiddi: input.teacherPersona === 'ciddi',
      isPersonaOzel: input.teacherPersona === 'ozel',
    };
    
    let flowOutput = await topicExplainerFlow(enrichedInput, modelToUse);

    if (input.generateTts && userProfile?.isAdmin && flowOutput.explanation) {
      console.log("[Topic Explainer Flow] Admin requested TTS. Synthesizing speech for explanation...");
      const audioDataUri = await synthesizeSpeech(flowOutput.explanation);
      if (audioDataUri) {
        flowOutput = { ...flowOutput, audioDataUri };
        console.log("[Topic Explainer Flow] TTS audio URI generated and added to output.");
      } else {
        console.warn("[Topic Explainer Flow] TTS audio URI generation failed. Proceeding without audio.");
      }
    }

    return flowOutput;

  } catch (error: any) {
    console.error("[ExplainTopic Action] CRITICAL error during server action execution (outer try-catch):", error);
    let errorMessage = 'Bilinmeyen bir sunucu hatası oluştu.';
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else {
        try {
            errorMessage = JSON.stringify(error).substring(0, 200);
        } catch (stringifyError) {
            errorMessage = 'Serileştirilemeyen sunucu hata nesnesi.';
        }
    }
    return {
        ...defaultErrorOutput,
        explanationTitle: `Sunucu Hatası: ${input.topicName}`,
        explanation: `Konu anlatımı oluşturulurken sunucuda kritik bir hata oluştu: ${errorMessage}. Lütfen daha sonra tekrar deneyin veya bir sorun olduğunu düşünüyorsanız destek ile iletişime geçin.`
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
  output: {schema: ExplainTopicOutputSchema.omit({ audioDataUri: true })}, // TTS akış dışında halledilecek
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
    outputSchema: ExplainTopicOutputSchema.omit({ audioDataUri: true }), // TTS akış dışında halledilecek
  },
  async (enrichedInput: z.infer<typeof TopicExplainerPromptInputSchema>, modelToUse: string ): Promise<Omit<ExplainTopicOutput, 'audioDataUri'>> => {

    let callOptions: { model: string; config?: Record<string, any> } = { model: modelToUse };

    if (modelToUse === 'googleai/gemini-2.5-flash-preview-05-20') {
        callOptions.config = { temperature: 0.7 }; 
    } else {
      callOptions.config = {
        generationConfig: {
          maxOutputTokens: enrichedInput.explanationLevel === 'detayli' ? 8192 : enrichedInput.explanationLevel === 'orta' ? 4096 : 2048,
        }
      };
    }

    console.log(`[Topic Explainer Flow] Using model: ${modelToUse} with config: ${JSON.stringify(callOptions.config)} for plan: ${enrichedInput.userPlan}, customModel: ${enrichedInput.customModelIdentifier}, level: ${enrichedInput.explanationLevel}, persona: ${enrichedInput.teacherPersona}`);

    try {
        const {output} = await topicExplainerPrompt(enrichedInput, callOptions);
        if (!output || !output.explanation) {
          console.error("[Topic Explainer Flow] AI did not produce a valid explanation. Output:", JSON.stringify(output).substring(0,500));
          throw new Error(`AI YKS Süper Öğretmeniniz, belirtilen konu için bir anlatım oluşturamadı. Model: ${modelToUse}. Lütfen konuyu ve ayarları kontrol edin veya farklı bir model deneyin.`);
        }
        // Ensure all optional fields are at least empty arrays if not provided by LLM, to match schema
        return {
            explanationTitle: output.explanationTitle,
            explanation: output.explanation,
            keyConcepts: output.keyConcepts || [],
            commonMistakes: output.commonMistakes || [],
            yksTips: output.yksTips || [],
            activeRecallQuestions: output.activeRecallQuestions || [],
        };
    } catch (error: any) {
        console.error(`[Topic Explainer Flow] INNER CRITICAL error during generation with model ${modelToUse}:`, error);
        if (error instanceof Error) {
           let errorMessage = `AI modeli (${modelToUse}) ile konu anlatımı oluşturulurken bir Genkit/AI hatası oluştu.`;
           if (error.message) {
                errorMessage += ` Detay: ${error.message.substring(0, 250)}`;
                if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
                  errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen konunuzu gözden geçirin. Model: ${modelToUse}. Detay: ${error.message.substring(0, 150)}`;
                } else if (error.message.includes('400 Bad Request') && (error.message.includes('generationConfig') || error.message.includes('generation_config'))) {
                   errorMessage = `Seçilen model (${modelToUse}) bazı yapılandırma ayarlarını desteklemiyor olabilir. Model: ${modelToUse}. Detay: ${error.message.substring(0,150)}`;
                } else if (error.message.includes('Handlebars')) {
                   errorMessage = `AI şablonunda bir hata oluştu. Geliştiriciye bildirin. Model: ${modelToUse}. Detay: ${error.message.substring(0,150)}`;
                }
            }
            throw new Error(errorMessage); // Re-throw to be caught by the outer explainTopic's catch block
        } else {
            throw new Error(`AI modeli (${modelToUse}) ile konu anlatımı oluşturulurken bilinmeyen bir Genkit/AI hatası oluştu.`);
        }
    }
  }
);
