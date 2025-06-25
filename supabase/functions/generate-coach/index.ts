import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CoachRequest {
  style: string;
  subjectFocus: string[];
  tone: string;
  dailyInteraction: string[];
  name?: string;
  examTargetDate: string;
  examType: string;
  studyHoursPerDay: number;
  weakSubjects: string[];
  preferredStudyTime: string;
}

// Get the API key from the environment variable
// @ts-ignore
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY environment variable not set.");
}

// @ts-ignore
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

serve(async (req) => {
  let result; // Declare result here to have it in the scope of the catch block
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      style, 
      subjectFocus, 
      tone, 
      dailyInteraction, 
      name, 
      examTargetDate, 
      examType,
      studyHoursPerDay,
      weakSubjects,
      preferredStudyTime 
    }: CoachRequest = await req.json()

    const prompt = `
    Sen bir Türk eğitim uzmanısın ve ${examType} sınavına hazırlanan öğrenciler için kişiselleştirilmiş AI çalışma koçu oluşturuyorsun.

    Öğrenci Profili:
    - Sınav Türü: ${examType}
    - Hedef Tarih: ${examTargetDate}
    - Odak Dersler: ${subjectFocus.join(', ')}
    - Zayıf Dersler: ${weakSubjects.join(', ')}
    - Günlük Çalışma Saati: ${studyHoursPerDay} saat
    - Tercih Edilen Çalışma Zamanı: ${preferredStudyTime}
    - İstenen Koç Tarzı: ${style}
    - İletişim Tonu: ${tone}
    - Günlük Etkileşim: ${dailyInteraction.join(', ')}
    - Koç İsmi: ${name || 'AI Koçum'}

    Lütfen aşağıdaki JSON formatında bir AI koç profili oluştur:

    {
      "name": "Koç ismi",
      "style": "Koç tarzı açıklaması",
      "description": "Koçun detaylı tanımı ve nasıl yardım edeceği",
      "dailyRoutine": ["Günlük rutin maddeleri"],
      "subjectFocus": ["Odak dersler"],
      "tone": "İletişim tonu",
      "examTargetDate": "Hedef tarih",
      "personalityTraits": {
        "strictness": 1-10 arası sayı,
        "humor": 1-10 arası sayı,
        "supportiveness": 1-10 arası sayı,
        "detailLevel": 1-10 arası sayı
      },
      "motivationalMessages": ["Motivasyon mesajları"],
      "studyTips": ["Çalışma ipuçları"],
      "weeklyGoals": ["Haftalık hedefler"]
    }

    Koç, Türk eğitim sistemi ve ${examType} sınavı hakkında uzman bilgiye sahip olmalı.
    Kişilik özellikleri seçilen tarza uygun olmalı.
    Mesajlar ve ipuçları Türkçe olmalı ve yaş grubuna uygun olmalı.
    `
    result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text();

    // Parse the JSON response from Gemini
    const coachProfile = JSON.parse(generatedText);

    return new Response(
      JSON.stringify(coachProfile),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    // Log the detailed error to the console for debugging
    console.error("Error in function execution:", error);

    // Prepare a more informative error response
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Check if the error is due to JSON parsing
    if (error instanceof SyntaxError && errorMessage.includes('JSON')) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse the response from the AI model. The model might have returned malformed JSON.',
          details: errorMessage,
          originalText: result ? await (await result.response).text() : "No response text available."
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 500 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        error: "An internal server error occurred.",
        details: errorMessage,
        stack: errorStack // Be cautious about exposing stack traces in production
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }, 
        status: 500 
      }
    )
  }
})