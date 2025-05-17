
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

// IMPORTANT: Replace with your actual site URL and name for OpenRouter HTTP headers
const YOUR_SITE_URL_HERE = "https://your-site-url.com"; // Example: "https://neutraledu.ai"
const YOUR_SITE_NAME_HERE = "NeutralEdu AI";           // Example: "My Awesome App"
// IMPORTANT: Ensure OPENROUTER_API_KEY is set in your .env.local file

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
(Admin Notu: Bu çözüm, özel olarak seçilmiş '{{{customModelIdentifier}}}' modeli kullanılarak üretilmeye çalışılmaktadır. Eğer bu model Genkit'te yapılandırılmamışsa veya OpenRouter API anahtarı gibi gerekli yapılandırmalar eksikse, varsayılan Google modeli kullanılacaktır.)
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
  async (input): Promise<SolveQuestionOutput> => { // Explicitly type the return promise
    if (!input.questionText && !input.imageDataUri) {
      // This case should ideally be caught by client-side validation, but good to have server-side too.
      return {
        solution: "Soru çözmek için lütfen bir metin girin veya bir görsel yükleyin.",
        relatedConcepts: [],
        examStrategyTips: [],
      };
    }
    
    if (input.customModelIdentifier === 'openrouter_deepseek_r1') {
      console.log("Admin OpenRouter/Deepseek R1 modelini seçti. API çağrısı deneniyor.");
      if (!process.env.OPENROUTER_API_KEY) {
        console.error("OpenRouter API anahtarı (OPENROUTER_API_KEY) ortam değişkenlerinde bulunamadı.");
        return {
          solution: "OpenRouter API anahtarı yapılandırılmamış. Lütfen sistem yöneticisiyle iletişime geçin.",
          relatedConcepts: ["Yapılandırma Hatası"],
          examStrategyTips: [],
        };
      }
      if (!input.questionText) {
        return {
          solution: "Deepseek R1 modeli için metin tabanlı bir soru gereklidir. Lütfen sorunuzu metin olarak girin veya görseldeki soruyu metinle açıklayın. Bu model için görsel işleme bu yolla tam desteklenmeyebilir.",
          relatedConcepts: [],
          examStrategyTips: [],
        };
      }

      const openRouterPrompt = `Sen bir YKS uzman öğretmenisin. Aşağıdaki soruyu adım adım, detaylı açıklamalarla ve YKS öğrencisinin anlayacağı bir dilde çöz: \n\nSoru: ${input.questionText}`;
      
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "HTTP-Referer": YOUR_SITE_URL_HERE, 
            "X-Title": YOUR_SITE_NAME_HERE,      
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "deepseek/deepseek-r1:free", 
            messages: [{ role: "user", content: openRouterPrompt }],
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: response.statusText }));
          console.error("OpenRouter API hatası:", response.status, errorData);
          return { // Return a structured error to the client
            solution: `OpenRouter API'sinden bir hata alındı: ${response.status} - ${errorData.message || 'Bilinmeyen hata'}. Lütfen daha sonra tekrar deneyin veya varsayılan modeli kullanın.`,
            relatedConcepts: ["API Hatası"],
            examStrategyTips: [],
          };
        }

        const data = await response.json();
        const solutionText = data.choices?.[0]?.message?.content;

        if (solutionText) {
          return {
            solution: solutionText,
            // Deepseek might not provide these structured, so we use placeholders
            relatedConcepts: ["Deepseek R1 ile çözülmüştür."], 
            examStrategyTips: ["Bu çözüm Deepseek R1 modeli kullanılarak üretilmiştir. Çözüm adımlarını ve mantığını dikkatlice inceleyin."]
          };
        } else {
          console.error("OpenRouter/Deepseek R1 modelinden geçerli bir çözüm alınamadı. Yanıt:", data);
          return {
            solution: "OpenRouter/Deepseek R1 modelinden geçerli bir çözüm alınamadı. Lütfen daha sonra tekrar deneyin veya varsayılan modeli kullanın.",
            relatedConcepts: ["Model Hatası"],
            examStrategyTips: [],
          };
        }
      } catch (error: any) {
        console.error("OpenRouter API çağrılırken hata:", error);
        return {
          solution: `OpenRouter/Deepseek R1 modeliyle iletişimde bir hata oluştu: ${error.message}. Lütfen daha sonra tekrar deneyin veya varsayılan modeli kullanın.`,
          relatedConcepts: ["Bağlantı Hatası"],
          examStrategyTips: [],
        };
      }
    }

    // Varsayılan Genkit / Google AI modeli kullanımı
    let modelToUse = input.userPlan === 'pro' ? 'googleai/gemini-1.5-flash-latest' : 'googleai/gemini-2.0-flash';
    if (input.customModelIdentifier === 'experimental_gemini_1.5_flash') {
      modelToUse = 'googleai/gemini-1.5-flash-latest'; 
      console.log("Admin deneysel Google modelini seçti: gemini-1.5-flash-latest");
    } else if (input.customModelIdentifier === 'default_gemini_flash') { // Ensure admin can select default too
        modelToUse = 'googleai/gemini-2.0-flash';
        console.log("Admin varsayılan Google modelini seçti: gemini-2.0-flash");
    }
    
    try {
      const {output} = await prompt(input, { model: modelToUse });
      if (!output || !output.solution) {
        // This case usually means the AI could not adhere to the output schema or had internal error
        console.error("AI YKS Uzmanı, Google modeli ile şemaya uygun bir çözüm üretemedi. Girdi:", input, "Çıktı:", output);
        return {
            solution: "AI YKS Uzmanı, bu soru için bir çözüm ve detaylı açıklama üretemedi. Lütfen girdilerinizi kontrol edin veya farklı bir soru deneyin. Eğer sorun devam ederse, AI modelinin yanıtı şemaya uymamış olabilir.",
            relatedConcepts: [],
            examStrategyTips: [],
        };
      }
      return output;
    } catch (genkitError: any) {
        console.error("Genkit prompt çağrılırken hata (Google Modeli):", genkitError);
        let errorMessage = "Google AI modeliyle çözüm üretilirken bir hata oluştu.";
        if (genkitError.message) {
            errorMessage += ` Detay: ${genkitError.message}`;
        }
        return {
            solution: errorMessage,
            relatedConcepts: ["Genkit Hatası"],
            examStrategyTips: [],
        };
    }
  }
);
