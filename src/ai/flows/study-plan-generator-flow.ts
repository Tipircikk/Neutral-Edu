
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

// Konu listeleri (önceki gibi)
const yksTopics = {
  tyt: {
    turkce: ["Sözcükte Anlam", "Cümlede Anlam", "Paragraf", "Ses Bilgisi", "Dil Bilgisi Genel", "Anlatım Bozuklukları", "Yazım Kuralları", "Noktalama İşaretleri"],
    matematik: ["Temel Kavramlar", "Sayılar", "Bölme-Bölünebilme", "OBEB-OKEK", "Rasyonel Sayılar", "Basit Eşitsizlikler", "Mutlak Değer", "Üslü Sayılar", "Köklü Sayılar", "Çarpanlara Ayırma","Denklem Çözme", "Oran-Orantı", "Problemler (Sayı, Kesir, Yaş, Yüzde, Karışım, Hareket, Grafik)", "Kümeler", "Mantık", "Olasılık"],
    geometri: ["Doğruda Açılar", "Üçgende Açılar", "Özel Üçgenler", "Üçgende Alan", "Açı-Kenar Bağıntıları", "Çokgenler", "Dörtgenler (Genel, Yamuk, Paralelkenar, Dikdörtgen, Kare, Deltoid)", "Çember ve Daire", "Katı Cisimler", "Analitik Geometri (Temel)"],
    fizik: ["Fizik Bilimine Giriş", "Madde ve Özellikleri", "Hareket ve Kuvvet", "Enerji", "Isı ve Sıcaklık", "Elektrostatik", "Optik (Temel)", "Dalgalar (Temel)"],
    kimya: ["Kimya Bilimi", "Atom ve Periyodik Sistem", "Kimyasal Türler Arası Etkileşim", "Maddenin Halleri", "Doğa ve Kimya", "Kimyanın Temel Kanunları"],
    biyoloji: ["Biyoloji Bilimi", "Canlıların Yapısında Bulunan Temel Bileşikler", "Hücre ve Organelleri", "Hücre Zarından Madde Geçişi", "Canlıların Sınıflandırılması (Genel)", "Ekosistem Ekolojisi (Temel)"],
    tarih: ["Tarih ve Zaman", "İlk Çağ Medeniyetleri", "İslamiyet Öncesi Türk Tarihi", "İslam Tarihi ve Uygarlığı", "Türk-İslam Devletleri (İlk Müslüman Türk Devletleri)", "Türkiye Selçuklu Devleti", "Osmanlı Devleti Kuruluş ve Yükselme Dönemleri"],
    cografya: ["Doğa ve İnsan Etkileşimi", "Coğrafi Konum ve Türkiye'nin Coğrafi Konumu", "Harita Bilgisi", "Atmosfer ve İklim Elemanları", "Türkiye'nin İklimi", "Yer Şekilleri ve Oluşum Süreçleri", "Türkiye'nin Yer Şekilleri", "Nüfus ve Yerleşme", "Türkiye'de Nüfus ve Yerleşme"],
    felsefe: ["Felsefenin Alanı ve Konusu", "Bilgi Felsefesi (Epistemoloji)", "Varlık Felsefesi (Ontoloji)", "Ahlak Felsefesi (Etik)"],
    dinKulturu: ["İslam'da İnanç Esasları", "İbadetler ve Temel Kavramlar", "Ahlaki Değerler", "Hz. Muhammed'in Hayatı ve Örnekliği"]
  },
  ayt: {
    turkDiliEdebiyati: ["Anlam Bilgisi (Şiirde ve Metinde Anlam)", "Dil Bilgisi (AYT Özel)", "Edebi Sanatlar (Söz Sanatları)", "Nazım Biçimleri ve Türleri", "Türk Edebiyatı Tarihi (Dönemler)", "İslamiyet Öncesi Türk Edebiyatı", "Divan Edebiyatı", "Halk Edebiyatı", "Tanzimat Edebiyatı", "Servetifünun Edebiyatı", "Fecriati Edebiyatı", "Milli Edebiyat", "Cumhuriyet Dönemi Türk Edebiyatı (Şiir, Roman, Hikaye, Tiyatro)", "Batı Edebiyatı Akımları"],
    matematik: ["Fonksiyonlar ve Uygulamaları", "Polinomlar", "İkinci Dereceden Denklemler ve Eşitsizlikler", "Parabol", "Karmaşık Sayılar", "Permütasyon, Kombinasyon, Binom Açılımı", "Olasılık (Koşullu Olasılık Dahil)", "Trigonometri (Birim Çember, Grafikler, Denklemler, Dönüşüm Formülleri)", "Logaritma", "Diziler (Aritmetik, Geometrik)", "Limit ve Süreklilik", "Türev ve Uygulamaları", "İntegral ve Uygulamaları"],
    geometri: ["Doğruda Açılar (Tekrar)", "Üçgenler (Açı, Kenar, Alan, Benzerlik, Açıortay, Kenarortay - Kapsamlı)", "Çokgenler ve Dörtgenler (AYT Özel)", "Çemberde Açı, Uzunluk ve Dairede Alan (Kapsamlı)", "Analitik Geometri (Doğrunun ve Çemberin Analitiği)", "Katı Cisimler (Tekrar ve İleri)", "Dönüşüm Geometrisi (Öteleme, Dönme, Simetri)"],
    fizik: ["Vektörler ve Kuvvet Denge", "Tork ve Denge", "Kütle Merkezi", "Basit Makineler", "Newton'un Hareket Yasaları (Dinamik)", "Bir Boyutta Sabit İvmeli Hareket", "İki Boyutta Hareket (Atışlar)", "Enerji ve Hareket (İş, Güç, Enerji Dönüşümleri)", "İtme ve Momentum", "Düzgün Çembersel Hareket", "Basit Harmonik Hareket", "Kütle Çekim ve Kepler Yasaları", "Elektriksel Kuvvet ve Elektriksel Alan", "Elektriksel Potansiyel ve Enerji", "Düzgün Elektrik Alan ve Sığa", "Manyetizma ve Elektromanyetik İndükleme", "Alternatif Akım ve Transformatörler", "Dalgalar (Su, Ses, Deprem, Elektromanyetik Dalgalar)", "Işığın Doğası ve Fotoelektrik Olay", "Modern Fizik (Özel Görelilik, Kuantum Fiziğine Giriş, Atom Modelleri)", "Modern Fiziğin Teknolojideki Uygulamaları"],
    kimya: ["Modern Atom Teorisi", "Gazlar", "Sıvı Çözeltiler ve Çözünürlük", "Kimyasal Tepkimelerde Enerji (Entalpi)", "Kimyasal Tepkimelerde Hız", "Kimyasal Denge", "Asit-Baz Dengesi", "Çözünürlük Dengesi (Kçç)", "Elektrokimya ve Piller", "Organik Kimyaya Giriş", "Organik Bileşikler (Alkanlar, Alkenler, Alkinler, Alkoller, Eterler, Aldehitler, Ketonlar, Karboksilik Asitler, Esterler, Aminler, Amidler, Aromatik Bileşikler)"],
    biyoloji: ["Sinir Sistemi", "Endokrin Sistem", "Duyu Organları", "Destek ve Hareket Sistemi", "Sindirim Sistemi", "Dolaşım ve Bağışıklık Sistemi", "Solunum Sistemi", "Boşaltım Sistemi", "Üreme Sistemi ve Embriyonik Gelişim", "Kalıtımın Genel İlkeleri (Genetik)", "Nükleik Asitler ve Protein Sentezi", "Biyoteknoloji ve Gen Mühendisliği", "Canlılarda Enerji Dönüşümleri (Fotosentez, Kemosentez, Hücresel Solunum)", "Bitki Biyolojisi", "Komünite ve Popülasyon Ekolojisi"],
    tarih: ["Tarih Bilimine Giriş (Tekrar)", "İlk Çağ Medeniyetleri (Tekrar)", "Orta Çağ'da Dünya", "İlk ve Orta Çağlarda Türk Dünyası", "İslam Medeniyetinin Doğuşu ve Yayılışı", "Türklerin İslamiyeti Kabulü ve İlk Türk İslam Devletleri", "Türkiye Selçuklu Devleti ve Anadolu Beylikleri", "Osmanlı Devleti'nin Kuruluşu ve Yükselişi (1300-1600)", "Yeni Çağ Avrupası'ndaki Gelişmeler", "XVII. ve XVIII. Yüzyıllarda Osmanlı Devleti (Arayış Yılları, Gerileme)", "Yakın Çağ Avrupası ve Sanayi İnkılabı", "XIX. Yüzyılda Osmanlı Devleti (Dağılma Dönemi)", "XX. Yüzyıl Başlarında Osmanlı Devleti ve Dünya (Trablusgarp ve Balkan Savaşları, I. Dünya Savaşı)", "Milli Mücadele Hazırlık Dönemi", "Kurtuluş Savaşı Cepheleri", "Türk İnkılabı ve Atatürkçülük", "İki Savaş Arası Dönemde Türkiye ve Dünya", "II. Dünya Savaşı ve Sonrası Türkiye ve Dünya", "Soğuk Savaş Dönemi", "Yumuşama Dönemi ve Sonrası", "Küreselleşen Dünya"],
    cografya: ["Doğal Sistemler (Ekosistem, Biyoçeşitlilik)", "Beşeri Sistemler (Nüfus, Yerleşme, Ekonomik Faaliyetler)", "Mekansal Sentez Türkiye (Coğrafi Konum, Yer Şekilleri, İklim, Nüfus, Ekonomi)", "Küresel Ortam: Bölgeler ve Ülkeler", "Çevre ve Toplum", "Doğal Afetler"],
    felsefeGrubu: {
      felsefe: ["Felsefeyle Tanışma", "Bilgi Felsefesi", "Varlık Felsefesi", "Ahlak Felsefesi", "Sanat Felsefesi", "Din Felsefesi", "Siyaset Felsefesi", "Bilim Felsefesi", "XX. Yüzyıl Felsefesi"],
      psikoloji: ["Psikolojinin Temel Süreçleri", "Öğrenme, Bellek, Düşünme", "Ruh Sağlığının Temelleri"],
      sosyoloji: ["Sosyolojiye Giriş", "Birey ve Toplum", "Toplumsal Yapı", "Toplumsal Değişme ve Gelişme", "Toplumsal Kurumlar"],
      mantik: ["Mantığa Giriş", "Klasik Mantık", "Mantık ve Dil", "Sembolik Mantık"]
    }
  }
};

