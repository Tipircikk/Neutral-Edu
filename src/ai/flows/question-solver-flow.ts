
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
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı."),
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi (örn: 'experimental_gemini_1.5_flash' veya 'openrouter_deepseek_r1').")
});
export type SolveQuestionInput = z.infer<typeof SolveQuestionInputSchema>;

const SolveQuestionOutputSchema = z.object({
  solution: z.string().describe('Sorunun YKS öğrencisinin anlayacağı dilde, son derece detaylı, her bir adımı mantığıyla açıklanmış, satır satır çözümü ve kavramsal açıklaması.'),
  relatedConcepts: z.array(z.string()).optional().describe('Çözümle ilgili veya sorunun ait olduğu konudaki YKS için önemli 2-3 anahtar akademik kavram veya konu başlığı.'),
  examStrategyTips: z.array(z.string()).optional().describe("Bu tür soruları YKS'de çözerken kullanılabilecek stratejiler veya dikkat edilmesi gereken noktalar."),
});
export type SolveQuestionOutput = z.infer<typeof SolveQuestionOutputSchema>;

export async function solveQuestion(input: SolveQuestionInput): Promise<SolveQuestionOutput> {
  return questionSolverFlow(input);
}

const YOUR_SITE_URL_HERE = "https://your-site-url.com"; // Lütfen kendi site URL'niz ile değiştirin
const YOUR_SITE_NAME_HERE = "NeutralEdu AI"; // Lütfen kendi site adınız ile değiştirin

