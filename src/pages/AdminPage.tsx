import React, { useState, useEffect } from 'react';
import { db, storage } from '../lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { User, Shield, BookOpen, Plus, Trash2, Edit, X, Sparkles, FileText, UploadCloud, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import ai, { modelName } from '../lib/gemini';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Lesson {
    id: string;
    title: string;
    subject: string;
    gradeLevel: string;
    content: string;
    status: 'pending_review' | 'approved';
    createdAt: any;
    attachments?: { name: string; url: string; }[];
}

const availableSubjects = [
  'Matematik', 'Fizik', 'Kimya', 'Biyoloji', 
  'Türkçe', 'Edebiyat', 'Tarih', 'Coğrafya', 'Felsefe'
];

const gradeLevels = ['9. Sınıf', '10. Sınıf', '11. Sınıf', '12. Sınıf', 'YKS', 'LGS'];


const AdminPage = () => {
  const [activeTab, setActiveTab] = useState('lessons');
  const [users, setUsers] = useState<UserData[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filters, setFilters] = useState({ subject: 'all', gradeLevel: 'all' });
  
  const [aiStep, setAiStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [lessonPrompt, setLessonPrompt] = useState({ title: '', subject: availableSubjects[0], gradeLevel: gradeLevels[0], keywords: '' });
  const [generatedContent, setGeneratedContent] = useState('');

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      if (activeTab === 'users') {
        const usersCollection = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollection);
        const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserData));
        setUsers(usersList);
      } else if (activeTab === 'lessons') {
        const lessonsCollection = collection(db, 'lessons');
        const lessonsSnapshot = await getDocs(lessonsCollection);
        const lessonsList = lessonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson)).sort((a,b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        setLessons(lessonsList);
      }
      setLoading(false);
    };

    fetchData();
  }, [activeTab]);

  const filteredLessons = React.useMemo(() => {
    return lessons.filter(lesson => {
        const subjectMatch = filters.subject === 'all' || lesson.subject === filters.subject;
        const gradeLevelMatch = filters.gradeLevel === 'all' || lesson.gradeLevel === filters.gradeLevel;
        return subjectMatch && gradeLevelMatch;
    });
  }, [lessons, filters]);

  const resetModal = () => {
    setIsModalOpen(false);
    setAiStep(1);
    setGenerating(false);
    setGeneratedContent('');
    setLessonPrompt({ title: '', subject: availableSubjects[0], gradeLevel: gradeLevels[0], keywords: '' });
  };

  const resetAiModal = () => {
    setIsAiModalOpen(false);
    setAiStep(1);
    setGenerating(false);
    setGeneratedContent('');
    setLessonPrompt({ title: '', subject: availableSubjects[0], gradeLevel: gradeLevels[0], keywords: '' });
  };

  const openEditModal = (lesson: Lesson) => {
    setCurrentLesson(lesson);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setCurrentLesson(null);
    setIsEditModalOpen(false);
    setUploadProgress(0);
    setUploading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !currentLesson) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
        toast.error('Dosya boyutu 5MB\'dan büyük olamaz.');
        return;
    }
    setUploading(true);
    
    const storageRef = ref(storage, `lesson_attachments/${currentLesson.id}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      }, 
      (error) => {
        console.error("Upload failed:", error);
        toast.error('Dosya yüklenirken bir hata oluştu.');
        setUploading(false);
      }, 
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
          const newAttachment = { name: file.name, url: downloadURL };
          const lessonRef = doc(db, 'lessons', currentLesson.id);
          await updateDoc(lessonRef, {
            attachments: arrayUnion(newAttachment)
          });

          setCurrentLesson(prev => prev ? { ...prev, attachments: [...(prev.attachments || []), newAttachment] } : null);
          setLessons(prevLessons => prevLessons.map(l => l.id === currentLesson.id ? { ...l, attachments: [...(l.attachments || []), newAttachment] } : l));

          toast.success('Dosya başarıyla yüklendi!');
          setUploading(false);
        });
      }
    );
  };

  const handleGenerateContent = async () => {
    if (!lessonPrompt.title || !lessonPrompt.keywords) {
        toast.error('Lütfen başlık ve anahtar kelimeleri doldurun.');
        return;
    }

    if (!currentUser) {
        toast.error("İçerik üretmek için yetkiniz yok veya giriş yapmadınız.");
        return;
    }

    setGenerating(true);
    const toastId = toast.loading("AI ders içeriğini hazırlıyor...");

    try {
        const prompt = `You are an expert curriculum developer. Your task is to generate a comprehensive lesson plan based on the following details.
The output must be in Turkish and formatted as a clean, well-structured Markdown document.

Lesson Title: "${lessonPrompt.title}"
Subject: "${lessonPrompt.subject}"
Grade Level: "${lessonPrompt.gradeLevel}"
Keywords: "${lessonPrompt.keywords}"

Please generate the lesson content. Include headings, lists, bold text, and other Markdown elements to create a rich, readable, and engaging educational text.
The content should be detailed and suitable for the specified grade level.
Do not include any text or explanation outside of the Markdown content itself.`;
        
        const result = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
        });
        const content = result.text;
        
        toast.dismiss(toastId);

        if (!content) {
          throw new Error("AI içerik üretirken boş yanıt döndürdü.");
        }

        setGeneratedContent(content);
        setAiStep(2); // Move to the next step
        toast.success("İçerik başarıyla oluşturuldu!");

    } catch (error: any) {
        toast.dismiss(toastId);
        const errorMessage = error.message || 'İçerik üretilemedi.';
        toast.error(errorMessage);
        console.error("Content generation failed:", error);
    } finally {
        setGenerating(false);
    }
  };

  const handleSaveLesson = async () => {
    if (!generatedContent) {
        toast.error('Kaydedilecek bir içerik bulunmuyor.');
        return;
    }
    setGenerating(true);
    toast.loading('Ders kaydediliyor...');

    try {
        await addDoc(collection(db, 'lessons'), {
            title: lessonPrompt.title,
            subject: lessonPrompt.subject,
            gradeLevel: lessonPrompt.gradeLevel,
            content: generatedContent,
            status: 'approved',
            createdAt: serverTimestamp()
        });

        toast.dismiss();
        toast.success('Ders başarıyla kaydedildi!');
        resetModal();
        
        const lessonsCollection = collection(db, 'lessons');
        const lessonsSnapshot = await getDocs(lessonsCollection);
        const lessonsList = lessonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lesson)).sort((a,b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        setLessons(lessonsList);

    } catch (error) {
        toast.dismiss();
        toast.error('Ders kaydedilirken bir hata oluştu.');
        console.error(error);
    } finally {
        setGenerating(false);
    }
  };


   const handleDeleteLesson = async (id: string) => {
    if (window.confirm('Bu dersi silmek istediğinizden emin misiniz?')) {
      try {
        await deleteDoc(doc(db, 'lessons', id));
        toast.success('Ders silindi.');
        setLessons(lessons.filter(l => l.id !== id));
      } catch (error) {
        toast.error('Ders silinirken bir hata oluştu.');
      }
    }
  };


  const renderUsersTable = () => (
    <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg shadow">
            <thead>
                <tr className="w-full h-16 border-gray-300 dark:border-gray-700 border-b py-8">
                    <th className="pl-8 text-left text-gray-600 dark:text-gray-200">Kullanıcı</th>
                    <th className="pr-8 text-left text-gray-600 dark:text-gray-200">Rol</th>
                </tr>
            </thead>
            <tbody>
                {users.map(user => (
                    <tr key={user.id} className="h-14 border-gray-300 dark:border-gray-700 border-b">
                        <td className="pl-8 pr-6 text-left whitespace-no-wrap">
                            <div className="flex items-center">
                                <div className="ml-4">
                                    <p className="font-medium text-gray-800 dark:text-white">{user.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                                </div>
                            </div>
                        </td>
                        <td className="pr-8 text-left">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.role === 'admin' ? 'bg-green-200 text-green-800' : 'bg-blue-200 text-blue-800'}`}>
                                {user.role}
                            </span>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
  );
  
  const renderLessonsTable = () => (
     <div>
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-4">
                <select 
                    value={filters.subject} 
                    onChange={e => setFilters({...filters, subject: e.target.value})}
                    className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                    <option value="all">Tüm Dersler</option>
                    {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select 
                    value={filters.gradeLevel}
                    onChange={e => setFilters({...filters, gradeLevel: e.target.value})}
                    className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                    <option value="all">Tüm Sınıflar</option>
                    {gradeLevels.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 shadow-md">
                <Plus className="w-5 h-5 mr-2" /> AI ile Yeni Ders Oluştur
            </button>
        </div>
        <div className="overflow-x-auto">
            <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg shadow">
                <thead>
                    <tr className="w-full h-16 border-gray-300 dark:border-gray-700 border-b py-8">
                        <th className="pl-8 text-left text-gray-600 dark:text-gray-200">Başlık</th>
                        <th className="px-4 text-left text-gray-600 dark:text-gray-200">Ders / Sınıf</th>
                        <th className="px-4 text-left text-gray-600 dark:text-gray-200">Durum</th>
                        <th className="pr-8 text-left text-gray-600 dark:text-gray-200">İşlemler</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredLessons.map(lesson => (
                        <tr key={lesson.id} className="h-14 border-gray-300 dark:border-gray-700 border-b">
                            <td className="pl-8 pr-6 text-left text-gray-800 dark:text-white font-medium">{lesson.title}</td>
                            <td className="px-4 text-left text-gray-500 dark:text-gray-400">{lesson.subject} / {lesson.gradeLevel}</td>
                            <td className="px-4 text-left">
                               <span className={`px-2 py-1 text-xs font-semibold rounded-full ${lesson.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {lesson.status === 'approved' ? 'Onaylı' : 'İnceleniyor'}
                               </span>
                            </td>
                            <td className="pr-8 text-left flex items-center space-x-2 h-14">
                                <button onClick={() => openEditModal(lesson)} className="text-blue-500 hover:text-blue-700 p-1">
                                    <Edit className="w-5 h-5" />
                                </button>
                                <button onClick={() => handleDeleteLesson(lesson.id)} className="text-red-500 hover:text-red-700 p-1">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </td>
                        </tr>
                    ))}
                     {filteredLessons.length === 0 && (
                        <tr>
                            <td colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400">
                                Filtreyle eşleşen ders bulunamadı.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );


  return (
    <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Admin Paneli</h1>
        <div className="flex border-b border-gray-300 dark:border-gray-700 mb-6">
            <button onClick={() => setActiveTab('users')} className={`flex items-center px-4 py-2 text-lg font-medium ${activeTab === 'users' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}>
                <User className="mr-2" /> Kullanıcılar
            </button>
            <button onClick={() => setActiveTab('lessons')} className={`flex items-center px-4 py-2 text-lg font-medium ${activeTab === 'lessons' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}>
                <BookOpen className="mr-2" /> Dersler
            </button>
        </div>

        {loading ? <LoadingSpinner /> : (
            <div>
                {activeTab === 'users' ? renderUsersTable() : renderLessonsTable()}
            </div>
        )}

        {isModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl transform transition-all duration-300 scale-100">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {aiStep === 1 ? 'AI ile Ders İçeriği Oluştur' : 'Oluşturulan İçeriği Onayla'}
                        </h2>
                        <button onClick={resetModal} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {aiStep === 1 ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-gray-700 dark:text-gray-200 mb-2 font-medium">Ders Başlığı</label>
                                <input type="text" value={lessonPrompt.title} onChange={e => setLessonPrompt({...lessonPrompt, title: e.target.value})} placeholder="Örn: Trigonometriye Giriş" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-700 dark:text-gray-200 mb-2 font-medium">Konu</label>
                                    <select value={lessonPrompt.subject} onChange={e => setLessonPrompt({...lessonPrompt, subject: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                                        {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-gray-700 dark:text-gray-200 mb-2 font-medium">Sınıf Seviyesi</label>
                                    <select value={lessonPrompt.gradeLevel} onChange={e => setLessonPrompt({...lessonPrompt, gradeLevel: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                                        {gradeLevels.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-gray-700 dark:text-gray-200 mb-2 font-medium">Anahtar Kelimeler / İstekler</label>
                                <textarea value={lessonPrompt.keywords} onChange={e => setLessonPrompt({...lessonPrompt, keywords: e.target.value})} rows={5} placeholder="Örn: Sinüs, kosinüs teoremleri, birim çember ve temel formüller basit bir dille anlatılsın." className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"></textarea>
                            </div>
                            <div className="flex justify-end pt-4">
                                <button
                                    type="button" 
                                    onClick={handleGenerateContent} 
                                    disabled={generating} 
                                    className="flex items-center justify-center bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:bg-primary-400 w-48"
                                >
                                    {generating ? <LoadingSpinner size="sm" /> : <><Sparkles className="w-5 h-5 mr-2" /> İçerik Oluştur</>}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-gray-700 dark:text-gray-200 mb-2 font-medium">Oluşturulan İçerik (Düzenleyebilirsiniz)</label>
                                <textarea value={generatedContent} onChange={e => setGeneratedContent(e.target.value)} rows={15} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-600 font-mono text-sm"></textarea>
                            </div>
                            <div className="flex justify-between items-center pt-4">
                                <button onClick={() => setAiStep(1)} disabled={generating} className="text-gray-600 dark:text-gray-300 hover:underline">Geri Dön ve Değiştir</button>
                                <button onClick={handleSaveLesson} disabled={generating} className="flex items-center justify-center bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-green-400 w-48">
                                    {generating ? <LoadingSpinner size="sm" /> : <><FileText className="w-5 h-5 mr-2" /> Dersi Kaydet</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {isEditModalOpen && currentLesson && (
             <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-2xl transform transition-all duration-300 scale-100">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dersi Düzenle</h2>
                            <p className="text-sm text-gray-400">{currentLesson.title}</p>
                        </div>
                        <button onClick={closeEditModal} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <h3 className="font-semibold text-lg text-gray-200 mb-3">Eklenmiş Dosyalar</h3>
                            <div className="space-y-2">
                                {currentLesson.attachments && currentLesson.attachments.length > 0 ? (
                                    currentLesson.attachments.map((file, index) => (
                                        <a href={file.url} target="_blank" rel="noopener noreferrer" key={index} className="flex items-center justify-between bg-gray-700 p-3 rounded-lg hover:bg-gray-600">
                                            <div className="flex items-center space-x-3">
                                                <LinkIcon className="w-5 h-5 text-primary-400" />
                                                <span className="text-gray-300">{file.name}</span>
                                            </div>
                                            <span className="text-xs text-gray-400">Görüntüle</span>
                                        </a>
                                    ))
                                ) : (
                                    <p className="text-gray-500 text-sm">Bu derse henüz dosya eklenmemiş.</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold text-lg text-gray-200 mb-3">Yeni Dosya Yükle (PDF, maks 5MB)</h3>
                             <div className="flex items-center justify-center w-full">
                                <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700 hover:bg-gray-600">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <UploadCloud className="w-10 h-10 mb-3 text-gray-400"/>
                                        <p className="mb-2 text-sm text-gray-400"><span className="font-semibold">Yüklemek için tıkla</span> veya dosyayı sürükle</p>
                                    </div>
                                    <input id="dropzone-file" type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} accept=".pdf"/>
                                </label>
                            </div> 
                            {uploading && (
                                <div className="w-full bg-gray-600 rounded-full h-2.5 mt-4">
                                    <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default AdminPage;