function getSubjectsForField(field?: "ea" | "sayisal" | "sozel" | "tyt"): string {
  if (!field || field === "tyt") {
      const allTytSubjects = Object.entries(yksTopics.tyt)
        .map(([ders, konular]) => `${ders.charAt(0).toUpperCase() + ders.slice(1)} (TYT: ${Array.isArray(konular) ? konular.slice(0,2).join(', ') : 'Genel'})`);
      return "TYT Tüm Dersler: " + allTytSubjects.join(", ");
  }

  let subjects: string[] = [];
  const addTytCourses = (includeMathGeo: boolean = true, includeFenSos: boolean = true, includeFelsefeDin: boolean = true) => {
    subjects.push("TYT Türkçe (" + (Array.isArray(yksTopics.tyt.turkce) ? yksTopics.tyt.turkce.slice(0, 2).join(', ') : 'Genel') + "...)");
    if (includeMathGeo) {
      subjects.push("TYT Matematik (" + (Array.isArray(yksTopics.tyt.matematik) ? yksTopics.tyt.matematik.slice(0, 2).join(', ') : 'Genel') + "...)");
      subjects.push("TYT Geometri (" + (Array.isArray(yksTopics.tyt.geometri) ? yksTopics.tyt.geometri.slice(0, 2).join(', ') : 'Genel') + "...)");
    }
    if (includeFenSos) {
      subjects.push("TYT Fizik (" + (Array.isArray(yksTopics.tyt.fizik) ? yksTopics.tyt.fizik.slice(0, 1).join(', ') : 'Genel') + "...)");
      subjects.push("TYT Kimya (" + (Array.isArray(yksTopics.tyt.kimya) ? yksTopics.tyt.kimya.slice(0, 1).join(', ') : 'Genel') + "...)");
      subjects.push("TYT Biyoloji (" + (Array.isArray(yksTopics.tyt.biyoloji) ? yksTopics.tyt.biyoloji.slice(0, 1).join(', ') : 'Genel') + "...)");
      subjects.push("TYT Tarih (" + (Array.isArray(yksTopics.tyt.tarih) ? yksTopics.tyt.tarih.slice(0, 1).join(', ') : 'Genel') + "...)");
      subjects.push("TYT Coğrafya (" + (Array.isArray(yksTopics.tyt.cografya) ? yksTopics.tyt.cografya.slice(0, 1).join(', ') : 'Genel') + "...)");
    }
    if (includeFelsefeDin) {
        subjects.push("TYT Felsefe (" + (Array.isArray(yksTopics.tyt.felsefe) ? yksTopics.tyt.felsefe.slice(0, 1).join(', ') : 'Genel') + "...)");
        subjects.push("TYT Din Kültürü ve Ahlak Bilgisi");
    }
  };

  switch (field) {
    case "sayisal":
      addTytCourses(true, true, true);
      subjects.push("AYT Matematik (" + (Array.isArray(yksTopics.ayt.matematik) ? yksTopics.ayt.matematik.slice(0, 2).join(', ') : 'Genel') + "...)");
      subjects.push("AYT Geometri (" + (Array.isArray(yksTopics.ayt.geometri) ? yksTopics.ayt.geometri.slice(0, 2).join(', ') : 'Genel') + "...)");
      subjects.push("AYT Fizik (" + (Array.isArray(yksTopics.ayt.fizik) ? yksTopics.ayt.fizik.slice(0, 2).join(', ') : 'Genel') + "...)");
      subjects.push("AYT Kimya (" + (Array.isArray(yksTopics.ayt.kimya) ? yksTopics.ayt.kimya.slice(0, 2).join(', ') : 'Genel') + "...)");
      subjects.push("AYT Biyoloji (" + (Array.isArray(yksTopics.ayt.biyoloji) ? yksTopics.ayt.biyoloji.slice(0, 2).join(', ') : 'Genel') + "...)");
      break;
    case "ea":
      addTytCourses(true, false, true);
      subjects.push("TYT Tarih (" + (Array.isArray(yksTopics.tyt.tarih) ? yksTopics.tyt.tarih.slice(0, 1).join(', ') : 'Genel') + "...)");
      subjects.push("TYT Coğrafya (" + (Array.isArray(yksTopics.tyt.cografya) ? yksTopics.tyt.cografya.slice(0, 1).join(', ') : 'Genel') + "...)");
      subjects.push("AYT Matematik (" + (Array.isArray(yksTopics.ayt.matematik) ? yksTopics.ayt.matematik.slice(0, 2).join(', ') : 'Genel') + "...)");
      subjects.push("AYT Geometri (" + (Array.isArray(yksTopics.ayt.geometri) ? yksTopics.ayt.geometri.slice(0, 2).join(', ') : 'Genel') + "...)");
      subjects.push("AYT Türk Dili ve Edebiyatı (" + (Array.isArray(yksTopics.ayt.turkDiliEdebiyati) ? yksTopics.ayt.turkDiliEdebiyati.slice(0, 2).join(', ') : 'Genel') + "...)");
      subjects.push("AYT Tarih-1 (" + (Array.isArray(yksTopics.ayt.tarih) ? yksTopics.ayt.tarih.slice(0, 1).join(', ') : 'Genel') + "...)");
      subjects.push("AYT Coğrafya-1 (" + (Array.isArray(yksTopics.ayt.cografya) ? yksTopics.ayt.cografya.slice(0, 1).join(', ') : 'Genel') + "...)");
      break;
    case "sozel":
      addTytCourses(false, true, true);
      subjects.push("TYT Matematik (Temel Düzey)");
      subjects.push("AYT Türk Dili ve Edebiyatı (" + (Array.isArray(yksTopics.ayt.turkDiliEdebiyati) ? yksTopics.ayt.turkDiliEdebiyati.slice(0, 2).join(', ') : 'Genel') + "...)");
      subjects.push("AYT Tarih-1 ve Tarih-2 (" + (Array.isArray(yksTopics.ayt.tarih) ? yksTopics.ayt.tarih.slice(0, 1).join(', ') : 'Genel') + "...)");
      subjects.push("AYT Coğrafya-1 ve Coğrafya-2 (" + (Array.isArray(yksTopics.ayt.cografya) ? yksTopics.ayt.cografya.slice(0, 1).join(', ') : 'Genel') + "...)");
      subjects.push("AYT Felsefe Grubu (Felsefe, Psikoloji, Sosyoloji, Mantık)");
      subjects.push("AYT Din Kültürü ve Ahlak Bilgisi");
      break;
  }
  return subjects.slice(0, 6).join(", ") + (subjects.length > 6 ? " ve diğerleri..." : "");
}


