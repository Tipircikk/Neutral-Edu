import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, doc, deleteDoc, DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Bot, Plus, MessageSquare, Trash2, Loader, Calendar, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

interface Coach extends DocumentData {
  id: string;
  coachName: string;
  examType: string;
  createdAt: {
    toDate: () => Date;
  };
}

const CoachListPage: React.FC = () => {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    setLoading(true);
    const coachesCollection = collection(db, 'coaches');
    const q = query(coachesCollection, where('userId', '==', currentUser.uid));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const coachesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coach));
      setCoaches(coachesData);
      setLoading(false);
    }, (error) => {
      console.error("Koçlar getirilirken hata:", error);
      toast.error("Koçlarınızı getirirken bir sorun oluştu.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, navigate]);

  const handleDeleteCoach = async (coachId: string) => {
    if (window.confirm("Bu koçu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) {
        const toastId = toast.loading("Koç siliniyor...");
        try {
            await deleteDoc(doc(db, 'coaches', coachId));
            toast.success("Koç başarıyla silindi.", { id: toastId });
        } catch (error) {
            toast.error("Koç silinirken bir hata oluştu.", { id: toastId });
            console.error("Error deleting coach: ", error);
        }
    }
  };

  if (loading) {
    return (
      <div className="flex-grow flex flex-col justify-center items-center">
        <Loader className="animate-spin text-primary-500" size={48} />
        <p className="mt-4 text-lg">Koçlarınız Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">AI Koçlarım</h1>
        <button
          onClick={() => navigate('/dashboard/coach-generator')}
          className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          <span>Yeni Koç Oluştur</span>
        </button>
      </div>

      {coaches.length === 0 ? (
        <div className="text-center py-16 px-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <Bot size={52} className="mx-auto text-gray-400" />
          <h2 className="mt-4 text-xl font-semibold text-gray-700 dark:text-gray-200">Henüz AI Koçunuz Yok</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Hemen şimdi hedeflerinize özel bir AI çalışma koçu oluşturun.
          </p>
          <button
            onClick={() => navigate('/dashboard/coach-generator')}
            className="mt-6 inline-flex items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-colors"
          >
            İlk Koçunu Oluştur
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coaches.map((coach) => (
            <div key={coach.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden flex flex-col justify-between p-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                  <Bot size={24} className="mr-3 text-indigo-500"/>
                  {coach.coachName}
                </h3>
                <div className="text-sm text-gray-500 dark:text-gray-400 space-y-2">
                    <p className="flex items-center"><BookOpen size={16} className="mr-2"/> Sınav: {coach.examType}</p>
                    <p className="flex items-center"><Calendar size={16} className="mr-2"/> Oluşturulma: {coach.createdAt?.toDate().toLocaleDateString('tr-TR')}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => handleDeleteCoach(coach.id)}
                  className="p-2 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  aria-label="Koçu Sil"
                >
                  <Trash2 size={20} />
                </button>
                <button
                  onClick={() => navigate(`/dashboard/chat/${coach.id}`)}
                  className="flex items-center px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-lg shadow transition-colors text-sm"
                >
                  <MessageSquare size={16} className="mr-2"/>
                  Sohbet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CoachListPage; 