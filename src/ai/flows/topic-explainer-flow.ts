
'use server';
/**
 * @fileOverview Kullanıcının girdiği bir YKS konusunu derinlemesine açıklayan,
 * anahtar kavramları, YKS için stratejik bilgileri ve aktif hatırlama soruları sunan uzman bir AI YKS öğretmeni.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { UserProfile } from '@/types';
// @google/genai ve Buffer importları, TTS kaldırıldığı için silindi.

const ExplainTopicInputSchema = z.object({
  topicName: z.string().min(3).describe('Açıklanması istenen YKS konu başlığı (örn: "Matematik - Türev ve Uygulamaları", "Edebiyat - Milli Edebiyat Dönemi").'),
  explanationLevel: z.enum(["temel", "orta", "detayli"]).optional().default("orta").describe("İstenen anlatımın YKS'ye göre zorluk ve detay seviyesi (temel, orta, detaylı)."),
  teacherPersona: z.enum(["samimi", "eglenceli", "ciddi", "ozel"]).optional().default("samimi").describe("İstenen hoca anlatım tarzı: 'samimi', 'eglenceli', 'ciddi' veya 'ozel' (kullanıcı tanımlı)."),
  customPersonaDescription: z.string().optional().describe("Eğer 'teacherPersona' olarak 'ozel' seçildiyse, kullanıcının istediği hoca kişiliğinin detaylı açıklaması."),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı."),
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi."),
  // generateTts: z.boolean().optional(), // TTS kaldırıldı
});
export type ExplainTopicInput = z.infer<typeof ExplainTopicInputSchema>;

const ExplainTopicOutputSchema = z.object({
  explanationTitle: z.string().describe("Oluşturulan konu anlatımı için bir başlık (örn: '{{{topicName}}} Detaylı Konu Anlatımı')."),
  explanation: z.string().describe('Konunun, YKS öğrencisinin anlayışını en üst düzeye çıkaracak şekilde, AI tarafından oluşturulmuş, yapılandırılmış ve kapsamlı anlatımı. Anlatım, ana tanımları, temel ilkeleri, önemli alt başlıkları, örnekleri ve YKS\'de çıkabilecek bağlantıları içermelidir. Matematiksel ifadeler (örn: x^2, H_2O, √, π) metin içinde okunabilir şekilde belirtilmelidir.'),
  keyConcepts: z.array(z.string()).optional().describe('Anlatımda vurgulanan ve YKS için hayati öneme sahip 3-5 anahtar kavram veya terim.'),
  commonMistakes: z.array(z.string()).optional().describe("Öğrencilerin bu konuda sık yaptığı hatalar veya karıştırdığı noktalar."),
  yksTips: z.array(z.string()).optional().describe("Bu konunun YKS'deki önemi, hangi soru tiplerinde çıktığı ve çalışırken nelere dikkat edilmesi gerektiği hakkında 2-3 stratejik ipucu."),
  activeRecallQuestions: z.array(z.string()).optional().describe("Konuyu pekiştirmek ve öğrencinin aktif katılımını sağlamak için AI tarafından sorulan 2-3 çeşitli (kısa cevaplı, boşluk doldurma, doğru/yanlış vb.) ve doğrudan konuyla ilgili soru."),
  // audioDataUri: z.string().optional(), // TTS kaldırıldı
  // ttsError: z.string().optional(), // TTS kaldırıldı
});
export type ExplainTopicOutput = z.infer<typeof ExplainTopicOutputSchema>;

const defaultErrorOutput: ExplainTopicOutput = {
  explanationTitle: "Hata: Konu Anlatımı Oluşturulamadı",
  explanation: "Konu anlatımı oluşturulurken beklenmedik bir sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin veya destek ile iletişime geçin.",
  keyConcepts: [],
  commonMistakes: [],
  yksTips: [],
  activeRecallQuestions: [],
};

export async function explainTopic(input: ExplainTopicInput): Promise<ExplainTopicOutput> {
  console.log("[ExplainTopic Action - Start] Received input. CustomModelIdentifier:", input.customModelIdentifier, "UserPlan:", input.userPlan, "TopicName:", input.topicName);
  
  const isProUser = input.userPlan === 'pro';
  const isPremiumUser = input.userPlan === 'premium';
  const isCustomModelSelected = !!input.customModelIdentifier && typeof input.customModelIdentifier === 'string' && input.customModelIdentifier.trim() !== "";

  let modelToUseForText = '';
  
  if (isCustomModelSelected) {
    const customIdLower = input.customModelIdentifier!.toLowerCase();
    switch (customIdLower) {
      case 'default_gemini_flash': modelToUseForText = 'googleai/gemini-2.0-flash'; break;
      case 'experimental_gemini_1_5_flash': modelToUseForText = 'googleai/gemini-1.5-flash-latest'; break;
      case 'experimental_gemini_2_5_flash_preview_05_20': modelToUseForText = 'googleai/gemini-2.5-flash-preview-05-20'; break;
      default:
        console.warn(`[ExplainTopic Action] Unknown or invalid customModelIdentifier: '${input.customModelIdentifier}'. Defaulting based on plan '${input.userPlan}'.`);
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
    isCustomModelSelected,
    isGemini25PreviewSelected: modelToUseForText === 'googleai/gemini-2.5-flash-preview-05-20',
    isPersonaSamimi: input.teacherPersona === 'samimi',
    isPersonaEglenceli: input.teacherPersona === 'eglenceli',
    isPersonaCiddi: input.teacherPersona === 'ciddi',
    isPersonaOzel: input.teacherPersona === 'ozel',
  };

  try {
    const textGenStartTime = Date.now();
    console.log("[ExplainTopic Action] Calling topicExplainerFlow for text generation with model:", modelToUseForText);
    
    const flowOutput = await topicExplainerFlow(enrichedInputForTextPrompt, modelToUseForText);
    
    const textGenEndTime = Date.now();
    console.log(`[ExplainTopic Action] Text generation took ${textGenEndTime - textGenStartTime}ms`);

    if (!flowOutput || typeof flowOutput.explanation !== 'string' || flowOutput.explanation.trim().length === 0) {
       console.error("[ExplainTopic Action] Flow output is invalid or explanation is empty. FlowOutput:", JSON.stringify(flowOutput, null, 2).substring(0, 500));
        return {
            ...defaultErrorOutput,
            explanationTitle: flowOutput?.explanationTitle || `Hata: ${input.topicName || 'Bilinmeyen Konu'}`,
            explanation: flowOutput?.explanation || "Yapay zeka geçerli bir konu anlatımı üretemedi.",
        };
    }
    
    console.log("[ExplainTopic Action] Successfully processed. Returning text-only output to client.");
    return flowOutput; // TTS kaldırıldığı için sadece metin tabanlı çıktı dönülüyor

  } catch (error: any) {
    console.error("[ExplainTopic Action] CRITICAL Unhandled error in explainTopic:", error, "Input was:", JSON.stringify(input));
    let errorMessage = `Konu anlatımı oluşturulurken sunucuda kritik bir hata oluştu.`;
    if (error instanceof Error && error.message) {
        errorMessage += ` Detay: ${error.message.substring(0,200)}`;
    } else if (typeof error === 'string') {
        errorMessage += ` Detay: ${error.substring(0,200)}`;
    }
    
    return {
        ...defaultErrorOutput,
        explanationTitle: `Kritik Sunucu Hatası: ${input.topicName || 'Konu Belirtilmemiş'}`,
        explanation: errorMessage,
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
  output: {schema: ExplainTopicOutputSchema},
  prompt: `Sen, YKS konularını öğrencilere en iyi şekilde öğreten, en karmaşık konuları bile en anlaşılır, en akılda kalıcı ve en kapsamlı şekilde öğreten, pedagojik dehası ve alan hakimiyeti tartışılmaz, son derece deneyimli bir AI YKS Süper Öğretmenisin.
Görevin, öğrencinin belirttiği "{{{topicName}}}" konusunu, seçtiği "{{{explanationLevel}}}" detay seviyesine ve "{{{teacherPersona}}}" hoca tarzına uygun olarak, adım adım ve YKS stratejileriyle açıklamaktır.
Anlatımın sonunda, konuyu pekiştirmek için 2-3 çeşitli ve konuyla ilgili aktif hatırlama sorusu sor.
Matematiksel ifadeleri (örn: x^2, H_2O, √, π, ±, ≤, ≥) metin içinde okunabilir şekilde belirt. Cevapların Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: Bu, Pro üyeliğinizle gelen bir USTA DERSİ niteliğindedir. "{{{topicName}}}" konusunu, YKS'deki en zorlayıcı soru tiplerini, UZMAN SEVİYESİNDE derinlemesine stratejileri (örn: zaman yönetimi, eleme teknikleri, soru kökü analizi, farklı çözüm yolları, en sık karşılaşılan çeldirici türleri), öğrencilerin sıklıkla düştüğü TUZAKLARI ve bu tuzaklardan kaçınma yöntemlerini, konunun diğer disiplinlerle olan KARMAŞIK BAĞLANTILARINI ve YKS'deki güncel soru trendlerini içerecek şekilde, son derece kapsamlı ve akademik bir zenginlikle açıkla. Anlatımın, YKS'de zirveyi hedefleyen bir öğrencinin ihtiyaç duyacağı tüm detayları, BENZERSİZ İÇGÖRÜLERİ ve uzman bakış açılarını barındırmalıdır. {{{explanationLevel}}} seviyesini "detayli" kabul et ve sıradan bir anlatımın çok ötesine geç. YKS ipuçları bölümünde, en az 3-4 kapsamlı, uygulanabilir ve sıra dışı strateji, kritik zaman yönetimi teknikleri ve en sık yapılan hatalardan kaçınma yolları hakkında detaylı tavsiyeler ver. Bu konunun YKS'deki stratejik önemini ve farklı soru formatlarında nasıl karşına çıkabileceğini vurgula. En gelişmiş AI yeteneklerini kullanarak, akılda kalıcı ve öğretici bir başyapıt sun. Özellikle konunun mantığını ve "neden"lerini derinlemesine irdele. Çıktıların kapsamlı ve detaylı olmalı. Örneğin, bir matematik konusunda sadece formülü vermek yerine, formülün ispatına veya geometrik yorumuna da değinebilirsin. Tarih konusunda, olayın sadece sonucunu değil, uzun vadeli etkilerini ve farklı bakış açılarını da sunabilirsin.)
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
    outputSchema: ExplainTopicOutputSchema,
  },
  async (enrichedInputFromAction: z.infer<typeof TopicExplainerPromptInputSchema>, modelToUseForTextParam: string ): Promise<ExplainTopicOutput> => {
    
    let finalModelToUse = modelToUseForTextParam;
    console.log(`[Topic Explainer Flow - Initial Check] Received modelToUseForTextParam: '${finalModelToUse}' from explainTopic action. Enriched Input - Plan: ${enrichedInputFromAction.userPlan}, Custom Model ID (from input): ${enrichedInputFromAction.customModelIdentifier}, Topic: ${enrichedInputFromAction.topicName}`);

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
        return output;
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