const GenerateStudyPlanInputSchema = z.object({
  userField: z.enum(["ea", "sayisal", "sozel", "tyt"]).optional().describe("Kullanıcının YKS alanı (Eşit Ağırlık, Sayısal, Sözel, Sadece TYT)."),
  customSubjectsInput: z.string().optional().describe("Kullanıcının odaklanmak istediği özel konular veya dersler. Bu alan doluysa, yukarıdaki 'userField' seçimi yerine bu konular önceliklendirilir."),
  studyDuration: z.string().describe("Toplam çalışma süresi (örn: '4_hafta', '3_ay', '6_ay')."),
  hoursPerDay: z.number().min(1).max(12).describe("Günlük ortalama çalışma saati."),
  userPlan: z.enum(["free", "premium", "pro"]).optional().describe("Kullanıcının mevcut üyelik planı. Eksikse 'free' varsayılacaktır."),
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi."),
  pdfContextText: z.string().optional().describe("Kullanıcının yüklediği PDF'ten çıkarılan, çalışma planı oluşturulurken ek bağlam olarak kullanılacak metin."),
});
export type GenerateStudyPlanInput = z.infer<typeof GenerateStudyPlanInputSchema>;

const DailyTaskSchema = z.object({
    day: z.string().describe("Haftanın günü veya planın belirli bir günü (örn: Pazartesi, 1. Gün)."),
    focusTopics: z.array(z.string()).min(1).describe("O gün odaklanılacak ana konular veya dersler. En az bir tane olmalıdır."),
    estimatedTime: z.string().optional().describe("Her konu/ders için tahmini çalışma süresi."),
    activities: z.array(z.string()).optional().describe("Konu çalışma, soru çözümü, tekrar gibi aktiviteler."),
    notes: z.string().optional().describe("O güne özel ek notlar veya ipuçları.")
});

