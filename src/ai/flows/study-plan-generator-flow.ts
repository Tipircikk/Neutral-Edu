
'use server';
/**
 * @fileOverview Kullanıcının YKS hedeflerine, seçtiği alana (EA, Sayısal, Sözel, TYT), konularına, çalışma süresine ve isteğe bağlı PDF bağlamına göre
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
    matematik: ["Temel Kavramlar", "Sayılar", "Bölme-Bölünebilme", "Asal Çarpanlar", "OBEB-OKEK", "Rasyonel Sayılar", "Basit Eşitsizlikler", "Mutlak Değer", "Üslü Sayılar", "Köklü Sayılar", "Çarpanlara Ayırma", "Denklem Çözme", "Oran-Orantı", "Problemler (Sayı, Kesir, Yaş, Yüzde, Kâr-Zarar, Faiz, Karışım, Hareket, Grafik)", "Kümeler", "Kartezyen Çarpım", "Mantık", "Sayma ve Olasılık", "Veri"],
    geometri: ["Doğruda Açılar", "Üçgende Açılar", "Açıortay-Kenarortay", "Üçgende Alan", "Üçgende Açı-Kenar Bağıntıları", "Dik Üçgen", "İkizkenar-Çeşitkenar Üçgen", "Benzerlik", "Pisagor", "Öklid", "Çokgenler", "Dörtgenler (Yamuk, Paralelkenar, Dikdörtgen, Kare, Deltoid)", "Çember ve Daire", "Katı Cisimler", "Koordinat Sistemi", "Analitik Geometri Temel"],
    fizik: ["Fizik Bilimine Giriş", "Madde ve Özellikleri", "Hareket ve Kuvvet", "Enerji", "Isı ve Sıcaklık", "Elektrostatik"],
    kimya: ["Kimya Bilimi", "Atom ve Periyodik Sistem", "Kimyasal Türler Arası Etkileşim", "Maddenin Halleri", "Doğa ve Kimya", "Kimyanın Temel Kanunları"],
    biyoloji: ["Biyoloji Bilimi", "Canlıların Yapısında Bulunan Bileşikler", "Hücre", "Canlıların Temel Bileşenleri", "Hücre Zarından Madde Geçişi", "Canlıların Sınıflandırılması"],
    tarih: ["Tarih ve Zaman", "İlk Uygarlıklar", "İslamiyet Öncesi Türk Tarihi", "İslam Tarihi ve Uygarlığı", "Türk-İslam Devletleri", "Türkiye Tarihi (Beylikten Devlete, Dünya Gücü Osmanlı)"],
    cografya: ["Coğrafya: Doğa ve İnsan", "Coğrafi Konum", "Harita Bilgisi", "Atmosfer ve İklim", "Yer Şekilleri", "Beşeri Coğrafya", "Nüfus ve Yerleşme"],
    felsefe: ["Felsefenin Konusu", "Bilgi Felsefesi", "Varlık Felsefesi", "Ahlak Felsefesi", "Sanat Felsefesi", "Din Felsefesi", "Siyaset Felsefesi"],
    dinKulturu: ["İslam'da İnanç Esasları", "İbadetler", "Ahlak", "Hz. Muhammed'in Hayatı", "İslam Düşüncesinde Yorumlar", "Dinler Tarihi (Kısaca)"]
  },
  ayt: {
    turkDiliEdebiyati: ["Anlam Bilgisi (AYT)", "Dil Bilgisi (AYT)", "Edebiyatın Tarihi Gelişimi", "Şiir Bilgisi", "Nazım Biçimleri", "Düz Yazı Türleri", "İslamiyet Öncesi Türk Edebiyatı", "Divan Edebiyatı", "Halk Edebiyatı", "Tanzimat Edebiyatı", "Servetifünun Edebiyatı", "Fecriati Edebiyatı", "Milli Edebiyat", "Cumhuriyet Edebiyatı", "Dünya Edebiyatı"],
    matematik: ["Fonksiyonlar (İleri Düzey)", "Polinomlar", "2. Dereceden Denklemler", "Karmaşık Sayılar", "Binom", "Permütasyon ve Kombinasyon", "Olasılık (AYT)", "Trigonometri", "Logaritma", "Diziler", "Limit ve Süreklilik", "Türev", "İntegral"],
    geometri: ["Üçgenler (AYT Detay)", "Çokgenler ve Dörtgenler (AYT Detay)", "Çember ve Daire (AYT Detay)", "Analitik Geometri (İleri Düzey)", "Katı Cisimler (AYT Detay)"],
    fizik: ["Vektörler", "Kuvvet ve Hareket (Newton, İş-Güç-Enerji, Atışlar)", "Elektrik ve Manyetizma (AYT)", "Dalgalar (AYT)", "Optik (AYT)", "Atom Fiziği ve Modern Fizik"],
    kimya: ["Atomun Yapısı (Modern)", "Periyodik Sistem (AYT)", "Kimyasal Türler Arası Etkileşim (AYT)", "Kimyasal Hesaplamalar (AYT)", "Gazlar", "Çözeltiler", "Kimyasal Tepkimelerde Enerji", "Tepkimelerde Hız", "Kimyasal Denge", "Asit-Baz Dengesi", "Elektrokimya", "Organik Kimya"],
    biyoloji: ["Hücre (AYT Detay)", "Canlıların Sınıflandırılması (AYT Detay)", "Sistemler (Destek-Hareket, Dolaşım, Solunum, Sindirim, Boşaltım, Sinir, Endokrin)", "Duyu Organları", "Üreme ve Gelişme", "Kalıtım (İleri Düzey)", "Biyoteknoloji", "Ekosistem Ekolojisi", "Canlılar ve Çevre"],
    tarih: ["Tarih Bilimi (AYT)", "İlk ve Orta Çağlarda Türkler (AYT)", "Osmanlı Kültür ve Medeniyeti", "Osmanlı Siyasi Gelişmeleri (Yükselme, Duraklama, Gerileme, Dağılma)", "19. Yüzyılda Osmanlı", "Kurtuluş Savaşı (Hazırlık, Cepheler)", "Cumhuriyetin İlanı ve Atatürk İlkeleri", "Çok Partili Hayat", "Türkiye’nin Dış Politikası"],
    cografya: ["Türkiye’nin Yer Şekilleri", "Türkiye İklimi", "Türkiye Nüfusu", "Türkiye'de Tarım ve Hayvancılık", "Türkiye'de Maden ve Enerji Kaynakları", "Türkiye'de Sanayi ve Ulaşım", "Türkiye'de Ticaret ve Turizm", "Türkiye'nin Bölgesel Kalkınma Projeleri", "Doğal Afetler ve Türkiye", "Ekosistem ve Biyoçeşitlilik (AYT)"],
    felsefeGrubu: {
      felsefe: ["Felsefeye Giriş (AYT)", "Bilgi Felsefesi (AYT)", "Varlık Felsefesi (AYT)", "Ahlak Felsefesi (AYT)", "Sanat Felsefesi (AYT)", "Din Felsefesi (AYT)", "Siyaset Felsefesi (AYT)", "Bilim Felsefesi"],
      psikoloji: ["Psikolojinin Temel Süreçleri", "Gelişim Psikolojisi", "Öğrenme Psikolojisi", "Ruh Sağlığı"],
      sosyoloji: ["Sosyolojiye Giriş", "Toplumsal Yapı", "Toplumsal Değişme ve Gelişme", "Kültür"],
      mantik: ["Mantığa Giriş", "Klasik Mantık", "Modern Mantık"]
    }
  }
};

function getSubjectsForField(field?: "ea" | "sayisal" | "sozel" | "tyt"): string {
  if (!field) return "Genel YKS Konuları (Tüm Dersler)";

  let subjects: string[] = [];
  const addTytCourses = (includeMathGeo: boolean = true, includeFenSos: boolean = true) => {
    subjects.push("TYT Türkçe (" + yksTopics.tyt.turkce.slice(0, 3).join(', ') + "...)");
    if (includeMathGeo) {
      subjects.push("TYT Matematik (" + yksTopics.tyt.matematik.slice(0, 3).join(', ') + "...)");
      subjects.push("TYT Geometri (" + yksTopics.tyt.geometri.slice(0, 2).join(', ') + "...)");
    }
    if (includeFenSos) {
      subjects.push("TYT Fizik (" + yksTopics.tyt.fizik.slice(0, 2).join(', ') + "...)");
      subjects.push("TYT Kimya (" + yksTopics.tyt.kimya.slice(0, 2).join(', ') + "...)");
      subjects.push("TYT Biyoloji (" + yksTopics.tyt.biyoloji.slice(0, 2).join(', ') + "...)");
      subjects.push("TYT Tarih (" + yksTopics.tyt.tarih.slice(0, 2).join(', ') + "...)");
      subjects.push("TYT Coğrafya (" + yksTopics.tyt.cografya.slice(0, 2).join(', ') + "...)");
      subjects.push("TYT Felsefe (" + yksTopics.tyt.felsefe.slice(0, 2).join(', ') + "...)");
      subjects.push("TYT Din Kültürü");
    }
  };

  switch (field) {
    case "sayisal":
      addTytCourses();
      subjects.push("AYT Matematik (" + yksTopics.ayt.matematik.slice(0, 3).join(', ') + "...)");
      subjects.push("AYT Geometri (" + yksTopics.ayt.geometri.slice(0, 2).join(', ') + "...)");
      subjects.push("AYT Fizik (" + yksTopics.ayt.fizik.slice(0, 2).join(', ') + "...)");
      subjects.push("AYT Kimya (" + yksTopics.ayt.kimya.slice(0, 2).join(', ') + "...)");
      subjects.push("AYT Biyoloji (" + yksTopics.ayt.biyoloji.slice(0, 2).join(', ') + "...)");
      break;
    case "ea":
      addTytCourses(true, false); // TYT Matematik ve Türkçe
      subjects.push("TYT Sosyal Bilimler (Tarih, Coğrafya, Felsefe, Din K.)"); // TYT Sosyal Bilimler özet
      subjects.push("AYT Matematik (" + yksTopics.ayt.matematik.slice(0, 3).join(', ') + "...)");
      subjects.push("AYT Geometri (" + yksTopics.ayt.geometri.slice(0, 2).join(', ') + "...)");
      subjects.push("AYT Türk Dili ve Edebiyatı (" + yksTopics.ayt.turkDiliEdebiyati.slice(0, 3).join(', ') + "...)");
      subjects.push("AYT Tarih-1 (" + yksTopics.ayt.tarih.slice(0, 2).join(', ') + "...)");
      subjects.push("AYT Coğrafya-1 (" + yksTopics.ayt.cografya.slice(0, 2).join(', ') + "...)");
      break;
    case "sozel":
      addTytCourses(false, true); // TYT Türkçe ve Sosyal + Din
      subjects.push("TYT Matematik (Temel Düzey)");
      subjects.push("AYT Türk Dili ve Edebiyatı (" + yksTopics.ayt.turkDiliEdebiyati.slice(0, 3).join(', ') + "...)");
      subjects.push("AYT Tarih-1 ve Tarih-2 (" + yksTopics.ayt.tarih.slice(0, 3).join(', ') + "...)");
      subjects.push("AYT Coğrafya-1 ve Coğrafya-2 (" + yksTopics.ayt.cografya.slice(0, 3).join(', ') + "...)");
      subjects.push("AYT Felsefe Grubu (Felsefe, Psikoloji, Sosyoloji, Mantık)");
      subjects.push("AYT Din Kültürü ve Ahlak Bilgisi");
      break;
    case "tyt":
      addTytCourses();
      break;
    default:
      return "Genel YKS Konuları (Tüm Dersler)";
  }
  return subjects.join(", ");
}


const GenerateStudyPlanInputSchema = z.object({
  userField: z.enum(["ea", "sayisal", "sozel", "tyt"]).optional().describe("Kullanıcının YKS alanı (Eşit Ağırlık, Sayısal, Sözel, Sadece TYT)."),
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
  planTitle: z.string().describe("Oluşturulan çalışma planı için bir başlık (örn: 'Kişiselleştirilmiş YKS Çalışma Planı')."),
  introduction: z.string().optional().describe("Plana genel bir giriş ve motivasyon mesajı."),
  weeklyPlans: z.array(WeeklyPlanSchema).describe("Haftalık olarak düzenlenmiş çalışma planı. Her bir haftalık plan objesi MUTLAKA 'week' (hafta numarası, SAYI olarak) alanını İÇERMELİDİR."),
  generalTips: z.array(z.string()).optional().describe("Genel çalışma stratejileri, mola önerileri ve YKS için ipuçları."),
  disclaimer: z.string().default("Bu, yapay zeka tarafından oluşturulmuş bir taslak plandır. Kendi öğrenme hızınıza ve ihtiyaçlarınıza göre uyarlamanız önemlidir.").describe("Planın bir taslak olduğuna dair uyarı.")
});
export type GenerateStudyPlanOutput = z.infer<typeof GenerateStudyPlanOutputSchema>;

export async function generateStudyPlan(input: GenerateStudyPlanInput): Promise<GenerateStudyPlanOutput> {
  const isProUser = input.userPlan === 'pro';
  const isCustomModelSelected = !!input.customModelIdentifier;
  const isGemini25PreviewSelected = input.customModelIdentifier === 'experimental_gemini_2_5_flash_preview';
  
  const subjectsToFocus = getSubjectsForField(input.userField);

  const enrichedInput = {
    ...input,
    subjects: subjectsToFocus, // AI'ya gönderilecek konu listesi
    isProUser,
    isCustomModelSelected,
    isGemini25PreviewSelected,
  };
  
  let flowOutput: GenerateStudyPlanOutput;
  try {
    flowOutput = await studyPlanGeneratorFlow(enrichedInput);
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

  if (flowOutput && Array.isArray(flowOutput.weeklyPlans)) {
      flowOutput.weeklyPlans.forEach((plan: any, index) => { 
          if (plan && (plan.week === undefined || typeof plan.week !== 'number' || isNaN(plan.week))) {
              console.warn(`Study Plan Generator: AI output for weeklyPlans[${index}] is missing or has an invalid 'week' number. Assigning index+1. Original plan object:`, JSON.stringify(plan).substring(0, 200));
              plan.week = index + 1; 
          }
      });
  } else if (flowOutput) {
      console.warn("Study Plan Generator: AI output for weeklyPlans is not an array or is missing. Defaulting to empty array. Input:", JSON.stringify(enrichedInput).substring(0,200));
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

const prompt = ai.definePrompt({
  name: 'studyPlanGeneratorPrompt',
  input: {schema: GenerateStudyPlanInputSchema.extend({
    subjects: z.string().optional().describe("Çalışılması planlanan dersler ve ana konular (virgülle ayrılmış veya bölüm seçimine göre otomatik oluşturulmuş)."),
    isProUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
  })},
  output: {schema: GenerateStudyPlanOutputSchema},
  prompt: `Sen, Yükseköğretim Kurumları Sınavı (YKS) başta olmak üzere çeşitli sınavlara hazırlanan öğrencilere, onların hedeflerine, seçtikleri alana ({{{userField}}}), mevcut bilgilerine (belirtildiyse), çalışma sürelerine, günlük ayırabilecekleri zamana ve (varsa) sağladıkları ek PDF bağlamına göre son derece detaylı, kişiselleştirilmiş ve etkili çalışma planları tasarlayan, YKS hazırlık sürecinin her aşamasına hakim uzman bir AI eğitim koçu ve stratejistisin.
Amacın, öğrencinin belirlediği veya seçtiği alana göre belirlenen konuları ({{{subjects}}}) {{{studyDuration}}} içinde, günde ortalama {{{hoursPerDay}}} saat çalışarak en verimli şekilde tamamlamasına yardımcı olacak, haftalık ve günlük bazda yapılandırılmış, gerçekçi bir yol haritası sunmaktır. Plan, YKS (veya {{{userField}}} alanına uygun sınavlar) formatına uygun olmalı ve öğrenciyi motive etmelidir. Cevapların her zaman Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: Planı, en karmaşık konuların bile nasıl parçalara ayrılarak çalışılabileceğini gösterecek şekilde, farklı öğrenme teknikleri (örn: Pomodoro, Feynman Tekniği) ve genel türde kaynak önerileriyle (spesifik kitap adı olmadan) zenginleştir. Öğrencinin potansiyel darboğazlarını, zaman yönetimi zorluklarını ve motivasyon düşüşlerini öngörerek proaktif çözümler ve alternatif yaklaşımlar sun. En kapsamlı ve stratejik planı oluştur.)
{{else ifEquals userPlan "premium"}}
(Premium Kullanıcı Notu: Haftalık hedefleri daha net belirle, günlük aktivitelere örnek soru çözüm sayıları veya tekrar stratejileri ekle. Motivasyonel ipuçlarını artır.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Bu çözüm, özel olarak seçilmiş '{{{customModelIdentifier}}}' modeli kullanılarak üretilmektedir.)
  {{#if isGemini25PreviewSelected}}
  (Gemini 2.5 Flash Preview Özel Notu: Yanıtlarını olabildiğince ÖZ ama ANLAŞILIR tut. HIZLI yanıt vermesi önemlidir.)
  {{/if}}
{{/if}}

Öğrencinin Girdileri:
YKS Alanı: {{{userField}}}
Çalışılacak Ana Dersler/Konular (Bu listeye göre planı oluştur): {{{subjects}}}
Toplam Çalışma Süresi: {{{studyDuration}}}
Günlük Ortalama Çalışma Saati: {{{hoursPerDay}}}

{{#if pdfContextText}}
Öğrenci Tarafından Sağlanan Ek Bağlam (PDF'ten çıkarılan metin):
{{{pdfContextText}}}
Lütfen bu ek bağlamı, öğrencinin özellikle odaklanmak istediği veya eksik olduğu konuları belirlerken ve planı kişiselleştirirken dikkate al. Bu metin, öğrencinin mevcut bilgi seviyesi veya çalışma materyalleri hakkında ipuçları içerebilir.
{{/if}}

Lütfen bu bilgilere göre, aşağıdaki formatta bir çalışma planı taslağı oluştur: Çıktı, JSON şemasına HARFİYEN uymalıdır. Özellikle 'weeklyPlans' dizisindeki her bir obje, 'week' (hafta numarası, SAYI olarak), 'weeklyGoal' (isteğe bağlı) ve 'dailyTasks' (günlük görevler dizisi) alanlarını içermelidir. 'dailyTasks' içindeki her obje de 'day', 'focusTopics' ve isteğe bağlı diğer alanları içermelidir. Şemada 'required' olarak belirtilen tüm alanlar MUTLAKA çıktıda bulunmalıdır. HER BİR HAFTALIK PLAN OBJESİ 'week' ANAHTARINA SAHİP OLMALI VE BU ANAHTARIN DEĞERİ BİR SAYI (NUMBER) OLMALIDIR. Örneğin: { "week": 1, ... }, { "week": 2, ... } gibi.

1.  **Plan Başlığı (planTitle)**: Örneğin, "Kişiye Özel {{{userField}}} Hazırlık Planı ({{{studyDuration}}})". Bu alan ZORUNLUDUR.
2.  **Giriş (introduction) (isteğe bağlı)**: Öğrenciyi motive eden, planın genel mantığını açıklayan kısa bir giriş. "PRO İPUCU:" veya "Not:" gibi etiketlerle önemli noktaları vurgulayabilirsin.
3.  **Haftalık Planlar (weeklyPlans)**: ÇOK ÖNEMLİ: Bu dizideki HER BİR obje, MUTLAKA 'week' adında bir alana sahip olmalı ve bu alanın değeri bir SAYI (örneğin 1, 2, 3...) olmalıdır. Çalışma süresine göre haftalara bölünmüş planlar. Her hafta için:
    *   **Hafta Numarası (week)**: Örneğin, 1, 2, 3... Bu alan HER HAFTALIK PLAN OBJESİNDE ZORUNLUDUR VE MUTLAKA BİR SAYI OLMALIDIR. Bu değerin kesinlikle bir sayı olduğundan ve her haftalık plan için mevcut olduğundan emin ol.
    *   **Haftalık Hedef (weeklyGoal) (isteğe bağlı)**: O haftanın ana odak noktası veya bitirilmesi hedeflenen genel konu başlıkları.
    *   **Günlük Görevler (dailyTasks)**: Haftanın her günü için (Pazartesi-Pazar veya 1. Gün - 7. Gün):
        *   **Gün (day)**: Günün adı. Bu alan ZORUNLUDUR.
        *   **Odak Konular (focusTopics)**: O gün çalışılacak ana konular veya dersler. Günlük çalışma saatine göre konu sayısı dengeli olmalı. Bu alan ZORUNLUDUR.
        *   **Tahmini Süre (estimatedTime) (isteğe bağlı)**: Her bir odak konuya ayrılması önerilen süre (örn: "Matematik - Türev: 2 saat").
        *   **Aktiviteler (activities) (isteğe bağlı)**: "Konu anlatımı dinleme/okuma", "{{{hoursPerDay}}} soru çözümü", "Kısa tekrar", "Yanlış analizi" gibi spesifik görevler.
        *   **Notlar (notes) (isteğe bağlı)**: O güne özel motivasyon, mola önerisi veya önemli bir ipucu. "PRO İPUCU:" veya "Not:" gibi etiketlerle önemli noktaları vurgulayabilirsin.
    Bu 'weeklyPlans' dizisi ZORUNLUDUR. Her bir elemanının yukarıdaki şemaya uyduğundan emin ol, özellikle 'week' alanının bir sayı olarak varlığından.
4.  **Genel İpuçları (generalTips) (isteğe bağlı)**: Zaman yönetimi, verimli ders çalışma teknikleri, sınav stresiyle başa çıkma gibi genel YKS hazırlık önerileri. "PRO İPUCU:" veya "Not:" gibi etiketlerle önemli noktaları vurgulayabilirsin.
5.  **Sorumluluk Reddi (disclaimer)**: "Bu, yapay zeka tarafından oluşturulmuş bir taslak plandır..." şeklinde standart bir uyarı.

Planlama Prensipleri:
*   AI, kendisine verilen {{{userField}}} alanına ve {{{subjects}}} listesindeki konulara göre, {{{studyDuration}}} süresince, günde ortalama {{{hoursPerDay}}} saat çalışmayı dikkate alarak mantıklı bir plan oluşturmalıdır.
*   Konuların zorluk seviyelerine ve birbirleriyle bağlantılarına dikkat et.
*   Tekrar ve soru çözümünü plana dahil et.
*   Öğrencinin sıkılmaması için çeşitlilik sağlamaya çalış.
*   Gerçekçi ve uygulanabilir bir plan oluştur.
*   Eğer verilen süre çok kısaysa veya konu sayısı çok fazlaysa, bu durumu nazikçe belirt ve planı en iyi şekilde optimize etmeye çalış veya daha odaklı bir plan öner.
*   Çıktının JSON şemasına HARFİYEN uyduğundan emin ol. Özellikle, 'weeklyPlans' dizisindeki HER BİR haftalık plan objesinin 'week' anahtarını içerdiğinden ve bu anahtarın değerinin bir SAYI olduğundan KESİNLİKLE emin ol. Çıktıyı oluşturmadan önce bunu son kez kontrol et. 'week' alanı kesinlikle eksik olmamalıdır.
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
  async (enrichedInput: GenerateStudyPlanInput & {subjects?: string; isProUser?: boolean; isCustomModelSelected?: boolean; isGemini25PreviewSelected?: boolean} ): Promise<GenerateStudyPlanOutput> => {
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
          console.warn(`[Study Plan Generator Flow] Unknown customModelIdentifier: ${enrichedInput.customModelIdentifier}. Defaulting to ${modelToUse}`);
      }
    } else if (enrichedInput.isProUser) { 
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
    
    console.log(`[Study Plan Generator Flow] Using model: ${modelToUse} for plan: ${enrichedInput.userPlan}, customModel: ${enrichedInput.customModelIdentifier}, PDF context provided: ${!!enrichedInput.pdfContextText}, User Field: ${enrichedInput.userField}, Subjects sent to AI: ${enrichedInput.subjects}`);
    
    let output: GenerateStudyPlanOutput | undefined;
    try {
        const result = await prompt(enrichedInput, callOptions);
        output = result.output;

        if (!output || !output.weeklyPlans) {
            console.error("Study Plan Generator: AI output is missing weeklyPlans or output is null. Input:", JSON.stringify(enrichedInput).substring(0, 200), "Raw Output:", JSON.stringify(output).substring(0,300));
            throw new Error("AI Eğitim Koçu, belirtilen girdilerle bir çalışma planı oluşturamadı. Lütfen bilgilerinizi kontrol edin.");
        }
        
        if (Array.isArray(output.weeklyPlans)) {
            output.weeklyPlans.forEach((plan: any, index) => { 
                if (plan && (plan.week === undefined || typeof plan.week !== 'number' || isNaN(plan.week))) {
                    console.warn(`Study Plan Generator Flow (Post-processing): AI output for weeklyPlans[${index}] is missing or has an invalid 'week' number. Assigning index+1. Original plan object:`, JSON.stringify(plan).substring(0, 200));
                    plan.week = index + 1; 
                }
            });
        } else {
            console.error("Study Plan Generator: AI output for weeklyPlans is not an array. Defaulting to empty. Input:", JSON.stringify(enrichedInput).substring(0, 200), "Raw Output:", JSON.stringify(output).substring(0,300));
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
