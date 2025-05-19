
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
  userPlan: z.enum(["free", "premium", "pro"]).optional().describe("Kullanıcının mevcut üyelik planı. Eksikse 'free' varsayılacaktır."), // Made optional
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi."),
  pdfContextText: z.string().optional().describe("Kullanıcının yüklediği PDF'ten çıkarılan, çalışma planı oluşturulurken ek bağlam olarak kullanılacak metin."),
});
export type GenerateStudyPlanInput = z.infer<typeof GenerateStudyPlanInputSchema>;

const DailyTaskSchema = z.object({
    day: z.string().describe("Haftanın günü veya planın belirli bir günü (örn: Pazartesi, 1. Gün)."),
    focusTopics: z.array(z.string()).min(1).describe("O gün odaklanılacak ana konular veya dersler. En az bir tane olmalıdır."), // Ensure at least one topic
    estimatedTime: z.string().optional().describe("Her konu/ders için tahmini çalışma süresi."),
    activities: z.array(z.string()).optional().describe("Konu çalışma, soru çözümü, tekrar gibi aktiviteler."),
    notes: z.string().optional().describe("O güne özel ek notlar veya ipuçları.")
});

const WeeklyPlanSchema = z.object({
    week: z.number().describe("Planın kaçıncı haftası olduğu. Bu alan HER ZAMAN ZORUNLUDUR ve her haftalık plan objesinde bir SAYI olarak bulunmalıdır."),
    weeklyGoal: z.string().optional().describe("O haftanın genel çalışma hedefi veya odak noktası."),
    dailyTasks: z.array(DailyTaskSchema).min(1).describe("Haftanın günlerine yayılmış günlük görevler ve konular. En az bir günlük görev olmalıdır.") // Ensure at least one daily task
});

const GenerateStudyPlanOutputSchema = z.object({
  planTitle: z.string().describe("Oluşturulan çalışma planı için bir başlık."),
  introduction: z.string().describe("Plana genel bir giriş ve motivasyon mesajı. Kullanıcının planına göre farklılaşan genel stratejiler ve YKS taktikleri de bu bölümde yer almalıdır."),
  weeklyPlans: z.array(WeeklyPlanSchema).min(1).describe("Haftalık olarak düzenlenmiş çalışma planı. Her bir haftalık plan objesi MUTLAKA 'week' (hafta numarası, SAYI olarak) alanını İÇERMELİDİR ve en az bir haftalık plan olmalıdır."), // Ensure at least one weekly plan
  disclaimer: z.string().default("Bu, yapay zeka tarafından oluşturulmuş bir taslak plandır. Kendi öğrenme hızınıza ve ihtiyaçlarınıza göre uyarlamanız önemlidir.").describe("Planın bir taslak olduğuna dair uyarı.")
});
export type GenerateStudyPlanOutput = z.infer<typeof GenerateStudyPlanOutputSchema>;

const defaultErrorResponse: GenerateStudyPlanOutput = {
  planTitle: "Plan Oluşturma Hatası",
  introduction: "Çalışma planı oluşturulurken beklenmedik bir sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin veya destek ile iletişime geçin.",
  weeklyPlans: [],
  disclaimer: "Bir hata nedeniyle plan oluşturulamadı."
};

// This is the server action that client components will call.
export async function generateStudyPlan(input: GenerateStudyPlanInput): Promise<GenerateStudyPlanOutput> {
  // En dışta bir try-catch bloğu ile tüm server action'ı sarmala
  try {
    const currentPlan = input.userPlan || 'free'; // Eğer userPlan gelmezse 'free' varsay
    const isProUser = currentPlan === 'pro';
    const isPremiumUser = currentPlan === 'premium';
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
    
    // AI Flow'u çağır
    let flowOutput = await studyPlanGeneratorFlow(enrichedInputForPrompt);

    // İstemci tarafına dönmeden önce burada da bir doğrulama/düzeltme yapabiliriz.
    // Ancak ana düzeltme flow içinde yapılmalı. Bu katman daha çok flow'dan tamamen geçersiz bir şey dönerse diye.
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
    
    // Client-side'da yapılan düzeltmeler burada da yapılabilir, ama idealde flow'un kendisi doğru formatı vermeli.
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
    // Server Action katmanında genel bir hata yakalama
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
    return { // Her zaman SolveQuestionOutput şemasına uygun bir nesne döndür
        ...defaultErrorResponse,
        introduction: `Sunucu tarafında kritik bir hata oluştu: ${errorMessage}. Lütfen daha sonra tekrar deneyin veya bir sorun olduğunu düşünüyorsanız destek ile iletişime geçin.`
    };
  }
}