const WeeklyPlanSchema = z.object({
    week: z.number().describe("Planın kaçıncı haftası olduğu. Bu alan HER ZAMAN ZORUNLUDUR ve her haftalık plan objesinde bir SAYI olarak bulunmalıdır."),
    weeklyGoal: z.string().optional().describe("O haftanın genel çalışma hedefi veya odak noktası."),
    dailyTasks: z.array(DailyTaskSchema).min(1).describe("Haftanın günlerine yayılmış günlük görevler ve konular. En az bir günlük görev olmalıdır.")
});

const GenerateStudyPlanOutputSchema = z.object({
  planTitle: z.string().describe("Oluşturulan çalışma planı için bir başlık."),
  introduction: z.string().describe("Plana genel bir giriş ve motivasyon mesajı. Kullanıcının planına göre farklılaşan genel stratejiler ve YKS taktikleri de bu bölümde yer almalıdır."),
  weeklyPlans: z.array(WeeklyPlanSchema).min(1).describe("Haftalık olarak düzenlenmiş çalışma planı. Her bir haftalık plan objesi MUTLAKA 'week' (hafta numarası, SAYI olarak) alanını İÇERMELİDİR ve en az bir haftalık plan olmalıdır."),
  disclaimer: z.string().default("Bu, yapay zeka tarafından oluşturulmuş bir taslak plandır. Kendi öğrenme hızınıza ve ihtiyaçlarınıza göre uyarlamanız önemlidir.").describe("Planın bir taslak olduğuna dair uyarı.")
});
export type GenerateStudyPlanOutput = z.infer<typeof GenerateStudyPlanOutputSchema>;

const defaultErrorResponse: GenerateStudyPlanOutput = {
  planTitle: "Plan Oluşturma Hatası",
  introduction: "Çalışma planı oluşturulurken beklenmedik bir sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin veya destek ile iletişime geçin.",
  weeklyPlans: [],
  disclaimer: "Bir hata nedeniyle plan oluşturulamadı."
};

