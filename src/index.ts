import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import * as logger from "firebase-functions/logger";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as puppeteer from "puppeteer";

// API anahtarını fonksiyon yapılandırmasından al
const API_KEY = functions.config().gemini?.key;

let genAI: GoogleGenerativeAI;

if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
} else {
  logger.error(
    "GEMINI_API_KEY environment variable not set. Function will not work."
  );
}

// 1. Nesil onCall fonksiyonu
export const solveQuestionFromImage = functions.https.onCall(async (data, context) => {
  logger.info("solveQuestionFromImage triggered", { uid: context.auth?.uid });

  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Bu işlemi yapmak için giriş yapmalısınız.');
  }
  if (!genAI) {
    throw new functions.https.HttpsError('internal', 'AI servisi yapılandırılamadı.');
  }

  const { imageBase64, mimeType } = data;
  if (!imageBase64 || !mimeType) {
    throw new functions.https.HttpsError('invalid-argument', 'Resim verisi eksik.');
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const prompt = `Lütfen bu resimdeki matematik veya fen sorusunu analiz et. Cevabını MUTLAKA ve SADECE aşağıdaki JSON formatında ver. JSON dışında hiçbir metin ekleme.
      {
        "problemText": "Yazıya dökülmüş soru metni",
        "subject": "Ders adı (Örn: Matematik, Fizik)",
        "difficulty": "Zorluk seviyesi (Kolay, Orta, Zor)",
        "steps": ["Adım adım çözümün her bir satırı bu dizide olacak"],
        "finalAnswer": "Sonuç ve varsa doğru şık (Örn: x = 4, Cevap A)"
      }`;
    const imagePart = { inlineData: { data: imageBase64, mimeType: mimeType } };
    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text();
    const jsonString = text.replace(/^```json\s*/, "").replace(/```$/, "");
    return JSON.parse(jsonString);
  } catch (error) {
    logger.error("Error processing image with Gemini API:", error);
    throw new functions.https.HttpsError('internal', 'AI soruyu analiz ederken bir hata oluştu.');
  }
});


export const generateLessonContent = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Bu işlemi yapmak için giriş yapmalısınız.');
    }
    if (!genAI) {
        throw new functions.https.HttpsError('internal', 'AI servisi yapılandırılamadı.');
    }
    const { title, subject, gradeLevel, keywords } = data;
    if (!title || !subject || !gradeLevel || !keywords) {
      throw new functions.https.HttpsError('invalid-argument', 'Eksik bilgi: Başlık, konu, sınıf ve anahtar kelimeler zorunludur.');
    }
    const prompt = `
      Bir eğitim içeriği yazarı olarak, aşağıdaki bilgileri kullanarak detaylı, anlaşılır ve ilgi çekici bir ders özeti hazırla.
      İçerik, Markdown formatında olmalı, başlıklar ve alt başlıklar içermelidir.
      - Sınıf Seviyesi: ${gradeLevel}
      - Ders: ${subject}
      - Ana Konu: ${title}
      - İşlenmesi İstenen Detaylar: ${keywords}
      Lütfen sadece istenen formatta ders içeriğini üret. Başka bir açıklama ekleme.
    `;
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      const result = await model.generateContent(prompt);
      return { content: result.response.text() };
    } catch (error) {
      logger.error("Error generating lesson content:", error);
      throw new functions.https.HttpsError('internal', 'AI içerik üretirken bir hata oluştu.');
    }
});


export const generatePdfSummary = functions.runWith({ timeoutSeconds: 300, memory: '1GiB' }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Bu işlemi yapmak için giriş yapmalısınız.');
    }
    if (!genAI) {
      throw new functions.https.HttpsError('internal', 'AI servisi yapılandırılamadı.');
    }
    const { lessonContent, summaryPrompt } = data;
    if (!lessonContent || !summaryPrompt) {
      throw new functions.https.HttpsError('invalid-argument', 'Ders içeriği ve özetleme isteği zorunludur.');
    }
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      const fullPrompt = `Aşağıdaki metni, şu isteğe göre yeniden düzenleyip özetle: "${summaryPrompt}". Yanıtı sadece Markdown formatında ver. Başka hiçbir açıklama ekleme.\\n\\n---METİN---\\n${lessonContent}`;
      const result = await model.generateContent(fullPrompt);
      const summarizedContent = result.response.text();
      
      const htmlContent = `...`; // HTML content remains the same
      
      const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();
      
      return { pdfBase64: pdfBuffer.toString('base64') };
    } catch (error) {
      logger.error("Error in generatePdfSummary:", error);
      throw new functions.https.HttpsError('internal', 'PDF özeti oluşturulurken bir hata oluştu.');
    }
}); 