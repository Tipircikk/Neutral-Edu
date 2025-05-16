
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, ListChecks, PlusCircle, Archive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Goal } from "@/types";

const LOCAL_STORAGE_KEY = "neutraledu_goals";

export default function GoalTrackerPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoalText, setNewGoalText] = useState("");
  const { toast } = useToast();

  // Load goals from localStorage on initial render
  useEffect(() => {
    const storedGoals = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedGoals) {
      try {
        const parsedGoals = JSON.parse(storedGoals) as Goal[];
        // Ensure createdAt is a number for proper sorting if it was stringified
        const validatedGoals = parsedGoals.map(g => ({...g, createdAt: Number(g.createdAt) || Date.now()}));
        setGoals(validatedGoals.sort((a,b) => a.createdAt - b.createdAt));
      } catch (error) {
        console.error("Error parsing goals from localStorage:", error);
        localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear corrupted data
      }
    }
  }, []);

  // Save goals to localStorage whenever they change
  useEffect(() => {
    if (goals.length > 0 || localStorage.getItem(LOCAL_STORAGE_KEY)) { // Only save if there are goals or if there was something to clear
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(goals));
    }
  }, [goals]);

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalText.trim()) {
      toast({ title: "Hedef Boş Olamaz", description: "Lütfen bir hedef metni girin.", variant: "destructive" });
      return;
    }
    const newGoal: Goal = {
      id: crypto.randomUUID(),
      text: newGoalText.trim(),
      completed: false,
      createdAt: Date.now(),
    };
    setGoals(prevGoals => [...prevGoals, newGoal].sort((a,b) => a.createdAt - b.createdAt));
    setNewGoalText("");
    toast({ title: "Hedef Eklendi!", description: `"${newGoal.text}" hedefi eklendi.` });
  };

  const toggleGoalCompletion = (id: string) => {
    setGoals(goals.map(goal =>
      goal.id === id ? { ...goal, completed: !goal.completed } : goal
    ));
  };

  const deleteGoal = (id: string) => {
    const goalToDelete = goals.find(g => g.id === id);
    setGoals(goals.filter(goal => goal.id !== id));
    if (goalToDelete) {
        toast({ title: "Hedef Silindi", description: `"${goalToDelete.text}" hedefi silindi.` });
    }
  };

  const clearCompletedGoals = () => {
    const completedCount = goals.filter(g => g.completed).length;
    if (completedCount === 0) {
        toast({ title: "Tamamlanmış Hedef Yok", description: "Temizlenecek tamamlanmış hedef bulunmuyor.", variant: "default"});
        return;
    }
    setGoals(goals.filter(goal => !goal.completed));
    toast({ title: "Tamamlanmış Hedefler Temizlendi", description: `${completedCount} adet tamamlanmış hedef silindi.` });
  };

  const uncompletedGoals = goals.filter(goal => !goal.completed);
  const completedGoals = goals.filter(goal => goal.completed);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <ListChecks className="h-8 w-8 text-primary" />
            <CardTitle className="text-4xl">Hedef Takipçisi</CardTitle>
          </div>
          <CardDescription>
            Günlük veya haftalık çalışma hedeflerinizi belirleyin ve ilerlemenizi takip edin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddGoal} className="flex gap-2 mb-6">
            <Input
              type="text"
              placeholder="Yeni bir hedef ekle..."
              value={newGoalText}
              onChange={(e) => setNewGoalText(e.target.value)}
              className="flex-grow"
            />
            <Button type="submit">
              <PlusCircle className="mr-2 h-4 w-4" /> Ekle
            </Button>
          </form>

          {goals.length === 0 && (
            <p className="text-muted-foreground text-center py-4">Henüz bir hedef belirlemediniz.</p>
          )}

          {uncompletedGoals.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">Yapılacak Hedefler</h3>
              {uncompletedGoals.map(goal => (
                <Card key={goal.id} className="flex items-center justify-between p-3 bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`goal-${goal.id}`}
                      checked={goal.completed}
                      onCheckedChange={() => toggleGoalCompletion(goal.id)}
                      aria-label={`Hedefi tamamla: ${goal.text}`}
                    />
                    <Label htmlFor={`goal-${goal.id}`} className={`text-sm ${goal.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {goal.text}
                    </Label>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteGoal(goal.id)} aria-label="Hedefi sil">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </Card>
              ))}
            </div>
          )}

          {completedGoals.length > 0 && (
            <div className="mt-8 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-foreground">Tamamlanmış Hedefler</h3>
                <Button variant="outline" size="sm" onClick={clearCompletedGoals}>
                  <Archive className="mr-2 h-4 w-4"/> Tamamlananları Temizle
                </Button>
              </div>
              {completedGoals.map(goal => (
                 <Card key={goal.id} className="flex items-center justify-between p-3 bg-muted/30 border-dashed">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`goal-${goal.id}`}
                      checked={goal.completed}
                      onCheckedChange={() => toggleGoalCompletion(goal.id)}
                       aria-label={`Hedefi tamamlanmamış yap: ${goal.text}`}
                    />
                    <Label htmlFor={`goal-${goal.id}`} className={`text-sm ${goal.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {goal.text}
                    </Label>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteGoal(goal.id)} aria-label="Hedefi sil">
                    <Trash2 className="h-4 w-4 text-destructive/70 hover:text-destructive" />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
