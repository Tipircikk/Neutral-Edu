
"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CalendarClock, AlertTriangle } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import type { ExamDatesConfig } from "@/types";
import { differenceInMilliseconds, intervalToDuration } from 'date-fns';
// import { tr } from 'date-fns/locale'; // Not directly used by intervalToDuration for numbers

const CountdownDisplay = ({ targetDate, title }: { targetDate: Date | null, title: string }) => {
  const [timeLeft, setTimeLeft] = useState<Duration | null>(null);
  const [isPast, setIsPast] = useState(false);

  const calculateTimeLeft = useCallback(() => {
    if (!targetDate) {
      setTimeLeft(null);
      setIsPast(false);
      return;
    }

    const now = new Date();
    if (targetDate.getTime() < now.getTime()) {
      setTimeLeft(null);
      setIsPast(true);
      return;
    }
    setIsPast(false);
    const diff = differenceInMilliseconds(targetDate, now);
    setTimeLeft(intervalToDuration({ start: 0, end: diff }));
  }, [targetDate]);

  useEffect(() => {
    if (!targetDate) {
      setTimeLeft(null);
      setIsPast(false);
      const timer = setInterval(calculateTimeLeft, 1000); 
      return () => clearInterval(timer);
    }
    
    if (isPast) {
        setTimeLeft(null); 
        return;
    }
    
    calculateTimeLeft(); 
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetDate, calculateTimeLeft, isPast]);

  if (!targetDate) {
    return (
      <p className="text-lg text-muted-foreground">Sınav tarihi henüz belirlenmedi.</p>
    );
  }

  if (isPast) {
    return (
      <p className="text-lg text-destructive">Bu sınavın tarihi geçti.</p>
    );
  }

  if (!timeLeft) {
    return (
        <div className="flex items-center justify-center">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Hesaplanıyor...
        </div>
    );
  }
  
  return (
    <div className="text-center space-y-1">
       <div className="flex justify-center items-baseline space-x-2">
        <p className="text-4xl md:text-6xl font-bold tracking-tighter text-primary">
          {timeLeft.days || 0}
        </p>
        <p className="text-xl md:text-3xl font-medium text-muted-foreground self-end pb-1 md:pb-2">
          gün
        </p>
      </div>
      <p className="text-2xl md:text-4xl font-semibold text-foreground">
        {String(timeLeft.hours || 0).padStart(2, '0')}:
        {String(timeLeft.minutes || 0).padStart(2, '0')}:
        {String(timeLeft.seconds || 0).padStart(2, '0')}
      </p>
      <p className="text-xs text-muted-foreground">
        (Saat:Dakika:Saniye)
      </p>
    </div>
  );
};

export default function YKSCountdownPage() {
  const [examDates, setExamDates] = useState<ExamDatesConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDates = async () => {
      setLoading(true);
      try {
        const examDatesDocRef = doc(db, "appConfig", "examDates");
        const docSnap = await getDoc(examDatesDocRef);
        if (docSnap.exists()) {
          // For debugging, you could log the fetched data:
          // console.log("Fetched exam dates from Firestore:", docSnap.data());
          setExamDates(docSnap.data() as ExamDatesConfig);
        } else {
          console.log("No exam dates document found in Firestore.");
          setExamDates({}); 
        }
      } catch (error) {
        console.error("Error fetching exam dates:", error);
        setExamDates({}); 
      } finally {
        setLoading(false);
      }
    };
    fetchDates();
  }, []);

  const parseDateString = (dateString?: string): Date | null => {
    if (!dateString) return null;
    const trimmedDateString = dateString.trim(); // Trim whitespace
    const [year, month, day] = trimmedDateString.split('-').map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
        console.error("Invalid date string format received:", trimmedDateString);
        return null;
    }
    // JavaScript months are 0-indexed (0 for January, 11 for December)
    return new Date(year, month - 1, day, 0, 0, 0, 0); 
  };

  const tytTargetDate = examDates?.tytDate ? parseDateString(examDates.tytDate) : null;
  const aytTargetDate = examDates?.aytDate ? parseDateString(examDates.aytDate) : null;

  // For debugging, you can log the parsed dates:
  // useEffect(() => {
  //   if (!loading) {
  //     console.log("Parsed TYT Target Date:", tytTargetDate);
  //     console.log("Parsed AYT Target Date:", aytTargetDate);
  //   }
  // }, [loading, tytTargetDate, aytTargetDate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Sınav tarihleri yükleniyor...</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CalendarClock className="h-8 w-8 text-primary" />
            <CardTitle className="text-4xl">YKS Geri Sayım</CardTitle>
          </div>
          <CardDescription>
            Bir sonraki YKS (TYT ve AYT) sınavlarına kalan süreyi takip edin.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-8 pt-6">
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-2xl text-center text-primary/90">TYT Sınavına Kalan Süre</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <CountdownDisplay targetDate={tytTargetDate} title="TYT" />
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-2xl text-center text-primary/90">AYT Sınavına Kalan Süre</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <CountdownDisplay targetDate={aytTargetDate} title="AYT" />
            </CardContent>
          </Card>
        </CardContent>
      </Card>
      {(!examDates?.tytDate && !examDates?.aytDate) && !loading && (
        <Card>
            <CardContent className="p-6 flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <div>
                    <CardTitle className="text-destructive">Sınav Tarihleri Belirlenmemiş</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        YKS (TYT ve AYT) sınav tarihleri henüz admin panelinden ayarlanmamış. Lütfen bir admin ile iletişime geçin veya daha sonra tekrar kontrol edin. 
                        {/* You can add a line here for debugging: */}
                        {/* Admin panelinde kaydedilen TYT: {examDates?.tytDate || 'Yok'}, AYT: {examDates?.aytDate || 'Yok'} */}
                    </CardDescription>
                </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