const prompt = ai.definePrompt({
  name: 'questionSolverPrompt',
  input: {schema: SolveQuestionInputSchema},
  output: {schema: SolveQuestionOutputSchema},
  prompt: `Sen, Yükseköğretim Kurumları Sınavı (YKS) için öğrencilere her türlü akademik soruyu (Matematik, Geometri, Fizik, Kimya, Biyoloji, Türkçe, Edebiyat, Tarih, Coğrafya, Felsefe vb.) en karmaşık detaylarına kadar, temel prensiplerine indirgeyerek, adım adım, son derece anlaşılır, pedagojik değeri yüksek ve motive edici bir şekilde çözmede uzmanlaşmış kıdemli bir AI YKS uzman öğretmenisin.
Amacın sadece doğru cevabı vermek değil, aynı zamanda sorunun çözüm mantığını en ince ayrıntısına kadar, SATIR SATIR ve ADIM ADIM açıklamak, altında yatan temel prensipleri ve YKS'de sıkça sorulan püf noktalarını vurgulamak ve öğrencinin konuyu tam anlamıyla "öğrenmesini" sağlamaktır. Çözümün her bir aşaması, nedenleriyle birlikte, bir öğrenciye ders anlatır gibi sunulmalıdır. Öğrencinin bu soru tipini bir daha gördüğünde kendinden emin bir şekilde çözebilmesi için gereken her türlü bilgiyi ve stratejiyi sun. Cevapların her zaman Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
{{#ifEquals userPlan "pro"}}
Pro kullanıcılar için: Çözümlerini en üst düzeyde akademik titizlikle, birden fazla çözüm yolunu (varsa) karşılaştırarak, konunun en derin ve karmaşık noktalarına değinerek sun. Sorunun çözümünde kullanılan her bir kavramı, formülü veya teoremine detaylıca açıkla. Sorunun YKS'deki genel stratejik önemini, benzer soru tiplerini ve bu tür sorulara yaklaşım stratejilerini derinlemesine tartış. Öğrencinin ufkunu açacak bağlantılar kur ve ileri düzey düşünme becerilerini tetikle. En sofistike, en detaylı ve en kapsamlı yanıtı vermek için en gelişmiş AI yeteneklerini kullan. Her bir işlem adımını, mantıksal çıkarımı ve kullanılan formülü ayrı ayrı ve çok net bir şekilde açıkla.
{{else ifEquals userPlan "premium"}}
Premium kullanıcılar için: Daha derinlemesine açıklamalar, varsa alternatif çözüm yolları ve konunun YKS'deki önemi hakkında daha detaylı bilgiler sunmaya özen göster. Standart kullanıcıya göre daha zengin ve öğretici bir deneyim sağla. Çözüm adımlarını netleştir.
{{/ifEquals}}

{{#if customModelIdentifier}}
(Admin Notu: Bu çözüm, özel olarak seçilmiş '{{{customModelIdentifier}}}' modeli kullanılarak üretilmeye çalışılmaktadır. Eğer bu model Genkit'te yapılandırılmamışsa, varsayılan Google modeli kullanılacaktır.)
{{/if}}

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
1.  **Sorunun Analizi ve Gerekli Bilgiler**:
    *   Sorunun ne istediğini, hangi YKS dersi ve konusuna ait olduğunu açıkça belirt.
    *   Çözüm için hangi temel bilgilere, formüllere, teoremlere veya kavramlara ihtiyaç duyulduğunu listele ve kısaca açıkla.
2.  **Adım Adım Çözüm Yolu (SATIR SATIR)**:
    *   Soruyu sanki bir YKS öğrencisine ders anlatır gibi, her adımı mantığıyla birlikte, SATIR SATIR açıklayarak çöz.
    *   Her bir matematiksel işlemi, mantıksal çıkarımı, kullanılan formülü veya kuralı ayrı ayrı ve net bir şekilde belirt ve nasıl uygulandığını göster.
    *   Çözümü olabildiğince parçalara ayırarak her bir adımı sindirilebilir kıl.
    *   {{{userPlan}}} "pro" ise veya {{{customModelIdentifier}}} daha gelişmiş bir Google modeli ise, varsa alternatif çözüm yollarına da değin ve avantaj/dezavantajlarını kısaca belirt.
3.  **Sonuç ve Kontrol**:
    *   Elde edilen sonucu net bir şekilde belirt.
    *   Mümkünse, sonucun mantıklı olup olmadığını veya nasıl kontrol edilebileceğini kısaca açıkla.
4.  **İlgili Kavramlar ve YKS Bağlantıları (isteğe bağlı)**:
    *   Çözümde kullanılan veya soruyla yakından ilişkili, YKS'de bilinmesi gereken 2-3 temel akademik kavramı listele.
    *   Bu kavramların YKS'deki önemine, soruyla bağlantısına ve hangi diğer konularda karşına çıkabileceğine değin.
5.  **YKS Strateji İpuçları (isteğe bağlı)**:
    *   Bu tür sorularla YKS'de karşılaşıldığında zaman kazanmak, doğru yaklaşımı sergilemek veya yaygın hatalardan kaçınmak için 2-3 pratik strateji veya ipucu ver.
    *   Sorunun zorluk seviyesi hakkında kısa bir değerlendirme yap.

Davranış Kuralları:
*   Eğer hem görsel hem de metin girdisi varsa, bunları birbiriyle %100 ilişkili kabul et. Metin, görseldeki soruyu tamamlayıcı veya açıklayıcı olabilir. Görseldeki soruyu tanımla ve metinle birleştirerek kapsamlı bir yanıt oluştur.
*   Eğer sadece görsel varsa, görseldeki soruyu (veya soruları) dikkatlice tanımla, YKS seviyesine uygun olanı seç ve çöz. Görseldeki tüm metinleri, diagramları, sayıları anlamaya çalış.
*   Eğer sadece metin varsa, metindeki soruyu YKS ciddiyetiyle çöz.
*   **Eğer girdi yetersizse, anlamsızsa, YKS kapsamı dışındaysa veya mevcut bilgilerle YKS standartlarında kaliteli, doğru ve adım adım bir çözüm üretemeyecek kadar belirsiz veya karmaşıksa, nazikçe ve gerekçesiyle bunu belirt. Örneğin, "Bu soruyu çözebilmek için ... bilgisine/görseline ihtiyacım var." veya "Verilen bilgilerle YKS kapsamında adım adım, güvenilir bir çözüm üretmek mümkün görünmüyor. Lütfen soruyu daha net ifade edin veya ek bilgi sağlayın." gibi bir ifade kullan. Kesin olmayan, zayıf veya yanlış olabilecek çözümler sunmaktan kaçın.**
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
    
    // Admin seçimi ve OpenRouter/Deepseek R1 entegrasyonu
    if (input.customModelIdentifier === 'openrouter_deepseek_r1' && process.env.OPENROUTER_API_KEY) {
      console.log("Admin selected OpenRouter/Deepseek R1 model. Attempting direct API call.");

      if (!input.questionText) {
        // Deepseek R1 için sadece görsel varsa, metin girdisi gerektiğini belirt
        return {
          solution: "Deepseek R1 modeli şu anda en iyi metin tabanlı sorularla çalışmaktadır. Lütfen sorunuzu metin olarak girin veya görseldeki soruyu metinle açıklayın. Görsel yükleme özelliği bu model için henüz tam desteklenmemektedir.",
          relatedConcepts: [],
          examStrategyTips: [],
        };
      }

      const messages = [];
      if (input.questionText) {
        messages.push({ role: 'user', content: input.questionText });
      }
      // Deepseek R1'in bu formatı destekleyip desteklemediği kontrol edilmeli. Şimdilik sadece metin gönderiliyor.
      // if (input.imageDataUri && input.questionText) { // Example: Include image if text is also present
      //   messages[0].content = [
      //       { type: "text", text: input.questionText },
      //       { type: "image_url", image_url: { url: input.imageDataUri } }
      //   ];
      // }

      const openRouterPrompt = `Sen bir YKS uzman öğretmenisin. Aşağıdaki soruyu adım adım, detaylı açıklamalarla ve YKS öğrencisinin anlayacağı bir dilde çöz: \n\nSoru: ${input.questionText}`;

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "HTTP-Referer": YOUR_SITE_URL_HERE, // Optional
            "X-Title": YOUR_SITE_NAME_HERE,      // Optional
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "deepseek/deepseek-r1:free", 
            messages: [{ role: "user", content: openRouterPrompt }], // Sadece metin gönderiliyor
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: response.statusText }));
          console.error("OpenRouter API error:", response.status, errorData);
          throw new Error(`OpenRouter API hatası: ${response.status} - ${errorData.message || 'Bilinmeyen hata'}`);
        }

        const data = await response.json();
        const solutionText = data.choices?.[0]?.message?.content;

        if (solutionText) {
          return {
            solution: solutionText,
            // Deepseek'ten bu alanlar doğrudan gelmeyebilir, genel bir mesaj veya boş bırakılabilir.
            relatedConcepts: ["Deepseek R1 ile çözülmüştür."], 
            examStrategyTips: ["Bu çözüm Deepseek R1 modeli kullanılarak üretilmiştir. Çözüm adımlarını ve mantığını dikkatlice inceleyin."]
          };
        } else {
          throw new Error("OpenRouter/Deepseek R1 modelinden geçerli bir çözüm alınamadı.");
        }
      } catch (error: any) {
        console.error("Error calling OpenRouter API:", error);
        // Hata durumunda Genkit prompt'una geri dönülebilir veya hata fırlatılabilir
         return {
          solution: `OpenRouter/Deepseek R1 modeliyle iletişimde bir hata oluştu: ${error.message}. Lütfen daha sonra tekrar deneyin veya varsayılan modeli kullanın.`,
          relatedConcepts: [],
          examStrategyTips: [],
        };
      }
    }

    // Varsayılan Genkit / Google AI modeli kullanımı
    let modelToUse = 'googleai/gemini-2.0-flash'; // Varsayılan model
    if (input.customModelIdentifier === 'experimental_gemini_1.5_flash') {
      modelToUse = 'googleai/gemini-1.5-flash-latest'; // Pro kullanıcılar veya admin seçimi için
      console.log("Admin selected experimental Google model: gemini-1.5-flash-latest");
    }
    
    const {output} = await prompt(input, { model: modelToUse });
    if (!output || !output.solution) {
      throw new Error("AI YKS Uzmanı, bu soru için bir çözüm ve detaylı açıklama üretemedi. Lütfen girdilerinizi kontrol edin veya farklı bir soru deneyin.");
    }
    return output;
  }
);
