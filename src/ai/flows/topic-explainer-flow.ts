
'use server';
/**
 * @fileOverview Kullanıcının girdiği bir YKS konusunu derinlemesine açıklayan,
 * anahtar kavramları, YKS için stratejik bilgileri ve aktif hatırlama soruları sunan uzman bir AI YKS öğretmeni.
 *
 * - explainTopic - Konu açıklama işlemini yöneten fonksiyon.
 * - ExplainTopicInput - explainTopic fonksiyonu için giriş tipi.
 * - ExplainTopicOutput - explainTopic fonksiyonu için dönüş tipi.
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
  explanation: z.string().describe('Konunun, YKS öğrencisinin anlayışını en üst düzeye çıkaracak şekilde, AI tarafından oluşturulmuş, yapılandırılmış ve kapsamlı anlatımı. Anlatım, ana tanımları, temel ilkeleri, önemli alt başlıkları, örnekleri ve YKS\'de çıkabilecek bağlantıları içermelidir. Matematiksel ifadeler (örn: x^2, H_2O, √, π) metin içinde okunabilir şekilde belirtilmelidir.'),
  keyConcepts: z.array(z.string()).optional().describe('Anlatımda vurgulanan ve YKS için hayati öneme sahip 3-5 anahtar kavram veya terim.'),
  commonMistakes: z.array(z.string()).optional().describe("Öğrencilerin bu konuda sık yaptığı hatalar veya karıştırdığı noktalar."),
  yksTips: z.array(z.string()).optional().describe("Bu konunun YKS'deki önemi, hangi soru tiplerinde çıktığı ve çalışırken nelere dikkat edilmesi gerektiği hakkında 2-3 stratejik ipucu."),
  activeRecallQuestions: z.array(z.string()).optional().describe("Konuyu pekiştirmek ve öğrencinin aktif katılımını sağlamak için AI tarafından sorulan 2-3 çeşitli (kısa cevaplı, boşluk doldurma, doğru/yanlış vb.) ve doğrudan konuyla ilgili soru.")
});
export type ExplainTopicOutput = z.infer<typeof ExplainTopicOutputSchema>;

export async function explainTopic(input: ExplainTopicInput): Promise<ExplainTopicOutput> {
  const isProUser = input.userPlan === 'pro';
  const isCustomModelSelected = !!input.customModelIdentifier;
  const isGemini25PreviewSelected = input.customModelIdentifier === 'experimental_gemini_2_5_flash_preview';

  const enrichedInput = {
    ...input,
    isProUser,
    isCustomModelSelected,
    isGemini25PreviewSelected,
  };
  return topicExplainerFlow(enrichedInput);
}

const prompt = ai.definePrompt({
  name: 'topicExplainerPrompt',
  input: {schema: ExplainTopicInputSchema.extend({
    isProUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
  })},
  output: {schema: ExplainTopicOutputSchema},
  prompt: `Sen, Yükseköğretim Kurumları Sınavı (YKS) için öğrencilere en karmaşık konuları bile en anlaşılır, en akılda kalıcı ve en kapsamlı şekilde öğreten, pedagojik dehası ve alan hakimiyeti tartışılmaz, son derece deneyimli bir AI YKS Süper Öğretmenisin.
Görevin, öğrencinin belirttiği "{{{topicName}}}" konusunu, seçtiği "{{{explanationLevel}}}" detay seviyesine ve "{{{teacherPersona}}}" hoca tarzına uygun olarak, A'dan Z'ye, sanki özel ders veriyormuşçasına, adım adım, tüm önemli detaylarıyla ve YKS'de başarılı olması için gereken her türlü stratejik bilgiyle birlikte açıklamaktır.
Anlatımın sonunda, konuyu pekiştirmek için 2-3 adet çeşitli (kısa cevaplı, boşluk doldurma, doğru/yanlış vb.), doğrudan konuyla ilgili ve cevabı anlatımında bulunabilecek soru sorarak öğrencinin aktif katılımını sağla.
Matematiksel ifadeleri (örn: üslü ifadeler için x^2, alt indisler için H_2O, karekök için √, pi için π, artı-eksi için ±, küçük eşit için ≤, büyük eşit için ≥) metin içinde okunabilir şekilde belirtmeye özen göster.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: Anlatımını en üst düzeyde akademik zenginlikle, konunun felsefi temellerine, diğer disiplinlerle bağlantılarına ve YKS'deki en zorlayıcı soru tiplerine odaklanarak yap. {{{explanationLevel}}} seviyesini "detayli" kabul et ve buna ek olarak daha derinlemesine, analitik ve eleştirel düşünmeyi teşvik eden bir bakış açısı sun. Öğrencinin sadece bilgi edinmesini değil, aynı zamanda konuyu derinlemesine sorgulamasını ve analitik düşünme becerilerini geliştirmesini sağla. En gelişmiş AI yeteneklerini kullanarak, adeta bir başyapıt niteliğinde bir konu anlatımı sun. Seçilen hoca tarzını bu derinlikle birleştir.)
{{else ifEquals userPlan "premium"}} 
(Premium Kullanıcı Notu: {{{explanationLevel}}} seviyesine ve seçilen hoca tarzına uygun olarak, anlatımına daha fazla örnek, YKS'de çıkmış benzer sorulara atıflar ve konunun püf noktalarını içeren ekstra ipuçları ekle. Öğrencinin konuyu farklı açılardan görmesini sağla.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Bu çözüm, özel olarak seçilmiş '{{{customModelIdentifier}}}' modeli kullanılarak üretilmektedir.)
  {{#if isGemini25PreviewSelected}}
  (Gemini 2.5 Flash Preview Özel Notu: Yanıtlarını olabildiğince ÖZ ama ANLAŞILIR tut. HIZLI yanıt vermesi önemlidir.)
  {{/if}}
{{/if}}

Hoca Tarzı ({{{teacherPersona}}}):
{{#ifEquals teacherPersona "ozel"}}
  {{#if customPersonaDescription}}
Kullanıcının Tanımladığı Özel Kişilik: "{{{customPersonaDescription}}}"
Lütfen anlatımını bu özel tanıma göre, YKS uzmanlığını ve seçilen anlatım seviyesini koruyarak şekillendir. Kullanıcının istediği hoca gibi davran.
  {{else}}
(Özel kişilik tanımı boş, varsayılan samimi tarza geçiliyor.) Samimi ve Destekleyici Hoca Tarzı: Öğrenciyle empati kuran, onu motive eden, karmaşık konuları bile sabırla ve anlaşılır örneklerle açıklayan bir öğretmen gibi davran.
  {{/if}}
{{else ifEquals teacherPersona "samimi"}}
Samimi ve Destekleyici Hoca Tarzı: Öğrenciyle empati kuran, onu motive eden, karmaşık konuları bile sabırla ve anlaşılır örneklerle açıklayan bir öğretmen gibi davran. "Anladın mı canım?", "Bak şimdi burası çok önemli..." gibi samimi ifadeler kullanabilirsin.
{{else ifEquals teacherPersona "eglenceli"}}
Eğlenceli ve Motive Edici Hoca Tarzı: Konuyu esprili bir dille, ilginç benzetmelerle ve günlük hayattan örneklerle anlat. Öğrencinin dikkatini canlı tutacak, enerjik ve pozitif bir üslup kullan. "Bu konu roket bilimi değil, hadi halledelim!", "Bu formül adeta bir sihir gibi çalışıyor!" gibi ifadeler kullanabilirsin.
{{else ifEquals teacherPersona "ciddi"}}
Ciddi ve Odaklı Hoca Tarzı: Konuyu doğrudan, net ve akademik bir dille anlat. Gereksiz detaylardan ve konudan sapmalardan kaçın. Bilgiyi en saf ve en doğru şekilde aktarmaya odaklan. Disiplinli ve resmi bir üslup kullan.
{{/if}}

Anlatım Seviyesi ve İçeriği ({{{explanationLevel}}}):
*   'temel': Konunun sadece en temel kavramlarını, ana tanımlarını ve en basit düzeyde YKS için ne ifade ettiğini açıkla. Çok fazla detaya girme.
*   'orta': Konunun temel tanımlarının yanı sıra, önemli alt başlıklarını, YKS'deki ortalama önemini, birkaç temel örnek ve yaygın YKS soru tiplerine basit değinilerle açıkla.
*   'detayli': Konunun tüm yönlerini, derinlemesine alt başlıklarını, karmaşık örneklerini, diğer konularla bağlantılarını, YKS'deki tüm potansiyel soru tiplerini ve çözüm stratejilerini kapsamlı bir şekilde ele al.

Konu: {{{topicName}}}

Lütfen bu konuyu aşağıdaki format ve prensiplere uygun olarak, seçilen "{{{explanationLevel}}}" detay seviyesini, "{{{teacherPersona}}}" hoca tarzını ve YKS öğrencisinin ihtiyaçlarını gözeterek detaylıca açıkla:

1.  **Anlatım Başlığı (explanationTitle)**: Konuyla ilgili ilgi çekici ve açıklayıcı bir başlık. Örneğin, "{{{topicName}}} - {{{explanationLevel}}} Seviye YKS Konu Anlatımı ({{{teacherPersona}}} Tarzı)".
2.  **Kapsamlı Konu Anlatımı (explanation)**:
    *   **Giriş**: Konunun YKS müfredatındaki yeri, önemi ve genel bir tanıtımı (seviyeye ve tarza uygun).
    *   **Temel Tanımlar ve İlkeler**: Konuyla ilgili bilinmesi gereken tüm temel tanımları, formülleri, kuralları veya prensipleri açık ve net bir dille ifade et (seviyeye ve tarza uygun). Matematiksel gösterimleri (x^2, H_2O, √, π, ±, ≤, ≥) kullan.
    *   **Alt Başlıklar ve Detaylar**: Konuyu mantıksal alt başlıklara ayırarak her birini detaylı bir şekilde, bol örnekle (seviyeye ve tarza uygun) ve YKS'de çıkabilecek noktaları vurgulayarak açıkla.
    *   **Örnekler ve Uygulamalar**: Konuyu somutlaştırmak için YKS düzeyine uygun, seçilen "{{{explanationLevel}}}" seviyesine göre çeşitlenen zorlukta örnekler ver.
    *   **Bağlantılar (özellikle 'detayli' seviyede)**: Konunun diğer YKS konularıyla (varsa) nasıl ilişkili olduğunu belirt.
    *   **Sonuç/Özet**: Anlatımın sonunda konunun ana hatlarını kısaca özetle (seviyeye ve tarza uygun).
3.  **Anahtar Kavramlar (keyConcepts) (isteğe bağlı, seviyeye göre)**: Konuyla ilgili en az 3-5 adet YKS için kritik öneme sahip anahtar kavramı veya terimi listele. Her birini kısaca açıkla. 'Temel' seviyede daha az ve basit kavramlar olabilir.
4.  **Sık Yapılan Hatalar (commonMistakes) (isteğe bağlı, 'orta' ve 'detayli' seviyede)**: Öğrencilerin bu konuyla ilgili sınavlarda veya öğrenme sürecinde en sık yaptığı 2-3 hatayı ve bu hatalardan nasıl kaçınılacağını belirt.
5.  **YKS İpuçları ve Stratejileri (yksTips) (isteğe bağlı, seviyeye göre)**: Bu konudan YKS'de nasıl sorular gelebileceği, çalışırken nelere öncelik verilmesi gerektiği gibi 2-3 stratejik ipucu ver. 'Temel' seviyede çok genel, 'detayli' seviyede daha spesifik olabilir.
6.  **Aktif Hatırlama Soruları (activeRecallQuestions)**: Anlatımın sonunda, konuyu pekiştirmek ve öğrencinin aktif katılımını sağlamak için **2-3 adet çeşitli (kısa cevaplı, boşluk doldurma, doğru/yanlış vb.)**, doğrudan konuyla ilgili ve cevabı anlatımın içinde bulunabilecek soru sor. Bu sorular öğrencinin konuyu anlayıp anlamadığını test etmelidir.

Anlatım Tarzı:
*   Seçilen "{{{teacherPersona}}}" hoca tarzına ve (eğer varsa) "{{{customPersonaDescription}}}" tanımına harfiyen uy.
*   Son derece akıcı, anlaşılır ve öğrenciyi sıkmayan bir dil kullan.
*   Karmaşık ifadelerden kaçın veya seçilen "{{{explanationLevel}}}" seviyesine uygun şekilde mutlaka açıkla.
*   Öğrenciyi motive edici ve konuyu sevdiren bir üslup benimse.
*   YKS terminolojisine hakim ol ve doğru kullan.
*   Bilgilerin doğruluğundan ve güncelliğinden emin ol.
`,
});

const topicExplainerFlow = ai.defineFlow(
  {
    name: 'topicExplainerFlow',
    inputSchema: ExplainTopicInputSchema.extend({ 
        isProUser: z.boolean().optional(),
        isCustomModelSelected: z.boolean().optional(),
        isGemini25PreviewSelected: z.boolean().optional(),
    }),
    outputSchema: ExplainTopicOutputSchema,
  },
  async (enrichedInput: ExplainTopicInput & {isProUser?: boolean; isCustomModelSelected?: boolean; isGemini25PreviewSelected?: boolean} ): Promise<ExplainTopicOutput> => {
    let modelToUse = 'googleai/gemini-1.5-flash-latest'; 
    let callOptions: { model: string; config?: Record<string, any> } = { model: modelToUse };

    if (enrichedInput.customModelIdentifier) {
      switch (enrichedInput.customModelIdentifier) {
        case 'default_gemini_flash':
          modelToUse = 'googleai/gemini-2.0-flash';
          break;
        case 'experimental_gemini_1_5_flash':
          modelToUse = 'googleai/gemini-1.5-flash-latest';
          break;
        case 'experimental_gemini_2_5_flash_preview':
          modelToUse = 'googleai/gemini-2.5-flash-preview-04-17';
          break;
        default:
          console.warn(`[Topic Explainer Flow] Unknown customModelIdentifier: ${enrichedInput.customModelIdentifier}. Defaulting to ${modelToUse}`);
      }
    } else if (enrichedInput.isProUser) { 
      modelToUse = 'googleai/gemini-1.5-flash-latest';
    }
    
    callOptions.model = modelToUse;
    
    if (modelToUse !== 'googleai/gemini-2.5-flash-preview-04-17') {
      callOptions.config = {
        generationConfig: {
          maxOutputTokens: enrichedInput.explanationLevel === 'detayli' ? 8000 : enrichedInput.explanationLevel === 'orta' ? 4096 : 2048,
        }
      };
    } else {
        callOptions.config = {}; 
    }

    console.log(`[Topic Explainer Flow] Using model: ${modelToUse} for plan: ${enrichedInput.userPlan}, customModel: ${enrichedInput.customModelIdentifier}, level: ${enrichedInput.explanationLevel}, persona: ${enrichedInput.teacherPersona}`);
    
    try {
        const {output} = await prompt(enrichedInput, callOptions); 
        if (!output || !output.explanation) {
        throw new Error("AI YKS Süper Öğretmeni, belirtilen konu için bir anlatım oluşturamadı. Lütfen konuyu ve ayarları kontrol edin.");
        }
        return output;
    } catch (error: any) {
        console.error(`[Topic Explainer Flow] Error during generation with model ${modelToUse}:`, error);
        let errorMessage = `AI modeli (${modelToUse}) ile konu anlatımı oluşturulurken bir hata oluştu.`;
        if (error.message) {
            errorMessage += ` Detay: ${error.message.substring(0, 200)}`;
             if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
              errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen konunuzu gözden geçirin. Model: ${modelToUse}. Detay: ${error.message.substring(0, 150)}`;
            }
        }
        
        return {
            explanationTitle: `Hata: ${errorMessage}`,
            explanation: "Bir hata nedeniyle konu anlatımı oluşturulamadı.",
            keyConcepts: [],
            commonMistakes: [],
            yksTips: [],
            activeRecallQuestions: []
        };
    }
  }
);

    