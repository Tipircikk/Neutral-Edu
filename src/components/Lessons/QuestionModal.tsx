import React, { useState } from 'react';

interface InteractiveQuestion {
  id: string;
  timestamp: number;
  question: string;
  options: string[];
  correctAnswer: string;
}

interface QuestionModalProps {
  question: InteractiveQuestion;
  onAnswer: (isCorrect: boolean) => void;
  onClose: () => void; // This might not be used if answering is mandatory
}

const QuestionModal: React.FC<QuestionModalProps> = ({ question, onAnswer }) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!selectedOption) return;
    setSubmitted(true);
    const isCorrect = selectedOption === question.correctAnswer;
    
    // Provide visual feedback before closing the modal
    setTimeout(() => {
        onAnswer(isCorrect);
    }, 1000); 
  };
  
  const getButtonClass = (option: string) => {
    if (!submitted) {
        return 'bg-gray-100 dark:bg-gray-700 hover:bg-indigo-100 dark:hover:bg-indigo-900';
    }
    if (option === question.correctAnswer) {
        return 'bg-green-500 text-white';
    }
    if (option === selectedOption && option !== question.correctAnswer) {
        return 'bg-red-500 text-white';
    }
    return 'bg-gray-100 dark:bg-gray-600';
  }

  return (
    <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all flex flex-col p-8">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">{question.question}</h3>
        
        <div className="space-y-4">
            {question.options.map((option, index) => (
                <button
                    key={index}
                    onClick={() => !submitted && setSelectedOption(option)}
                    disabled={submitted}
                    className={`w-full text-left p-4 rounded-lg font-semibold transition-all duration-300 ${getButtonClass(option)} ${selectedOption === option && !submitted ? 'ring-2 ring-indigo-500' : ''}`}
                >
                    {option}
                </button>
            ))}
        </div>
        
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!selectedOption || submitted}
            className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {submitted ? 'İşleniyor...' : 'Cevapla'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionModal; 