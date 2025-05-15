
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
    setMessages([]); // Clear previous messages
    try {
      const messagesCollectionRef = collection(db, "supportTickets", ticketId, "messages");
      const q = query(messagesCollectionRef, orderBy("timestamp", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedMessages = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          ...data,
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp : Timestamp.now(), // Ensure it's a Timestamp
        } as SupportMessage;
      });
      setMessages(fetchedMessages);
    } catch (error) {
      console.error("Error fetching messages for admin:", error);
      toast({ title: "Mesajlar Yüklenemedi", description: "Mesajlar çekilirken bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (isOpen && ticket) {
      fetchMessages(ticket.id);
      // Pre-fill replyText if there was a previous adminReply (this field is now part of the messages subcollection)
      // For now, we'll clear it. A more advanced implementation could find the last admin message.
      setReplyText("");
    } else if (!isOpen) {
      setMessages([]); // Clear messages when dialog closes
      setReplyText("");
    }
  }, [isOpen, ticket]);


  const handleReply = async () => {
    if (!ticket || !replyText.trim()) {
      toast({ title: "Yanıt Metni Gerekli", description: "Lütfen bir yanıt yazın.", variant: "destructive" });
      return;
    }
    if (!adminProfile || !adminProfile.isAdmin) {
      toast({ title: "Yetki Hatası", description: "Yanıt göndermek için admin yetkiniz olmalı.", variant: "destructive" });
      return;
    }

    setIsReplying(true);
    try {
      const nowServerTimestamp = serverTimestamp() as Timestamp;
      const ticketRef = doc(db, "supportTickets", ticket.id);
      const messagesCollectionRef = collection(db, "supportTickets", ticket.id, "messages");

      // Add admin's message to subcollection
      await addDoc(messagesCollectionRef, {
        senderId: adminProfile.uid,
        senderType: "admin",
        senderName: "Destek Ekibi",
        text: replyText.trim(),
        timestamp: nowServerTimestamp,
      });
      
      // Update parent ticket document
      const updatedTicketData: Partial<SupportTicket> = {
        status: "answered",
        updatedAt: nowServerTimestamp,
        lastMessageSnippet: replyText.trim().substring(0, 70) + (replyText.trim().length > 70 ? "..." : ""),
        lastMessageAt: nowServerTimestamp,
        lastRepliedByAdmin: true,
      };
      await updateDoc(ticketRef, updatedTicketData);

      const fullUpdatedTicket: SupportTicket = {
        ...ticket,
        status: "answered",
        updatedAt: Timestamp.now(), // Use client-side for immediate UI update
        lastMessageSnippet: updatedTicketData.lastMessageSnippet,
        lastMessageAt: Timestamp.now(), // Use client-side for immediate UI update
        lastRepliedByAdmin: true,
        id: ticket.id
      };

      onTicketReplySuccess(fullUpdatedTicket);
      toast({ title: "Yanıt Gönderildi", description: "Destek talebi başarıyla yanıtlandı." });
      
      // Optimistically add new message to local state
      setMessages(prevMessages => [
        ...prevMessages,
        {
          id: 'temp-' + Date.now(),
          senderId: adminProfile.uid,
          senderType: "admin",
          senderName: "Destek Ekibi",
          text: replyText.trim(),
          timestamp: Timestamp.now(),
        }
      ]);
      setReplyText("");
      // fetchMessages(ticket.id); // Refresh messages or rely on optimistic update
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
          <DialogTitle>Destek Talebi: {ticket.subject}</DialogTitle>
          <DialogDescription>
            Talep ID: {ticket.id} | Kullanıcı: {ticket.userEmail || ticket.userId}
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
                <div className="text-xs font-semibold mb-1">
                  {msg.senderName} {msg.senderType === 'admin' && <Badge variant="outline" className="ml-1 text-xs">Destek</Badge>}
                </div>
                <p className="text-sm whitespace-pre-line">{msg.text}</p>
                <p className="text-xs text-muted-foreground mt-1">{format(msg.timestamp.toDate(), 'PPpp', {locale: tr})}</p>
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
