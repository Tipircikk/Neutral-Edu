"use strict";
/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePdfSummary = exports.generateLessonContent = exports.solveQuestionFromImage = void 0;
const functions = __importStar(require("firebase-functions"));
const logger = __importStar(require("firebase-functions/logger"));
const generative_ai_1 = require("@google/generative-ai");
const puppeteer = __importStar(require("puppeteer"));
const marked_1 = require("marked");
// API anahtarını fonksiyon yapılandırmasından al
const API_KEY = (_a = functions.config().gemini) === null || _a === void 0 ? void 0 : _a.key;
let genAI;
if (API_KEY) {
    genAI = new generative_ai_1.GoogleGenerativeAI(API_KEY);
}
else {
    logger.error("GEMINI_API_KEY ortam değişkeni ayarlanmadı. Fonksiyonlar çalışmayacak.");
}
// v1 onCall fonksiyonu
exports.solveQuestionFromImage = functions.https.onCall(async (data, context) => {
    var _a;
    logger.info("solveQuestionFromImage tetiklendi", { uid: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid });
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
        // Gemini'nin döndürebileceği ```json bloğunu temizle
        const jsonString = text.replace(/^```json\s*/, "").replace(/```$/, "");
        return JSON.parse(jsonString);
    }
    catch (error) {
        logger.error("Gemini API ile resim işlenirken hata:", error);
        throw new functions.https.HttpsError('internal', 'AI soruyu analiz ederken bir hata oluştu.');
    }
});
exports.generateLessonContent = functions.https.onCall(async (data, context) => {
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
    }
    catch (error) {
        logger.error("Ders içeriği üretilirken hata:", error);
        throw new functions.https.HttpsError('internal', 'AI içerik üretirken bir hata oluştu.');
    }
});
exports.generatePdfSummary = functions.runWith({ timeoutSeconds: 300, memory: '1GB' }).https.onCall(async (data, context) => {
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
        const fullPrompt = `Aşağıdaki metni, şu isteğe göre yeniden düzenleyip özetle: "${summaryPrompt}". Yanıtı sadece Markdown formatında ver. Başka hiçbir açıklama ekleme.\n\n---METİN---\n${lessonContent}`;
        const result = await model.generateContent(fullPrompt);
        const summarizedContent = result.response.text();
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Ders Özeti</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
            h1, h2, h3 { color: #2c3e50; }
            code { background-color: #f4f4f4; padding: 2px 4px; border-radius: 4px; }
            pre { background-color: #f4f4f4; padding: 1em; border-radius: 5px; overflow-x: auto; }
            blockquote { border-left: 5px solid #ccc; padding-left: 1.5em; margin-left: 0; }
          </style>
        </head>
        <body>
          ${(0, marked_1.marked)(summarizedContent)}
        </body>
        </html>
      `;
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();
        return { pdfBase64: pdfBuffer.toString('base64') };
    }
    catch (error) {
        logger.error("generatePdfSummary fonksiyonunda hata:", error);
        throw new functions.https.HttpsError('internal', 'PDF özeti oluşturulurken bir hata oluştu.');
    }
});
//# sourceMappingURL=index.js.map