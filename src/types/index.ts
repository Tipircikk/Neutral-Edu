export interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin' | 'user';
  xp: number;
  streak: number;
  level: number;
  progress: Record<string, number>;
  lastLogin: Date;
  createdAt: Date;
}

export interface Lesson {
  id: string;
  title: string;
  subject: string;
  grade: number;
  content: string;
  createdBy: string;
  createdAt: Date;
}

export interface Quiz {
  id: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questions: Question[];
  createdAt: Date;
}

export interface Question {
  id: string;
  text: string;
  type: 'multiple-choice' | 'matching' | 'open-ended';
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  tags: string[];
  difficulty: number;
  nextReview: Date;
  userId: string;
}

export interface SolvedQuestion {
  id: string;
  imageUrl: string;
  solvedText: string;
  solutionSteps: string[];
  subject: string;
  difficulty: string;
  solvedBy: 'ai';
  userId: string;
  createdAt: Date;
}

export interface PDFSummary {
  id: string;
  title: string;
  originalPdfUrl: string;
  summaryText: string;
  userId: string;
  createdAt: Date;
}

export interface StudyPlan {
  id: string;
  userId: string;
  examDate: Date;
  tasks: StudyTask[];
  subjects: string[];
  weeklyHours: number;
}

export interface StudyTask {
  id: string;
  title: string;
  subject: string;
  type: 'lesson' | 'quiz' | 'flashcards' | 'practice';
  completed: boolean;
  date: Date;
  estimatedMinutes: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  condition: string;
}

export interface AICoach {
  id: string;
  userId: string;
  name: string;
  style: string;
  description: string;
  dailyRoutine: string[];
  subjectFocus: string[];
  tone: string;
  examTargetDate: string;
  communicationPreferences: {
    morningCheckIn: boolean;
    taskLists: boolean;
    reflectionPrompts: boolean;
    motivationalQuotes: boolean;
  };
  personality: {
    strictness: number; // 1-10
    humor: number; // 1-10
    supportiveness: number; // 1-10
    detailLevel: number; // 1-10
  };
  createdAt: Date;
  isActive: boolean;
}

export interface CoachMessage {
  id: string;
  coachId: string;
  userId: string;
  type: 'morning-checkin' | 'task-reminder' | 'motivation' | 'reflection' | 'achievement';
  content: string;
  timestamp: Date;
  isRead: boolean;
}

export interface CoachCreationForm {
  style: 'friendly' | 'strict' | 'humorous' | 'calm' | 'energetic' | 'professional';
  subjectFocus: string[];
  tone: 'encouraging' | 'motivational' | 'no-nonsense' | 'detailed' | 'casual' | 'formal';
  dailyInteraction: string[];
  name?: string;
  examTargetDate: string;
  examType: 'TYT' | 'AYT' | 'YDT' | 'LGS';
  studyHoursPerDay: number;
  weakSubjects: string[];
  preferredStudyTime: 'morning' | 'afternoon' | 'evening' | 'night';
}