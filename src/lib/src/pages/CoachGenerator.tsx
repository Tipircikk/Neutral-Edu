import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    Bot, Save, ArrowLeft, ArrowRight, User, Target, Book, Calendar, Sparkles, BarChart, Mic, Brain, Heart, CheckSquare, Clock, Users, Zap, Wind, Coffee, Award, Smile, Loader, BookCopy, TestTube, Languages, School
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Data for the new UI
const examTypes = [
    { id: 'TYT', title: 'TYT', description: 'Temel Yeterlilik Testi', icon: <BookCopy size={28} /> },
    { id: 'AYT', title: 'AYT', description: 'Alan Yeterlilik Testi', icon: <TestTube size={28} /> },
    { id: 'YDT', title: 'YDT', description: 'Yabancı Dil Testi', icon: <Languages size={28} /> },
    { id: 'LGS', title: 'LGS', description: 'Liselere Geçiş Sınavı', icon: <School size={28} /> },
];

const lessonOptions = ['Matematik', 'Türkçe', 'Fen Bilimleri', 'Sosyal Bilimler'];

const communicationTones = [
    { id: 'encouraging', title: 'Cesaretlendirici', description: 'Pozitif pekiştirme odaklı' },
    { id: 'inspirational', title: 'İlham Verici', description: 'Motive edici konuşmalar yapar' },
    { id: 'clear', title: 'Net ve Açık', description: 'Doğrudan, gereksiz detaysız' },
    { id: 'detailed', title: 'Detaylı', description: 'Kapsamlı açıklamalar sunar' },
];

const interactionOptions = [
    { id: 'morning_check', title: 'Sabah Kontrolü', description: 'Güne başlarken motivasyon' },
    { id: 'task_lists', title: 'Görev Listeleri', description: 'Günlük yapılacaklar' },
    { id: 'thought_questions', title: 'Düşünce Soruları', description: 'Öğrenmeyi pekiştirme' },
    { id: 'motivational_quotes', title: 'Motivasyon Sözleri', description: 'İlham verici mesajlar' },
    { id: 'progress_tracking', title: 'İlerleme Takibi', description: 'Başarı değerlendirmesi' },
    { id: 'study_tips', title: 'Çalışma İpuçları', description: 'Teknik öneriler' },
];

const dailyHoursOptions = ['1 Saat', '2 Saat', '3 Saat', '4 Saat', '5+ Saat'];

