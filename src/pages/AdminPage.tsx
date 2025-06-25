import React, { useState, useEffect } from 'react';
import { db, storage, functions } from '../lib/firebase';
import { httpsCallable } from "firebase/functions";
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { User, Shield, BookOpen, Plus, Trash2, Edit, X, Sparkles, FileText, UploadCloud, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

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
    youtubeLink?: string;
    coverImageUrl?: string;
    interactiveQuestions?: InteractiveQuestion[];
}

interface InteractiveQuestion {
  id: string; // To be used as a key in React
  timestamp: number;
  question: string;
  options: string[];
  correctAnswer: string;
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
  const [filters, setFilters] = useState({ subject: 'all', gradeLevel: 'all' });
  
  const [aiStep, setAiStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [lessonPrompt, setLessonPrompt] = useState({ title: '', subject: availableSubjects[0], gradeLevel: gradeLevels[0], keywords: '', youtubeLink: '' });
  const [generatedContent, setGeneratedContent] = useState('');
  const [isTranscriptFetching, setIsTranscriptFetching] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [interactiveQuestions, setInteractiveQuestions] = useState<InteractiveQuestion[]>([]);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCoverUploading, setIsCoverUploading] = useState(false);

  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      if (activeTab === 'users') {
        const usersCollection = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollection);
        const usersList = usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as UserData));
        setUsers(usersList);
      } else if (activeTab === 'lessons') {
        const lessonsCollection = collection(db, 'lessons');
        const lessonsSnapshot = await getDocs(lessonsCollection);
        const lessonsList = lessonsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Lesson)).sort((a: Lesson, b: Lesson) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
        setLessons(lessonsList);
      }
      setLoading(false);
    };

    fetchData();
  }, [activeTab]);

  const filteredLessons = React.useMemo(() => {
    return lessons.filter((lesson: Lesson) => {
        const subjectMatch = filters.subject === 'all' || lesson.subject === filters.subject;
        const gradeLevelMatch = filters.gradeLevel === 'all' || lesson.gradeLevel === filters.gradeLevel;
        return subjectMatch && gradeLevelMatch;
    });
  }, [lessons, filters]);

  const resetAiModal = () => {
    setIsAiModalOpen(false);
    setAiStep(1);
    setGenerating(false);
    setGeneratedContent('');
    setLessonPrompt({ title: '', subject: availableSubjects[0], gradeLevel: gradeLevels[0], keywords: '', youtubeLink: '' });
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
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('Dosya boyutu 5MB\'dan büyük olamaz.');
        return;
    }
    
    setUploading(true);
    const toastId = toast.loading("Dosya sunucuya yükleniyor...");

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const fileData = reader.result;
        const filePath = `lesson_attachments/${currentLesson.id}/${Date.now()}_${file.name}`;

        const uploadFunction = httpsCallable(functions, 'uploadFileAsBase64');
        const result = await uploadFunction({ fileData, filePath, fileType: file.type });
        const data = result.data as { downloadURL?: string; error?: string };
        
        if (!data.downloadURL) {
            throw new Error(data.error || "Dosya URL'i alınamadı.");
        }

        const newAttachment = { name: file.name, url: data.downloadURL };
        const lessonRef = doc(db, 'lessons', currentLesson.id);
        await updateDoc(lessonRef, {
          attachments: arrayUnion(newAttachment)
        });

        setCurrentLesson(prev => prev ? { ...prev, attachments: [...(prev.attachments || []), newAttachment] } : null);
        setLessons(prevLessons => prevLessons.map(l => l.id === currentLesson.id ? { ...l, attachments: [...(l.attachments || []), newAttachment] } : l));

        toast.success('Dosya başarıyla yüklendi!', { id: toastId });
      };
      reader.onerror = (error) => {
        throw error;
      };
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error('Dosya yüklenirken bir hata oluştu.', { id: toastId });
    } finally {
      setUploading(false);
    }
  };
  
    const handleDeleteAttachment = async (file: { name: string; url: string; }) => {
    if (!currentLesson) {
        toast.error("İşlem için geçerli bir ders seçilmemiş.");
        return;
    }

    if (!window.confirm(`'${file.name}' adlı dosyayı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
        return;
    }

    const toastId = toast.loading("Dosya siliniyor...");
    try {
        const fileRef = ref(storage, file.url);
        await deleteObject(fileRef);

        const lessonRef = doc(db, 'lessons', currentLesson.id);
        await updateDoc(lessonRef, {
            attachments: arrayRemove(file)
        });

        const updatedAttachments = currentLesson.attachments?.filter(att => att.url !== file.url);
        setCurrentLesson(prev => prev ? { ...prev, attachments: updatedAttachments } : null);
        
        setLessons(prevLessons => prevLessons.map(l => 
            l.id === currentLesson.id 
                ? { ...l, attachments: updatedAttachments } 
                : l
        ));

        toast.dismiss(toastId);
        toast.success("Dosya başarıyla silindi.");

    } catch (error) {
        toast.dismiss(toastId);
        console.error("Attachment deletion failed:", error);
        toast.error("Dosya silinirken bir hata oluştu.");
    }
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !currentLesson) return;
    const file = e.target.files[0];
    if (file.size > 2 * 1024 * 1024) { 
        toast.error('Kapak fotoğrafı boyutu 2MB\'dan büyük olamaz.');
        return;
    }
    
    setIsCoverUploading(true);
    const toastId = toast.loading("Kapak fotoğrafı yükleniyor...");

    // Önceki resmi silme mantığı şimdilik aynı kalabilir, URL'den silme genellikle çalışır.
    if (currentLesson.coverImageUrl) {
        try {
            const oldImageRef = ref(storage, currentLesson.coverImageUrl);
            await deleteObject(oldImageRef);
        } catch (error) {
            console.warn("Eski kapak fotoğrafı silinemedi, muhtemelen zaten yok:", error);
        }
    }
    
    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const fileData = reader.result;
            const filePath = `lesson_covers/${currentLesson.id}/${Date.now()}_${file.name}`;

            const uploadFunction = httpsCallable(functions, 'uploadFileAsBase64');
            const result = await uploadFunction({ fileData, filePath, fileType: file.type });
            const data = result.data as { downloadURL?: string; error?: string };

            if (!data.downloadURL) {
                throw new Error(data.error || "Dosya URL'i alınamadı.");
            }
            
            const lessonRef = doc(db, 'lessons', currentLesson.id);
            await updateDoc(lessonRef, { coverImageUrl: data.downloadURL });

            const updatedLesson = { ...currentLesson, coverImageUrl: data.downloadURL };
            setCurrentLesson(updatedLesson);
            setLessons(prev => prev.map(l => l.id === currentLesson.id ? updatedLesson : l));
            
            toast.success("Kapak fotoğrafı güncellendi!", { id: toastId });
            setIsCoverUploading(false);
        };
        reader.onerror = (error) => {
            setIsCoverUploading(false);
            throw error;
        };
    } catch (error) {
        console.error("Cover image upload failed:", error);
        toast.error("Fotoğraf yüklenirken bir hata oluştu.", { id: toastId });
        setIsCoverUploading(false);
    }
  };

  const handleRemoveCoverImage = async () => {
    if (!currentLesson || !currentLesson.coverImageUrl) return;

    if (!window.confirm("Kapak fotoğrafını kaldırmak istediğinizden emin misiniz?")) return;
    
    const toastId = toast.loading("Kapak fotoğrafı kaldırılıyor...");
    try {
        const imageRef = ref(storage, currentLesson.coverImageUrl);
        await deleteObject(imageRef);

        const lessonRef = doc(db, 'lessons', currentLesson.id);
        await updateDoc(lessonRef, { coverImageUrl: '' });

        const updatedLesson = { ...currentLesson, coverImageUrl: '' };
        setCurrentLesson(updatedLesson);
        setLessons(prev => prev.map(l => l.id === currentLesson.id ? updatedLesson : l));

        toast.dismiss(toastId);
        toast.success("Kapak fotoğrafı kaldırıldı.");
    } catch (error) {
        console.error("Cover image removal failed:", error);
        toast.dismiss(toastId);
        toast.error("Fotoğraf kaldırılırken bir hata oluştu.");
    }
  };

  const handleFetchTranscript = async () => {
    if (!lessonPrompt.youtubeLink) {
        toast.error("Lütfen bir YouTube video linki girin.");
        return;
    }
    setIsTranscriptFetching(true);
    const toastId = toast.loading("Transkript getiriliyor...");
    try {
        const getTranscript = httpsCallable(functions, 'getYouTubeTranscript');
        const result = await getTranscript({ url: lessonPrompt.youtubeLink });
        const data = result.data as { transcript?: string; error?: string };

        if (data.error) {
            throw new Error(data.error);
        }

        if (data.transcript) {
            setLessonPrompt(prev => ({ ...prev, keywords: prev.keywords ? `${prev.keywords}\n\n--- YOUTUBE TRANSCRIPT ---\n${data.transcript}` : data.transcript || '' }));
            toast.success("Transkript başarıyla getirildi ve eklendi!");
        } else {
            throw new Error("Transkript bulunamadı.");
        }

    } catch (error: any) {
        console.error("Transcript fetch failed:", error);
        toast.error(`Transkript getirilemedi: ${error.message}`);
    } finally {
        setIsTranscriptFetching(false);
        toast.dismiss(toastId);
    }
  };

  const handleGenerateInteractiveQuestions = async () => {
      if (!currentLesson?.youtubeLink) {
          toast.error("Soru üretmek için derse bir YouTube linki eklenmiş olmalı.");
          return;
      }
      setIsGeneratingQuestions(true);
      const toastId = toast.loading("Transkript alınıyor ve sorular üretiliyor...");

      try {
          // Step 1: Get transcript
          const getTranscriptFunc = httpsCallable(functions, 'getYouTubeTranscript');
          const transcriptResult = await getTranscriptFunc({ url: currentLesson.youtubeLink });
          const transcriptData = transcriptResult.data as { transcript?: string; error?: string };

          if (!transcriptData.transcript) {
              throw new Error(transcriptData.error || "Transkript alınamadı.");
          }
          
          toast.loading("AI interaktif soruları hazırlıyor...", { id: toastId });

          // Step 2: Generate questions from transcript
          const generateQuestionsFunc = httpsCallable(functions, 'generateInteractiveQuestions');
          const questionsResult = await generateQuestionsFunc({ transcript: transcriptData.transcript });
          const questionsData = questionsResult.data as { questions?: any[] };
          
          if (!questionsData.questions || questionsData.questions.length === 0) {
              throw new Error("AI, bu transkript için soru üretemedi.");
          }
          
          // Add a temporary ID for React keys
          const newQuestions = questionsData.questions.map((q, index) => ({ ...q, id: `q-${Date.now()}-${index}` }));
          
          setInteractiveQuestions(newQuestions);
          setCurrentLesson(prev => prev ? { ...prev, interactiveQuestions: newQuestions } : null);

          toast.success("Sorular başarıyla üretildi! Şimdi düzenleyip kaydedebilirsiniz.", { id: toastId });

      } catch (error: any) {
          console.error("Interactive question generation failed:", error);
          toast.error(`Soru üretilemedi: ${error.message}`, { id: toastId });
      } finally {
          setIsGeneratingQuestions(false);
      }
  };

  const handleQuestionChange = (id: string, field: string, value: string | number | string[]) => {
      const updatedQuestions = interactiveQuestions.map(q => {
          if (q.id === id) {
              return { ...q, [field]: value };
          }
          return q;
      });
      setInteractiveQuestions(updatedQuestions);
  };
  
  const handleSaveInteractiveQuestions = async () => {
    if (!currentLesson) return;
    const toastId = toast.loading("İnteraktif sorular kaydediliyor...");
    try {
        const lessonRef = doc(db, 'lessons', currentLesson.id);
        await updateDoc(lessonRef, {
            interactiveQuestions: interactiveQuestions
        });

        setLessons(prev => prev.map(l => l.id === currentLesson.id ? { ...l, interactiveQuestions: interactiveQuestions } : l));
        
        toast.success("Sorular başarıyla derse kaydedildi.", { id: toastId });
    } catch (error) {
        console.error("Error saving questions:", error);
        toast.error("Sorular kaydedilirken bir hata oluştu.", { id: toastId });
    }
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
        const generateFunction = httpsCallable(functions, 'generateLessonFromKeywords');
        const result = await generateFunction(lessonPrompt);
        const data = result.data as { content?: string; error?: string; };

        if (data.error) {
          throw new Error(data.error);
        }
        
        const content = data.content;
        
        toast.dismiss(toastId);

        if (!content) {
          throw new Error("AI içerik üretirken boş yanıt döndürdü.");
        }

        setGeneratedContent(content);
        setAiStep(2);
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
    const toastId = toast.loading('Ders kaydediliyor...');

    try {
        const docRef = await addDoc(collection(db, 'lessons'), {
            title: lessonPrompt.title,
            subject: lessonPrompt.subject,
            gradeLevel: lessonPrompt.gradeLevel,
            content: generatedContent,
            youtubeLink: lessonPrompt.youtubeLink || '',
            status: 'approved',
            createdAt: serverTimestamp()
        });
        
        const newLesson: Lesson = {
            id: docRef.id,
            ...lessonPrompt,
            content: generatedContent,
            status: 'approved',
            createdAt: { toMillis: () => Date.now() }, 
        };
        
        setLessons(prev => [newLesson, ...prev].sort((a: Lesson, b: Lesson) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)));
        
        toast.dismiss(toastId);
        toast.success('Ders başarıyla kaydedildi!');
        resetAiModal();

    } catch (error) {
        toast.dismiss(toastId);
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
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">İsim</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rol</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {users.map(user => (
            <tr key={user.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.name}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.email}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200'}`}>
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
     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredLessons.map(lesson => (
            <div key={lesson.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden flex flex-col">
                <img src={lesson.coverImageUrl || 'https://via.placeholder.com/400x200?text=Ders'} alt={lesson.title} className="w-full h-40 object-cover"/>
                <div className="p-4 flex-grow">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{lesson.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{lesson.subject} • {lesson.gradeLevel}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
                    <button onClick={() => openEditModal(lesson)} className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200">
                        <Edit className="w-4 h-4 mr-1" />
                        Düzenle
                    </button>
                    <button onClick={() => handleDeleteLesson(lesson.id)} className="flex items-center text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
                         <Trash2 className="w-4 h-4 mr-1" />
                        Sil
                    </button>
                </div>
            </div>
        ))}
    </div>
  );
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Paneli</h1>
            <div className="mt-4 sm:mt-0 sm:ml-4 flex items-center space-x-4">
                 <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('lessons')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'lessons' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-600/50'}`}>
                        <BookOpen className="w-5 h-5 inline-block mr-2" />Dersler
                    </button>
                    <button onClick={() => setActiveTab('users')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'users' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-600/50'}`}>
                        <User className="w-5 h-5 inline-block mr-2" />Kullanıcılar
                    </button>
                </div>
                {activeTab === 'lessons' && (
                     <button onClick={() => setIsAiModalOpen(true)} className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-semibold shadow">
                        <Plus className="w-5 h-5 mr-2" />
                        Yeni Ders Ekle
                    </button>
                )}
            </div>
        </div>
        
        {loading ? <div className="text-center py-10"><LoadingSpinner size="lg" /></div> : (
          <div>
            {activeTab === 'users' ? renderUsersTable() : renderLessonsTable()}
          </div>
        )}
      </div>

      {isAiModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{aiStep === 1 ? 'Yapay Zeka ile Ders Oluştur' : 'Oluşturulan İçeriği Onayla'}</h3>
                      <button onClick={resetAiModal} className="p-2 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"><X className="w-6 h-6" /></button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto">
                      {aiStep === 1 ? (
                          <div className="space-y-4">
                              <div>
                                  <label className="block text-gray-700 dark:text-gray-200 mb-1 font-medium">Ders Başlığı</label>
                                  <input type="text" value={lessonPrompt.title} onChange={e => setLessonPrompt({...lessonPrompt, title: e.target.value})} placeholder="Örn: Üçgende Açılar" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"/>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-700 dark:text-gray-200 mb-1 font-medium">Ders</label>
                                    <select value={lessonPrompt.subject} onChange={e => setLessonPrompt({...lessonPrompt, subject: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                                        {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-gray-700 dark:text-gray-200 mb-1 font-medium">Sınıf</label>
                                    <select value={lessonPrompt.gradeLevel} onChange={e => setLessonPrompt({...lessonPrompt, gradeLevel: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                                        {gradeLevels.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                              </div>
                               <div className="mt-4">
                                  <label htmlFor="youtubeLink" className="block text-sm font-medium text-gray-700 dark:text-gray-300">YouTube Video Linki (Transkript için)</label>
                                  <div className="mt-1 flex rounded-md shadow-sm">
                                      <div className="relative flex-grow focus-within:z-10">
                                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                              <LinkIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                          </div>
                                          <input
                                              type="url"
                                              name="youtubeLink"
                                              id="youtubeLink"
                                              className="focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-none rounded-l-md pl-10 sm:text-sm border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                                              placeholder="https://www.youtube.com/watch?v=..."
                                              value={lessonPrompt.youtubeLink}
                                              onChange={(e) => setLessonPrompt({ ...lessonPrompt, youtubeLink: e.target.value })}
                                          />
                                      </div>
                                      <button
                                          type="button"
                                          onClick={handleFetchTranscript}
                                          disabled={isTranscriptFetching}
                                          className="-ml-px relative inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-r-md text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-200 dark:disabled:bg-gray-600"
                                      >
                                          <Sparkles className={`h-5 w-5 ${isTranscriptFetching ? 'animate-spin' : ''}`} />
                                          <span>{isTranscriptFetching ? 'Getiriliyor' : 'Transkript Getir'}</span>
                                      </button>
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-gray-700 dark:text-gray-200 mb-1 font-medium">Anahtar Kelimeler / İçerik Özeti</label>
                                  <textarea value={lessonPrompt.keywords} onChange={e => setLessonPrompt({...lessonPrompt, keywords: e.target.value})} rows={5} placeholder="Örn: Sinüs, kosinüs teoremleri, birim çember ve temel formüller basit bir dille anlatılsın." className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"></textarea>
                              </div>
                              <div className="flex justify-end pt-4">
                                  <button
                                      onClick={handleGenerateContent}
                                      disabled={generating}
                                      className="flex items-center justify-center bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 font-semibold"
                                  >
                                      {generating ? <LoadingSpinner size="sm" /> : <><Sparkles className="w-5 h-5 mr-2" /> İçerik Oluştur</>}
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              <div className="mt-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                                  <label htmlFor="generatedContent" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Oluşturulan İçerik (Düzenleyebilirsiniz)</label>
                                  <textarea
                                      id="generatedContent"
                                      rows={15}
                                      className="mt-2 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                                      value={generatedContent}
                                      onChange={(e) => setGeneratedContent(e.target.value)}
                                  />
                              </div>
                              <div className="mt-6 flex justify-between">
                                  <button onClick={() => setAiStep(1)} disabled={generating} className="text-gray-600 dark:text-gray-300 hover:underline">Geri Dön ve Değiştir</button>
                                  <button onClick={handleSaveLesson} disabled={generating} className="flex items-center justify-center bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-green-400 w-48">
                                      {generating ? <LoadingSpinner size="sm" /> : 'Dersi Kaydet'}
                                  </button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {isEditModalOpen && currentLesson && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Dersi Düzenle</h3>
                      <button onClick={closeEditModal} className="p-2 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"><X className="w-6 h-6" /></button>
                  </div>

                  <div className="p-6 overflow-y-auto space-y-6">
                      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                           <h4 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-200">Ders Ayarları</h4>
                           
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Kapak Fotoğrafı</label>
                                <div className="mt-2 flex items-center gap-4">
                                    {currentLesson.coverImageUrl ? (
                                        <img src={currentLesson.coverImageUrl} alt="Kapak Fotoğrafı" className="w-32 h-20 object-cover rounded-md shadow" />
                                    ) : (
                                        <div className="w-32 h-20 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center">
                                            <ImageIcon className="w-8 h-8 text-gray-400" />
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="file"
                                            id="cover-upload"
                                            className="hidden"
                                            accept="image/png, image/jpeg, image/webp"
                                            onChange={handleCoverImageUpload}
                                            disabled={isCoverUploading}
                                        />
                                        <label htmlFor="cover-upload" className={`cursor-pointer text-sm font-medium px-4 py-2 rounded-md transition-colors ${isCoverUploading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white`}>
                                            {isCoverUploading ? 'Yükleniyor...' : 'Değiştir'}
                                        </label>
                                        
                                        {currentLesson.coverImageUrl && (
                                            <button onClick={handleRemoveCoverImage} className="text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
                                                Kaldır
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                          <h4 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-200">Dosya Ekleri</h4>
                          <div className="mt-4">
                              <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600">
                                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                      <UploadCloud className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400"/>
                                      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">Yüklemek için tıkla</span> veya sürükle</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">PDF (MAKS. 5MB)</p>
                                  </div>
                                  <input id="dropzone-file" type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} accept=".pdf"/>
                              </label>
                          </div> 
                          {uploading && (
                              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-4">
                                  <div className="bg-indigo-600 h-2.5 rounded-full" style={{width: `${uploadProgress}%`}}></div>
                              </div>
                          )}
                          
                          {currentLesson.attachments && currentLesson.attachments.length > 0 && (
                            <div className="mt-4">
                               <h5 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Yüklenen Dosyalar</h5>
                               <ul className="mt-2 border border-gray-200 dark:border-gray-600 rounded-md divide-y divide-gray-200 dark:divide-gray-600">
                                   {currentLesson.attachments.map(file => (
                                       <li key={file.url} className="pl-4 pr-3 py-2 flex items-center justify-between text-sm">
                                           <div className="w-0 flex-1 flex items-center">
                                               <FileText className="flex-shrink-0 h-5 w-5 text-gray-400" aria-hidden="true" />
                                               <a href={file.url} target="_blank" rel="noopener noreferrer" className="ml-2 flex-1 w-0 truncate text-indigo-600 dark:text-indigo-400 hover:underline">
                                                   {file.name}
                                               </a>
                                           </div>
                                           <div className="ml-4 flex-shrink-0">
                                               <button onClick={() => handleDeleteAttachment(file)} className="p-1 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/50 transition-colors">
                                                   <Trash2 className="h-5 w-5" />
                                                   <span className="sr-only">Dosyayı sil</span>
                                               </button>
                                           </div>
                                       </li>
                                   ))}
                               </ul>
                           </div>
                          )}
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                        <div className="flex justify-between items-center mb-4">
                           <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-200">İnteraktif Video Soruları</h4>
                           <button 
                            onClick={handleGenerateInteractiveQuestions}
                            disabled={isGeneratingQuestions || !currentLesson?.youtubeLink}
                            className="flex items-center text-sm font-medium px-3 py-1.5 rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed"
                           >
                             <Sparkles className={`w-4 h-4 mr-2 ${isGeneratingQuestions ? 'animate-spin' : ''}`}/>
                             {isGeneratingQuestions ? 'Üretiliyor...' : 'AI ile Soru Oluştur'}
                           </button>
                        </div>
                        
                         {isGeneratingQuestions && !interactiveQuestions.length && (
                            <div className="text-center py-4">
                                <LoadingSpinner />
                                <p className="text-sm text-gray-500 mt-2">Transkript alınıyor ve sorular üretiliyor... Bu işlem 30 saniye kadar sürebilir.</p>
                            </div>
                        )}

                        {interactiveQuestions.length > 0 && (
                            <div className="space-y-6">
                                {interactiveQuestions.map((q, index) => (
                                    <div key={q.id} className="bg-white dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                                       <div className="flex items-center gap-4 mb-3">
                                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Zaman (saniye):</label>
                                            <input 
                                                type="number" 
                                                value={q.timestamp}
                                                onChange={(e) => handleQuestionChange(q.id, 'timestamp', parseInt(e.target.value))}
                                                className="w-24 px-2 py-1 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                                            />
                                       </div>
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Soru:</label>
                                        <textarea 
                                            value={q.question}
                                            onChange={(e) => handleQuestionChange(q.id, 'question', e.target.value)}
                                            className="w-full px-2 py-1 border rounded-md dark:bg-gray-800 dark:border-gray-600 my-1"
                                            rows={2}
                                        />
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Seçenekler:</label>
                                        <div className="space-y-2 mt-1">
                                            {q.options.map((option, optIndex) => (
                                                 <div key={optIndex} className="flex items-center">
                                                    <input 
                                                        type="radio" 
                                                        name={`q-${q.id}-correct`} 
                                                        checked={option === q.correctAnswer}
                                                        onChange={() => handleQuestionChange(q.id, 'correctAnswer', option)}
                                                        className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 dark:bg-gray-900 dark:border-gray-600"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        value={option}
                                                        onChange={(e) => {
                                                            const newOptions = [...q.options];
                                                            newOptions[optIndex] = e.target.value;
                                                            // if this was the correct answer, update the correct answer as well
                                                            const isCorrect = q.correctAnswer === option;
                                                            handleQuestionChange(q.id, 'options', newOptions);
                                                            if (isCorrect) {
                                                                handleQuestionChange(q.id, 'correctAnswer', e.target.value);
                                                            }
                                                        }}
                                                        className="ml-3 block w-full text-sm border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-600"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                <button onClick={handleSaveInteractiveQuestions} className="w-full mt-4 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                                    İnteraktif Soruları Kaydet
                                </button>
                            </div>
                        )}
                      </div>
                  </div>
                   <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                        <button onClick={closeEditModal} type="button" className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">
                            Kapat
                        </button>
                    </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AdminPage;
