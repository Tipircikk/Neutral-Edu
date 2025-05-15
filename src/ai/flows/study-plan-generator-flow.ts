
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
    week: z.number().describe("Planın kaçıncı haftası olduğu."),
    weeklyGoal: z.string().optional().describe("O haftanın genel çalışma hedefi veya odak noktası."),
    dailyTasks: z.array(DailyTaskSchema).describe("Haftanın günlerine yayılmış günlük görevler ve konular.")
});

const GenerateStudyPlanOutputSchema = z.object({
  planTitle: z.string().describe("Oluşturulan çalışma planı için bir başlık (örn: 'Kişiselleştirilmiş YKS Çalışma Planı')."),
  introduction: z.string().optional().describe("Plana genel bir giriş ve motivasyon mesajı."),
  weeklyPlans: z.array(WeeklyPlanSchema).describe("Haftalık olarak düzenlenmiş çalışma planı."),
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
  prompt: `Sen, Yükseköğretim Kurumları Sınavı (YKS) başta olmak üzere çeşitli sınavlara hazırlanan öğrencilere, onların hedeflerine, mevcut bilgilerine (belirtildiyse), çalışma sürelerine ve günlük ayırabilecekleri zamana göre son derece detaylı, kişiselleştirilmiş ve etkili çalışma planları tasarlayan uzman bir AI eğitim koçu ve stratejistisin.
Amacın, öğrencinin belirlediği konuları {{{studyDuration}}} içinde, günde ortalama {{{hoursPerDay}}} saat çalışarak en verimli şekilde tamamlamasına yardımcı olacak, haftalık ve günlük bazda yapılandırılmış, gerçekçi bir yol haritası sunmaktır. Plan, YKS (veya {{{targetExam}}}) formatına uygun olmalı ve öğrenciyi motive etmelidir. Cevapların her zaman Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#ifEquals userPlan "pro"}}
Pro kullanıcılar için: Planı, en karmaşık konuların bile nasıl parçalara ayrılarak çalışılabileceğini gösterecek şekilde, farklı öğrenme teknikleri (örn: Pomodoro, Feynman Tekniği) ve kaynak önerileriyle (genel türde, spesifik kitap adı olmadan) zenginleştir. Öğrencinin potansiyel darboğazlarını öngörerek alternatif yaklaşımlar sun. En kapsamlı ve stratejik planı oluştur.
{{else ifEquals userPlan "premium"}}
Premium kullanıcılar için: Haftalık hedefleri daha net belirle, günlük aktivitelere örnek soru çözüm sayıları veya tekrar stratejileri ekle. Motivasyonel ipuçlarını artır.
{{/ifEquals}}

Öğrencinin Girdileri:
Hedef Sınav: {{{targetExam}}}
Çalışılacak Konular/Dersler: {{{subjects}}}
Toplam Çalışma Süresi: {{{studyDuration}}}
Günlük Ortalama Çalışma Saati: {{{hoursPerDay}}}

Lütfen bu bilgilere göre, aşağıdaki formatta bir çalışma planı taslağı oluştur:

1.  **Plan Başlığı (planTitle)**: Örneğin, "Kişiye Özel {{{targetExam}}} Hazırlık Planı ({{{studyDuration}}})".
2.  **Giriş (introduction) (isteğe bağlı)**: Öğrenciyi motive eden, planın genel mantığını açıklayan kısa bir giriş.
3.  **Haftalık Planlar (weeklyPlans)**: Çalışma süresine göre haftalara bölünmüş planlar. Her hafta için:
    *   **Hafta Numarası (week)**: Örneğin, 1, 2, 3...
    *   **Haftalık Hedef (weeklyGoal) (isteğe bağlı)**: O haftanın ana odak noktası veya bitirilmesi hedeflenen genel konu başlıkları.
    *   **Günlük Görevler (dailyTasks)**: Haftanın her günü için (Pazartesi-Pazar veya 1. Gün - 7. Gün):
        *   **Gün (day)**: Günün adı.
        *   **Odak Konular (focusTopics)**: O gün çalışılacak ana konular veya dersler. Günlük çalışma saatine göre konu sayısı dengeli olmalı.
        *   **Tahmini Süre (estimatedTime) (isteğe bağlı)**: Her bir odak konuya ayrılması önerilen süre (örn: "Matematik - Türev: 2 saat").
        *   **Aktiviteler (activities) (isteğe bağlı)**: "Konu anlatımı dinleme/okuma", "{{{hoursPerDay}}} soru çözümü", "Kısa tekrar", "Yanlış analizi" gibi spesifik görevler.
        *   **Notlar (notes) (isteğe bağlı)**: O güne özel motivasyon, mola önerisi veya önemli bir ipucu.
4.  **Genel İpuçları (generalTips) (isteğe bağlı)**: Zaman yönetimi, verimli ders çalışma teknikleri, sınav stresiyle başa çıkma gibi genel YKS hazırlık önerileri.
5.  **Sorumluluk Reddi (disclaimer)**: "Bu, yapay zeka tarafından oluşturulmuş bir taslak plandır..." şeklinde standart bir uyarı.

Planlama Prensipleri:
*   {{{subjects}}} listesindeki konuları {{{studyDuration}}} içine mantıklı bir şekilde dağıt. {{{hoursPerDay}}} saatlik günlük çalışmayı göz önünde bulundur.
*   Konuların zorluk seviyelerine ve birbirleriyle bağlantılarına dikkat et.
*   Tekrar ve soru çözümünü plana dahil et.
*   Öğrencinin sıkılmaması için çeşitlilik sağlamaya çalış.
*   Gerçekçi ve uygulanabilir bir plan oluştur.
*   Eğer verilen süre çok kısaysa veya konu sayısı çok fazlaysa, bu durumu nazikçe belirt ve planı en iyi şekilde optimize etmeye çalış veya daha odaklı bir plan öner.
`,
});

const studyPlanGeneratorFlow = ai.defineFlow(
  {
    name: 'studyPlanGeneratorFlow',
    inputSchema: GenerateStudyPlanInputSchema,
    outputSchema: GenerateStudyPlanOutputSchema,
  },
  async (input) => {
    // Model seçimi, kullanıcı planına göre önceki flow'larda olduğu gibi yapılabilir.
    // Şimdilik varsayılan model kullanılacak.
    // const modelToUse = input.userPlan === 'pro' ? 'googleai/gemini-1.5-flash-latest' : 'googleai/gemini-2.0-flash';
    const {output} = await prompt(input); // , { model: modelToUse });
    if (!output || !output.weeklyPlans || output.weeklyPlans.length === 0) {
      throw new Error("AI Eğitim Koçu, belirtilen girdilerle bir çalışma planı oluşturamadı. Lütfen bilgilerinizi kontrol edin.");
    }
    return output;
  }
);
