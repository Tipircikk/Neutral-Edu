
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
import { Textarea } from "@/components/ui/textarea";
import type { SupportTicket, UserProfile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { useUser } from "@/hooks/useUser"; // Import useUser

interface ReplyTicketDialogProps {
  ticket: SupportTicket | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketReplySuccess: (updatedTicket: SupportTicket) => void; 
}

export default function ReplyTicketDialog({ ticket, isOpen, onOpenChange, onTicketReplySuccess }: ReplyTicketDialogProps) {
  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const { toast } = useToast();
  const { userProfile: adminProfile } = useUser(); // Get current admin's profile

  useEffect(() => {
    if (isOpen && ticket) {
      setReplyText(ticket.adminReply || ""); // Pre-fill with existing reply if any
    } else if (!isOpen) {
      setReplyText(""); // Clear when dialog closes
    }
  }, [isOpen, ticket]);

  const handleReply = async () => {
    if (!ticket || !replyText.trim()) {
      toast({ title: "Yanıt Metni Gerekli", description: "Lütfen bir yanıt yazın.", variant: "destructive"});
      return;
    }
    if (!adminProfile) {
      toast({ title: "Admin Bilgisi Bulunamadı", description: "Yanıt göndermek için admin olarak giriş yapmalısınız.", variant: "destructive"});
      return;
    }

    setIsReplying(true);
    try {
      const ticketRef = doc(db, "supportTickets", ticket.id);
      const now = Timestamp.now();
      const updatedTicketData: Partial<SupportTicket> = {
        adminReply: replyText,
        status: "answered",
        repliedBy: adminProfile.uid,
        lastReplyAt: now,
        updatedAt: now,
      };
      await updateDoc(ticketRef, updatedTicketData);
      
      toast({ title: "Yanıt Gönderildi", description: "Destek talebi başarıyla yanıtlandı." });
      
      // Pass the fully updated ticket object back to the parent
      onTicketReplySuccess({ ...ticket, ...updatedTicketData, id: ticket.id }); 
      onOpenChange(false);
    } catch (error) {
      console.error("Error replying to ticket:", error);
      toast({ title: "Yanıt Hatası", description: "Talep yanıtlanırken bir hata oluştu.", variant: "destructive"});
    } finally {
      setIsReplying(false);
    }
  };

  if (!ticket) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Destek Talebini Yanıtla</DialogTitle>
          <DialogDescription>
            Talep ID: {ticket.id} <br />
            Kullanıcı: {ticket.userEmail || ticket.userId} <br />
            Konu: {ticket.subject}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="ticketMessage" className="font-semibold">Kullanıcının Mesajı:</Label>
            <Textarea
              id="ticketMessage"
              value={ticket.message}
              readOnly
              rows={5}
              className="mt-1 bg-muted"
            />
          </div>
          <div>
            <Label htmlFor="replyText" className="font-semibold">Yanıtınız:</Label>
            <Textarea
              id="replyText"
              placeholder="Yanıtınızı buraya yazın..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={7}
              className="mt-1"
              disabled={isReplying}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isReplying}>
            İptal
          </Button>
          <Button onClick={handleReply} disabled={isReplying || !replyText.trim()}>
            {isReplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Yanıtı Gönder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
