
'use server';
/**
 * @fileOverview Kullanıcının YKS hedeflerine, konularına ve çalışma süresine göre
 * kişiselleştirilmiş bir çalışma planı taslağı oluşturan AI aracı.
 *
 * - generateStudyPlan - Çalışma planı oluşturma işlemini yöneten fonksiyon.
 * - GenerateStudyPlanInput - generateStudyPlan fonksiyonu için giriş tipi.
 * - GenerateStudyPlanOutput - generateStudyPlan fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { UserProfile } from '@/types';

const GenerateStudyPlanInputSchema = z.object({
  targetExam: z.string().default("YKS").describe("Hedeflenen sınav (örn: YKS, TYT, AYT)."),
  subjects: z.string().min(5).describe("Çalışılması planlanan dersler ve ana konular (virgülle ayrılmış)."),
  studyDuration: z.string().describe("Toplam çalışma süresi (örn: '4_hafta', '3_ay', '6_ay')."),
  hoursPerDay: z.number().min(1).max(12).describe("Günlük ortalama çalışma saati."),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı.")
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
    week: z.number().describe("Planın kaçıncı haftası olduğu. Bu alan ZORUNLUDUR ve her haftalık plan objesinde bulunmalıdır."),
    weeklyGoal: z.string().optional().describe("O haftanın genel çalışma hedefi veya odak noktası."),
    dailyTasks: z.array(DailyTaskSchema).describe("Haftanın günlerine yayılmış günlük görevler ve konular.")
});

const GenerateStudyPlanOutputSchema = z.object({
  planTitle: z.string().describe("Oluşturulan çalışma planı için bir başlık (örn: 'Kişiselleştirilmiş YKS Çalışma Planı')."),
  introduction: z.string().optional().describe("Plana genel bir giriş ve motivasyon mesajı."),
  weeklyPlans: z.array(WeeklyPlanSchema).describe("Haftalık olarak düzenlenmiş çalışma planı. Her bir haftalık plan objesi MUTLAKA 'week' (hafta numarası) alanını İÇERMELİDİR ve bu bir SAYI olmalıdır."),
  generalTips: z.array(z.string()).optional().describe("Genel çalışma stratejileri, mola önerileri ve YKS için ipuçları."),
  disclaimer: z.string().default("Bu, yapay zeka tarafından oluşturulmuş bir taslak plandır. Kendi öğrenme hızınıza ve ihtiyaçlarınıza göre uyarlamanız önemlidir.").describe("Planın bir taslak olduğuna dair uyarı.")
});
export type GenerateStudyPlanOutput = z.infer<typeof GenerateStudyPlanOutputSchema>;

export async function generateStudyPlan(input: GenerateStudyPlanInput): Promise<GenerateStudyPlanOutput> {
  return studyPlanGeneratorFlow(input);
}

const prompt = ai.definePrompt({
  name: 'studyPlanGeneratorPrompt',
  input: {schema: GenerateStudyPlanInputSchema},
  output: {schema: GenerateStudyPlanOutputSchema},
  prompt: `Sen, Yükseköğretim Kurumları Sınavı (YKS) başta olmak üzere çeşitli sınavlara hazırlanan öğrencilere, onların hedeflerine, mevcut bilgilerine (belirtildiyse), çalışma sürelerine ve günlük ayırabilecekleri zamana göre son derece detaylı, kişiselleştirilmiş ve etkili çalışma planları tasarlayan, YKS hazırlık sürecinin her aşamasına hakim uzman bir AI eğitim koçu ve stratejistisin.
Amacın, öğrencinin belirlediği konuları {{{studyDuration}}} içinde, günde ortalama {{{hoursPerDay}}} saat çalışarak en verimli şekilde tamamlamasına yardımcı olacak, haftalık ve günlük bazda yapılandırılmış, gerçekçi bir yol haritası sunmaktır. Plan, YKS (veya {{{targetExam}}}) formatına uygun olmalı ve öğrenciyi motive etmelidir. Cevapların her zaman Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#ifEquals userPlan "pro"}}
Pro kullanıcılar için: Planı, en karmaşık konuların bile nasıl parçalara ayrılarak çalışılabileceğini gösterecek şekilde, farklı öğrenme teknikleri (örn: Pomodoro, Feynman Tekniği) ve genel türde kaynak önerileriyle (spesifik kitap adı olmadan) zenginleştir. Öğrencinin potansiyel darboğazlarını, zaman yönetimi zorluklarını ve motivasyon düşüşlerini öngörerek proaktif çözümler ve alternatif yaklaşımlar sun. En kapsamlı ve stratejik planı oluştur.
{{else ifEquals userPlan "premium"}}
Premium kullanıcılar için: Haftalık hedefleri daha net belirle, günlük aktivitelere örnek soru çözüm sayıları veya tekrar stratejileri ekle. Motivasyonel ipuçlarını artır.
{{/ifEquals}}

Öğrencinin Girdileri:
Hedef Sınav: {{{targetExam}}}
Çalışılacak Konular/Dersler: {{{subjects}}}
Toplam Çalışma Süresi: {{{studyDuration}}}
Günlük Ortalama Çalışma Saati: {{{hoursPerDay}}}

Lütfen bu bilgilere göre, aşağıdaki formatta bir çalışma planı taslağı oluştur: Çıktı, JSON şemasına HARFİYEN uymalıdır. Özellikle 'weeklyPlans' dizisindeki her bir obje, 'week' (hafta numarası, SAYI olarak), 'weeklyGoal' (isteğe bağlı) ve 'dailyTasks' (günlük görevler dizisi) alanlarını içermelidir. 'dailyTasks' içindeki her obje de 'day', 'focusTopics' ve isteğe bağlı diğer alanları içermelidir. Şemada 'required' olarak belirtilen tüm alanlar MUTLAKA çıktıda bulunmalıdır. HER BİR HAFTALIK PLAN OBJESİ 'week' ANAHTARINA SAHİP OLMALI VE BU ANAHTARIN DEĞERİ BİR SAYI (NUMBER) OLMALIDIR. Örneğin: { "week": 1, ... }, { "week": 2, ... } gibi.

1.  **Plan Başlığı (planTitle)**: Örneğin, "Kişiye Özel {{{targetExam}}} Hazırlık Planı ({{{studyDuration}}})". Bu alan ZORUNLUDUR.
2.  **Giriş (introduction) (isteğe bağlı)**: Öğrenciyi motive eden, planın genel mantığını açıklayan kısa bir giriş.
3.  **Haftalık Planlar (weeklyPlans)**: Çalışma süresine göre haftalara bölünmüş planlar. Her hafta için:
    *   **Hafta Numarası (week)**: Örneğin, 1, 2, 3... Bu alan HER HAFTALIK PLAN OBJESİNDE ZORUNLUDUR VE MUTLAKA BİR SAYI OLMALIDIR. Bu değerin kesinlikle bir sayı olduğundan ve her haftalık plan için mevcut olduğundan emin ol.
    *   **Haftalık Hedef (weeklyGoal) (isteğe bağlı)**: O haftanın ana odak noktası veya bitirilmesi hedeflenen genel konu başlıkları.
    *   **Günlük Görevler (dailyTasks)**: Haftanın her günü için (Pazartesi-Pazar veya 1. Gün - 7. Gün):
        *   **Gün (day)**: Günün adı. Bu alan ZORUNLUDUR.
        *   **Odak Konular (focusTopics)**: O gün çalışılacak ana konular veya dersler. Günlük çalışma saatine göre konu sayısı dengeli olmalı. Bu alan ZORUNLUDUR.
        *   **Tahmini Süre (estimatedTime) (isteğe bağlı)**: Her bir odak konuya ayrılması önerilen süre (örn: "Matematik - Türev: 2 saat").
        *   **Aktiviteler (activities) (isteğe bağlı)**: "Konu anlatımı dinleme/okuma", "{{{hoursPerDay}}} soru çözümü", "Kısa tekrar", "Yanlış analizi" gibi spesifik görevler.
        *   **Notlar (notes) (isteğe bağlı)**: O güne özel motivasyon, mola önerisi veya önemli bir ipucu.
    Bu 'weeklyPlans' dizisi ZORUNLUDUR. Her bir elemanının yukarıdaki şemaya uyduğundan emin ol, özellikle 'week' alanının bir sayı olarak varlığından.
4.  **Genel İpuçları (generalTips) (isteğe bağlı)**: Zaman yönetimi, verimli ders çalışma teknikleri, sınav stresiyle başa çıkma gibi genel YKS hazırlık önerileri.
5.  **Sorumluluk Reddi (disclaimer)**: "Bu, yapay zeka tarafından oluşturulmuş bir taslak plandır..." şeklinde standart bir uyarı.

Planlama Prensipleri:
*   {{{subjects}}} listesindeki konuları {{{studyDuration}}} içine mantıklı bir şekilde dağıt. {{{hoursPerDay}}} saatlik günlük çalışmayı göz önünde bulundur.
*   Konuların zorluk seviyelerine ve birbirleriyle bağlantılarına dikkat et.
*   Tekrar ve soru çözümünü plana dahil et.
*   Öğrencinin sıkılmaması için çeşitlilik sağlamaya çalış.
*   Gerçekçi ve uygulanabilir bir plan oluştur.
*   Eğer verilen süre çok kısaysa veya konu sayısı çok fazlaysa, bu durumu nazikçe belirt ve planı en iyi şekilde optimize etmeye çalış veya daha odaklı bir plan öner.
*   Şemadaki 'required' olarak işaretlenmiş tüm alanların çıktıda bulunduğundan emin ol. Özellikle 'weeklyPlans' içindeki her bir haftanın 'week' numarası MUTLAKA BİR SAYI OLARAK belirtilmelidir.
`,
});

const studyPlanGeneratorFlow = ai.defineFlow(
  {
    name: 'studyPlanGeneratorFlow',
    inputSchema: GenerateStudyPlanInputSchema,
    outputSchema: GenerateStudyPlanOutputSchema,
  },
  async (input) => {
    const modelToUse = 'googleai/gemini-2.0-flash'; 
    
    const {output} = await prompt(input, { model: modelToUse });

    if (!output || !output.weeklyPlans) {
      throw new Error("AI Eğitim Koçu, belirtilen girdilerle bir çalışma planı oluşturamadı. Lütfen bilgilerinizi kontrol edin.");
    }
    
    // AI'nın 'week' alanını eklemeyi unuttuğu veya yanlış formatta eklediği durumlar için ek kontrol ve düzeltme
    if (Array.isArray(output.weeklyPlans)) {
      output.weeklyPlans.forEach((plan, index) => {
        if (typeof plan.week !== 'number' || isNaN(plan.week)) {
          console.warn(`Study Plan Generator: AI output for weeklyPlans[${index}] is missing or has an invalid 'week' number. Assigning index+1. Original plan:`, JSON.stringify(plan));
          plan.week = index + 1; // Dizideki sırasına göre bir hafta numarası ata
        }
      });
    } else {
      // Eğer weeklyPlans bir dizi değilse veya boşsa, bu da bir sorundur.
      console.error("Study Plan Generator: AI output for weeklyPlans is not an array or is empty. Input:", JSON.stringify(input));
      throw new Error("AI Eğitim Koçu, haftalık planları doğru formatta oluşturamadı.");
    }

    return output;
  }
);