// Bu Genkit flow'u, input'u alır ve AI'ye gönderir.
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
  async (input: z.infer<typeof GenerateStudyPlanInputSchema> & {subjects?: string; isProUser?: boolean; isPremiumUser?: boolean; isCustomModelSelected?: boolean; isGemini25PreviewSelected?: boolean} ): Promise<GenerateStudyPlanOutput> => {
    // En dışta bir try-catch bloğu ile tüm flow'u sarmala
    let modelToUse = 'googleai/gemini-2.0-flash'; // Varsayılan hata durumunda gösterilecek model
    try {
      console.log(`[Study Plan Generator Flow (Genkit)] Starting flow with input:`, { userPlan: input.userPlan, customModel: input.customModelIdentifier, studyDuration: input.studyDuration, hoursPerDay: input.hoursPerDay, subjects: input.subjects?.substring(0,100) + "...", pdfContextProvided: !!input.pdfContextText });
      
      const effectivePlan = input.userPlan || 'free';

      // Model seçimi (Soru Çözücü'deki gibi)
      modelToUse = 'googleai/gemini-1.5-flash-latest'; // Pro ve özel model yoksa varsayılan
      if (input.isCustomModelSelected) {
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
            console.warn(`[Study Plan Generator Flow (Genkit)] Unknown customModelIdentifier: ${input.customModelIdentifier}. Defaulting based on plan ${effectivePlan}`);
            if (effectivePlan !== 'pro') { // Sadece Pro değilse eski flash'a dön
               modelToUse = 'googleai/gemini-2.0-flash';
            } // Pro ise zaten 'googleai/gemini-1.5-flash-latest' idi.
            break; 
        }
      } else if (effectivePlan !== 'pro') { // Özel model yok VE Pro değilse eski flash
        modelToUse = 'googleai/gemini-2.0-flash';
      }
      // Pro kullanıcılar ve özel model seçmemişlerse varsayılan olarak 'googleai/gemini-1.5-flash-latest' kalır.


      let callOptions: { model: string; config?: Record<string, any> } = { model: modelToUse };
      if (modelToUse !== 'googleai/gemini-2.5-flash-preview-04-17') {
        callOptions.config = {
          generationConfig: {
            maxOutputTokens: 8000, // Çıktı uzun olabilir
          }
        };
      } else {
          callOptions.config = {}; // Preview modeli için config gönderme
      }

      console.log(`[Study Plan Generator Flow (Genkit)] Using model: ${modelToUse} with options:`, JSON.stringify(callOptions), `for plan: ${effectivePlan}`);
      const result = await studyPlanGeneratorPrompt(input, callOptions);
      let output = result.output; 

      // AI'dan gelen çıktıyı doğrula ve düzelt (Post-processing)
      if (!output || typeof output.planTitle !== 'string' || typeof output.introduction !== 'string' || !Array.isArray(output.weeklyPlans) || output.weeklyPlans.length === 0) {
          const errorDetail = !output ? "AI anlamsız bir yanıt döndürdü (null/undefined)." :
                            typeof output.planTitle !== 'string' ? "Plan başlığı (planTitle) eksik veya geçersiz." :
                            typeof output.introduction !== 'string' ? "Giriş metni (introduction) eksik veya geçersiz." :
                            !Array.isArray(output.weeklyPlans) ? "Haftalık planlar (weeklyPlans) bir dizi değil." :
                            output.weeklyPlans.length === 0 ? "Haftalık planlar (weeklyPlans) boş geldi." :
                            "Bilinmeyen yapısal hata.";
          console.error(`[Study Plan Generator Flow (Genkit)] AI output is missing critical fields or has invalid structure: ${errorDetail}. Raw Output:`, JSON.stringify(output).substring(0,500));
          // Throw an error that the server action layer can catch and format
          throw new Error(`AI, beklenen temel plan yapısını (${errorDetail}) oluşturamadı. Model: ${modelToUse}.`);
      }

      output.weeklyPlans = output.weeklyPlans.map((plan: any, index) => {
          const correctedPlan: any = {
              week: (plan && typeof plan.week === 'number' && !isNaN(plan.week)) ? plan.week : index + 1,
              dailyTasks: [],
              weeklyGoal: (plan && typeof plan.weeklyGoal === 'string') ? plan.weeklyGoal : `Hafta ${index + 1} Hedefi` // Varsayılan hedef
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
      // Flow içindeki hataları yakala ve daha bilgilendirici bir mesajla yeniden fırlat
      // Bu, server action katmanının yakalaması için.
      console.error(`[Study Plan Generator Flow (Genkit)] CRITICAL ERROR in Genkit flow:`, flowError, "Input (main part):", { userField: input.userField, customSubjectsInput: input.customSubjectsInput, studyDuration: input.studyDuration, hoursPerDay: input.hoursPerDay, userPlan: input.userPlan, customModelIdentifier: input.customModelIdentifier });
      let errorMessage = `AI Eğitim Koçu ile çalışma planı oluşturulurken bir Genkit/AI hatası oluştu. Kullanılan Model: ${modelToUse}.`;
      if (flowError instanceof Error) {
        errorMessage += ` Detay: ${flowError.message.substring(0, 300)}`;
         if (flowError.name === 'GenkitError' && flowError.message.includes('Schema validation failed')) {
            let zodErrors = "Şema Doğrulama Hatası.";
            // @ts-ignore
            if (flowError.details && Array.isArray(flowError.details)) {
                // @ts-ignore
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
      // Flow'dan hata fırlatmak yerine, her zaman SolveQuestionOutput döndür.
      // Server action katmanı bu hatayı alıp kendi defaultErrorResponse'unu oluşturacak.
      // Ancak, burada da defaultErrorResponse'a benzer bir yapı döndürmek daha tutarlı olabilir.
      return {
        planTitle: "Plan Oluşturma Başarısız",
        introduction: errorMessage,
        weeklyPlans: [],
        disclaimer: "Bir hata oluştu. Lütfen daha sonra tekrar deneyin."
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
{{#if isCustomModelSelected}}
(Admin Notu: Özel model '{{{customModelIdentifier}}}' kullanılıyor.)
  {{#if isGemini25PreviewSelected}}
  (Gemini 2.5 Flash Preview Notu: Yanıtların ÖZ ama ANLAŞILIR olsun. HIZLI yanıtla. JSON formatına HARFİYEN uy! Özellikle 'week' alanı her haftalık planda bir SAYI olarak bulunmalıdır. 'dailyTasks' içindeki her bir görevde 'focusTopics' MUTLAKA en az bir eleman içeren bir dizi olmalıdır.)
  {{/if}}
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
2.  **Giriş ve Genel Stratejiler (introduction)**: Plana genel bir giriş ve motivasyon mesajı. Ayrıca, kullanıcının planına göre farklılaşan GENEL STRATEJİLER ve YKS TAKTİKLERİ de BU BÖLÜMDE yer almalıdır.
    {{#if isProUser}}
    (Pro Kullanıcı için Stratejiler: En kapsamlı YKS stratejileri, öğrenme teknikleri (Feynman, Pomodoro vb.), kaynak önerileri, deneme sınavı taktikleri, stres yönetimi gibi uzman seviyesinde bilgiler sun. Mümkünse, sık yapılan hatalara ve bunlardan kaçınma yollarına değin. Bu bölüm daha detaylı olabilir.)
    {{else if isPremiumUser}}
    (Premium Kullanıcı için Stratejiler: Etkili konu tekrarı yöntemleri, çalışma verimliliği ipuçları, genel motivasyon teknikleri ve zaman yönetimi hakkında bilgiler sun.)
    {{else}}
    (Ücretsiz Kullanıcı için Stratejiler: Temel çalışma alışkanlıkları, mola vermenin önemi, düzenli çalışmanın faydaları gibi birkaç genel YKS tavsiyesi sun.)
    {{/if}}
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
```
```xml
  <change>
    <file>/src/app/(app)/dashboard/ai-tools/study-plan-generator/page.tsx</file>
    <content><![CDATA[
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalendarDays, Wand2, Loader2, AlertTriangle, Settings, UploadCloud, FileText as FileTextIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input as ShadInput } from "@/components/ui/input"; 
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import React, { useState, useEffect, useCallback, Fragment } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useUser";
import { generateStudyPlan, type GenerateStudyPlanOutput, type GenerateStudyPlanInput } from "@/ai/flows/study-plan-generator-flow";
import { extractTextFromPdf } from "@/lib/pdfUtils";

const MAX_PDF_SIZE_MB = 5;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

const renderFormattedText = (text: string | undefined | null, keyPrefix: string): React.ReactNode[] => {
  if (text === null || text === undefined || text.trim() === "") {
    return [<Fragment key={`${keyPrefix}-empty`}></Fragment>];
  }
  
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let listItems: React.ReactNode[] = [];
  let keyCounter = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`${keyPrefix}-ul-${keyCounter++}`} className="list-disc pl-5 my-2 space-y-1 text-muted-foreground">
          {listItems.map((item, idx) => <li key={`${keyPrefix}-li-${keyCounter}-${idx}`}>{item}</li>)}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    const specialLabelMatch = trimmedLine.match(/^(PRO KULLANICI İÇİN STRATEJİLER|PREMIUM KULLANICI İÇİN STRATEJİLER|ÜCRETSİZ KULLANICI İÇİN STRATEJİLER|ÖNEMLİ NOT|UNUTMA|GENEL STRATEJİLER VE YKS TAKTİKLERİ|NOT|PRO İPUCU)\s*:\s*(.*)/i);


    if (specialLabelMatch) {
      flushList();
      const label = specialLabelMatch[1];
      const content = specialLabelMatch[2];
      elements.push(
        <div key={`${keyPrefix}-tip-${keyCounter++}`} className="my-3 p-3 border-l-4 border-primary bg-primary/10 rounded-r-md">
          <strong className="font-semibold text-primary">{label.trim()}:</strong>
          <p className="text-muted-foreground mt-1 leading-relaxed">{content || <Fragment>&nbsp;</Fragment>}</p>
        </div>
      );
    } else if (trimmedLine.startsWith("## ")) {
       flushList();
       elements.push(<h3 key={`${keyPrefix}-h3-${keyCounter++}`} className="text-xl font-semibold mt-4 mb-2 text-foreground">{trimmedLine.substring(3)}</h3>);
    } else if (trimmedLine.startsWith("### ")) {
       flushList();
       elements.push(<h4 key={`${keyPrefix}-h4-${keyCounter++}`} className="text-lg font-semibold mt-3 mb-1 text-foreground">{trimmedLine.substring(4)}</h4>);
    } else if (trimmedLine.startsWith("* ") || trimmedLine.startsWith("- ")) {
      listItems.push(trimmedLine.substring(trimmedLine.indexOf(' ') + 1) || <Fragment>&nbsp;</Fragment>);
    } else if (trimmedLine === "") {
       flushList();
    }
    else {
      flushList();
      elements.push(<p key={`${keyPrefix}-p-${keyCounter++}`} className="my-1 text-muted-foreground leading-relaxed">{line || <Fragment>&nbsp;</Fragment>}</p>); 
    }
  });
  flushList(); 
  return elements.length > 0 ? elements : [<Fragment key={`${keyPrefix}-empty-final`}></Fragment>];
};


export default function StudyPlanGeneratorPage() {
  const [userField, setUserField] = useState<GenerateStudyPlanInput["userField"] | undefined>(undefined);
  const [customSubjectsInput, setCustomSubjectsInput] = useState("");
  const [studyDuration, setStudyDuration] = useState("4_hafta");
  const [hoursPerDay, setHoursPerDay] = useState(4);
  const [planOutput, setPlanOutput] = useState<GenerateStudyPlanOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [adminSelectedModel, setAdminSelectedModel] = useState<string | undefined>(undefined);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [pdfContextText, setPdfContextText] = useState<string | null>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({});


  const { toast } = useToast();
  const { userProfile, loading: userProfileLoading, checkAndResetQuota, decrementQuota } = useUser();
  const [canProcess, setCanProcess] = useState(false);

  const memoizedCheckAndResetQuota = useCallback(async () => {
    if (!checkAndResetQuota) return userProfile; 
    return checkAndResetQuota();
  }, [checkAndResetQuota, userProfile]);

  useEffect(() => {
    if (!userProfileLoading) {
      if (userProfile) {
        memoizedCheckAndResetQuota().then(updatedProfile => {
          setCanProcess((updatedProfile?.dailyRemainingQuota ?? 0) > 0);
        });
      } else {
         setCanProcess(false); 
      }
    }
  }, [userProfile, userProfileLoading, memoizedCheckAndResetQuota]);

  const handlePdfFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast({ title: "Geçersiz Dosya Türü", description: "Lütfen bir PDF dosyası yükleyin.", variant: "destructive" });
        setPdfFile(null); setPdfFileName(null); setPdfContextText(null);
        event.target.value = ""; return;
      }
      if (file.size > MAX_PDF_SIZE_BYTES) {
        toast({ title: "Dosya Boyutu Çok Büyük", description: `Lütfen ${MAX_PDF_SIZE_MB}MB'den küçük bir PDF dosyası yükleyin.`, variant: "destructive" });
        setPdfFile(null); setPdfFileName(null); setPdfContextText(null);
        event.target.value = ""; return;
      }
      
      const confirmUpload = window.confirm(`"${file.name}" adlı dosyayı yükleyip içeriğini çalışma planı için ek bağlam olarak kullanmak istediğinize emin misiniz? Bu işlem dosya boyutuna göre zaman alabilir.`);
      if (!confirmUpload) {
        event.target.value = ""; 
        setPdfFile(null); setPdfFileName(null); setPdfContextText(null);
        return;
      }
      
      setPdfFile(file); setPdfFileName(file.name); setPlanOutput(null); 
      setIsProcessingPdf(true);
      toast({ title: "PDF İşleniyor...", description: "Lütfen bekleyin." });
      try {
        const text = await extractTextFromPdf(file);
        setPdfContextText(text);
        toast({ title: "PDF İşlendi", description: "PDF içeriği çalışma planı için ek bağlam olarak kullanılmaya hazır." });
      } catch (error: any) {
        console.error("PDF metin çıkarma hatası:", error);
        toast({ title: "PDF İşleme Hatası", description: error.message || "PDF'ten metin çıkarılırken bir hata oluştu.", variant: "destructive" });
        setPdfFile(null); setPdfFileName(null); setPdfContextText(null);
        event.target.value = ""; 
      } finally {
        setIsProcessingPdf(false);
      }
    } else {
      setPdfFile(null); setPdfFileName(null); setPdfContextText(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userField && !customSubjectsInput.trim()) {
      toast({ title: "Girdi Gerekli", description: "Lütfen bir YKS alanı seçin veya odaklanmak istediğiniz konuları girin.", variant: "destructive" });
      return;
    }
    if (hoursPerDay < 1 || hoursPerDay > 12) {
        toast({ title: "Geçersiz Saat", description: "Günlük çalışma saati 1 ile 12 arasında olmalıdır.", variant: "destructive" });
        return;
    }

    setIsGenerating(true);
    setPlanOutput(null);
    setExpandedWeeks({});

    const currentProfile = await memoizedCheckAndResetQuota();
    if (!currentProfile) { 
      toast({ title: "Kullanıcı Bilgisi Yüklenemedi", description: "Lütfen sayfayı yenileyin veya tekrar giriş yapın.", variant: "destructive" });
      setIsGenerating(false);
      setCanProcess(false); 
      return;
    }
    
    const currentCanProcess = (currentProfile.dailyRemainingQuota ?? 0) > 0;
    setCanProcess(currentCanProcess); 

    if (!currentCanProcess) {
      toast({ title: "Kota Aşıldı", description: "Bugünkü plan oluşturma hakkınızı doldurdunuz.", variant: "destructive" });
      setIsGenerating(false);
      return;
    }
    
    try {
      const input: GenerateStudyPlanInput = {
        userField: userField || undefined,
        customSubjectsInput: customSubjectsInput.trim() || undefined,
        studyDuration,
        hoursPerDay,
        userPlan: currentProfile.plan, 
        customModelIdentifier: userProfile?.isAdmin ? adminSelectedModel : undefined,
        pdfContextText: pdfContextText || undefined,
      };
      
      let flowOutput = await generateStudyPlan(input);

      if (!flowOutput || typeof flowOutput.planTitle !== 'string' || typeof flowOutput.introduction !== 'string' || !Array.isArray(flowOutput.weeklyPlans)) {
        const errorDetail = !flowOutput ? "Flow tanımsız bir yanıt döndürdü." :
                            typeof flowOutput.planTitle !== 'string' ? "Plan başlığı (planTitle) eksik veya geçersiz." :
                            typeof flowOutput.introduction !== 'string' ? "Giriş metni (introduction) eksik veya geçersiz." :
                            !Array.isArray(flowOutput.weeklyPlans) ? "Haftalık planlar (weeklyPlans) bir dizi değil." :
                            "Bilinmeyen yapısal hata.";
        console.error(`[Study Plan Generator Page] Flow returned invalid structure: ${errorDetail}. Raw output:`, JSON.stringify(flowOutput).substring(0, 500));
        
        const introMessage = flowOutput?.introduction && typeof flowOutput.introduction === 'string' ? flowOutput.introduction : `AI akışından beklenen yapıda bir yanıt alınamadı. ${errorDetail}. Lütfen tekrar deneyin.`;
        setPlanOutput({
            planTitle: flowOutput?.planTitle || "Plan Oluşturma Başarısız",
            introduction: introMessage,
            weeklyPlans: [], 
            disclaimer: flowOutput?.disclaimer || "Bir hata nedeniyle plan oluşturulamadı."
        });
        toast({ title: "Plan Oluşturma Sonucu Yetersiz", description: introMessage, variant: "destructive"});

      } else {
        // Client-side post-processing just in case, flow should ideally handle this
        flowOutput.weeklyPlans = flowOutput.weeklyPlans.map((plan: any, index) => ({
          ...plan,
          week: (plan && typeof plan.week === 'number' && !isNaN(plan.week)) ? plan.week : index + 1,
          dailyTasks: Array.isArray(plan.dailyTasks) ? plan.dailyTasks.map((task: any, taskIndex: number) => ({
            ...task,
            day: (task && typeof task.day === 'string' && task.day.trim() !== "") ? task.day.trim() : `Gün ${taskIndex + 1}`,
            focusTopics: (task && Array.isArray(task.focusTopics) && task.focusTopics.length > 0 && task.focusTopics.every((t:any) => typeof t === 'string' && t.trim() !== "")) ? task.focusTopics.map(t => t.trim()).filter(t => t) : ["Genel Tekrar / Boş Zaman"],
          })) : [{ day: "1. Gün", focusTopics: ["Bu hafta için görevler üretilemedi."], activities: [], estimatedTime: "Esnek", notes: "Lütfen girdilerinizi kontrol edin." }],
        }));
        setPlanOutput(flowOutput);
        toast({ title: "Çalışma Planı Hazır!", description: "Kişiselleştirilmiş çalışma planınız oluşturuldu." });
        
        const decrementSuccess = await decrementQuota(currentProfile); 
        if (decrementSuccess) {
            const updatedProfileAfterDecrement = await memoizedCheckAndResetQuota();
            if (updatedProfileAfterDecrement) {
              setCanProcess((updatedProfileAfterDecrement.dailyRemainingQuota ?? 0) > 0);
            }
        } else {
            const refreshedProfile = await memoizedCheckAndResetQuota();
            if (refreshedProfile) {
              setCanProcess((refreshedProfile.dailyRemainingQuota ?? 0) > 0);
            }
        }
      }
    } catch (error: any) {
      console.error("[Study Plan Generator Page] Plan oluşturma hatası (handleSubmit catch):", error);
      let displayErrorMessage = "Çalışma planı oluşturulurken beklenmedik bir istemci tarafı hatası oluştu.";
        if (error instanceof Error) {
            displayErrorMessage = error.message;
        } else if (typeof error === 'string' && error.length > 0) {
            displayErrorMessage = error;
        } else if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
            displayErrorMessage = error.message;
        }
      setPlanOutput({ planTitle: "Hata", introduction: displayErrorMessage, weeklyPlans: [], disclaimer: "Bir sorun oluştu." });
      toast({ title: "Oluşturma Hatası", description: displayErrorMessage, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const isSubmitButtonDisabled = 
    isGenerating || 
    isProcessingPdf || 
    (!userField && !customSubjectsInput.trim()) ||
    (hoursPerDay < 1 || hoursPerDay > 12) || 
    (!userProfileLoading && userProfile && !canProcess) || 
    (!userProfileLoading && !userProfile); 
  
  const isModelSelectDisabled = 
    isGenerating || 
    isProcessingPdf ||
    !userProfile?.isAdmin ||
    (!userProfileLoading && userProfile && !canProcess) ||
    (!userProfileLoading && !userProfile);

  const isFormElementsDisabled = 
    isGenerating || 
    isProcessingPdf || 
    (!userProfileLoading && userProfile && !canProcess) ||
    (!userProfileLoading && !userProfile);

  const toggleWeekExpansion = (weekNumber: number) => {
    setExpandedWeeks(prev => ({ ...prev, [weekNumber]: !prev[weekNumber] }));
  };

  if (userProfileLoading && !userProfile) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">AI Çalışma Planı Oluşturucu yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CalendarDays className="h-7 w-7 text-primary" /> 
            <CardTitle className="text-2xl">AI Çalışma Planı Oluşturucu</CardTitle>
          </div>
          <CardDescription>
            YKS alanınızı, toplam çalışma sürenizi ve günlük çalışma saatinizi girin. İsteğe bağlı olarak, konularınızı veya notlarınızı içeren bir PDF yükleyerek ya da özel konular belirterek AI'nın daha kişisel bir plan oluşturmasına yardımcı olabilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
         {userProfile?.isAdmin && (
              <div className="space-y-2 p-4 mb-4 border rounded-md bg-muted/50">
                <Label htmlFor="adminModelSelectStudyPlan" className="font-semibold text-primary flex items-center gap-2"><Settings size={16}/> Model Seç (Admin Özel)</Label>
                <Select 
                  value={adminSelectedModel} 
                  onValueChange={setAdminSelectedModel} 
                  disabled={isModelSelectDisabled}
                >
                  <SelectTrigger id="adminModelSelectStudyPlan">
                    <SelectValue placeholder="Varsayılan Modeli Kullan (Plan Bazlı)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default_gemini_flash">Varsayılan (Gemini 2.0 Flash)</SelectItem>
                    <SelectItem value="experimental_gemini_1_5_flash">Deneysel (Gemini 1.5 Flash)</SelectItem>
                    <SelectItem value="experimental_gemini_2_5_flash_preview">Deneysel (Gemini 2.5 Flash Preview)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Farklı AI modellerini test edebilirsiniz.</p>
              </div>
            )}
        </CardContent>
      </Card>

      {!userProfileLoading && userProfile && !canProcess && !isGenerating && !isProcessingPdf && (userProfile.dailyRemainingQuota ?? 0) <=0 && (
         <Alert variant="destructive" className="shadow-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Günlük Kota Doldu</AlertTitle>
          <AlertDescription>
            Bugünlük ücretsiz hakkınızı kullandınız. Lütfen yarın tekrar kontrol edin veya Premium/Pro'ya yükseltin.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
             <CardTitle className="text-lg">Plan Detayları</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="userField">YKS Alanınız / Bölümünüz</Label>
                    <Select value={userField} onValueChange={(value: GenerateStudyPlanInput["userField"]) => setUserField(value)} disabled={isFormElementsDisabled}>
                        <SelectTrigger id="userField" className="mt-1">
                            <SelectValue placeholder="Bir alan seçin veya özel konu girin" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="sayisal">Sayısal</SelectItem>
                            <SelectItem value="ea">Eşit Ağırlık</SelectItem>
                            <SelectItem value="sozel">Sözel</SelectItem>
                            <SelectItem value="tyt">Sadece TYT</SelectItem>
                        </SelectContent>
                    </Select>
                     <p className="text-xs text-muted-foreground mt-1">Bir alan seçerseniz, AI o alana özgü dersleri plana dahil eder.</p>
                </div>
                 <div>
                    <Label htmlFor="customSubjectsInput">Veya Odaklanmak İstediğiniz Özel Konular/Dersler (isteğe bağlı)</Label>
                    <Textarea
                        id="customSubjectsInput"
                        placeholder="Örn: Sadece Kimya - Organik Kimya ve Çözeltiler konuları için bir plan istiyorum. Veya: Matematik - Türev ve İntegral'e ağırlık ver."
                        value={customSubjectsInput}
                        onChange={(e) => setCustomSubjectsInput(e.target.value)}
                        rows={3}
                        className="mt-1"
                        disabled={isFormElementsDisabled}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Bu alanı doldurursanız, yukarıdaki alan seçimi yerine bu konular önceliklendirilir.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="studyDuration">Toplam Çalışma Süresi</Label>
                    <Select value={studyDuration} onValueChange={setStudyDuration} disabled={isFormElementsDisabled} className="mt-1">
                        <SelectTrigger id="studyDuration">
                            <SelectValue placeholder="Süre seçin" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1_hafta">1 Hafta</SelectItem>
                            <SelectItem value="2_hafta">2 Hafta</SelectItem>
                            <SelectItem value="4_hafta">4 Hafta (1 Ay)</SelectItem>
                            <SelectItem value="8_hafta">8 Hafta (2 Ay)</SelectItem>
                            <SelectItem value="12_hafta">12 Hafta (3 Ay)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div>
                    <Label htmlFor="hoursPerDay">Günlük Ortalama Çalışma Saati (1-12)</Label>
                    <ShadInput type="number" id="hoursPerDay" value={hoursPerDay} onChange={(e) => setHoursPerDay(parseInt(e.target.value, 10))} min="1" max="12" disabled={isFormElementsDisabled} className="mt-1"/>
                </div>
            </div>
           
            <div className="space-y-2">
                <Label htmlFor="pdfUploadStudyPlan" className="flex items-center gap-2">
                    <UploadCloud className="h-5 w-5 text-muted-foreground" />
                    Ek Bağlam İçin PDF Yükle (İsteğe Bağlı, Maks {MAX_PDF_SIZE_MB}MB)
                </Label>
                <ShadInput 
                    id="pdfUploadStudyPlan"
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfFileChange}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    disabled={isFormElementsDisabled}
                />
                {pdfFileName && (
                  <div className="mt-2 flex items-center text-sm text-muted-foreground bg-muted p-2 rounded-md">
                    <FileTextIcon className="h-5 w-5 mr-2 text-primary" />
                    Yüklenen PDF: {pdfFileName} {isProcessingPdf && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  </div>
                )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitButtonDisabled}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Çalışma Planı Oluştur
            </Button>
          </CardContent>
        </Card>
      </form>

      {isGenerating && !planOutput && (
        <Card className="mt-6 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium text-foreground">Çalışma Planı Oluşturuluyor...</p>
              <p className="text-sm text-muted-foreground">
                Yapay zeka sizin için en uygun planı hazırlıyor... Bu işlem biraz zaman alabilir.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {planOutput && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{planOutput.planTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             {planOutput.introduction && (
                <Card className="bg-muted/30 p-4">
                    <CardHeader className="p-0 mb-2">
                        <CardTitle className="text-xl text-primary">Giriş ve Genel Stratejiler</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 prose prose-sm dark:prose-invert max-w-none">
                        {renderFormattedText(planOutput.introduction, "intro")}
                    </CardContent>
                </Card>
             )}
            
            <h3 className="text-2xl font-semibold text-center text-primary mt-6 mb-4">Haftalık Planlar</h3>
            <ScrollArea className="h-auto max-h-[700px] w-full rounded-md border">
              <div className="p-1 sm:p-4">
              {planOutput.weeklyPlans && planOutput.weeklyPlans.length > 0 ? (
                planOutput.weeklyPlans.map((weekPlan, weekIndex) => (
                  <Card key={`week-${weekPlan.week ?? weekIndex}`} className="bg-card shadow-md mb-6 last:mb-0">
                    <CardHeader 
                        className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg p-4"
                        onClick={() => toggleWeekExpansion(weekPlan.week ?? weekIndex)}
                    >
                        <CardTitle className="text-lg text-primary">
                        {weekPlan.week ?? (weekIndex + 1)}. Hafta
                        {weekPlan.weeklyGoal && `: ${weekPlan.weeklyGoal}`}
                        </CardTitle>
                        {expandedWeeks[weekPlan.week ?? weekIndex] ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                    </CardHeader>
                    {expandedWeeks[weekPlan.week ?? weekIndex] && (
                        <CardContent className="space-y-4 pt-4 border-t p-4">
                            {weekPlan.dailyTasks && weekPlan.dailyTasks.length > 0 ? (
                            weekPlan.dailyTasks.map((dayTask, dayIndex) => (
                                <div key={`day-${weekPlan.week ?? weekIndex}-${dayIndex}`} className="p-3 border rounded-md bg-background/50">
                                <h4 className="font-semibold text-foreground mb-1">{dayTask.day}</h4>
                                <p className="text-sm text-muted-foreground">
                                    <strong className="text-foreground/90">Odak Konular:</strong> {dayTask.focusTopics.join(", ")}
                                </p>
                                {dayTask.activities && dayTask.activities.length > 0 && (
                                    <div className="mt-2">
                                    <p className="text-xs text-foreground/80 font-medium">Aktiviteler:</p>
                                    <ul className="list-disc list-inside pl-4 text-xs text-muted-foreground space-y-0.5">
                                        {dayTask.activities.map((activity, actIndex) => <li key={`act-${weekPlan.week ?? weekIndex}-${dayIndex}-${actIndex}`}>{activity}</li>)}
                                    </ul>
                                    </div>
                                )}
                                {dayTask.estimatedTime && <p className="text-xs text-muted-foreground mt-2"><strong className="text-foreground/80">Tahmini Süre:</strong> {dayTask.estimatedTime}</p>}
                                {dayTask.notes && <div className="text-xs mt-2 prose prose-xs dark:prose-invert max-w-none whitespace-pre-line">{renderFormattedText(dayTask.notes, `week${weekPlan.week ?? weekIndex}-day${dayIndex}-notes`)}</div>}
                                </div>
                            ))
                            ) : (
                            <p className="text-sm text-muted-foreground italic p-3">Bu hafta için günlük görev bulunmuyor.</p>
                            )}
                        </CardContent>
                    )}
                  </Card>
                ))
              ) : (
                 <p className="text-center text-muted-foreground p-6">Haftalık planlar oluşturulamadı veya bulunamadı.</p>
              )}
              </div>
            </ScrollArea>
             {planOutput.disclaimer && (
                <Alert className="mt-4" variant="default">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Sorumluluk Reddi</AlertTitle>
                    <AlertDescription>{renderFormattedText(planOutput.disclaimer, "disclaimer")}</AlertDescription>
                </Alert>
             )}
            <div className="mt-4 p-3 text-xs text-destructive-foreground bg-destructive/80 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>NeutralEdu AI bir yapay zekadır bu nedenle hata yapabilir, bu yüzden verdiği bilgileri doğrulayınız ve bu planı bir başlangıç noktası olarak kullanınız.</span>
            </div>
          </CardContent>
        </Card>
      )}
       {!isGenerating && !isProcessingPdf && !planOutput && !userProfileLoading && (!userProfile || (userProfile && canProcess)) && ( 
         <Alert className="mt-6">
          <CalendarDays className="h-4 w-4" />
          <AlertTitle>Plana Hazır!</AlertTitle>
          <AlertDescription>
            Yukarıdaki formu doldurarak kişiselleştirilmiş YKS çalışma planınızı oluşturun. İsterseniz ek bağlam için bir PDF de yükleyebilirsiniz.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

    