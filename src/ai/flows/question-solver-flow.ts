
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
import type { UserProfile } from '@/types';

const SolveQuestionInputSchema = z.object({
  questionText: z.string().optional().describe('Öğrencinin çözülmesini istediği, YKS kapsamındaki soru metni.'),
  imageDataUri: z.string().optional().describe("Soruyla ilgili bir görselin data URI'si (Base64 formatında). 'data:<mimetype>;base64,<encoded_data>' formatında olmalıdır. Görsel, soru metni yerine veya ona ek olarak sunulabilir."),
  userPlan: z.enum(["free", "premium", "pro"]).describe("Kullanıcının mevcut üyelik planı."),
  customModelIdentifier: z.string().optional().describe("Adminler için özel model seçimi (örn: 'default_gemini_flash', 'experimental_gemini_1_5_flash', 'experimental_gemini_2_5_flash_preview').")
});
export type SolveQuestionInput = z.infer<typeof SolveQuestionInputSchema>;

const SolveQuestionOutputSchema = z.object({
  solution: z.string().describe('Sorunun YKS öğrencisinin anlayacağı dilde, adım adım çözümü ve kavramsal açıklaması.'),
  relatedConcepts: z.array(z.string()).optional().describe('Çözümle ilgili veya sorunun ait olduğu konudaki YKS için önemli 2-3 anahtar akademik kavram veya konu başlığı.'),
  examStrategyTips: z.array(z.string()).optional().describe("Bu tür soruları YKS'de çözerken kullanılabilecek stratejiler veya dikkat edilmesi gereken noktalar."),
});
export type SolveQuestionOutput = z.infer<typeof SolveQuestionOutputSchema>;

// This wrapper function is called by the client (Server Action)
export async function solveQuestion(input: SolveQuestionInput): Promise<SolveQuestionOutput> {
  console.log("[SolveQuestion Action] Received input:", {
      hasQuestionText: !!input.questionText,
      hasImageDataUri: !!input.imageDataUri && input.imageDataUri.length > 30 ? input.imageDataUri.substring(0,30) + "..." : "No Image",
      userPlan: input.userPlan,
      customModelIdentifier: input.customModelIdentifier,
  });

  try {
    const result = await questionSolverFlow(input);

    if (!result || typeof result.solution !== 'string' || !Array.isArray(result.relatedConcepts) || !Array.isArray(result.examStrategyTips)) {
      console.error("[SolveQuestion Action] Flow returned invalid, null, or malformed result:", JSON.stringify(result).substring(0, 500));
      return {
        solution: "AI akışından geçersiz veya eksik bir yanıt alındı. Lütfen tekrar deneyin veya farklı bir soru sorun.",
        relatedConcepts: ["Hata"],
        examStrategyTips: ["Tekrar deneyin"],
      };
    }

    console.log("[SolveQuestion Action] Successfully received result from questionSolverFlow.");
    return result;
  } catch (error: any) {
    console.error("[SolveQuestion Action] Critical error during server action execution:", error);
    let errorMessage = 'Bilinmeyen sunucu hatası oluştu.';
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else if (error && typeof error.toString === 'function') {
        errorMessage = error.toString();
    } else {
        errorMessage = JSON.stringify(error); // Fallback for non-standard errors
    }
    
    return {
      solution: `Sunucu tarafında genel bir hata oluştu: ${errorMessage}. Geliştirici konsolunu kontrol edin.`,
      relatedConcepts: ["Hata"],
      examStrategyTips: ["Tekrar deneyin"],
    };
  }
}

