import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { BookMarked, Search, Sparkles as SparklesIcon, DownloadCloud, LayoutGrid, List, BrainCircuit, BookCopy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import ai from '../lib/gemini';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Lesson {
    id: string;
    title: string;
    subject: string;
    gradeLevel: string;
    content: string;
    attachments?: { name: string; url: string; }[];
}

// Bu listeler AdminPage'den kopyalandı, idealde ortak bir dosyada olabilir.
const availableSubjects = [
  'Matematik', 'Fizik', 'Kimya', 'Biyoloji', 
  'Türkçe', 'Edebiyat', 'Tarih', 'Coğrafya', 'Felsefe'
];
const gradeLevels = ['9. Sınıf', '10. Sınıf', '11. Sınıf', '12. Sınıf', 'YKS', 'LGS'];

// Yeni bileşen: AI İçerik Üretici
const AiContentGenerator: React.FC<{ lesson: Lesson | null }> = ({ lesson }) => {
    const [prompt, setPrompt] = useState('');
    const [generatedContent, setGeneratedContent] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    if (!lesson) return null;

    const handleGenerateContent = async () => {
        if (!prompt) {
            toast.error("Lütfen bir istek girin.");
            return;
        }
        setIsGenerating(true);
        setGeneratedContent('');
        const toastId = toast.loading("Yapay zeka içeriği oluşturuyor...");

        try {
            const systemPrompt = `Bir eğitim materyali hazırlama uzmanısın. Sana verilen ders içeriğini ve kullanıcı isteğini temel alarak, konuyu zengin ve anlaşılır bir şekilde açıklayan bir metin oluştur. Cevabını mutlaka Markdown formatında yapılandır. Başlıklar (##), alt başlıklar (###), listeler (* veya -) ve önemli kısımlar için kalın metin (**metin**) kullan. Anlaşılır, eğitici ve ilgi çekici bir dil kullan.\n\n### Ders İçeriği Özeti:\nBaşlık: ${lesson.title}\nKonu: ${lesson.subject}\nSeviye: ${lesson.gradeLevel}\nAna İçerik: ${lesson.content.substring(0, 500)}...\n\n### Kullanıcının İsteği:\n"${prompt}"\n\n### Oluşturulacak İçerik (Sadece Markdown):`;

            const result = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: systemPrompt
            });
            const text = result.text;

            setGeneratedContent(text);
            toast.dismiss(toastId);
            toast.success("İçerik başarıyla oluşturuldu!");

        } catch (error) {
            toast.dismiss(toastId);
            toast.error("İçerik üretilirken bir hata oluştu.");
            console.error("AI content generation failed:", error);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleGeneratePdf = async () => {
        if (!generatedContent || !contentRef.current) {
            toast.error("PDF oluşturmak için önce içerik üretmelisiniz.");
            return;
        }
        const toastId = toast.loading("PDF oluşturuluyor...");
        try {
            const canvas = await html2canvas(contentRef.current, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const ratio = canvasWidth / canvasHeight;
            const imgHeight = pdfWidth / ratio;
            let heightLeft = imgHeight;
            let position = 0;
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }
            pdf.save(`${lesson.title.replace(/ /g, '_')}_AI.pdf`);
            toast.dismiss(toastId);
            toast.success("PDF başarıyla indirildi!");
        } catch (error) {
            toast.dismiss(toastId);
            toast.error("PDF oluşturulurken bir hata oluştu.");
            console.error("PDF generation failed:", error);
        }
    };


    return (
        <div className="mt-8 pt-6 border-t dark:border-gray-600">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <BrainCircuit className="w-8 h-8 mr-3 text-indigo-400" />
                AI Destekli İçerik Oluşturucu
            </h3>
            <p className="text-md text-gray-500 dark:text-gray-400 mb-4">
                Bu konuyla ilgili ne öğrenmek istersin? Örnek: "Bu konuyu gerçek hayattan örneklerle açıkla.", "Konunun en önemli 5 noktasını özetle."
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="İsteğinizi buraya yazın..."
                    className="flex-grow w-full px-4 py-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button 
                    onClick={handleGenerateContent}
                    disabled={isGenerating}
                    className="flex items-center justify-center bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors font-semibold"
                >
                    {isGenerating ? <LoadingSpinner size="sm" /> : <><SparklesIcon className="w-5 h-5 mr-2" /> Oluştur</>}
                </button>
            </div>

            {generatedContent && (
                <div className="mt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xl font-semibold">Oluşturulan İçerik</h4>
                        <button 
                            onClick={handleGeneratePdf}
                            className="flex items-center justify-center bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-green-400 transition-colors text-sm"
                        >
                            <DownloadCloud className="w-5 h-5 mr-2" /> PDF İndir
                        </button>
                    </div>
                    <div ref={contentRef} className="p-6 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                        <div className="prose prose-lg dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{generatedContent}</ReactMarkdown>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const LessonsPage: React.FC = () => {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
    const [filters, setFilters] = useState({ subject: 'all', gradeLevel: 'all' });
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    useEffect(() => {
        const fetchLessons = async () => {
            setLoading(true);
            try {
                const lessonsQuery = query(collection(db, 'lessons'), where("status", "==", "approved"));
                const lessonsSnapshot = await getDocs(lessonsQuery);
                const lessonsList = lessonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson));
                setLessons(lessonsList);
            } catch (error) {
                console.error("Onaylı dersler alınırken hata (fallback tetiklendi):", error);
                const lessonsCollection = collection(db, 'lessons');
                const lessonsSnapshot = await getDocs(lessonsCollection);
                const lessonsList = lessonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson));
                setLessons(lessonsList);
            }
            setLoading(false);
        };
        fetchLessons();
    }, []);

    const filteredLessons = useMemo(() => {
        return lessons
            .filter(lesson => filters.subject === 'all' || lesson.subject === filters.subject)
            .filter(lesson => filters.gradeLevel === 'all' || lesson.gradeLevel === filters.gradeLevel)
            .filter(lesson => lesson.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [lessons, filters, searchQuery]);
    
    useEffect(() => {
      // Filtreler değiştiğinde veya arama yapıldığında seçili dersi temizle
      if (selectedLesson && !filteredLessons.find(l => l.id === selectedLesson.id)) {
        setSelectedLesson(null);
      }
    }, [filteredLessons, selectedLesson]);

    if (loading) {
        return <div className="flex justify-center items-center h-screen"><LoadingSpinner size="lg"/></div>;
    }
    
    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
            {/* Sol Panel: Ders Listesi */}
            <div className="w-1/3 max-w-md border-r border-gray-200 dark:border-gray-700 flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ders Kütüphanesi</h1>
                     <div className="relative mt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Ders ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                        />
                    </div>
                </div>
                <div className="p-4 space-y-4">
                    <select onChange={(e) => setFilters(f => ({...f, subject: e.target.value}))} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600">
                        <option value="all">Tüm Dersler</option>
                        {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                     <select onChange={(e) => setFilters(f => ({...f, gradeLevel: e.target.value}))} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600">
                        <option value="all">Tüm Sınıflar</option>
                        {gradeLevels.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>
                <div className="flex-grow overflow-y-auto p-4">
                    <div className="grid grid-cols-1 gap-4">
                        {filteredLessons.map(lesson => (
                            <div key={lesson.id} onClick={() => setSelectedLesson(lesson)}
                                className={`p-4 rounded-lg cursor-pointer border-2 transition-all ${selectedLesson?.id === lesson.id ? 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-500' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-transparent'}`}>
                                <h3 className="font-bold text-lg text-gray-900 dark:text-white">{lesson.title}</h3>
                                <div className="flex items-center gap-2 mt-2 text-sm">
                                    <span className="font-medium text-indigo-600 dark:text-indigo-400">{lesson.subject}</span>
                                    <span className="text-gray-500 dark:text-gray-400">{lesson.gradeLevel}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sağ Panel: Ders İçeriği */}
            <div className="w-2/3 flex-grow p-8 overflow-y-auto">
                {selectedLesson ? (
                    <div>
                        <div className="mb-8">
                            <span className="text-sm font-medium bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full dark:bg-indigo-900 dark:text-indigo-300">{selectedLesson.subject}</span>
                             <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white mt-3">{selectedLesson.title}</h2>
                            <p className="text-lg text-gray-500 mt-1">{selectedLesson.gradeLevel}</p>
                        </div>
                        
                        <div className="prose prose-lg dark:prose-invert max-w-none bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedLesson.content}</ReactMarkdown>
                        </div>

                        <AiContentGenerator lesson={selectedLesson} />
                    </div>
                ) : (
                    <div className="flex flex-col justify-center items-center h-full text-center">
                        <BookCopy size={64} className="text-gray-400 dark:text-gray-500 mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bir ders seçin</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">
                            Kütüphaneden bir ders seçerek içeriğini görüntüleyin ve AI araçlarını kullanın.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LessonsPage; 