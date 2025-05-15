
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input"; // Added Input for date
import { Switch } from "@/components/ui/switch";
import type { UserProfile } from "@/types";
import { updateUserProfile, getDefaultQuota } from "@/lib/firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Timestamp } from "firebase/firestore"; // Added Timestamp import
import { format, parseISO } from 'date-fns'; // For date input handling

interface EditUserDialogProps {
  user: UserProfile | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdate: (updatedUser: UserProfile) => void;
}

export default function EditUserDialog({ user, isOpen, onOpenChange, onUserUpdate }: EditUserDialogProps) {
  const [plan, setPlan] = useState<UserProfile["plan"]>("free");
  const [isAdmin, setIsAdmin] = useState(false);
  const [planExpiryDate, setPlanExpiryDate] = useState<string>(""); // Store as string for input field
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setPlan(user.plan);
      setIsAdmin(user.isAdmin || false);
      if (user.planExpiryDate && user.planExpiryDate instanceof Timestamp) {
        setPlanExpiryDate(format(user.planExpiryDate.toDate(), 'yyyy-MM-dd'));
      } else {
        setPlanExpiryDate("");
      }
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    const newDailyQuota = user.plan !== plan ? getDefaultQuota(plan) : user.dailyRemainingQuota;

    let expiryTimestamp: Timestamp | null = null;
    if ((plan === "premium" || plan === "pro") && planExpiryDate) {
      try {
        expiryTimestamp = Timestamp.fromDate(parseISO(planExpiryDate));
      } catch (e) {
        toast({ title: "Geçersiz Tarih", description: "Lütfen geçerli bir bitiş tarihi girin.", variant: "destructive" });
        setIsSaving(false);
        return;
      }
    } else if (plan === "free") {
        expiryTimestamp = null; // Free plan has no expiry
    }


    const updatedFields: Partial<UserProfile> = {
      plan,
      isAdmin,
      dailyRemainingQuota: newDailyQuota,
      planExpiryDate: expiryTimestamp,
    };

    try {
      await updateUserProfile(user.uid, updatedFields);
      // Ensure planExpiryDate is correctly passed to onUserUpdate
      const fullUpdatedUser: UserProfile = {
        ...user,
        ...updatedFields,
        planExpiryDate: expiryTimestamp, // Ensure this is the Timestamp or null
        uid: user.uid
      };
      onUserUpdate(fullUpdatedUser);
      toast({
        title: "Kullanıcı Güncellendi",
        description: `${user.email} için bilgiler başarıyla güncellendi.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: "Güncelleme Hatası",
        description: "Kullanıcı bilgileri güncellenirken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Kullanıcıyı Düzenle</DialogTitle>
          <DialogDescription>
            {user.email} kullanıcısının planını, admin yetkisini ve abonelik süresini düzenleyin.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="plan" className="text-right">
              Plan
            </Label>
            <Select value={plan} onValueChange={(value: UserProfile["plan"]) => setPlan(value)}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Plan seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Ücretsiz</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(plan === "premium" || plan === "pro") && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="planExpiryDate" className="text-right">
                Plan Bitiş Tarihi
              </Label>
              <Input
                id="planExpiryDate"
                type="date"
                value={planExpiryDate}
                onChange={(e) => setPlanExpiryDate(e.target.value)}
                className="col-span-3"
              />
            </div>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="isAdmin" className="text-right">
              Admin Yetkisi
            </Label>
            <Switch
              id="isAdmin"
              checked={isAdmin}
              onCheckedChange={setIsAdmin}
              className="col-span-3 justify-self-start"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            İptal
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