export async function generateStudyPlan(input: GenerateStudyPlanInput): Promise<GenerateStudyPlanOutput> {
  try {
    const currentPlan = input.userPlan || 'free';
    const isProUser = currentPlan === 'pro';
    const isPremiumUser = currentPlan === 'premium';
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
          console.warn(`[Study Plan Generator Flow (Action)] Unknown customModelIdentifier: ${input.customModelIdentifier}. Defaulting based on plan ${currentPlan}`);
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
    const isGemini25PreviewSelected = modelToUse === 'googleai/gemini-2.5-flash-preview-05-20';


    let subjectsToFocus: string;
    if (input.customSubjectsInput && input.customSubjectsInput.trim() !== "") {
      subjectsToFocus = input.customSubjectsInput.trim();
    } else if (input.userField) {
      subjectsToFocus = getSubjectsForField(input.userField);
    } else {
      subjectsToFocus = "Genel YKS konuları (TYT ve AYT tüm dersler)";
    }

    console.log(`[generateStudyPlan Action] Input received:`, { userField: input.userField, customSubjectsInput: !!input.customSubjectsInput, studyDuration: input.studyDuration, hoursPerDay: input.hoursPerDay, userPlan: currentPlan, customModelIdentifier: input.customModelIdentifier, pdfContextTextProvided: !!input.pdfContextText });
    console.log(`[generateStudyPlan Action] Subjects to focus for AI: ${subjectsToFocus.substring(0, 200)}...`);


    const enrichedInputForPrompt = {
      ...input,
      userPlan: currentPlan,
      subjects: subjectsToFocus,
      isProUser,
      isPremiumUser,
      isCustomModelSelected,
      isGemini25PreviewSelected,
    };

    let flowOutput = await studyPlanGeneratorFlow(enrichedInputForPrompt, modelToUse);

    if (!flowOutput || typeof flowOutput.planTitle !== 'string' || typeof flowOutput.introduction !== 'string' || !Array.isArray(flowOutput.weeklyPlans)) {
      const errorDetail = !flowOutput ? "Flow tanımsız bir yanıt döndürdü." :
                          typeof flowOutput.planTitle !== 'string' ? "Plan başlığı (planTitle) eksik veya geçersiz." :
                          typeof flowOutput.introduction !== 'string' ? "Giriş metni (introduction) eksik veya geçersiz." :
                          !Array.isArray(flowOutput.weeklyPlans) ? "Haftalık planlar (weeklyPlans) bir dizi değil." :
                          "Bilinmeyen yapısal hata.";
      console.error(`[generateStudyPlan Action] Flow returned invalid structure: ${errorDetail}. Raw output:`, JSON.stringify(flowOutput).substring(0, 500));
      return {
          planTitle: "Plan Oluşturma Başarısız",
          introduction: flowOutput?.introduction || `AI akışından beklenen yapıda bir yanıt alınamadı (${errorDetail}). Lütfen tekrar deneyin.`,
          weeklyPlans: [],
          disclaimer: flowOutput?.disclaimer || "Bir hata nedeniyle plan oluşturulamadı."
      };
    }

    flowOutput.weeklyPlans = flowOutput.weeklyPlans.map((plan: any, index) => {
      const correctedPlan: any = {
        week: (plan && typeof plan.week === 'number' && !isNaN(plan.week)) ? plan.week : index + 1,
        dailyTasks: [],
        weeklyGoal: (plan && typeof plan.weeklyGoal === 'string') ? plan.weeklyGoal : ""
      };
      if (!(plan && typeof plan.week === 'number' && !isNaN(plan.week))) {
         console.warn(`[generateStudyPlan Action Post-Processing for Client] weeklyPlans[${index}] had invalid 'week': ${plan?.week}. Corrected to: ${index + 1}`);
      }

      if (plan && Array.isArray(plan.dailyTasks) && plan.dailyTasks.length > 0) {
        correctedPlan.dailyTasks = plan.dailyTasks.map((task: any, taskIndex: number) => {
          return {
            day: (task && typeof task.day === 'string' && task.day.trim() !== "") ? task.day.trim() : `Gün ${taskIndex + 1}`,
            focusTopics: (task && Array.isArray(task.focusTopics) && task.focusTopics.length > 0 && task.focusTopics.every((t: any) => typeof t === 'string' && t.trim() !== "")) ? task.focusTopics.map(t => t.trim()).filter(t => t) : ["Genel Tekrar / Boş Zaman"],
            activities: (task && Array.isArray(task.activities)) ? task.activities : [],
            estimatedTime: (task && typeof task.estimatedTime === 'string') ? task.estimatedTime : "",
            notes: (task && typeof task.notes === 'string') ? task.notes : ""
          };
        });
      } else {
         console.warn(`[generateStudyPlan Action Post-Processing for Client] weeklyPlans[${index}].dailyTasks was not a non-empty array. Defaulting task.`);
         correctedPlan.dailyTasks = [{ day: "1. Gün", focusTopics: ["Genel Tekrar / Plan Detaylandırılacak"], activities: [], estimatedTime: "Esnek", notes: "AI bu hafta için detaylı günlük görev üretemedi." }];
      }
      return correctedPlan;
    });

    console.log("[generateStudyPlan Action] Successfully processed and validated study plan. Returning to client.");
    return flowOutput;

  } catch (error: any) {
    console.error("[generateStudyPlan Action] CRITICAL error during server action execution (outer try-catch):", error);
    let errorMessage = 'Çalışma planı oluşturulurken sunucuda beklenmedik bir hata oluştu.';
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
        ...defaultErrorResponse,
        introduction: `Sunucu tarafında kritik bir hata oluştu: ${errorMessage}. Lütfen daha sonra tekrar deneyin veya bir sorun olduğunu düşünüyorsanız destek ile iletişime geçin.`
    };
  }
}

