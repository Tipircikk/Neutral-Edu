
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
import type { SupportTicket } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ReplyTicketDialogProps {
  ticket: SupportTicket | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketReply?: (ticketId: string, replyText: string) => Promise<void>; // Placeholder for actual reply logic
}

export default function ReplyTicketDialog({ ticket, isOpen, onOpenChange, onTicketReply }: ReplyTicketDialogProps) {
  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setReplyText(""); // Clear reply text when dialog opens
    }
  }, [isOpen]);

  const handleReply = async () => {
    if (!ticket || !replyText.trim()) {
      toast({ title: "Yanıt Metni Gerekli", description: "Lütfen bir yanıt yazın.", variant: "destructive"});
      return;
    }
    if (onTicketReply) { // If actual reply logic is provided
      setIsReplying(true);
      try {
        await onTicketReply(ticket.id, replyText);
        toast({ title: "Yanıt Gönderildi", description: "Destek talebi başarıyla yanıtlandı." });
        onOpenChange(false);
      } catch (error) {
        console.error("Error replying to ticket:", error);
        toast({ title: "Yanıt Hatası", description: "Talep yanıtlanırken bir hata oluştu.", variant: "destructive"});
      } finally {
        setIsReplying(false);
      }
    } else {
      // Placeholder for when no onTicketReply is passed (e.g., UI setup phase)
      toast({ title: "Yanıt Gönderildi (Simülasyon)", description: "Bu özellik henüz tam olarak aktif değil." });
      console.log("Simulated reply for ticket:", ticket.id, "Reply:", replyText);
      onOpenChange(false);
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
          <Button onClick={handleReply} disabled={isReplying || !replyText.trim() || !onTicketReply}>
            {isReplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Yanıtı Gönder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    