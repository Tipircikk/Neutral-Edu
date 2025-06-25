import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, Upload, Brain, Loader, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import ai, { modelName } from '../lib/gemini';

interface Solution {
  problemText: string;
  subject: string;
  difficulty: string;
  steps: string[];
  finalAnswer: string;
}

const QuestionSolver: React.FC = () => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [result, setResult] = useState<Solution | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentUser } = useAuth();

  const handleImageSelect = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setImagePreview(dataUrl);
        setImageBase64(dataUrl.split(',')[1]);
        setMimeType(file.type);
        setResult(null); 
      };
      reader.readAsDataURL(file);
    } else {
      toast.error('Lütfen geçerli bir resim dosyası seçin');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
  };

  const handleSolve = async () => {
    if (!imageBase64 || !mimeType) {
      toast.error('Lütfen önce bir soru resmi yükleyin.');
      return;
    }

    if (!currentUser) {
      toast.error('Bu özelliği kullanmak için giriş yapmalısınız.');
      return;
    }

    setLoading(true);
    setResult(null);
    const toastId = toast.loading('Soru analiz ediliyor...');

    try {
      const prompt = `You are an expert in solving academic problems from images. Analyze the following image and solve the problem.
Provide the solution in a structured JSON format. Do not include any text outside of the JSON object.
The JSON object must follow this TypeScript interface:
interface Solution {
  problemText: string; // A brief description of the problem identified from the image.
  subject: string; // The academic subject (e.g., "Matematik", "Fizik", "Kimya").
  difficulty: string; // The estimated difficulty (e.g., "Kolay", "Orta", "Zor").
  steps: string[]; // An array of strings, where each string is a step in the solution process.
  finalAnswer: string; // The final answer to the problem.
}

Your entire response must be ONLY the JSON object. Do not wrap it in markdown backticks.`;

      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType,
        },
      };

      const apiResult = await ai.models.generateContent({
        model: modelName,
        contents: [prompt, imagePart]
      });
      const responseText = apiResult.text;

      if (!responseText) {
        throw new Error("API'den boş yanıt alındı.");
      }
      
      let parsedResponse: Solution;
      try {
        // First, try to parse directly
        parsedResponse = JSON.parse(responseText);
      } catch (e) {
        // If it fails, try to extract from markdown
        const match = responseText.match(/```json\n([\s\S]*?)\n```/);
        if (match && match[1]) {
          parsedResponse = JSON.parse(match[1]);
        } else {
          throw new Error("Invalid JSON response from API.");
        }
      }

      toast.dismiss(toastId);
      setResult(parsedResponse);
      toast.success('Soru başarıyla çözüldü!');

    } catch (error: any) {
      toast.dismiss(toastId);
      const errorMessage = error.message || 'Soru çözülürken bir hata oluştu.';
      toast.error(errorMessage);
      console.error("Gemini API error:", error);
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setImagePreview(null);
    setImageBase64(null);
    setMimeType(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="text-center mb-12">
          <Brain className="mx-auto h-12 w-12 text-primary-600 mb-4" />
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">AI Soru Çözücü</h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">Sorunun fotoğrafını çek veya yükle, adım adım çözümü al</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Image Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Soru Resmi</h2>
          {!imagePreview ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-primary-500 transition-colors"
            >
                <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">Soru resmini yükle</p>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Sürükle bırak veya tıkla</p>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden"/>
                <button type="button" className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg">Dosya Seç</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <img src={imagePreview} alt="Seçilen problem" className="w-full object-contain rounded-lg border border-gray-200 dark:border-gray-600"/>
                <button onClick={clearAll} className="absolute top-2 right-2 p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSolve} disabled={loading || !imagePreview} className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-bold rounded-lg flex items-center justify-center space-x-2 text-lg">
                {loading ? (<> <Loader className="w-6 h-6 animate-spin" /> <span>Analiz ediliyor...</span> </>) : (<> <Brain className="w-6 h-6" /> <span>Soruyu Çöz</span> </>)}
              </motion.button>
            </div>
          )}
        </div>

        {/* Solution Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg min-h-[400px]">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Çözüm</h2>
          
          {loading && (
            <div className="text-center py-12 flex flex-col items-center justify-center h-full">
              <Loader className="w-12 h-12 text-primary-500 animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-400 text-lg">AI sorunuzu analiz ediyor...</p>
            </div>
          )}

          {!result && !loading && (
            <div className="text-center py-12 flex flex-col items-center justify-center h-full">
              <Brain className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Çözüm için önce bir soru resmi yükleyin.</p>
            </div>
          )}

          {result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center space-x-3 mb-3">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  <span className="font-semibold text-lg text-gray-900 dark:text-white">Tanımlanan Problem</span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-3">{result.problemText}</p>
                <div className="flex space-x-2 text-sm">
                  <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded-full font-medium">{result.subject}</span>
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full font-medium">{result.difficulty}</span>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-3">Çözüm Adımları</h3>
                <div className="space-y-3">
                  {result.steps.map((step: string, index: number) => (
                    <motion.div key={index} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="flex items-start space-x-4 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-md">{index + 1}</div>
                      <p className="text-gray-800 dark:text-gray-200 pt-1">{step}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

               <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
                  <h3 className="font-semibold text-lg text-green-800 dark:text-green-200 mb-2">Sonuç</h3>
                  <p className="text-gray-800 dark:text-gray-200">{result.finalAnswer}</p>
              </div>

            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionSolver;