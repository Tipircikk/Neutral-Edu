import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { BookMarked, Search, DownloadCloud, BookCopy, ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import ai, { modelName } from '../lib/gemini';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, FileText, Download } from 'lucide-react';
import VideoPlayer from '../components/Lessons/VideoPlayer';

interface Lesson {
    id: string;
    title: string;
    subject: string;
    gradeLevel: string;
    content: string;
    createdAt: any;
    attachments?: { name: string; url: string; }[];
    youtubeLink?: string;
    coverImageUrl?: string;
    interactiveQuestions?: any[]; // Using any for now
}

// Bu listeler AdminPage'den kopyalandı, idealde ortak bir dosyada olabilir.
const availableSubjects = [
  'Matematik', 'Fizik', 'Kimya', 'Biyoloji', 
  'Türkçe', 'Edebiyat', 'Tarih', 'Coğrafya', 'Felsefe'
];
const gradeLevels = ['9. Sınıf', '10. Sınıf', '11. Sınıf', '12. Sınıf', 'YKS', 'LGS'];

const getYouTubeEmbedUrl = (url: string | undefined): string | null => {
    if (!url) return null;
    let videoId: string | null = null;
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1);
        } else if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
            videoId = urlObj.searchParams.get('v');
        }
    } catch (error) {
        console.error("Invalid URL:", error);
        return null;
    }
    
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
};

const LessonsPage: React.FC = () => {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
    const [filters, setFilters] = useState({ subject: 'all', gradeLevel: 'all' });
    const [searchQuery, setSearchQuery] = useState('');

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
      if (selectedLesson && !filteredLessons.find(l => l.id === selectedLesson.id)) {
        setSelectedLesson(null);
      }
    }, [filteredLessons, selectedLesson]);

    if (loading) {
        return <div className="flex justify-center items-center h-screen"><LoadingSpinner size="lg"/></div>;
    }
    
    if (selectedLesson) {
        return (
            <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
                <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
                    <button 
                        onClick={() => setSelectedLesson(null)} 
                        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Tüm Derslere Geri Dön
                    </button>
                    
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8">
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">{selectedLesson.title}</h2>
                        <div className="flex flex-wrap items-center gap-3 mt-4 mb-8">
                            <span className="font-semibold bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm dark:bg-indigo-900 dark:text-indigo-200">{selectedLesson.subject}</span>
                            <span className="font-semibold bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm dark:bg-gray-700 dark:text-gray-300">{selectedLesson.gradeLevel}</span>
                        </div>

                        <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 lg:p-8">
                            <div className="mb-8">
                                {selectedLesson.youtubeLink ? (
                                     <VideoPlayer 
                                        youtubeLink={selectedLesson.youtubeLink}
                                        questions={selectedLesson.interactiveQuestions}
                                     />
                                ) : selectedLesson.coverImageUrl ? (
                                    <img src={selectedLesson.coverImageUrl} alt={selectedLesson.title} className="w-full rounded-lg shadow-md aspect-video object-cover" />
                                ) : null}
                            </div>

                            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2">{selectedLesson.title}</h1>
                            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
                                <span className="font-medium text-indigo-600 dark:text-indigo-400">{selectedLesson.subject}</span>
                                <span className="text-gray-500 dark:text-gray-400">•</span>
                                <span className="text-gray-500 dark:text-gray-400">{selectedLesson.gradeLevel}</span>
                            </div>

                            <div className="prose prose-lg dark:prose-invert max-w-none 
                                            prose-headings:font-bold prose-headings:text-gray-800 dark:prose-headings:text-gray-200 prose-headings:mt-10 prose-headings:mb-5
                                            prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed prose-p:my-6
                                            prose-ul:list-disc prose-ul:pl-6 prose-li:my-4 prose-li:leading-relaxed
                                            prose-ol:list-decimal prose-ol:pl-6
                                            prose-a:text-indigo-600 hover:prose-a:text-indigo-700 dark:prose-a:text-indigo-400
                                            prose-hr:hidden
                                            text-gray-700 dark:text-gray-300">
                                 <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {selectedLesson.content}
                                </ReactMarkdown>
                            </div>

                            {selectedLesson.attachments && selectedLesson.attachments.length > 0 && (
                                <div className="mt-8 pt-6 border-t dark:border-gray-600">
                                    <h4 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Ekler</h4>
                                    <ul className="space-y-2">
                                        {selectedLesson.attachments.map(file => (
                                            <li key={file.url}>
                                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-indigo-600 hover:underline dark:text-indigo-400">
                                                    <DownloadCloud className="w-4 h-4" />
                                                    {file.name}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Ders listesi görünümü
    return (
        <div className="bg-gray-100 dark:bg-gray-900 min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Üst Başlık ve Filtreler */}
                <div className="md:flex md:items-center md:justify-between mb-8">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-3xl font-bold leading-tight text-gray-900 dark:text-white">Ders Kütüphanesi</h1>
                    </div>
                    <div className="mt-4 flex md:mt-0 md:ml-4">
                        <div className="relative w-full max-w-xs">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Ders ara..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    <select onChange={(e) => setFilters(f => ({...f, subject: e.target.value}))} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="all" className="bg-white dark:bg-gray-800">Tüm Dersler</option>
                        {availableSubjects.map(s => <option className="bg-white dark:bg-gray-800" key={s} value={s}>{s}</option>)}
                    </select>
                     <select onChange={(e) => setFilters(f => ({...f, gradeLevel: e.target.value}))} className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="all" className="bg-white dark:bg-gray-800">Tüm Sınıflar</option>
                        {gradeLevels.map(g => <option className="bg-white dark:bg-gray-800" key={g} value={g}>{g}</option>)}
                    </select>
                </div>

                {/* Ders Kartları Grid */}
                {filteredLessons.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredLessons.map(lesson => (
                            <div 
                                key={lesson.id} 
                                onClick={() => setSelectedLesson(lesson)}
                                className="bg-white dark:bg-gray-800 rounded-lg shadow-md cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden group"
                            >
                                <div className="relative h-40 w-full overflow-hidden">
                                    {lesson.coverImageUrl ? (
                                        <img src={lesson.coverImageUrl} alt={lesson.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                            <BookCopy className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                                        </div>
                                    )}
                                </div>
                                <div className="p-5 flex-grow">
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{lesson.title}</h3>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="font-medium text-indigo-600 dark:text-indigo-400">{lesson.subject}</span>
                                        <span className="text-gray-500 dark:text-gray-400">•</span>
                                        <span className="text-gray-500 dark:text-gray-400">{lesson.gradeLevel}</span>
                                    </div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700/50 px-5 py-3 text-sm font-medium text-indigo-700 dark:text-indigo-300 mt-auto">
                                    Dersi Görüntüle →
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
                         <Search className="mx-auto h-12 w-12 text-gray-400" />
                        <h2 className="mt-4 text-xl font-medium text-gray-700 dark:text-gray-300">Sonuç Bulunamadı</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Arama kriterlerinizi değiştirmeyi deneyin.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default LessonsPage; 