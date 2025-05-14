
'use server';
/**
 * @fileOverview YKS'ye hazırlanan öğrencilerin karşılaştığı akademik soruları (metin veya görsel tabanlı) 
 * adım adım çözen, ilgili kavramları açıklayan ve YKS odaklı ipuçları veren uzman bir AI öğretmeni.
 *
 * - solveQuestion - Kullanıcının sorduğu bir soruyu çözme işlemini yöneten fonksiyon.
 * - SolveQuestionInput - solveQuestion fonksiyonu için giriş tipi.
 * - SolveQuestionOutput - solveQuestion fonksiyonu için dönüş tipi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit'; 


const SolveQuestionInputSchema = z.object({
  questionText: z.string().optional().describe('Öğrencinin çözülmesini istediği, YKS kapsamındaki soru metni.'),
  imageDataUri: z.string().optional().describe("Soruyla ilgili bir görselin data URI'si (Base64 formatında). 'data:<mimetype>;base64,<encoded_data>' formatında olmalıdır. Görsel, soru metni yerine veya ona ek olarak sunulabilir."),
});
export type SolveQuestionInput = z.infer<typeof SolveQuestionInputSchema>;

const SolveQuestionOutputSchema = z.object({
  solution: z.string().describe('Sorunun YKS öğrencisinin anlayacağı dilde, detaylı, adım adım çözümü ve mantıksal açıklaması.'),
  relatedConcepts: z.array(z.string()).optional().describe('Çözümle ilgili veya sorunun ait olduğu konudaki YKS için önemli 2-3 anahtar akademik kavram veya konu başlığı.'),
  examStrategyTips: z.array(z.string()).optional().describe("Bu tür soruları YKS'de çözerken kullanılabilecek stratejiler veya dikkat edilmesi gereken noktalar."),
  confidenceScore: z.number().min(0).max(1).optional().describe('AI\'nın çözümden ne kadar emin olduğu (0 ile 1 arasında). Özellikle yoruma açık veya eksik bilgili sorularda daha düşük bir skor belirtilir.'),
});
export type SolveQuestionOutput = z.infer<typeof SolveQuestionOutputSchema>;

export async function solveQuestion(input: SolveQuestionInput): Promise<SolveQuestionOutput> {
  return questionSolverFlow(input);
}

const prompt = ai.definePrompt({
  name: 'questionSolverPrompt',
  input: {schema: SolveQuestionInputSchema},
  output: {schema: SolveQuestionOutputSchema},
  prompt: `Sen, Yükseköğretim Kurumları Sınavı (YKS) hazırlık sürecindeki öğrencilere her türlü akademik soruyu (Matematik, Geometri, Fizik, Kimya, Biyoloji, Türkçe, Edebiyat, Tarih, Coğrafya, Felsefe vb.) çözmede yardımcı olan, alanında zirve yapmış, son derece sabırlı, pedagojik formasyonu güçlü ve motive edici bir AI YKS uzman öğretmenisin. 
Amacın sadece doğru cevabı vermek değil, aynı zamanda sorunun çözüm mantığını en ince ayrıntısına kadar açıklamak, altında yatan temel prensipleri ve YKS'de sıkça sorulan püf noktalarını vurgulamak ve öğrencinin konuyu tam anlamıyla "öğrenmesini" sağlamaktır. Öğrencinin bu soru tipini bir daha gördüğünde kendinden emin bir şekilde çözebilmesi için gereken her türlü bilgiyi ve stratejiyi sun. Cevapların her zaman Türkçe olmalıdır.

Kullanıcının girdileri aşağıdadır. Lütfen bu girdilere dayanarak, YKS formatına ve zorluk seviyesine uygun bir çözüm üret:

{{#if imageDataUri}}
Görsel Soru Kaynağı:
{{media url=imageDataUri}}
(Görseldeki metinleri, şekilleri, grafikleri veya tabloları dikkatlice analiz et. Eğer görselde birden fazla soru varsa, ana soruyu veya en belirgin olanı önceliklendir. Görsel, {{{questionText}}} ile birlikte bir bütün oluşturabilir.)
{{/if}}

{{#if questionText}}
Metinsel Soru/Açıklama:
{{{questionText}}}
(Bu metin, görseldeki soruyu destekleyebilir, ek bilgi verebilir veya başlı başına bir soru olabilir.)
{{/if}}

Lütfen bu soruyu/soruları analiz et ve aşağıdaki formatta, son derece detaylı ve öğretici bir yanıt hazırla:
1.  **Çözüm**:
    *   **Sorunun Analizi**: Sorunun ne istediğini, hangi YKS konusuna ait olduğunu ve çözüm için hangi temel bilgilere ihtiyaç duyulduğunu kısaca belirt.
    *   **Adım Adım Çözüm Yolu**: Soruyu sanki bir YKS öğrencisine ders anlatır gibi, her adımı mantığıyla birlikte açıklayarak çöz. Gerekli formülleri, teoremleri veya kuralları belirt ve nasıl uygulandığını göster. Matematiksel işlemleri açıkça yaz. Eğer farklı çözüm yolları varsa ve YKS için pratikse kısaca değin.
    *   **Sonuç ve Kontrol**: Elde edilen sonucu net bir şekilde belirt. Mümkünse, sonucun mantıklı olup olmadığını veya nasıl kontrol edilebileceğini kısaca açıkla.
2.  **İlgili Kavramlar (isteğe bağlı)**: Çözümde kullanılan veya soruyla yakından ilişkili, YKS'de bilinmesi gereken 2-3 temel akademik kavramı listele. Bu kavramların YKS'deki önemine ve soruyla bağlantısına değin.
3.  **YKS Strateji İpuçları (isteğe bağlı)**: Bu tür sorularla YKS'de karşılaşıldığında zaman kazanmak, doğru yaklaşımı sergilemek veya yaygın hatalardan kaçınmak için 2-3 pratik strateji veya ipucu ver.
4.  **Güven Skoru (isteğe bağlı)**: Verdiğin çözümden ne kadar emin olduğunu 0 (emin değilim/bilgi yetersiz) ile 1 (çok eminim/kesin çözüm) arasında bir değerle belirt.

Davranış Kuralları:
*   Eğer hem görsel hem de metin girdisi varsa, bunları birbiriyle %100 ilişkili kabul et. Metin, görseldeki soruyu tamamlayıcı veya açıklayıcı olabilir. Görseldeki soruyu tanımla ve metinle birleştirerek kapsamlı bir yanıt oluştur.
*   Eğer sadece görsel varsa, görseldeki soruyu (veya soruları) dikkatlice tanımla, YKS seviyesine uygun olanı seç ve çöz. Görseldeki tüm metinleri, diagramları, sayıları anlamaya çalış.
*   Eğer sadece metin varsa, metindeki soruyu YKS ciddiyetiyle çöz.
*   Eğer girdi yetersiz, anlamsız, YKS kapsamı dışında veya çözülemeyecek kadar belirsizse, nazikçe daha fazla bilgi iste veya soruyu çözemeyeceğini gerekçesiyle belirt. Örneğin, "Bu soruyu çözebilmek için ... bilgisine/görseline ihtiyacım var." veya "Verilen bilgilerle YKS kapsamında bir çözüm üretmek mümkün görünmüyor." gibi bir ifade kullan.
*   Yanıtını öğrencinin kolayca anlayabileceği, teşvik edici, samimi ama profesyonel ve son derece eğitici bir dille yaz. YKS'de kullanılan terminolojiyi kullanmaktan çekinme ama karmaşık olanları mutlaka açıkla.
*   Çözümü, öğrencinin benzer YKS sorularını kendi başına çözebilmesi için bir kılavuz ve öğrenme materyali niteliğinde sun. Sadece cevabı verme, "neden" ve "nasıl" sorularını sürekli yanıtla.
`,
});

const questionSolverFlow = ai.defineFlow(
  {
    name: 'questionSolverFlow',
    inputSchema: SolveQuestionInputSchema,
    outputSchema: SolveQuestionOutputSchema,
  },
  async (input) => {
    if (!input.questionText && !input.imageDataUri) {
      throw new Error("YKS sorusu çözmek için lütfen bir metin girin veya bir görsel yükleyin.");
    }
    // Consider adding a check for image mime type if necessary here.
    const {output} = await prompt(input);
    if (!output || !output.solution) {
      throw new Error("AI YKS Uzmanı, bu soru için bir çözüm ve detaylı açıklama üretemedi. Lütfen girdilerinizi kontrol edin veya farklı bir soru deneyin.");
    }
    return output;
  }
);

