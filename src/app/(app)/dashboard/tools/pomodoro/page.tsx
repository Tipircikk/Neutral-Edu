
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer, Play, Pause, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const POMODORO_DURATION = 25 * 60; // 25 minutes
const SHORT_BREAK_DURATION = 5 * 60; // 5 minutes
const LONG_BREAK_DURATION = 15 * 60; // 15 minutes
const POMODOROS_UNTIL_LONG_BREAK = 4;

type PomodoroMode = "pomodoro" | "shortBreak" | "longBreak";

export default function PomodoroPage() {
  const [mode, setMode] = useState<PomodoroMode>("pomodoro");
  const [timeRemaining, setTimeRemaining] = useState(POMODORO_DURATION);
  const [isActive, setIsActive] = useState(false);
  const [pomodorosCompleted, setPomodorosCompleted] = useState(0);
  const { toast } = useToast();

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleModeChange = useCallback((newMode: PomodoroMode) => {
    setIsActive(false);
    setMode(newMode);
    switch (newMode) {
      case "pomodoro":
        setTimeRemaining(POMODORO_DURATION);
        break;
      case "shortBreak":
        setTimeRemaining(SHORT_BREAK_DURATION);
        break;
      case "longBreak":
        setTimeRemaining(LONG_BREAK_DURATION);
        break;
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeRemaining === 0) {
      setIsActive(false);
      // Optional: Add sound notification here
      // new Audio('/path/to/notification-sound.mp3').play();
      
      toast({
        title: mode === "pomodoro" ? "Çalışma Süresi Bitti!" : "Mola Bitti!",
        description: mode === "pomodoro" ? "Şimdi mola zamanı." : "Şimdi çalışma zamanı.",
      });

      if (mode === "pomodoro") {
        const newPomodorosCompleted = pomodorosCompleted + 1;
        setPomodorosCompleted(newPomodorosCompleted);
        if (newPomodorosCompleted % POMODOROS_UNTIL_LONG_BREAK === 0) {
          handleModeChange("longBreak");
        } else {
          handleModeChange("shortBreak");
        }
      } else {
        handleModeChange("pomodoro");
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeRemaining, mode, pomodorosCompleted, handleModeChange, toast]);

  const toggleTimer = () => {
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    handleModeChange(mode); // Resets to the current mode's default time
    setIsActive(false);
  };

  const getModeText = () => {
    switch (mode) {
      case "pomodoro": return "Çalışma Zamanı";
      case "shortBreak": return "Kısa Mola";
      case "longBreak": return "Uzun Mola";
      default: return "";
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Timer className="h-7 w-7 text-primary" />
            <CardTitle className="text-3xl">Pomodoro Zamanlayıcı</CardTitle>
          </div>
          <CardDescription>
            Çalışma ve mola sürelerinizi Pomodoro Tekniği ile yönetin.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-8">
          <div className="text-center">
            <p className="text-lg font-medium text-muted-foreground">{getModeText()}</p>
            <p className="text-8xl font-bold text-primary tracking-tighter">
              {formatTime(timeRemaining)}
            </p>
          </div>

          <div className="flex w-full justify-center space-x-3">
            <Button
              onClick={toggleTimer}
              size="lg"
              className="w-32"
              variant={isActive ? "destructive" : "default"}
            >
              {isActive ? <Pause className="mr-2" /> : <Play className="mr-2" />}
              {isActive ? "Duraklat" : "Başlat"}
            </Button>
            <Button onClick={resetTimer} variant="outline" size="lg" className="w-32">
              <RotateCcw className="mr-2" />
              Sıfırla
            </Button>
          </div>

          <div className="flex w-full justify-around border-t pt-6 space-x-2 sm:space-x-3">
            <Button
              variant={mode === "pomodoro" ? "default" : "outline"}
              onClick={() => handleModeChange("pomodoro")}
              className="flex-1 text-xs sm:text-sm px-2 sm:px-3 whitespace-normal h-auto py-2 leading-tight"
            >
              Pomodoro (25dk)
            </Button>
            <Button
              variant={mode === "shortBreak" ? "default" : "outline"}
              onClick={() => handleModeChange("shortBreak")}
              className="flex-1 text-xs sm:text-sm px-2 sm:px-3 whitespace-normal h-auto py-2 leading-tight"
            >
              Kısa Mola (5dk)
            </Button>
            <Button
              variant={mode === "longBreak" ? "default" : "outline"}
              onClick={() => handleModeChange("longBreak")}
              className="flex-1 text-xs sm:text-sm px-2 sm:px-3 whitespace-normal h-auto py-2 leading-tight"
            >
              Uzun Mola (15dk)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
