
'use server';
/**
 * @fileOverview Kullanıcının YKS hedeflerine, seçtiği alana (EA, Sayısal, Sözel, TYT),
 * girdiği özel konulara, çalışma süresine ve isteğe bağlı PDF bağlamına göre
 * kişiselleştirilmiş bir çalışma planı taslağı oluşturan AI aracı.
 *
 * - generateStudyPlan - Çalışma planı oluşturma işlemini yöneten fonksiyon.
 * - GenerateStudyPlanInput - generateStudyPlan fonksiyonu için giriş tipi.
 * - GenerateStudyPlanOutput - generateStudyPlan fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// TYT ve AYT Konu Listeleri
const yksTopics = {
  tyt: {
    turkce: ["Sözcükte Anlam", "Cümlede Anlam", "Paragraf", "Ses Bilgisi", "Dil Bilgisi Genel", "Anlatım Bozuklukları", "Yazım Kuralları", "Noktalama İşaretleri"],
    matematik: ["Temel Kavramlar", "Sayılar", "Bölme-Bölünebilme", "OBEB-OKEK", "Rasyonel Sayılar", "Basit Eşitsizlikler", "Mutlak Değer", "Üslü Sayılar", "Köklü Sayılar", "Çarpanlara Ayırma", "Problemler", "Kümeler", "Mantık", "Olasılık"],
    geometri: ["Doğruda Açılar", "Üçgende Açılar", "Çokgenler", "Dörtgenler", "Çember ve Daire", "Katı Cisimler", "Analitik Geometri Temel"],
    fizik: ["Fizik Bilimine Giriş", "Madde ve Özellikleri", "Hareket ve Kuvvet", "Enerji", "Isı ve Sıcaklık", "Elektrostatik"],
    kimya: ["Kimya Bilimi", "Atom ve Periyodik Sistem", "Kimyasal Türler Arası Etkileşim", "Maddenin Halleri", "Doğa ve Kimya"],
    biyoloji: ["Biyoloji Bilimi", "Canlıların Yapısında Bulunan Bileşikler", "Hücre", "Canlıların Sınıflandırılması"],
    tarih: ["Tarih ve Zaman", "İlk Uygarlıklar", "İslamiyet Öncesi Türk Tarihi", "İslam Tarihi", "Türk-İslam Devletleri", "Osmanlı (Kuruluş-Yükselme)"],
    cografya: ["Doğa ve İnsan", "Coğrafi Konum", "Harita Bilgisi", "Atmosfer ve İklim", "Yer Şekilleri", "Nüfus ve Yerleşme"],
    felsefe: ["Felsefenin Konusu", "Bilgi Felsefesi", "Varlık Felsefesi", "Ahlak Felsefesi"],
    dinKulturu: ["İslam'da İnanç Esasları", "İbadetler", "Ahlak", "Hz. Muhammed'in Hayatı"]
  },
  ayt: {
    turkDiliEdebiyati: ["Anlam Bilgisi (AYT)", "Dil Bilgisi (AYT)", "Şiir Bilgisi", "Edebi Akımlar", "Divan Edebiyatı", "Halk Edebiyatı", "Tanzimat Edebiyatı", "Servetifünun Edebiyatı", "Milli Edebiyat", "Cumhuriyet Edebiyatı"],
    matematik: ["Fonksiyonlar", "Polinomlar", "2. Dereceden Denklemler", "Karmaşık Sayılar", "Trigonometri", "Logaritma", "Diziler", "Limit ve Süreklilik", "Türev", "İntegral"],
    geometri: ["Üçgenler (AYT)", "Çokgenler ve Dörtgenler (AYT)", "Çember ve Daire (AYT)", "Analitik Geometri (İleri)"],
    fizik: ["Vektörler", "Kuvvet ve Hareket (Newton)", "Elektrik ve Manyetizma (AYT)", "Dalgalar (AYT)", "Optik (AYT)", "Modern Fizik"],
    kimya: ["Modern Atom Teorisi", "Gazlar", "Çözeltiler", "Kimyasal Tepkimelerde Enerji", "Hız", "Denge", "Asit-Baz Dengesi", "Elektrokimya", "Organik Kimya"],
    biyoloji: ["Sistemler (Destek-Hareket, Dolaşım, Solunum, Sindirim, Boşaltım, Sinir, Endokrin)", "Üreme ve Gelişme", "Kalıtım", "Ekosistem"],
    tarih: ["Osmanlı (Kültür, Siyasi Gelişmeler)", "Kurtuluş Savaşı", "Atatürk İlkeleri", "Türkiye’nin Dış Politikası"],
    cografya: ["Türkiye’nin Yer Şekilleri ve İklimi", "Türkiye Nüfusu ve Ekonomisi", "Doğal Afetler", "Ekosistem (AYT)"],
    felsefeGrubu: {
      felsefe: ["Bilgi Felsefesi (AYT)", "Varlık Felsefesi (AYT)", "Ahlak Felsefesi (AYT)", "Bilim Felsefesi"],
      psikoloji: ["Psikolojinin Temel Süreçleri", "Öğrenme Psikolojisi"],
      sosyoloji: ["Sosyolojiye Giriş", "Toplumsal Yapı"],
      mantik: ["Mantığa Giriş", "Klasik Mantık"]
    }
  }
};

function getSubjectsForField(field?: "ea" | "sayisal" | "sozel" | "tyt"): string {
  if (!field || field === "tyt") {
      const allTytSubjects = Object.entries(yksTopics.tyt).map(([ders, konular]) => `${ders.charAt(0).toUpperCase() + ders.slice(1)} (TYT: ${konular.slice(0,2).join(', ')}...)`);
      return "TYT Tüm Dersler: " + allTytSubjects.join(", ");
  }

  let subjects: string[] = [];
  const addTytCourses = (includeMathGeo: boolean = true, includeFenSos: boolean = true) => {
    subjects.push("TYT Türkçe (" + yksTopics.tyt.turkce.slice(0, 2).join(', ') + "...)");
    if (includeMathGeo) {
      subjects.push("TYT Matematik (" + yksTopics.tyt.matematik.slice(0, 2).join(', ') + "...)");
      subjects.push("TYT Geometri (" + yksTopics.tyt.geometri.slice(0, 2).join(', ') + "...)");
    }
    if (includeFenSos) {
      subjects.push("TYT Fizik (" + yksTopics.tyt.fizik.slice(0, 1).join(', ') + "...)");
      subjects.push("TYT Kimya (" + yksTopics.tyt.kimya.slice(0, 1).join(', ') + "...)");
      subjects.push("TYT Biyoloji (" + yksTopics.tyt.biyoloji.slice(0, 1).join(', ') + "...)");
      subjects.push("TYT Tarih (" + yksTopics.tyt.tarih.slice(0, 1).join(', ') + "...)");
      subjects.push("TYT Coğrafya (" + yksTopics.tyt.cografya.slice(0, 1).join(', ') + "...)");
      subjects.push("TYT Felsefe (" + yksTopics.tyt.felsefe.slice(0, 1).join(', ') + "...)");
      subjects.push("TYT Din Kültürü");
    }
  };

  switch (field) {
    case "sayisal":
      addTytCourses();
      subjects.push("AYT Matematik (" + yksTopics.ayt.matematik.slice(0, 2).join(', ') + "...)");
      subjects.push("AYT Geometri (" + yksTopics.ayt.geometri.slice(0, 1).join(', ') + "...)");
      subjects.push("AYT Fizik (" + yksTopics.ayt.fizik.slice(0, 1).join(', ') + "...)");
      subjects.push("AYT Kimya (" + yksTopics.ayt.kimya.slice(0, 1).join(', ') + "...)");
      subjects.push("AYT Biyoloji (" + yksTopics.ayt.biyoloji.slice(0, 1).join(', ') + "...)");
      break;
    case "ea":
      addTytCourses(true, false); 
      subjects.push("TYT Sosyal Bilimler (Tarih, Coğrafya, Felsefe, Din K.)");
      subjects.push("AYT Matematik (" + yksTopics.ayt.matematik.slice(0, 2).join(', ') + "...)");
      subjects.push("AYT Geometri (" + yksTopics.ayt.geometri.slice(0, 1).join(', ') + "...)");
      subjects.push("AYT Türk Dili ve Edebiyatı (" + yksTopics.ayt.turkDiliEdebiyati.slice(0, 2).join(', ') + "...)");
      subjects.push("AYT Tarih-1 (" + yksTopics.ayt.tarih.slice(0, 1).join(', ') + "...)");
      subjects.push("AYT Coğrafya-1 (" + yksTopics.ayt.cografya.slice(0, 1).join(', ') + "...)");
      break;
    case "sozel":
      addTytCourses(false, true); 
      subjects.push("TYT Matematik (Temel Düzey)");
      subjects.push("AYT Türk Dili ve Edebiyatı (" + yksTopics.ayt.turkDiliEdebiyati.slice(0, 2).join(', ') + "...)");
      subjects.push("AYT Tarih-1 ve Tarih-2 (" + yksTopics.ayt.tarih.slice(0, 2).join(', ') + "...)");
      subjects.push("AYT Coğrafya-1 ve Coğrafya-2 (" + yksTopics.ayt.cografya.slice(0, 2).join(', ') + "...)");
      subjects.push("AYT Felsefe Grubu");
      subjects.push("AYT Din Kültürü ve Ahlak Bilgisi");
      break;
  }
  return subjects.join(", ");
}


const GenerateStudyPlanInputSchema = z.object({
  userField: z.enum(["ea", "sayisal", "sozel", "tyt"]).optional().describe("Kullanıcının YKS alanı (Eşit Ağırlık, Sayısal, Sözel, Sadece TYT). Boş bırakılırsa ve özel konu girilmemişse genel YKS planı istenir."),
  customSubjectsInput: z.string().optional().describe("Kullanıcının odaklanmak istediği özel konular veya dersler. Bu alan doluysa, yukarıdaki 'userField' seçimi yerine bu konular önceliklendirilir."),
  studyDuration: z.string().describe("Toplam çalışma süresi (örn: '4_hafta', '3_ay', '6_ay')."),
  hoursPerDay: z.number().min(1).max(12).describe("Günlük ortalama çalışma saati."),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı."),
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi."),
  pdfContextText: z.string().optional().describe("Kullanıcının yüklediği PDF'ten çıkarılan, çalışma planı oluşturulurken ek bağlam olarak kullanılacak metin."),
});
export type GenerateStudyPlanInput = z.infer<typeof GenerateStudyPlanInputSchema>;

const DailyTaskSchema = z.object({
    day: z.string().describe("Haftanın günü veya planın belirli bir günü (örn: Pazartesi, 1. Gün)."),
    focusTopics: z.array(z.string()).describe("O gün odaklanılacak ana konular veya dersler."),
    estimatedTime: z.string().optional().describe("Her konu/ders için tahmini çalışma süresi."),
    activities: z.array(z.string()).optional().describe("Konu çalışma, soru çözümü, tekrar gibi aktiviteler."),
    notes: z.string().optional().describe("O güne özel ek notlar veya ipuçları.")
});

const WeeklyPlanSchema = z.object({
    week: z.number().describe("Planın kaçıncı haftası olduğu. Bu alan HER ZAMAN ZORUNLUDUR ve her haftalık plan objesinde bir SAYI olarak bulunmalıdır."),
    weeklyGoal: z.string().optional().describe("O haftanın genel çalışma hedefi veya odak noktası."),
    dailyTasks: z.array(DailyTaskSchema).describe("Haftanın günlerine yayılmış günlük görevler ve konular.")
});

const GenerateStudyPlanOutputSchema = z.object({
  planTitle: z.string().describe("Oluşturulan çalışma planı için bir başlık."),
  introduction: z.string().optional().describe("Plana genel bir giriş ve motivasyon mesajı."),
  weeklyPlans: z.array(WeeklyPlanSchema).describe("Haftalık olarak düzenlenmiş çalışma planı. Her bir haftalık plan objesi MUTLAKA 'week' (hafta numarası, SAYI olarak) alanını İÇERMELİDİR."),
  generalTips: z.array(z.string()).optional().describe("Genel çalışma stratejileri ve YKS için ipuçları."),
  disclaimer: z.string().default("Bu, yapay zeka tarafından oluşturulmuş bir taslak plandır. Kendi öğrenme hızınıza ve ihtiyaçlarınıza göre uyarlamanız önemlidir.").describe("Planın bir taslak olduğuna dair uyarı.")
});
export type GenerateStudyPlanOutput = z.infer<typeof GenerateStudyPlanOutputSchema>;

export async function generateStudyPlan(input: GenerateStudyPlanInput): Promise<GenerateStudyPlanOutput> {
  const isProUser = input.userPlan === 'pro';
  const isCustomModelSelected = !!input.customModelIdentifier;
  const isGemini25PreviewSelected = input.customModelIdentifier === 'experimental_gemini_2_5_flash_preview';
  
  let subjectsToFocus: string;
  if (input.customSubjectsInput && input.customSubjectsInput.trim() !== "") {
    subjectsToFocus = input.customSubjectsInput.trim();
  } else if (input.userField) {
    subjectsToFocus = getSubjectsForField(input.userField);
  } else {
    subjectsToFocus = "Genel YKS konuları (TYT ve AYT tüm dersler)";
  }

  const enrichedInputForPrompt = { // Renamed to avoid conflict with the flow function input
    ...input,
    subjects: subjectsToFocus, 
    isProUser,
    isCustomModelSelected,
    isGemini25PreviewSelected,
  };
  
  let flowOutput: GenerateStudyPlanOutput;
  try {
    flowOutput = await studyPlanGeneratorFlow(enrichedInputForPrompt); // Pass the enriched input for the prompt
  } catch (error) {
    console.error("[generateStudyPlan Wrapper] Error calling studyPlanGeneratorFlow:", error);
    return {
        planTitle: "Plan Oluşturma Hatası",
        introduction: "Çalışma planı oluşturulurken beklenmedik bir sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.",
        weeklyPlans: [],
        generalTips: ["Girdilerinizi kontrol edin.", "Tekrar deneyin."],
        disclaimer: "Bir hata nedeniyle plan oluşturulamadı."
    };
  }

  // Ensure every weekly plan has a 'week' number (redundant if AI behaves, but good fallback)
  if (flowOutput && Array.isArray(flowOutput.weeklyPlans)) {
      flowOutput.weeklyPlans.forEach((plan: any, index) => { 
          if (plan && (typeof plan.week !== 'number' || isNaN(plan.week))) {
              console.warn(`Study Plan Generator (Wrapper): AI output for weeklyPlans[${index}] is missing or has an invalid 'week' number. Assigning index+1. Original plan object:`, JSON.stringify(plan).substring(0, 200));
              plan.week = index + 1; 
          }
      });
  } else if (flowOutput) {
      console.warn("Study Plan Generator (Wrapper): AI output for weeklyPlans is not an array or is missing. Defaulting to empty array.");
      flowOutput.weeklyPlans = [];
      if (!flowOutput.planTitle) {
          flowOutput.planTitle = "Hata: Haftalık Planlar Oluşturulamadı";
      }
      if (!flowOutput.introduction) {
          flowOutput.introduction = "AI modeli, haftalık planları beklenen formatta oluşturamadı. Lütfen girdilerinizi kontrol edin veya daha sonra tekrar deneyin.";
      }
  }
  return flowOutput;
}

const studyPlanGeneratorPrompt = ai.definePrompt({
  name: 'studyPlanGeneratorPrompt',
  input: {schema: GenerateStudyPlanInputSchema.extend({
    subjects: z.string().optional().describe("Çalışılması planlanan dersler ve ana konular."),
    isProUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
  })},
  output: {schema: GenerateStudyPlanOutputSchema},
  prompt: `Sen, YKS öğrencilerine yönelik, onların girdilerine göre kişiselleştirilmiş, haftalık ve günlük bazda yapılandırılmış, gerçekçi ve motive edici YKS çalışma planları tasarlayan uzman bir AI eğitim koçusun. Cevapların daima Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}(Pro Kullanıcı Notu: Planı, farklı öğrenme teknikleri ve genel kaynak önerileriyle zenginleştir. Kapsamlı ve stratejik bir plan oluştur.){{/if}}
{{#if isCustomModelSelected}}(Admin Notu: '{{{customModelIdentifier}}}' modeli kullanılıyor.{{#if isGemini25PreviewSelected}} (Gemini 2.5 Flash Preview Özel Notu: Yanıtlarını ÖZ ama ANLAŞILIR tut. HIZLI yanıtla.){{/if}}){{/if}}

Öğrencinin Girdileri:
YKS Alanı (Seçildiyse): {{{userField}}}
Çalışılacak Ana Dersler/Konular (Bu listeye göre planı oluştur): {{{subjects}}}
Toplam Çalışma Süresi: {{{studyDuration}}}
Günlük Ortalama Çalışma Saati: {{{hoursPerDay}}}
{{#if pdfContextText}}Ek Bağlam (PDF'ten): {{{pdfContextText}}} (Bu metni, öğrencinin odaklanmak istediği konuları belirlerken dikkate al.)
{{/if}}

Lütfen bu bilgilere göre, aşağıdaki formatta bir çalışma planı taslağı oluştur. Çıktı, JSON şemasına HARFİYEN uymalıdır. Özellikle 'weeklyPlans' dizisindeki HER BİR obje, MUTLAKA 'week' (hafta numarası, SAYI olarak) alanını İÇERMELİDİR.

1.  **Plan Başlığı (planTitle)**: Örneğin, "Kişiye Özel {{{userField}}} Hazırlık Planı ({{{studyDuration}}})". Bu alan ZORUNLUDUR.
2.  **Giriş (introduction) (isteğe bağlı)**: Öğrenciyi motive eden, planın genel mantığını açıklayan kısa bir giriş.
3.  **Haftalık Planlar (weeklyPlans)**: ÇOK ÖNEMLİ: Bu dizideki HER BİR obje, MUTLAKA 'week' adında bir SAYI (number) tipinde alana sahip olmalıdır.
    *   **Hafta Numarası (week)**: Örneğin, 1, 2, 3... BU ALAN HER HAFTALIK PLAN OBJESİNDE ZORUNLUDUR VE SAYI OLMALIDIR.
    *   **Haftalık Hedef (weeklyGoal) (isteğe bağlı)**: O haftanın ana odak noktası.
    *   **Günlük Görevler (dailyTasks)**: Haftanın her günü için:
        *   **Gün (day)**: Günün adı. ZORUNLUDUR.
        *   **Odak Konular (focusTopics)**: O gün çalışılacak ana konular/dersler. ZORUNLUDUR.
        *   **Tahmini Süre (estimatedTime) (isteğe bağlı)**: Her odak konuya ayrılacak süre.
        *   **Aktiviteler (activities) (isteğe bağlı)**: "Konu anlatımı", "{{{hoursPerDay}}} soru çözümü", "Tekrar" gibi görevler.
        *   **Notlar (notes) (isteğe bağlı)**: O güne özel motivasyon, mola önerisi veya ipucu.
    Bu 'weeklyPlans' dizisi ZORUNLUDUR ve her elemanın şemaya uyduğundan, özellikle 'week' alanının bir SAYI olduğundan emin ol.
4.  **Genel İpuçları (generalTips) (isteğe bağlı)**: Zaman yönetimi, verimli ders çalışma teknikleri gibi genel YKS önerileri.
5.  **Sorumluluk Reddi (disclaimer)**: Standart uyarı metni.

Planlama İlkeleri:
*   Verilen {{{userField}}} ve/veya {{{subjects}}} listesine göre, {{{studyDuration}}} süresince, günde ortalama {{{hoursPerDay}}} saat çalışmayı dikkate alarak mantıklı bir plan oluştur.
*   Konuların zorluk seviyelerine ve bağlantılarına dikkat et. Tekrar ve soru çözümünü dahil et.
*   Gerçekçi ve uygulanabilir bir plan sun. Süre çok kısaysa veya konu sayısı çok fazlaysa, bu durumu nazikçe belirt ve planı en iyi şekilde optimize etmeye çalış veya daha odaklı bir plan öner.
*   Şemadaki 'required' olarak işaretlenmiş tüm alanların çıktıda bulunduğundan emin ol. Özellikle 'weeklyPlans' içindeki her bir haftanın 'week' numarası MUTLAKA belirtilmelidir ve bir SAYI olmalıdır.
`,
});

const studyPlanGeneratorFlow = ai.defineFlow(
  {
    name: 'studyPlanGeneratorFlow',
    inputSchema: GenerateStudyPlanInputSchema.extend({ 
        subjects: z.string().optional(),
        isProUser: z.boolean().optional(),
        isCustomModelSelected: z.boolean().optional(),
        isGemini25PreviewSelected: z.boolean().optional(),
    }),
    outputSchema: GenerateStudyPlanOutputSchema,
  },
  async (input: z.infer<typeof GenerateStudyPlanInputSchema> & {subjects?: string; isProUser?: boolean; isCustomModelSelected?: boolean; isGemini25PreviewSelected?: boolean} ): Promise<GenerateStudyPlanOutput> => {
    let modelToUse = 'googleai/gemini-1.5-flash-latest'; 
    let callOptions: { model: string; config?: Record<string, any> } = { model: modelToUse };

    if (input.customModelIdentifier) {
      switch (input.customModelIdentifier) {
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
          console.warn(`[Study Plan Generator Flow] Unknown customModelIdentifier: ${input.customModelIdentifier}. Defaulting to ${modelToUse}`);
      }
    } else if (input.isProUser) { 
      modelToUse = 'googleai/gemini-1.5-flash-latest';
    }
    
    callOptions.model = modelToUse;

    if (modelToUse !== 'googleai/gemini-2.5-flash-preview-04-17') {
      callOptions.config = {
        generationConfig: {
          maxOutputTokens: 8000, 
        }
      };
    } else {
        callOptions.config = {}; 
    }
    
    console.log(`[Study Plan Generator Flow] Using model: ${modelToUse} for plan: ${input.userPlan}, customModel: ${input.customModelIdentifier}, PDF context provided: ${!!input.pdfContextText}, User Field: ${input.userField}, Subjects sent to AI: ${input.subjects}`);
    
    let output: GenerateStudyPlanOutput | undefined;
    try {
        // CORRECTED: Call studyPlanGeneratorPrompt instead of prompt
        const result = await studyPlanGeneratorPrompt(input, callOptions); 
        output = result.output;

        if (!output || !output.weeklyPlans) {
            console.error("Study Plan Generator: AI output is missing weeklyPlans or output is null. Input:", JSON.stringify(input).substring(0, 200), "Raw Output:", JSON.stringify(output).substring(0,300));
            throw new Error("AI Eğitim Koçu, belirtilen girdilerle bir çalışma planı oluşturamadı. Lütfen bilgilerinizi kontrol edin.");
        }
        
        // Ensure every weekly plan has a 'week' number
        if (Array.isArray(output.weeklyPlans)) {
            output.weeklyPlans.forEach((plan: any, index) => { 
                if (plan && (typeof plan.week !== 'number' || isNaN(plan.week))) { // Check if week is not a number or NaN
                    console.warn(`Study Plan Generator Flow (Post-processing): AI output for weeklyPlans[${index}] is missing or has an invalid 'week' number. Assigning index+1. Original plan object:`, JSON.stringify(plan).substring(0, 200));
                    plan.week = index + 1; 
                }
            });
        } else {
            console.error("Study Plan Generator: AI output for weeklyPlans is not an array. Defaulting to empty. Input:", JSON.stringify(input).substring(0, 200), "Raw Output:", JSON.stringify(output).substring(0,300));
            output.weeklyPlans = []; 
        }

        return output as GenerateStudyPlanOutput; 
    } catch (error: any) {
        console.error(`[Study Plan Generator Flow] Error during generation with model ${modelToUse}:`, error);
        let errorMessage = `AI modeli (${modelToUse}) ile çalışma planı oluşturulurken bir hata oluştu.`;
        if (error.message) {
            if (error.name === 'GenkitError' && error.details && Array.isArray(error.details)) {
                const validationErrors = error.details.map((detail: any) => detail.message || JSON.stringify(detail)).join('; ');
                errorMessage += ` Şema Doğrulama Hatası: ${validationErrors.substring(0, 300)}`;
            } else {
                 errorMessage += ` Detay: ${error.message.substring(0, 200)}`;
            }
            if (error.message.includes('SAFETY') || error.message.includes('block_reason')) {
              errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen girdilerinizi gözden geçirin. Model: ${modelToUse}. Detay: ${error.message.substring(0, 150)}`;
            }
        }
        
        return {
            planTitle: `Hata: ${errorMessage}`,
            weeklyPlans: [],
            introduction: "Bir hata nedeniyle plan oluşturulamadı.",
            generalTips: [],
            disclaimer: "Lütfen girdilerinizi kontrol edin veya daha sonra tekrar deneyin."
        };
    }
  }
);

    