// prompt definition
const questionSolverPrompt = ai.definePrompt({
  name: 'questionSolverPrompt',
  input: {schema: SolveQuestionInputSchema},
  output: {schema: SolveQuestionOutputSchema},
  prompt: `Sen, Yükseköğretim Kurumları Sınavı (YKS) için öğrencilere her türlü akademik soruyu (Matematik, Geometri, Fizik, Kimya, Biyoloji, Türkçe, Edebiyat, Tarih, Coğrafya, Felsefe vb.) en karmaşık detaylarına kadar, temel prensiplerine indirgeyerek, adım adım, son derece anlaşılır, pedagojik değeri yüksek ve motive edici bir şekilde çözmede uzmanlaşmış kıdemli bir AI YKS uzman öğretmenisin.
Amacın sadece doğru cevabı vermek değil, aynı zamanda sorunun çözüm mantığını, SATIR SATIR ve ADIM ADIM açıklamak, altında yatan temel prensipleri ve YKS'de sıkça sorulan püf noktalarını vurgulamak ve öğrencinin konuyu tam anlamıyla "öğrenmesini" sağlamaktır. Çözümün her bir aşaması, nedenleriyle birlikte, bir öğrenciye ders anlatır gibi sunulmalıdır. Öğrencinin bu soru tipini bir daha gördüğünde kendinden emin bir şekilde çözebilmesi için gereken her türlü bilgiyi ve stratejiyi sun. Çözümün olabildiğince açık ve anlaşılır olmasına, ancak gereksiz yere aşırı uzun olmamasına özen göster.
Matematiksel ifadeleri ve denklemleri yazarken lütfen Markdown formatlamasına (örneğin, tek backtick \`denklem\` veya üçlü backtick ile kod blokları) dikkat edin ve formatlamayı doğru bir şekilde kapatın.
Cevapların her zaman Türkçe olmalıdır.

Kullanıcının üyelik planı: {{{userPlan}}}.
Kullanıcının seçtiği özel model (eğer varsa): {{{customModelIdentifier}}}.

{{#if customModelIdentifier}}
(Admin Notu: Bu çözüm, özel olarak seçilmiş '{{{customModelIdentifier}}}' modeli kullanılarak üretilmektedir.
{{#if (eq customModelIdentifier "experimental_gemini_2_5_flash_preview")}}
Özel Not (Gemini 2.5 Flash Preview için): Çözümü ana adımları ve kilit mantıksal çıkarımları vurgulayarak, olabildiğince öz ama anlaşılır olmalıdır. Aşırı detaydan kaçın, doğrudan ve net bir çözüm sun.
{{/if}}
{{/if}}

{{#if (eq userPlan "pro")}}
Pro kullanıcılar için: Çözümlerini en üst düzeyde akademik titizlikle, birden fazla çözüm yolunu (varsa) karşılaştırarak, konunun en derin ve karmaşık noktalarına değinerek sun. Sorunun çözümünde kullanılan her bir kavramı, formülü veya teoremine detaylıca açıkla. Sorunun YKS'deki genel stratejik önemini, benzer soru tiplerini ve bu tür sorulara yaklaşım stratejilerini derinlemesine tartış. Öğrencinin ufkunu açacak bağlantılar kur ve ileri düzey düşünme becerilerini tetikle. Her bir işlem adımını, mantıksal çıkarımı ve kullanılan formülü ayrı ayrı ve çok net bir şekilde açıkla. En sofistike ve en kapsamlı yanıtı vermek için en gelişmiş AI yeteneklerini kullan.
{{else if (eq userPlan "premium")}}
Premium kullanıcılar için: Daha derinlemesine açıklamalar, varsa alternatif çözüm yolları ve konunun YKS'deki önemi hakkında daha detaylı bilgiler sunmaya özen göster. Standart kullanıcıya göre daha zengin ve öğretici bir deneyim sağla. Çözüm adımlarını netleştir.
{{/if}}

Kullanıcının girdileri aşağıdadır. Lütfen bu girdilere dayanarak, YKS formatına ve zorluk seviyesine uygun bir çözüm üret:

{{#if imageDataUri}}
Görsel Soru Kaynağı:
{{media url=imageDataUri}}
(Görseldeki metinleri, şekilleri, grafikleri veya tabloları dikkatlice analiz et. Eğer görselde birden fazla soru varsa, ana soruyu veya en belirgin olanı önceliklendir. Görsel, {{{questionText}}} ile birlikte bir bütün oluşturabilir. Görseldeki soruyu tanımla ve metinle birleştirerek kapsamlı bir yanıt oluştur.)
{{/if}}

{{#if questionText}}
Metinsel Soru/Açıklama:
{{{questionText}}}
(Bu metin, görseldeki soruyu destekleyebilir, ek bilgi verebilir veya başlı başına bir soru olabilir.)
{{/if}}

Lütfen bu soruyu/soruları analiz et ve aşağıdaki formatta, öğretici bir yanıt hazırla:
1.  **Sorunun Analizi ve Gerekli Bilgiler**:
    *   Sorunun ne istediğini, hangi YKS dersi ve konusuna ait olduğunu açıkça belirt.
    *   Çözüm için hangi temel bilgilere, formüllere, teoremlere veya kavramlara ihtiyaç duyulduğunu listele ve kısaca açıkla.
2.  **Adım Adım Çözüm Yolu (ANA ADIMLAR)**:
    *   Soruyu sanki bir YKS öğrencisine ders anlatır gibi, ana adımları mantığıyla birlikte, açıklayarak çöz.
    *   Her bir matematiksel işlemi, mantıksal çıkarımı, kullanılan formülü veya kuralı ayrı ayrı ve net bir şekilde belirt ve nasıl uygulandığını göster.
    *   Çözümü olabildiğince parçalara ayırarak her bir adımı sindirilebilir kıl.
    *   Eğer kullanıcının üyelik planı 'pro' ise veya seçilen özel model daha gelişmiş bir Google modeli ise (ve 'experimental_gemini_2_5_flash_preview' değilse), varsa alternatif çözüm yollarına da değin ve avantaj/dezavantajlarını kısaca belirt.
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
*   Eğer hem görsel hem de metin girdisi varsa, bunları birbiriyle %100 ilişkili kabul et. Görseldeki soruyu tanımla ve metinle birleştirerek kapsamlı bir yanıt oluştur.
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
  async (input): Promise<SolveQuestionOutput> => {
    console.log("[QuestionSolver Flow] Flow started. Input received:", {
      hasQuestionText: !!input.questionText,
      hasImageDataUri: !!input.imageDataUri,
      userPlan: input.userPlan,
      customModelIdentifier: input.customModelIdentifier // Log the received custom model identifier
    });

    try {
      if (!input.questionText && !input.imageDataUri) {
        console.warn("[QuestionSolver Flow] No question text or image data provided.");
        return {
          solution: "Soru çözmek için lütfen bir metin girin veya bir görsel yükleyin.",
          relatedConcepts: [],
          examStrategyTips: [],
        };
      }
      
      let modelToUse = 'googleai/gemini-1.5-flash-latest'; // Default for free/premium or if admin doesn't select
      let callOptions: { model: string; config?: Record<string, any> } = { model: modelToUse };

      if (input.customModelIdentifier && input.userPlan === 'pro') { 
        console.log(`[QuestionSolver Flow] Admin attempting to use custom model: ${input.customModelIdentifier}`);
        if (input.customModelIdentifier === 'default_gemini_flash') {
          modelToUse = 'googleai/gemini-2.0-flash';
          console.log("[QuestionSolver Flow] Admin selected default Google model: gemini-2.0-flash");
        } else if (input.customModelIdentifier === 'experimental_gemini_1_5_flash') {
             modelToUse = 'googleai/gemini-1.5-flash-latest'; 
             console.log("[QuestionSolver Flow] Admin selected experimental Google model: gemini-1.5-flash-latest");
        } else if (input.customModelIdentifier === 'experimental_gemini_2_5_flash_preview') {
            modelToUse = 'googleai/gemini-2.5-flash-preview-04-17'; 
            console.log("[QuestionSolver Flow] Admin selected experimental Google model: gemini-2.5-flash-preview-04-17");
        }
        callOptions.model = modelToUse;
      } else if (input.userPlan === 'pro') {
        modelToUse = 'googleai/gemini-1.5-flash-latest'; 
        callOptions.model = modelToUse;
        console.log(`[QuestionSolver Flow] Pro user using model: ${modelToUse}`);
      } else {
        // Free and Premium users will use the default Genkit model (gemini-1.5-flash-latest) or the one explicitly set here
        console.log(`[QuestionSolver Flow] Free/Premium user using model: ${modelToUse}`);
      }
      
      // Add generationConfig only if the model is NOT the preview version
      if (modelToUse !== 'googleai/gemini-2.5-flash-preview-04-17') {
        callOptions.config = {
          generationConfig: {
            maxOutputTokens: 4096, 
          }
        };
        console.log(`[QuestionSolver Flow] Using generationConfig for model ${modelToUse}:`, callOptions.config);
      } else {
        console.log(`[QuestionSolver Flow] NOT using generationConfig for preview model ${modelToUse}.`);
        // Ensure config is not passed or is empty for the preview model if it causes issues.
        // If the prompt itself has a default config, we might need to override it with an empty config.
        // For now, we'll let the Genkit prompt use its default config if callOptions.config is undefined.
      }

      console.log(`[QuestionSolver Flow] Calling Google prompt with model: ${callOptions.model} and config:`, callOptions.config || "Prompt's default config");
      
      let outputFromPrompt: SolveQuestionOutput | undefined;
      try {
        // Pass callOptions which now correctly omits/includes config based on modelToUse
        const { output } = await questionSolverPrompt(input, callOptions); 
        outputFromPrompt = output;
      } catch (promptError: any) {
        console.error(`[QuestionSolver Flow] Error during prompt execution with model ${modelToUse}:`, promptError);
        let errorMessage = `AI modeli (${modelToUse}) ile iletişimde bir hata oluştu.`;
        if (promptError?.message) {
            errorMessage += ` Detay: ${promptError.message}`;
            if (promptError.message.includes('SAFETY') || promptError.message.includes('block_reason')) {
                errorMessage = `İçerik güvenlik filtrelerine takılmış olabilir. Lütfen sorunuzu gözden geçirin. Model: ${modelToUse}. Detay: ${promptError.message}`;
            } else if (promptError.message.includes('400 Bad Request') && (promptError.message.includes('generationConfig') || promptError.message.includes('generation_config'))) {
                errorMessage = `Seçilen model (${modelToUse}) bazı yapılandırma ayarlarını desteklemiyor olabilir. Geliştiriciye bildirin. Detay: ${promptError.message}`;
            } else if (promptError.message.includes('Must have a text part if there is a media part')) {
                errorMessage = `Görsel ile birlikte metin girmeniz gerekmektedir veya model bu tür bir girdiyi desteklemiyor. Model: ${modelToUse}. Detay: ${promptError.message}`;
            }
        }
        return {
            solution: errorMessage,
            relatedConcepts: ["Model Hatası"],
            examStrategyTips: [],
        };
      }
      
      if (!outputFromPrompt || typeof outputFromPrompt.solution !== 'string') {
        console.error("[QuestionSolver Flow] AI (Google model) did not produce a valid solution matching the schema. Output received:", JSON.stringify(outputFromPrompt).substring(0,300)+"...");
        return {
            solution: `AI YKS Uzmanı (${modelToUse}), bu soru için bir çözüm ve detaylı açıklama üretemedi veya yanıt formatı beklenmedik. Lütfen girdilerinizi kontrol edin veya farklı bir soru deneyin. Model: ${modelToUse}`,
            relatedConcepts: outputFromPrompt?.relatedConcepts || ["Yanıt Formatı Hatası"],
            examStrategyTips: outputFromPrompt?.examStrategyTips || [],
        };
      }
      console.log("[QuestionSolver Flow] Successfully received solution from Google model.");
      return {
        solution: outputFromPrompt.solution,
        relatedConcepts: outputFromPrompt.relatedConcepts || [],
        examStrategyTips: outputFromPrompt.examStrategyTips || [],
      };

    } catch (flowError: any) {
        console.error("[QuestionSolver Flow] UNEXPECTED CRITICAL ERROR in flow execution:", flowError);
        let flowErrorMessage = 'Soru çözme akışında beklenmedik kritik bir hata oluştu.';
        if (flowError instanceof Error) {
            flowErrorMessage = flowError.message;
        } else if (typeof flowError === 'string') {
            flowErrorMessage = flowError;
        } else {
            try {
                flowErrorMessage = JSON.stringify(flowError);
            } catch (e) {
                flowErrorMessage = 'Serileştirilemeyen kritik akış hatası.';
            }
        }
        return {
            solution: `Beklenmedik Sunucu Hatası: ${flowErrorMessage}. Lütfen daha sonra tekrar deneyin. Geliştirici konsolunu kontrol edin.`,
            relatedConcepts: ["Kritik Akış Hatası"],
            examStrategyTips: ["Sistemi kontrol edin"],
        };
    }
  }
);