const CoachGenerator: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    
    // Page states
    const [loading, setLoading] = useState(true); // For initial coach check
    const [isSaving, setIsSaving] = useState(false);
    const [step, setStep] = useState(1);

    // Form states for the new UI
    const [coachName, setCoachName] = useState('Personal Coach');
    const [examType, setExamType] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [subjects, setSubjects] = useState<string[]>([]);
    const [communicationTone, setCommunicationTone] = useState<string[]>([]);
    const [interactions, setInteractions] = useState<string[]>([]);
    const [dailyHours, setDailyHours] = useState('');
    const [personality, setPersonality] = useState('');

    useEffect(() => {
        const checkUser = () => {
            if (!currentUser) {
                navigate('/login');
                return;
            }
            // Sayfa ilk yüklendiğinde artık koç var mı diye kontrol etmiyoruz,
            // bu sayede kullanıcı her zaman yeni bir koç oluşturabilir veya eskisini güncelleyebilir.
            setLoading(false); 
        };
        checkUser();
    }, [currentUser, navigate]);

    const handleToggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
        setter(prev => prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]);
    };
    
    const handleSaveCoach = async () => {
        if (!currentUser || !examType || !targetDate || subjects.length === 0 || !coachName) {
            toast.error('Lütfen 1. ve 2. adımdaki tüm zorunlu alanları doldurun.');
            setStep(1);
            return;
        }

        setIsSaving(true);
        toast.loading('AI Koçunuz oluşturuluyor...');

        try {
            const initialMessage = `Merhaba! Ben ${coachName}. ${examType} sınavına hazırlık sürecinde sana rehberlik edeceğim. Belirttiğin derslere odaklanarak ve seçtiğin iletişim tonunu kullanarak, ${targetDate} tarihindeki sınavına en iyi şekilde hazırlanmanı sağlayacağım. Hadi başlayalım!`;
            
            const coachesCollection = collection(db, 'coaches');
            const newCoachRef = await addDoc(coachesCollection, {
                userId: currentUser.uid,
                coachName,
                examType,
                targetDate,
                subjects,
                communicationTone,
                interactions,
                dailyHours,
                personality,
                createdAt: serverTimestamp(),
                chatHistory: [{ role: 'model', content: initialMessage, timestamp: new Date() }]
            });

            toast.dismiss();
            toast.success("Koçunuz başarıyla oluşturuldu!");
            navigate(`/dashboard/chat/${newCoachRef.id}`);

        } catch (error) {
            toast.dismiss();
            toast.error("Koç kaydedilirken bir hata oluştu.");
            console.error("Error saving coach:", error);
        } finally {
            setIsSaving(false);
        }
    };
    
    const nextStep = () => {
        if (step === 1 && (!examType || !targetDate)) {
            toast.error('Lütfen sınav türünü ve hedef tarihi seçin.');
            return;
        }
        if (step === 2 && (subjects.length === 0 || !coachName)) {
            toast.error('Lütfen koçunuza isim verin ve en az bir ders seçin.');
            return;
        }
        setStep(s => s + 1);
    }
    const prevStep = () => setStep(s => s - 1);

    // Step rendering logic
    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <div>
                        <h3 className="text-xl font-bold text-gray-100 mb-2">Temel Tercihler</h3>
                        <p className="text-gray-400 mb-6">Sınav türünü ve diğer temel bilgileri seçerek başla.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {examTypes.map((type) => (
                                <div key={type.id} onClick={() => setExamType(type.id)}
                                    className={`p-6 rounded-lg cursor-pointer border-2 transition-all flex items-center gap-4 ${examType === type.id ? 'border-indigo-500 bg-indigo-900/30' : 'border-gray-700 bg-gray-800/60 hover:border-indigo-600'}`}>
                                    <div className="text-indigo-400">{type.icon}</div>
                                    <div>
                                        <h4 className="font-bold text-lg text-gray-100">{type.title}</h4>
                                        <p className="text-sm text-gray-400">{type.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6">
                            <label htmlFor="targetDate" className="block text-sm font-medium text-gray-300 mb-2">Hedef Sınav Tarihi</label>
                            <input
                                type="date"
                                id="targetDate"
                                value={targetDate}
                                onChange={(e) => setTargetDate(e.target.value)}
                                min={new Date().toISOString().split("T")[0]}
                                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    </div>
                );
            case 2:
                return (
                     <div>
                        <h3 className="text-xl font-bold text-gray-100 mb-6">Detaylı Tercihler</h3>
                        <div className="space-y-6">
                            <div>
                                <label htmlFor="coachName" className="block text-sm font-medium text-gray-300 mb-2">Koçuna bir isim ver</label>
                                <input
                                    type="text"
                                    id="coachName"
                                    value={coachName}
                                    onChange={(e) => setCoachName(e.target.value)}
                                    placeholder="Örn: Başarı Rehberim"
                                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-3 pt-4">Odaklanmak İstediğin Dersler</label>
                                <div className="flex flex-wrap gap-4">
                                    {lessonOptions.map(subject => (
                                        <label key={subject} className={`flex items-center space-x-2 p-3 rounded-lg cursor-pointer border-2 ${subjects.includes(subject) ? 'border-indigo-500 bg-indigo-900/30' : 'border-gray-700 bg-gray-800/60'}`}>
                                            <input type="checkbox" checked={subjects.includes(subject)} onChange={() => handleToggle(setSubjects, subject)} className="h-4 w-4 rounded border-gray-500 text-indigo-600 focus:ring-indigo-500 bg-gray-700" />
                                            <span className="text-gray-200">{subject}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-3">İletişim Tonu</label>
                                <div className="grid grid-cols-2 gap-4">
                                     {communicationTones.map(item => (
                                         <div key={item.id} onClick={() => handleToggle(setCommunicationTone, item.id)} className={`p-4 rounded-lg cursor-pointer border-2 ${communicationTone.includes(item.id) ? 'border-indigo-500 bg-indigo-900/30' : 'border-gray-700 bg-gray-800/60'}`}>
                                             <h4 className="font-semibold text-gray-200">{item.title}</h4>
                                             <p className="text-xs text-gray-400">{item.description}</p>
                                         </div>
                                     ))}
                                 </div>
                            </div>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div>
                        <h3 className="text-xl font-bold text-gray-100 mb-6">Kişilik & Onay</h3>
                        <div className="space-y-6">
                            <div>
                                <label htmlFor="personality" className="block text-sm font-medium text-gray-300 mb-2">
                                    Koçunuzun Kişilik Özellikleri
                                </label>
                                <textarea
                                    id="personality"
                                    value={personality}
                                    onChange={(e) => setPersonality(e.target.value)}
                                    placeholder="Örn: Sabırlı, esprili, motive edici ama aynı zamanda disiplinli..."
                                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-indigo-500 focus:border-indigo-500 min-h-[120px]"
                                />
                                 <p className="text-xs text-gray-400 mt-2">AI koçunuzun size nasıl davranmasını istediğinizi birkaç kelimeyle açıklayın.</p>
                            </div>
                             <div className="p-6 rounded-lg bg-gradient-to-br from-green-500/20 to-cyan-500/20">
                                <h4 className="font-bold text-white mb-2">Önizleme</h4>
                                <p className="text-gray-300 text-sm">
                                    Merhaba! Ben AI Koçun. {examType} sınavına hazırlık sürecinde, seçtiğin derslere odaklanarak ve belirlediğin kişilik özelliklerine göre sana özel bir çalışma programı sunacağım. Birlikte başaracağız!
                                </p>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="flex-grow flex flex-col justify-center items-center">
                <Loader className="animate-spin text-primary-500" size={48} />
                <p className="mt-4 text-lg">Kontrol ediliyor...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-8 text-white">
            <div className="text-center mb-8">
                <div className="inline-block p-4 bg-gray-800 text-indigo-400 rounded-full mb-4">
                    <Sparkles className="h-10 w-10" />
                </div>
                <h1 className="text-4xl font-extrabold text-white">AI Çalışma Koçu Oluştur</h1>
                <p className="mt-2 text-md text-gray-400">Size özel kişiselleştirilmiş AI koçunuzu oluşturun</p>
            </div>

            <div className="flex items-center justify-center w-full max-w-md mx-auto mb-12 px-4">
                {[1, 2, 3].map((s, index) => (
                    <React.Fragment key={s}>
                        <div className="flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ${step >= s ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                                {s}
                            </div>
                        </div>
                        {index < 2 && <div className={`flex-auto border-t-2 transition-colors duration-500 ${step > s ? 'border-indigo-600' : 'border-gray-600'}`} />}
                    </React.Fragment>
                ))}
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 p-8 rounded-2xl min-h-[400px]">
                {renderStepContent()}
            </div>

            <div className="flex justify-between mt-8">
                <button
                    onClick={prevStep}
                    disabled={step === 1 || isSaving}
                    className="flex items-center px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    <span>Geri</span>
                </button>

                {step < 3 ? (
                    <button
                        onClick={nextStep}
                        className="flex items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors"
                    >
                         <span>{step === 2 ? 'Özeti Gör' : 'Devam Et'}</span>
                        <ArrowRight className="w-5 h-5 ml-2" />
                    </button>
                ) : (
                    <button
                        onClick={handleSaveCoach}
                        disabled={isSaving}
                        className="flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors disabled:bg-green-400 disabled:cursor-not-allowed"
                    >
                        <Save className="w-5 h-5 mr-2" />
                        <span>{isSaving ? 'Kaydediliyor...' : 'Koçu Kaydet'}</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default CoachGenerator;