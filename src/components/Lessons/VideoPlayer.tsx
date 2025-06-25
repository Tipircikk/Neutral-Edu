import React, { useState, useRef, useEffect } from 'react';
import YouTube from 'react-youtube';
import QuestionModal from './QuestionModal';
import { toast } from 'react-hot-toast';

interface InteractiveQuestion {
  id: string;
  timestamp: number;
  question: string;
  options: string[];
  correctAnswer: string;
}

interface VideoPlayerProps {
  youtubeLink: string;
  questions?: InteractiveQuestion[];
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ youtubeLink, questions = [] }) => {
  const [player, setPlayer] = useState<any>(null);
  const [activeQuestion, setActiveQuestion] = useState<InteractiveQuestion | null>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState<string[]>([]);
  const intervalRef = useRef<NodeJS.Timeout>();

  const videoId = new URL(youtubeLink).searchParams.get('v');

  useEffect(() => {
    if (player) {
      intervalRef.current = setInterval(() => {
        const currentTime = Math.floor(player.getCurrentTime());
        
        const questionToShow = questions.find(q => 
          q.timestamp === currentTime && !answeredQuestions.includes(q.id)
        );

        if (questionToShow) {
          player.pauseVideo();
          setActiveQuestion(questionToShow);
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [player, questions, answeredQuestions]);

  const handleAnswer = (isCorrect: boolean) => {
    if (!activeQuestion) return;

    if (isCorrect) {
      toast.success('Doğru cevap!');
      setAnsweredQuestions(prev => [...prev, activeQuestion.id]);
      setActiveQuestion(null);
      player.playVideo();
    } else {
      toast.error('Yanlış cevap! Video başa sarılıyor.');
      setAnsweredQuestions([]); // Reset all answers on failure
      setActiveQuestion(null);
      player.seekTo(0);
      player.playVideo();
    }
  };

  const onReady = (event: { target: any }) => {
    setPlayer(event.target);
  };

  if (!videoId) {
    return <p className="text-red-500">Geçersiz YouTube linki.</p>;
  }

  const opts = {
    height: '100%',
    width: '100%',
    playerVars: {
      // https://developers.google.com/youtube/player_parameters
      autoplay: 0,
      modestbranding: 1,
      rel: 0,
    },
  };

  return (
    <div className="relative aspect-video w-full">
      <YouTube videoId={videoId} opts={opts} onReady={onReady} className="absolute top-0 left-0 w-full h-full"/>
      {activeQuestion && (
        <QuestionModal 
          question={activeQuestion}
          onAnswer={handleAnswer}
          onClose={() => setActiveQuestion(null)}
        />
      )}
    </div>
  );
};

export default VideoPlayer; 