
'use server';
/**
 * @fileOverview Kullanıcının girdiği bir YKS konusunu derinlemesine açıklayan,
 * anahtar kavramları, YKS için stratejik bilgileri ve aktif hatırlama soruları sunan uzman bir AI YKS öğretmeni.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { UserProfile } from '@/types';

const ExplainTopicInputSchema = z.object({
  topicName: z.string().min(3).describe('Açıklanması istenen YKS konu başlığı (örn: "Matematik - Türev ve Uygulamaları", "Edebiyat - Milli Edebiyat Dönemi").'),
  explanationLevel: z.enum(["temel", "orta", "detayli"]).optional().default("orta").describe("İstenen anlatımın YKS'ye göre zorluk ve detay seviyesi (temel, orta, detaylı)."),
  teacherPersona: z.enum(["samimi", "eglenceli", "ciddi", "ozel"]).optional().default("samimi").describe("İstenen hoca anlatım tarzı: 'samimi', 'eglenceli', 'ciddi' veya 'ozel' (kullanıcı tanımlı)."),
  customPersonaDescription: z.string().optional().describe("Eğer 'teacherPersona' olarak 'ozel' seçildiyse, kullanıcının istediği hoca kişiliğinin detaylı açıklaması."),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı."),
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi."),
});
export type ExplainTopicInput = z.infer<typeof ExplainTopicInputSchema>;

const ExplainTopicOutputSchema = z.object({
  explanationTitle: z.string().describe("Oluşturulan konu anlatımı için bir başlık (örn: '{{{topicName}}} Detaylı Konu Anlatımı')."),
  explanation: z.string().describe('Konunun, YKS öğrencisinin anlayışını en üst düzeye çıkaracak şekilde, AI tarafından oluşturulmuş, yapılandırılmış ve kapsamlı ANLATIMI. BU ALAN SADECE ANA KONU ANLATIMINI İÇERMELİDİR; anahtar kavramlar, hatalar, ipuçları ve sorular aşağıdaki ayrı alanlarda bir dizi (array) olarak tanımlanmıştır.'),
  keyConcepts: z.array(z.string()).optional().describe('Anlatımda vurgulanan ve YKS için hayati öneme sahip 3-5 anahtar kavram veya terim. HER BİR DİZİ ELEMANI TEK BİR KAVRAM/TERİM İÇERMELİDİR.'),
  commonMistakes: z.array(z.string()).optional().describe("Öğrencilerin bu konuda sık yaptığı hatalar veya karıştırdığı noktalar. HER BİR DİZİ ELEMANI TEK BİR HATA/NOKTA İÇERMELİDİR."),
  yksTips: z.array(z.string()).optional().describe("Bu konunun YKS'deki önemi, hangi soru tiplerinde çıktığı ve çalışırken nelere dikkat edilmesi gerektiği hakkında 2-3 stratejik ipucu. HER BİR DİZİ ELEMANI TEK BİR İPUCU/STRATEJİ İÇERMELİDİR."),
  activeRecallQuestions: z.array(z.string()).optional().describe("Konuyu pekiştirmek ve öğrencinin aktif katılımını sağlamak için AI tarafından sorulan 2-3 çeşitli ve doğrudan konuyla ilgili soru. HER BİR DİZİ ELEMANI TEK BİR SORU İÇERMELİDİR."),
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
  console.log(`[ExplainTopic Action] Received input. Plan: ${input.userPlan}, Admin Model ID: '${input.customModelIdentifier}', TopicName: ${input.topicName}`);

  const isProUser = input.userPlan === 'pro';
  const isPremiumUser = input.userPlan === 'premium';
  
  let modelToUseForText: string;
  
  if (input.customModelIdentifier && typeof input.customModelIdentifier === 'string' && input.customModelIdentifier.trim() !== "") {
    const customIdLower = input.customModelIdentifier.toLowerCase();
    switch (customIdLower) {
      case 'default_gemini_flash': modelToUseForText = 'googleai/gemini-2.0-flash'; break;
      case 'experimental_gemini_1_5_flash': modelToUseForText = 'googleai/gemini-1.5-flash-latest'; break;
      case 'experimental_gemini_2_5_flash_preview_05_20': modelToUseForText = 'googleai/gemini-2.5-flash-preview-05-20'; break;
      default:
        if (input.customModelIdentifier.startsWith('googleai/')) {
            modelToUseForText = input.customModelIdentifier;
            console.warn(`[ExplainTopic Action] Admin specified a direct Genkit model name: '${modelToUseForText}'. Ensure this model is supported.`);
        } else {
            console.warn(`[ExplainTopic Action] Admin specified an UNKNOWN customModelIdentifier: '${input.customModelIdentifier}'. Falling back to plan-based default for plan '${input.userPlan}'.`);
            if (isProUser || isPremiumUser) modelToUseForText = 'googleai/gemini-2.5-flash-preview-05-20';
            else modelToUseForText = 'googleai/gemini-2.0-flash';
        }
        break;
    }
  } else {
    console.log(`[ExplainTopic Action] No custom model specified by admin, or identifier was invalid. Using plan-based default for plan '${input.userPlan}'.`);
    if (isProUser || isPremiumUser) modelToUseForText = 'googleai/gemini-2.5-flash-preview-05-20';
    else modelToUseForText = 'googleai/gemini-2.0-flash';
  }
  
  // Absolute fallback to prevent "()=>null" or other invalid strings
  if (typeof modelToUseForText !== 'string' || !modelToUseForText.startsWith('googleai/')) {
    console.error(`[ExplainTopic Action] CRITICAL FALLBACK: modelToUseForText was invalid ('${modelToUseForText}'). Defaulting to gemini-2.0-flash.`);
    modelToUseForText = 'googleai/gemini-2.0-flash';
  }
  console.log(`[ExplainTopic Action] Final model for text generation: ${modelToUseForText}, Plan: ${input.userPlan}, Admin Model ID (raw): ${input.customModelIdentifier}`);
  
  const enrichedInputForTextPrompt = {
    ...input,
    isProUser,
    isPremiumUser,
    isCustomModelSelected: !!input.customModelIdentifier,
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
       const errorTitle = flowOutput?.explanationTitle || `Hata: ${input.topicName || 'Bilinmeyen Konu'}`;
       const errorExplanation = flowOutput?.explanation || `Yapay zeka (${modelToUseForText}) geçerli bir konu anlatımı üretemedi.`;
       return {
            ...defaultErrorOutput, 
            explanationTitle: errorTitle,
            explanation: errorExplanation,
        };
    }

    console.log("[ExplainTopic Action] Successfully processed. Returning text output to client.");
    return flowOutput;

  } catch (error: any) {
    console.error(`[ExplainTopic Action] CRITICAL Unhandled error in explainTopic. Model tried: ${modelToUseForText}. Error:`, error, "Input was:", JSON.stringify(input));
    let errorMessage = `Konu anlatımı oluşturulurken sunucuda kritik bir hata oluştu (Model: ${modelToUseForText}).`;
    if (error instanceof Error && error.message) {
        errorMessage += ` Detay: ${error.message.substring(0,200)}`;
    } else if (typeof error === 'string') {
        errorMessage += ` Detay: ${error.substring(0,200)}`;
    }
    
    return { 
        explanationTitle: `Kritik Sunucu Hatası: ${input.topicName || 'Konu Belirtilmemiş'}`,
        explanation: errorMessage,
        keyConcepts: ["Kritik hata oluştu."],
        commonMistakes: ["Lütfen daha sonra tekrar deneyin."],
        yksTips: ["Teknik bir sorun yaşandı."],
        activeRecallQuestions: ["AI yanıt üretemedi, bir sorun olabilir."],
    };
  }
}

const promptInputSchema = ExplainTopicInputSchema.extend({
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
  input: {schema: promptInputSchema},
  output: {schema: ExplainTopicOutputSchema }, 
  prompt: `Sen, YKS konularını öğrencilere en iyi şekilde öğreten, en karmaşık konuları bile en anlaşılır, en akılda kalıcı ve en kapsamlı şekilde öğreten, pedagojik dehası ve alan hakimiyeti tartışılmaz, son derece deneyimli bir AI YKS Süper Öğretmenisin.
Görevin, öğrencinin belirttiği "{{{topicName}}}" konusunu, seçtiği "{{{explanationLevel}}}" detay seviyesine ve "{{{teacherPersona}}}" hoca tarzına uygun olarak, adım adım ve YKS stratejileriyle açıklamaktır.
Matematiksel ifadeleri (örn: x^2, H_2O, √, π, ±, ≤, ≥) metin içinde okunabilir şekilde belirt. Cevapların Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: Bu, Pro üyeliğinizle gelen bir USTA DERSİ niteliğindedir ve üyeliğinizin özel bir avantajıdır. Anlatımını en üst düzeyde ve kapsamlı yap. "{{{topicName}}}" konusunu, YKS'deki EN ZORLAYICI soru tipleriyle doğrudan ilişkilendir. UZMAN SEVİYESİNDE derinlemesine stratejiler sun: zaman yönetimi, en etkili eleme teknikleri, karmaşık soru köklerinin analizi, farklı ve alternatif çözüm yolları, öğrencilerin en sık karşılaştığı çeldirici türleri ve bunlardan kaçınma yöntemleri. Öğrencilerin sıklıkla düştüğü ÖRTÜK TUZAKLARI ve kavram yanılgılarını detaylıca açıkla. Konunun diğer disiplinlerle olan KARMAŞIK BAĞLANTILARINI, YKS dışındaki akademik önemini ve (eğer uygunsa) tarihsel gelişimini veya felsefi temellerini irdele. YKS'deki GÜNCEL SORU TRENDLERİNİ ve bu konunun bu trendlerdeki yerini analiz et. Anlatımın, YKS'de zirveyi hedefleyen bir öğrencinin ihtiyaç duyacağı tüm detayları, BENZERSİZ İÇGÖRÜLERİ, uzman bakış açılarını ve DERİN ANALİZLERİ barındırmalıdır. {{{explanationLevel}}} ne seçilirse seçilsin, bu Pro anlatımı her zaman en az "detayli" seviyenin de üzerinde, bir uzman konsültasyonu derinliğinde olmalıdır. Sıradan bir anlatımın çok ötesine geç; konunun mantığını, "neden"lerini ve "nasıl"larını en ince ayrıntısına kadar, birden fazla örnekle ve farklı perspektiflerle açıkla. Çıktıların son derece kapsamlı, detaylı, analitik ve stratejik olmalı. Diğer planlara göre belirgin bir fark yarat.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: {{{explanationLevel}}} seviyesine ve seçilen hoca tarzına uygun olarak, anlatımına daha fazla örnek, YKS'de çıkmış benzer sorulara atıflar ve 1-2 etkili çalışma tekniği (örn: Feynman Tekniği, Pomodoro) ile birlikte ekstra ipuçları ekle. Konuyu orta-üst seviyede detaylandır. Anahtar kavramları ve YKS'deki önemlerini vurgula. Çıktıların dengeli ve bilgilendirici olmalı.)
{{else}}
(Ücretsiz Kullanıcı Notu: Anlatımını {{{explanationLevel}}} seviyesine uygun, temel ve anlaşılır tut. Konunun ana hatlarını ve en temel tanımlarını sun. Çıktıların temel düzeyde ve net olmalı.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' seçildi.)
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
{{#if isProUser}}
(Pro Kullanıcı Notu: 'Temel' veya 'orta' seçseniz bile, Pro üyeliğiniz sayesinde anlatımınız bu seviyelerin çok ötesinde, 'detaylı' bir anlatımın zenginliğinde ve derinliğinde olacaktır. Amacımız size en kapsamlı bilgiyi sunmaktır.)
{{/if}}

Konu: {{{topicName}}}

Lütfen bu konuyu aşağıdaki formatta, seçilen "{{{explanationLevel}}}" seviyesine, "{{{teacherPersona}}}" tarzına ve YKS ihtiyaçlarına göre açıkla. Her bir bölümü Zod şemasındaki ilgili alana yerleştir. Şemadaki 'describe' alanları, her alanın ne içermesi gerektiğini açıklar. Özellikle 'keyConcepts', 'commonMistakes', 'yksTips' ve 'activeRecallQuestions' alanlarının string dizileri (array of strings) olduğunu ve HER BİR DİZİ ELEMANININ SADECE TEK BİR KAVRAM/HATA/İPUCU/SORU içermesi gerektiğini unutma.

İstenen Çıktı Bölümleri (Her bir bölümü şemadaki ilgili alana yerleştir. Örneğin 'keyConcepts' bir dizi string olmalı, ana anlatım 'explanation' alanında olmalı):
1.  **Anlatım Başlığı (explanationTitle)**: Konuyla ilgili ilgi çekici başlık.
2.  **Kapsamlı Konu Anlatımı (explanation)**: Konuyu, YKS öğrencisinin anlayışını en üst düzeye çıkaracak şekilde, **kısa paragraflar, Markdown formatında ## Alt Başlıklar ve ### Daha Alt Başlıklar kullanarak mantıksal bölümlere ayırarak** ve bol örnekle açıkla. Okunabilirliği artırmak için GEREKTİĞİNDE listeler (örn: * Madde 1) kullan.
    *   Giriş: Konunun YKS'deki yeri ve önemi.
    *   Temel Tanımlar ve İlkeler: Açık ve net ifadeler.
    *   Alt Başlıklar ve Detaylar: Mantıksal alt başlıklarla, bol örnekle açıkla.
    *   Örnekler ve Uygulamalar: YKS düzeyine uygun örnekler.
    *   Sonuç/Özet: Ana hatları özetle.
    **(Bu bölüm SADECE konunun ana anlatımını içermelidir. Anahtar kavramlar, hatalar, YKS ipuçları ve aktif hatırlama soruları aşağıdaki ayrı bölümlerde Zod şemasına uygun olarak string dizileri şeklinde listelenmelidir. Bu bölümlerin içeriği ana anlatım metninde TEKRAR ETMEMELİDİR.)**
3.  **Anahtar Kavramlar (keyConcepts) (isteğe bağlı, seviyeye göre)**: YKS için 3-5 kritik YKS kavramını LİSTELE (string dizisi). Her bir dizi elemanı TEK BİR KAVRAM/TERİM içermelidir.
4.  **Sık Yapılan Hatalar (commonMistakes) (isteğe bağlı, 'orta' ve 'detayli' seviyede)**: 2-3 yaygın hatayı ve kaçınma yollarını LİSTELE (string dizisi). Her bir dizi elemanı TEK BİR HATA/NOKTA içermelidir.
5.  **YKS İpuçları ve Stratejileri (yksTips) (isteğe bağlı, seviyeye göre)**: Planına göre 1-4 stratejik YKS ipucunu LİSTELE (string dizisi). Her bir dizi elemanı TEK BİR İPUCU/STRATEJİ İÇERMELİDİR. {{#if isProUser}} (Pro Kullanıcı Notu: Bu Pro seviyesindeki derinlemesine YKS ipuçları ve stratejileri, üyeliğinizin özel bir avantajıdır. En kapsamlı ve uygulanabilir stratejileri, kritik zaman yönetimi tekniklerini ve en sık yapılan hatalardan kaçınma yolları hakkında detaylı tavsiyeler ver. Bu konunun YKS'deki stratejik önemini ve farklı soru formatlarında nasıl karşına çıkabileceğini vurgula.) {{/if}}
6.  **Aktif Hatırlama Soruları (activeRecallQuestions)**: Konuyu pekiştirmek için 2-3 çeşitli (kısa cevaplı, boşluk doldurma, doğru/yanlış vb.) ve konuyla ilgili soruyu LİSTELE (string dizisi). Her bir dizi elemanı TEK BİR SORU içermelidir.

Dilbilgisi ve YKS terminolojisine dikkat et. Bilgilerin doğru ve güncel olduğundan emin ol.
`,
});

// This function is responsible for making the actual call to the AI model for text generation.
const topicExplainerFlow = ai.defineFlow(
  {
    name: 'topicExplainerFlow',
    inputSchema: promptInputSchema,
    outputSchema: ExplainTopicOutputSchema, 
  },
  async (enrichedInputFromAction: z.infer<typeof promptInputSchema>, modelToUseForTextParam: string ): Promise<ExplainTopicOutput> => {
    
    let finalModelToUseForText = modelToUseForTextParam;
    console.log(`[Topic Explainer Flow - Text Gen] Initial modelToUseForTextParam: '${finalModelToUseForText}', type: ${typeof finalModelToUseForText}`);

    if (typeof finalModelToUseForText !== 'string' || !finalModelToUseForText.startsWith('googleai/')) {
        console.warn(`[Topic Explainer Flow - Text Gen] Invalid or non-string modelToUseForTextParam ('${finalModelToUseForText}', type: ${typeof finalModelToUseForText}) received in flow. Defaulting based on plan from enrichedInput.`);
        if (enrichedInputFromAction.isProUser || enrichedInputFromAction.isPremiumUser) {
            finalModelToUseForText = 'googleai/gemini-2.5-flash-preview-05-20';
        } else {
            finalModelToUseForText = 'googleai/gemini-2.0-flash';
        }
        console.log(`[Topic Explainer Flow - Text Gen] Corrected/Defaulted model INSIDE FLOW to: ${finalModelToUseForText}`);
    }

    const standardSafetySettings = [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ];

    let standardTemperature = 0.7;
    if (enrichedInputFromAction.isProUser) {
        standardTemperature = 0.6; 
    } else if (enrichedInputFromAction.teacherPersona === 'eglenceli') {
        standardTemperature = 0.8;
    }

    let maxOutputTokens = 4096; // Default for medium
    if (enrichedInputFromAction.explanationLevel === 'detayli' || enrichedInputFromAction.isProUser) {
        maxOutputTokens = 8192;
    } else if (enrichedInputFromAction.explanationLevel === 'orta') {
        maxOutputTokens = 4096;
    } else { // temel
        maxOutputTokens = 2048;
    }
    // Ensure Pro users get at least 8192 for detailed, even if level is not 'detayli' but they are pro
    if (enrichedInputFromAction.isProUser) {
      maxOutputTokens = Math.max(maxOutputTokens, 8192);
    }


    const callOptions: { model: string; config?: Record<string, any> } = { 
        model: finalModelToUseForText,
        config: {
            temperature: standardTemperature,
            safetySettings: standardSafetySettings,
            generationConfig: {
              maxOutputTokens: maxOutputTokens,
            }
        }
    };
    
    const promptInputForLog = { ...enrichedInputFromAction, resolvedModelUsed: finalModelToUseForText };
    console.log(`[Topic Explainer Flow - Text Gen] Using Genkit model: ${finalModelToUseForText} with config: ${JSON.stringify(callOptions.config)} for plan: ${enrichedInputFromAction.userPlan}, customModel (raw): ${enrichedInputFromAction.customModelIdentifier}, level: ${enrichedInputFromAction.explanationLevel}, persona: ${enrichedInputFromAction.teacherPersona}`);

    try {
        const {output} = await topicExplainerPrompt(promptInputForLog, callOptions);
        if (!output || !output.explanation) {
          const errorMsg = `AI YKS Süper Öğretmeniniz (${finalModelToUseForText}), belirtilen konu ("${enrichedInputFromAction.topicName}") için bir anlatım oluşturamadı. Lütfen konuyu ve ayarları kontrol edin veya farklı bir model deneyin.`;
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
        console.error(`[Topic Explainer Flow - Text Gen] CRITICAL error during Genkit prompt execution with model ${finalModelToUseForText} for topic "${enrichedInputFromAction.topicName}":`, error);
        let errorMessage = `AI modeli (${finalModelToUseForText}) ile "${enrichedInputFromAction.topicName}" konusu için anlatım oluşturulurken bir Genkit/AI hatası oluştu.`;
        if (error instanceof Error && error.message) {
            errorMessage += ` Detay: ${error.message.substring(0, 250)}`;
            if (error.message.includes('SAFETY') || error.message.includes('block_reason') || (error.cause as any)?.message?.includes('SAFETY')) {
              errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen konunuzu gözden geçirin. Model: ${finalModelToUseForText}. Detay: ${error.message.substring(0, 150)}`;
            } else if (error.message.includes('400 Bad Request') && (error.message.includes('generationConfig') || error.message.includes('generation_config'))) {
               errorMessage = `Seçilen model (${finalModelToUseForText}) bazı yapılandırma ayarlarını desteklemiyor olabilir. Detay: ${error.message.substring(0,150)}`;
            } else if (error.message.includes('Handlebars')) {
               errorMessage = `AI şablonunda bir hata oluştu. Geliştiriciye bildirin. Model: ${finalModelToUseForText}. Detay: ${error.message.substring(0,150)}`;
            } else if (error.name === 'GenkitError' && error.message.includes('Schema validation failed')) {
               errorMessage = `AI modeli (${finalModelToUseForText}) beklenen yanıt şemasına uymayan bir çıktı üretti. Detay: ${error.message.substring(0,250)}`;
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