const studyPlanGeneratorFlow = ai.defineFlow(
  {
    name: 'studyPlanGeneratorFlow',
    inputSchema: GenerateStudyPlanInputSchema.extend({
        subjects: z.string().optional(),
        isProUser: z.boolean().optional(),
        isPremiumUser: z.boolean().optional(),
        isCustomModelSelected: z.boolean().optional(),
        isGemini25PreviewSelected: z.boolean().optional(),
    }),
    outputSchema: GenerateStudyPlanOutputSchema,
  },
  async (enrichedInput: z.infer<typeof GenerateStudyPlanInputSchema> & {subjects?: string; isProUser?: boolean; isPremiumUser?: boolean; isCustomModelSelected?: boolean; isGemini25PreviewSelected?: boolean}, modelToUse: string ): Promise<GenerateStudyPlanOutput> => {
    
    try {
      console.log(`[Study Plan Generator Flow (Genkit)] Starting flow with input:`, { userPlan: enrichedInput.userPlan, customModel: enrichedInput.customModelIdentifier, studyDuration: enrichedInput.studyDuration, hoursPerDay: enrichedInput.hoursPerDay, subjects: enrichedInput.subjects?.substring(0,100) + "...", pdfContextProvided: !!enrichedInput.pdfContextText });

      let callOptions: { model: string; config?: Record<string, any> } = { model: modelToUse };
      if (modelToUse === 'googleai/gemini-2.5-flash-preview-05-20') {
          callOptions.config = {}; 
      } else {
        callOptions.config = {
          generationConfig: {
            maxOutputTokens: 8000, 
          }
        };
      }

      console.log(`[Study Plan Generator Flow (Genkit)] Using model: ${modelToUse} with options:`, JSON.stringify(callOptions.config), `for plan: ${enrichedInput.userPlan}`);
      const result = await studyPlanGeneratorPrompt(enrichedInput, callOptions);
      let output = result.output;

      if (!output || typeof output.planTitle !== 'string' || typeof output.introduction !== 'string' || !Array.isArray(output.weeklyPlans) ) {
          const errorDetail = !output ? "AI anlamsız bir yanıt döndürdü (null/undefined)." :
                            typeof output.planTitle !== 'string' ? "Plan başlığı (planTitle) eksik veya geçersiz." :
                            typeof output.introduction !== 'string' ? "Giriş metni (introduction) eksik veya geçersiz." :
                            !Array.isArray(output.weeklyPlans) ? "Haftalık planlar (weeklyPlans) bir dizi değil veya boş." :
                            "Bilinmeyen yapısal hata.";
          console.error(`[Study Plan Generator Flow (Genkit)] AI output is missing critical fields or has invalid structure: ${errorDetail}. Raw Output:`, JSON.stringify(output).substring(0,500));
          throw new Error(`AI, beklenen temel plan yapısını (${errorDetail}) oluşturamadı. Model: ${modelToUse}.`);
      }
       if (output.weeklyPlans.length === 0 && enrichedInput.studyDuration !== "0_gun") { 
         console.warn(`[Study Plan Generator Flow (Genkit)] AI returned an empty weeklyPlans array for duration ${enrichedInput.studyDuration}. This might be an issue.`);
       }


      output.weeklyPlans = output.weeklyPlans.map((plan: any, index) => {
          const correctedPlan: any = {
              week: (plan && typeof plan.week === 'number' && !isNaN(plan.week)) ? plan.week : index + 1,
              dailyTasks: [],
              weeklyGoal: (plan && typeof plan.weeklyGoal === 'string') ? plan.weeklyGoal : `Hafta ${index + 1} Hedefi`
          };

          if (!(plan && typeof plan.week === 'number' && !isNaN(plan.week))) {
               console.warn(`[Study Plan Generator Flow (Genkit) - PostProcessing] weeklyPlans[${index}] had invalid or missing 'week': ${plan?.week}. Corrected to: ${index + 1}`);
          }

          if (plan && Array.isArray(plan.dailyTasks) && plan.dailyTasks.length > 0) {
              correctedPlan.dailyTasks = plan.dailyTasks.map((task: any, taskIndex: number) => {
                const focusTopics = (task && Array.isArray(task.focusTopics) && task.focusTopics.length > 0 && task.focusTopics.every((t: any) => typeof t === 'string' && t.trim() !== ""))
                                    ? task.focusTopics.map(t => t.trim()).filter(t => t)
                                    : ["Belirlenmemiş Odak Konusu / Serbest Çalışma"];
                if (focusTopics[0] === "Belirlenmemiş Odak Konusu / Serbest Çalışma" && (!task || !task.focusTopics || task.focusTopics.length === 0)) {
                   console.warn(`[Study Plan Generator Flow (Genkit) - PostProcessing] weeklyPlans[${index}].dailyTasks[${taskIndex}] had missing or empty focusTopics. Defaulted.`);
                }
                return {
                    day: (task && typeof task.day === 'string' && task.day.trim() !== "") ? task.day.trim() : `Gün ${taskIndex + 1}`,
                    focusTopics: focusTopics,
                    activities: (task && Array.isArray(task.activities)) ? task.activities : [],
                    estimatedTime: (task && typeof task.estimatedTime === 'string') ? task.estimatedTime : "Belirsiz",
                    notes: (task && typeof task.notes === 'string') ? task.notes : ""
                };
              });
          } else {
              console.warn(`[Study Plan Generator Flow (Genkit) - PostProcessing] weeklyPlans[${index}].dailyTasks was not a non-empty array. Defaulting task.`);
              correctedPlan.dailyTasks = [{ day: "1. Gün", focusTopics: ["Genel Tekrar / Plan Detaylandırılacak"], activities: [], estimatedTime: "Esnek", notes: "AI bu hafta için detaylı günlük görev üretemedi." }];
          }
          return correctedPlan;
      });

      if (typeof output.disclaimer !== 'string' || output.disclaimer.trim() === "") {
          console.warn(`[Study Plan Generator Flow (Genkit) - PostProcessing] Disclaimer was missing or empty. Setting default.`);
          output.disclaimer = "Bu, yapay zeka tarafından oluşturulmuş bir taslak plandır. Kendi öğrenme hızınıza ve ihtiyaçlarınıza göre uyarlamanız önemlidir.";
      }

      console.log(`[Study Plan Generator Flow (Genkit)] Successfully generated and validated plan titled: ${output.planTitle}`);
      return output;

    } catch (flowError: any) {
      console.error(`[Study Plan Generator Flow (Genkit)] CRITICAL ERROR in Genkit flow with model ${modelToUse}:`, flowError, "Input (main part):", { userField: enrichedInput.userField, customSubjectsInput: enrichedInput.customSubjectsInput, studyDuration: enrichedInput.studyDuration, hoursPerDay: enrichedInput.hoursPerDay, userPlan: enrichedInput.userPlan, customModelIdentifier: enrichedInput.customModelIdentifier });
      let errorMessage = `AI Eğitim Koçu ile çalışma planı oluşturulurken bir Genkit/AI hatası oluştu. Kullanılan Model: ${modelToUse}.`;
      if (flowError instanceof Error) {
        errorMessage += ` Detay: ${flowError.message.substring(0, 300)}`;
         if (flowError.name === 'GenkitError' && flowError.message.includes('Schema validation failed')) {
            let zodErrors = "Şema Doğrulama Hatası.";
            if (flowError.details && Array.isArray(flowError.details)) {
                zodErrors = flowError.details.map((detail: any) => `[${detail.path.join('.') || 'root'}]: ${detail.message}`).join('; ');
            }
            errorMessage = `AI modelinden gelen yanıt beklenen şemayla uyuşmuyor: ${zodErrors.substring(0, 400)}. Model: ${modelToUse}.`;
        } else if (flowError.message.includes('Invalid JSON payload') || flowError.message.includes('Unknown name "config"')) {
             errorMessage = `AI modeli (${modelToUse}) ile iletişimde bir yapılandırma sorunu oluştu (Invalid JSON payload or unknown config).`;
        } else if (flowError.message.includes('SAFETY') || flowError.message.includes('block_reason')) {
          errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen girdilerinizi gözden geçirin. Model: ${modelToUse}. Detay: ${flowError.message.substring(0, 150)}`;
        }
      } else if (typeof flowError === 'string') {
        errorMessage += ` Detay: ${flowError.substring(0, 300)}`;
      }
      return {
        ...defaultErrorResponse,
        introduction: errorMessage,
      };
    }
  }
);

const studyPlanGeneratorPrompt = ai.definePrompt({
  name: 'studyPlanGeneratorPrompt',
  input: {schema: GenerateStudyPlanInputSchema.extend({
    subjects: z.string().optional().describe("Çalışılması planlanan dersler ve ana konular."),
    isProUser: z.boolean().optional(),
    isPremiumUser: z.boolean().optional(),
    isCustomModelSelected: z.boolean().optional(),
    isGemini25PreviewSelected: z.boolean().optional(),
  })},
  output: {schema: GenerateStudyPlanOutputSchema},
  prompt: `Sen, YKS öğrencilerine kişiselleştirilmiş, haftalık ve günlük bazda yapılandırılmış, gerçekçi ve motive edici YKS çalışma planları tasarlayan uzman bir AI eğitim koçusun. Cevapların daima Türkçe olmalıdır. Amacın, öğrencinin hedeflerine ulaşmasına yardımcı olacak en etkili planı sunmaktır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#if isProUser}}
(Pro Kullanıcı Notu: Pro üyeliğinizle gelen bu kapsamlı planlama aracı, üyeliğinizin özel bir avantajıdır. Giriş bölümünde en uzman YKS stratejilerini, etkili öğrenme tekniklerini (örn: Feynman Tekniği, aralıklı tekrar, Pomodoro), güvenilir kaynak önerilerini, deneme sınavı çözme ve analiz taktiklerini, stres yönetimi ve motivasyon koruma gibi detaylı bilgiler sun. Planın geneline yayılmış olarak, sık yapılan YKS hatalarına ve bunlardan kaçınma yollarına değin.)
{{else if isPremiumUser}}
(Premium Kullanıcı Notu: Giriş bölümünde, 1-2 etkili konu tekrarı yöntemi (örn: aktif hatırlama), çalışma verimliliği için pratik ipuçları, genel motivasyon teknikleri ve zaman yönetimi hakkında bilgiler sun. Planın bazı günlerine küçük motivasyon notları ekle.)
{{else}}
(Ücretsiz Kullanıcı Notu: Giriş bölümünde, temel çalışma alışkanlıkları, mola vermenin önemi, düzenli çalışmanın faydaları gibi 1-2 genel YKS tavsiyesi sun.)
{{/if}}

{{#if isCustomModelSelected}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' kullanılıyor.)
{{/if}}

{{#if isGemini25PreviewSelected}}
(Gemini 2.5 Flash Preview 05-20 Modeli Notu: Yanıtların ÖZ ama ANLAŞILIR ve YKS öğrencisine doğrudan fayda sağlayacak şekilde olsun. HIZLI yanıt vermeye odaklan. {{#if isProUser}}Pro kullanıcı için gereken derinliği ve stratejik bilgileri koruyarak{{else if isPremiumUser}}Premium kullanıcı için gereken detayları ve pratik ipuçlarını sağlayarak{{/if}} gereksiz uzun açıklamalardan ve süslemelerden kaçın, doğrudan konuya girerek en kritik bilgileri vurgula. JSON formatına HARFİYEN uy! Özellikle 'week' alanı her haftalık planda bir SAYI olarak bulunmalıdır. 'dailyTasks' içindeki her bir görevde 'focusTopics' MUTLAKA en az bir eleman içeren bir dizi olmalıdır.)
{{/if}}

Öğrencinin Girdileri:
{{#if userField}}Seçilen YKS Alanı: {{{userField}}}{{/if}}
{{#if customSubjectsInput}}Özel Odak Konuları: {{{customSubjectsInput}}}{{/if}}
Çalışılacak Ana Dersler/Konular (Önceliklendirilmiş): {{{subjects}}}
Toplam Çalışma Süresi: {{{studyDuration}}}
Günlük Ortalama Çalışma Saati: {{{hoursPerDay}}} saat
{{#if pdfContextText}}
Ek Bağlam (Kullanıcının Yüklediği PDF Metni):
{{{pdfContextText}}}
(Bu metni, öğrencinin odaklanmak istediği konuları veya zayıf olduğu alanları belirlerken dikkate al.)
{{/if}}

Lütfen bu bilgilere göre, aşağıdaki JSON formatına HARFİYEN uyan bir çalışma planı taslağı oluştur. 'weeklyPlans' dizisindeki HER BİR obje, MUTLAKA 'week' adında bir SAYI (number) tipinde alana sahip olmalıdır. 'dailyTasks' dizisindeki her bir günlük görev objesi, MUTLAKA en az bir eleman içeren 'focusTopics' (string dizisi) alanına sahip olmalıdır.

İstenen Çıktı Bölümleri:
1.  **Plan Başlığı (planTitle)**: Örneğin, "Kişiye Özel {{#if userField}}{{{userField}}}{{else}}YKS{{/if}} Hazırlık Planı ({{{studyDuration}}})". ZORUNLUDUR.
2.  **Giriş ve Genel Stratejiler (introduction)**: Plana genel bir giriş ve motivasyon mesajı. Ayrıca, kullanıcının planına göre farklılaşan GENEL STRATEJİLER ve YKS TAKTİKLERİ de BU BÖLÜMDE yer almalıdır (Yukarıdaki plan bazlı notlara göre detaylandır).
3.  **Haftalık Planlar (weeklyPlans)**: ÇOK ÖNEMLİ: Bu dizideki HER BİR obje, MUTLAKA 'week' adında bir SAYI (number) tipinde alana sahip olmalıdır. Her bir 'week' objesi, 'dailyTasks' adlı bir dizi içermelidir. Her bir 'dailyTask' objesi de 'day' (string) ve 'focusTopics' (string dizisi, en az bir eleman) alanlarını MUTLAKA içermelidir.
    *   **Hafta Numarası (week)**: Örn: 1, 2... BU ALAN HER HAFTALIK PLAN OBJESİNDE ZORUNLUDUR VE SAYI OLMALIDIR. AI, BU KURALA KESİNLİKLE UYMALIDIR.
    *   **Haftalık Hedef (weeklyGoal) (isteğe bağlı)**: Haftanın ana hedefi.
    *   **Günlük Görevler (dailyTasks)**: Her gün için:
        *   **Gün (day)**: Günün adı. ZORUNLUDUR.
        *   **Odak Konular (focusTopics)**: O gün çalışılacak ana konular/dersler. ZORUNLUDUR ve en az bir tane olmalıdır.
        *   **Tahmini Süre (estimatedTime) (isteğe bağlı)**: Tahmini çalışma süresi.
        *   **Aktiviteler (activities) (isteğe bağlı)**: Konu çalışma, soru çözümü, tekrar.
        *   **Notlar (notes) (isteğe bağlı)**: O güne özel notlar veya ipuçları.
    Bu 'weeklyPlans' dizisi ZORUNLUDUR ve her elemanın şemaya uyduğundan, özellikle 'week' SAYISININ ve 'dailyTasks' içindeki 'focusTopics'İN DOLU OLDUĞUNDAN MUTLAKA EMİN OL. AI, BU ŞARTLARA HARFİYEN UYMALIDIR. 'week' alanı her zaman bir sayı olmalıdır.
4.  **Sorumluluk Reddi (disclaimer)**: Standart uyarı.

Planlama İlkeleri:
*   Mantıklı bir plan oluştur. {{{subjects}}} konularını ve YKS alanını ({{#if userField}}{{{userField}}}{{else}}belirtilmemiş{{/if}}) dikkate al. {{{customSubjectsInput}}} verilmişse, buna öncelik ver.
*   Konuların zorluk seviyelerine ve YKS'deki ağırlıklarına dikkat et.
*   Gerçekçi ve uygulanabilir ol. Süre kısaysa veya konu çoksa, bunu 'introduction' bölümünde nazikçe belirt ve planı en iyi şekilde optimize etmeye çalış veya daha odaklı bir plan öner.
*   ŞEMADAKİ 'required' OLARAK İŞARETLENMİŞ TÜM ALANLARIN ÇIKTIDA BULUNDUĞUNDAN EMİN OL. ÖZELLİKLE 'weeklyPlans' İÇİNDEKİ HER BİR HAFTANIN 'week' NUMARASININ (SAYI OLARAK) VE 'dailyTasks' İÇİNDEKİ 'focusTopics'İN DOLU OLDUĞUNDAN MUTLAKA EMİN OL. AI, BU ŞARTLARA HARFİYEN UYMALIDIR. 'week' alanı her zaman bir sayı olmalıdır. Yanıtın ÖZ ama ANLAŞILIR olsun.
`,
});
