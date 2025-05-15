
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SupportTicket, SupportMessage, SupportTicketStatus } from "@/types";
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
  const [currentTicketStatus, setCurrentTicketStatus] = useState<SupportTicketStatus>("open");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { userProfile: adminProfile } = useUser();

  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const fetchMessages = async (ticketId: string) => {
    setIsLoadingMessages(true);
    setMessages([]);
    try {
      const messagesCollectionRef = collection(db, "supportTickets", ticketId, "messages");
      const q = query(messagesCollectionRef, orderBy("timestamp", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedMessages = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          ...data,
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp : Timestamp.now(),
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
      setCurrentTicketStatus(ticket.status);
      setReplyText("");
    } else if (!isOpen) {
      setMessages([]);
      setReplyText("");
    }
  }, [isOpen, ticket]);

  const handleSendMessageToTicket = async () => {
    if (!ticket || !replyText.trim()) {
      toast({ title: "Yanıt Metni Gerekli", description: "Lütfen bir yanıt yazın.", variant: "destructive" });
      return;
    }
    if (!adminProfile || !adminProfile.isAdmin) {
      toast({ title: "Yetki Hatası", description: "Yanıt göndermek için admin yetkiniz olmalı.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const nowServerTimestamp = serverTimestamp() as Timestamp;
      const messagesCollectionRef = collection(db, "supportTickets", ticket.id, "messages");
      
      await addDoc(messagesCollectionRef, {
        senderId: adminProfile.uid,
        senderType: "admin",
        senderName: "Destek Ekibi",
        text: replyText.trim(),
        timestamp: nowServerTimestamp,
      });
      
      const ticketRef = doc(db, "supportTickets", ticket.id);
      const updatedTicketData: Partial<SupportTicket> = {
        status: currentTicketStatus === "open" ? "answered" : currentTicketStatus, // If admin replies to an open ticket, mark as answered
        updatedAt: nowServerTimestamp,
        lastMessageSnippet: replyText.trim().substring(0, 70) + (replyText.trim().length > 70 ? "..." : ""),
        lastMessageAt: nowServerTimestamp,
        lastRepliedByAdmin: true,
      };
      await updateDoc(ticketRef, updatedTicketData);

      const fullUpdatedTicket: SupportTicket = {
        ...ticket,
        ...updatedTicketData,
        id: ticket.id,
        status: updatedTicketData.status || ticket.status, // ensure status is passed
        updatedAt: Timestamp.now(),
        lastMessageAt: Timestamp.now(),
      };

      onTicketReplySuccess(fullUpdatedTicket);
      toast({ title: "Yanıt Gönderildi", description: "Destek talebi başarıyla yanıtlandı." });
      setReplyText("");
      fetchMessages(ticket.id); // Refresh messages
    } catch (error) {
      console.error("Error replying to ticket:", error);
      toast({ title: "Yanıt Hatası", description: "Talep yanıtlanırken bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateStatus = async (newStatus: SupportTicketStatus) => {
    if (!ticket) return;
    setIsProcessing(true);
    try {
      const ticketRef = doc(db, "supportTickets", ticket.id);
      const updatedTicketData: Partial<SupportTicket> = {
        status: newStatus,
        updatedAt: serverTimestamp() as Timestamp,
      };
      await updateDoc(ticketRef, updatedTicketData);
      
      const fullUpdatedTicket: SupportTicket = { ...ticket, ...updatedTicketData, id: ticket.id };
      onTicketReplySuccess(fullUpdatedTicket);
      setCurrentTicketStatus(newStatus);
      toast({ title: "Durum Güncellendi", description: `Talep durumu "${newStatus}" olarak değiştirildi.` });
    } catch (error) {
      console.error("Error updating ticket status:", error);
      toast({ title: "Durum Güncelleme Hatası", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseTicket = () => {
    handleUpdateStatus("closed_by_admin");
  };


  if (!ticket) return null;

  const isTicketClosed = ticket.status === 'closed_by_admin' || ticket.status === 'closed_by_user';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Destek Talebi: {ticket.subject}</DialogTitle>
          <DialogDescription>
            Talep ID: {ticket.id} | Kullanıcı: {ticket.userEmail || ticket.userId} | Plan: {ticket.userPlan || 'Bilinmiyor'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center space-x-4 my-4">
            <Label htmlFor="ticketStatusAdmin" className="text-sm font-medium">Talep Durumu:</Label>
            <Select 
                value={currentTicketStatus} 
                onValueChange={(value: SupportTicketStatus) => {
                    setCurrentTicketStatus(value);
                    if (value !== ticket.status) { // Only update if changed
                        handleUpdateStatus(value);
                    }
                }}
                disabled={isProcessing || isTicketClosed}
            >
                <SelectTrigger id="ticketStatusAdmin" className="w-[180px]">
                    <SelectValue placeholder="Durum Seçin" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="open">Açık</SelectItem>
                    <SelectItem value="answered">Yanıtlandı</SelectItem>
                    <SelectItem value="closed_by_admin">Admin Kapattı</SelectItem>
                    <SelectItem value="closed_by_user">Kullanıcı Kapattı</SelectItem>
                </SelectContent>
            </Select>
        </div>


        <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-muted/30">
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
              disabled={isProcessing || isTicketClosed}
            />
          </div>
        </div>
        <DialogFooter className="justify-between">
            <Button variant="destructive" onClick={handleCloseTicket} disabled={isProcessing || isTicketClosed}>
                Talebi Kapat
            </Button>
            <div className="space-x-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                    Kapat
                </Button>
                <Button onClick={handleSendMessageToTicket} disabled={isProcessing || !replyText.trim() || isTicketClosed}>
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4"/>} Yanıtı Gönder
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
