
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
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { SupportTicket, SupportMessage } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { doc, updateDoc, serverTimestamp, Timestamp, collection, query, orderBy, getDocs, addDoc } from "firebase/firestore";
import { useUser } from "@/hooks/useUser";
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

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
  const { userProfile: adminProfile } = useUser();

  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const fetchMessages = async (ticketId: string) => {
    setIsLoadingMessages(true);
    try {
      const messagesCollection = collection(db, "supportTickets", ticketId, "messages");
      const q = query(messagesCollection, orderBy("timestamp", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedMessages = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportMessage));
      setMessages(fetchedMessages);
    } catch (error) {
      console.error("Error fetching messages for admin:", error);
      toast({ title: "Mesajlar Yüklenemedi", variant: "destructive" });
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (isOpen && ticket) {
      fetchMessages(ticket.id);
      setReplyText(""); // Clear reply text each time dialog opens
    } else if (!isOpen) {
      setMessages([]); // Clear messages when dialog closes
    }
  }, [isOpen, ticket, toast]);


  const handleReply = async () => {
    if (!ticket || !replyText.trim()) {
      toast({ title: "Yanıt Metni Gerekli", description: "Lütfen bir yanıt yazın.", variant: "destructive" });
      return;
    }
    if (!adminProfile || !adminProfile.isAdmin) { // Ensure admin is an admin
      toast({ title: "Yetki Hatası", description: "Yanıt göndermek için admin yetkiniz olmalı.", variant: "destructive" });
      return;
    }

    setIsReplying(true);
    try {
      const now = serverTimestamp() as Timestamp;
      const ticketRef = doc(db, "supportTickets", ticket.id);
      const messagesCollectionRef = collection(db, "supportTickets", ticket.id, "messages");

      // Add admin's message to subcollection
      await addDoc(messagesCollectionRef, {
        senderId: adminProfile.uid,
        senderType: "admin",
        senderName: "Destek Ekibi", // Or adminProfile.displayName if preferred
        text: replyText.trim(),
        timestamp: now,
      });
      
      // Update parent ticket document
      const updatedTicketData: Partial<SupportTicket> = {
        status: "answered",
        updatedAt: now,
        lastMessageSnippet: replyText.trim().substring(0, 50) + (replyText.trim().length > 50 ? "..." : ""),
        lastMessageAt: now,
        lastRepliedByAdmin: true,
      };
      await updateDoc(ticketRef, updatedTicketData);

      toast({ title: "Yanıt Gönderildi", description: "Destek talebi başarıyla yanıtlandı." });
      onTicketReplySuccess({ ...ticket, ...updatedTicketData, id: ticket.id });
      fetchMessages(ticket.id); // Refresh messages in the dialog
      setReplyText(""); // Clear the textarea
      // onOpenChange(false); // Keep dialog open to see the new message, or close based on preference
    } catch (error) {
      console.error("Error replying to ticket:", error);
      toast({ title: "Yanıt Hatası", description: "Talep yanıtlanırken bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsReplying(false);
    }
  };

  if (!ticket) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Destek Talebini Yanıtla/Görüntüle</DialogTitle>
          <DialogDescription>
            Talep ID: {ticket.id} | Kullanıcı: {ticket.userEmail || ticket.userId} | Konu: {ticket.subject}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[300px] w-full rounded-md border p-4 my-4 bg-muted/30">
          {isLoadingMessages ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : messages.length > 0 ? (
            messages.map(msg => (
              <div key={msg.id} className={`mb-3 p-3 rounded-lg max-w-[80%] ${msg.senderType === 'admin' ? 'bg-primary/10 ml-auto text-right' : 'bg-secondary/50 mr-auto text-left'}`}>
                <p className="text-xs font-semibold mb-1">
                  {msg.senderName} {msg.senderType === 'admin' && <Badge variant="outline" className="ml-1 text-xs">Destek</Badge>}
                </p>
                <p className="text-sm whitespace-pre-line">{msg.text}</p>
                <p className="text-xs text-muted-foreground mt-1">{format(msg.timestamp.toDate(), 'Pp', {locale: tr})}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center">Bu talep için henüz mesaj yok.</p>
          )}
        </ScrollArea>
        <div className="py-4 space-y-2">
          <div>
            <Label htmlFor="replyText" className="font-semibold">Yanıtınız:</Label>
            <Textarea
              id="replyText"
              placeholder="Yanıtınızı buraya yazın..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={5}
              className="mt-1"
              disabled={isReplying || ticket.status === 'closed_by_admin' || ticket.status === 'closed_by_user'}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isReplying}>
            Kapat
          </Button>
          <Button onClick={handleReply} disabled={isReplying || !replyText.trim() || ticket.status === 'closed_by_admin' || ticket.status === 'closed_by_user'}>
            {isReplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4"/>} Yanıtı Gönder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
