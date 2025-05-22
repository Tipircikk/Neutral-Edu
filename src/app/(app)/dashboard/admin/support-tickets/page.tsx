
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, MessageSquare, Send, Inbox, User, Settings2, Trash2 } from "lucide-react";
import type { SupportTicket, SupportTicketStatus, SupportMessage, UserProfile } from "@/types";
import { db } from "@/lib/firebase/config";
import { collection, query, orderBy, Timestamp as FirestoreTimestamp, doc, updateDoc, serverTimestamp, getDocs, addDoc, getDoc, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function AdminSupportTicketsPage() {
  const { userProfile: adminUserProfile, loading: adminLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [allTickets, setAllTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (!adminLoading && !adminUserProfile?.isAdmin) {
      router.replace("/dashboard");
    }
  }, [adminUserProfile, adminLoading, router]);

  const fetchAllTickets = useCallback(async () => {
    if (!adminUserProfile?.isAdmin) return;
    setIsLoadingTickets(true);
    try {
      const ticketsCollectionRef = collection(db, "supportTickets");
      const ticketsQuery = query(ticketsCollectionRef, orderBy("lastMessageAt", "desc"));
      const querySnapshot = await getDocs(ticketsQuery);

      const ticketsListPromises = querySnapshot.docs.map(async (docSnapshot) => {
        const data = docSnapshot.data();
        let userPlan: UserProfile["plan"] | undefined = data.userPlan;
        if (!userPlan && data.userId) {
          try {
            const userDoc = await getDoc(doc(db, "users", data.userId));
            if (userDoc.exists()) userPlan = (userDoc.data() as UserProfile).plan;
          } catch (e) { console.warn(`Could not fetch user plan for ticket ${docSnapshot.id}:`, e); }
        }
        return {
          id: docSnapshot.id,
          ...data,
          userPlan,
          createdAt: data.createdAt instanceof FirestoreTimestamp ? data.createdAt : FirestoreTimestamp.now(),
          updatedAt: data.updatedAt instanceof FirestoreTimestamp ? data.updatedAt : undefined,
          lastMessageAt: data.lastMessageAt instanceof FirestoreTimestamp ? data.lastMessageAt : (data.createdAt instanceof FirestoreTimestamp ? data.createdAt : FirestoreTimestamp.now()),
        } as SupportTicket;
      });

      let ticketsList = await Promise.all(ticketsListPromises);
      const planOrder: Record<UserProfile["plan"], number> = { pro: 0, premium: 1, free: 2 };
      const statusOrder: Record<SupportTicketStatus, number> = { open: 0, answered: 1, closed_by_user: 2, closed_by_admin: 3 };

      ticketsList.sort((a, b) => {
        const statusAOrder = statusOrder[a.status];
        const statusBOrder = statusOrder[b.status];
        if (statusAOrder !== statusBOrder) return statusAOrder - statusBOrder;
        
        const planAOrder = a.userPlan ? planOrder[a.userPlan] : planOrder.free;
        const planBOrder = b.userPlan ? planOrder[b.userPlan] : planOrder.free;
        if (planAOrder !== planBOrder) return planAOrder - planBOrder;
        
        const timeA = a.lastMessageAt?.toMillis() || 0;
        const timeB = b.lastMessageAt?.toMillis() || 0;
        return timeB - timeA;
      });
      
      setAllTickets(ticketsList);
    } catch (error: any) {
      toast({ title: "Hata", description: error.message || "Destek talepleri çekilirken bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsLoadingTickets(false);
    }
  }, [adminUserProfile, toast]);

  useEffect(() => {
    fetchAllTickets();
  }, [fetchAllTickets]);

  const fetchMessagesForTicket = useCallback(async (ticketId: string) => {
    setIsLoadingMessages(true);
    setMessages([]);
    try {
      const messagesCollectionRef = collection(db, "supportTickets", ticketId, "messages");
      const q = query(messagesCollectionRef, orderBy("timestamp", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedMessages = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        timestamp: (docSnap.data().timestamp as FirestoreTimestamp) || FirestoreTimestamp.now(),
      } as SupportMessage));
      setMessages(fetchedMessages);
    } catch (error: any) {
      toast({ title: "Mesajlar Yüklenemedi", description: error.message, variant: "destructive" });
    } finally {
      setIsLoadingMessages(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedTicket) {
      fetchMessagesForTicket(selectedTicket.id);
    } else {
      setMessages([]);
    }
  }, [selectedTicket, fetchMessagesForTicket]);

  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim() || !adminUserProfile) return;
    setIsSendingReply(true);
    try {
      const nowServerTimestamp = serverTimestamp() as FirestoreTimestamp;
      const messagesCollectionRef = collection(db, "supportTickets", selectedTicket.id, "messages");
      await addDoc(messagesCollectionRef, {
        senderId: adminUserProfile.uid,
        senderType: "admin",
        senderName: "Destek Ekibi",
        text: replyText.trim(),
        timestamp: nowServerTimestamp,
      });

      const ticketRef = doc(db, "supportTickets", selectedTicket.id);
      const newStatus = selectedTicket.status === "open" ? "answered" : selectedTicket.status;
      await updateDoc(ticketRef, {
        status: newStatus,
        updatedAt: nowServerTimestamp,
        lastMessageSnippet: replyText.trim().substring(0, 70) + (replyText.trim().length > 70 ? "..." : ""),
        lastMessageAt: nowServerTimestamp,
        lastRepliedByAdmin: true,
      });
      
      setReplyText("");
      fetchMessagesForTicket(selectedTicket.id); // Refresh messages
      fetchAllTickets(); // Refresh ticket list for status updates
      toast({ title: "Yanıt Gönderildi" });
    } catch (error: any) {
      toast({ title: "Yanıt Gönderme Hatası", description: error.message, variant: "destructive" });
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, newStatus: SupportTicketStatus) => {
    setIsUpdatingStatus(true);
    try {
      const ticketRef = doc(db, "supportTickets", ticketId);
      await updateDoc(ticketRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
        lastRepliedByAdmin: newStatus === 'closed_by_admin' || newStatus === 'answered' ? true : selectedTicket?.lastRepliedByAdmin
      });
      toast({ title: "Durum Güncellendi", description: `Talep durumu "${formatTicketStatus(newStatus)}" olarak değiştirildi.` });
      fetchAllTickets(); // Refresh list
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (error: any)
       {
      toast({ title: "Durum Güncelleme Hatası", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    // Consider adding a confirmation dialog here
    try {
      // First delete all messages in the subcollection (optional, or rely on Firebase Extension for this)
      // For simplicity, direct delete for now. If subcollections are large, this could be an issue.
      // const messagesRef = collection(db, "supportTickets", ticketId, "messages");
      // const messagesSnap = await getDocs(messagesRef);
      // const batch = writeBatch(db);
      // messagesSnap.forEach(doc => batch.delete(doc.ref));
      // await batch.commit();

      await deleteDoc(doc(db, "supportTickets", ticketId));
      toast({ title: "Talep Silindi", description: `Talep ID: ${ticketId} başarıyla silindi.` });
      setAllTickets(prev => prev.filter(t => t.id !== ticketId));
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(null);
      }
    } catch (error: any) {
      toast({ title: "Silme Hatası", description: error.message, variant: "destructive" });
    }
  };

  const formatTicketSubject = (subject: SupportTicket['subject']): string => {
    switch (subject) {
      case "premium": return "Premium Üyelik";
      case "ai_tools": return "Yapay Zeka Araçları";
      case "account": return "Hesap Sorunları";
      case "bug_report": return "Hata Bildirimi";
      case "other": return "Diğer";
      default: return subject;
    }
  };

  const formatTicketStatus = (status: SupportTicketStatus): string => {
    switch (status) {
      case "open": return "Açık";
      case "answered": return "Yanıtlandı";
      case "closed_by_user": return "Kullanıcı Kapattı";
      case "closed_by_admin": return "Admin Kapattı";
      default: return status;
    }
  };
  
  const getStatusBadgeVariant = (status: SupportTicketStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "open": return "destructive";
      case "answered": return "secondary";
      case "closed_by_user": case "closed_by_admin": return "outline";
      default: return "default";
    }
  };

  if (adminLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  }
  if (!adminUserProfile?.isAdmin) {
    return <div className="flex flex-col items-center justify-center h-screen"><ShieldAlert className="h-12 w-12 text-destructive" /><p className="mt-2">Erişim Engellendi.</p></div>;
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] border rounded-lg shadow-sm">
      {/* Left Column: Ticket List */}
      <div className="w-1/3 border-r overflow-y-auto">
        <CardHeader className="sticky top-0 bg-card z-10 border-b">
          <CardTitle className="text-lg flex items-center"><Inbox className="mr-2 h-5 w-5"/> Destek Talepleri</CardTitle>
        </CardHeader>
        {isLoadingTickets ? (
          <div className="p-4 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : allTickets.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground text-center">Görüntülenecek destek talebi yok.</p>
        ) : (
          <ScrollArea className="h-[calc(100%-4rem)]">
            {allTickets.map(ticket => (
              <Button
                key={ticket.id}
                variant="ghost"
                className={`w-full justify-start p-3 h-auto rounded-none border-b ${selectedTicket?.id === ticket.id ? 'bg-accent text-accent-foreground' : ''}`}
                onClick={() => setSelectedTicket(ticket)}
              >
                <div className="flex flex-col items-start text-left w-full">
                  <div className="flex justify-between w-full items-center mb-1">
                    <span className="text-xs font-semibold truncate max-w-[70%]">
                      {ticket.userEmail || ticket.userName || ticket.userId}
                    </span>
                    <Badge variant={getStatusBadgeVariant(ticket.status)} className="text-xs">
                      {formatTicketStatus(ticket.status)}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium truncate w-full">{formatTicketSubject(ticket.subject)}</p>
                  <p className="text-xs text-muted-foreground truncate w-full">{ticket.lastMessageSnippet}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ticket.lastMessageAt ? format(ticket.lastMessageAt.toDate(), 'dd/MM HH:mm', { locale: tr }) : 'N/A'}
                  </p>
                </div>
              </Button>
            ))}
          </ScrollArea>
        )}
      </div>

      {/* Right Column: Chat View */}
      <div className="w-2/3 flex flex-col">
        {!selectedTicket ? (
          <div className="flex-grow flex items-center justify-center">
            <p className="text-muted-foreground">Görüntülemek için bir talep seçin.</p>
          </div>
        ) : (
          <>
            <CardHeader className="border-b">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5"/>Kullanıcı: {selectedTicket.userEmail || selectedTicket.userName || selectedTicket.userId}
                    <Badge variant={selectedTicket.userPlan === 'pro' ? 'default' : selectedTicket.userPlan === 'premium' ? 'secondary' : 'outline'} 
                           className={`${selectedTicket.userPlan === 'pro' ? 'bg-purple-600 text-white' : selectedTicket.userPlan === 'premium' ? 'bg-blue-500 text-white' : ''}`}>
                      {selectedTicket.userPlan?.toUpperCase() || 'N/A'}
                    </Badge>
                  </CardTitle>
                  <CardDescription>Talep ID: {selectedTicket.id} | Konu: {formatTicketSubject(selectedTicket.subject)}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedTicket.status}
                    onValueChange={(newStatus: SupportTicketStatus) => handleUpdateTicketStatus(selectedTicket.id, newStatus)}
                    disabled={isUpdatingStatus}
                  >
                    <SelectTrigger className="w-[150px] text-xs h-8">
                      <SelectValue placeholder="Durumu Değiştir" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Açık</SelectItem>
                      <SelectItem value="answered">Yanıtlandı</SelectItem>
                      <SelectItem value="closed_by_admin">Admin Kapattı</SelectItem>
                      <SelectItem value="closed_by_user" disabled>Kullanıcı Kapattı</SelectItem>
                    </SelectContent>
                  </Select>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon" className="h-8 w-8">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Talebi Silmek İstediğinizden Emin Misiniz?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Bu işlem geri alınamaz. Talep ID: {selectedTicket.id} kalıcı olarak silinecektir.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteTicket(selectedTicket.id)}>Sil</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            
            <ScrollArea className="flex-grow p-4 bg-muted/20">
              {isLoadingMessages ? (
                <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Bu talep için mesaj bulunmuyor.</p>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`mb-3 p-3 rounded-lg max-w-[85%] w-fit clear-both ${msg.senderType === 'admin' ? 'bg-primary text-primary-foreground ml-auto text-right float-right' : 'bg-secondary text-secondary-foreground mr-auto text-left float-left'}`}>
                    <div className="text-xs font-semibold mb-1 opacity-80">
                      {msg.senderName} {msg.senderType === 'admin' && <Badge variant="outline" className="ml-1 text-xs border-primary-foreground/50 text-primary-foreground/80 bg-transparent">Destek</Badge>}
                    </div>
                    <p className="text-sm whitespace-pre-line">{msg.text}</p>
                    <p className="text-xs opacity-70 mt-1">{format(msg.timestamp.toDate(), 'PPpp', { locale: tr })}</p>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </ScrollArea>
            
            <div className="p-4 border-t bg-card">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Yanıtınızı buraya yazın..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={3}
                  className="flex-grow"
                  disabled={isSendingReply || selectedTicket.status === 'closed_by_admin' || selectedTicket.status === 'closed_by_user'}
                />
                <Button
                  onClick={handleSendReply}
                  disabled={isSendingReply || !replyText.trim() || selectedTicket.status === 'closed_by_admin' || selectedTicket.status === 'closed_by_user'}
                  className="self-end"
                >
                  {isSendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="ml-2 hidden sm:inline">Gönder</span>
                </Button>
              </div>
               {(selectedTicket.status === 'closed_by_admin' || selectedTicket.status === 'closed_by_user') && (
                <p className="text-xs text-destructive mt-2 text-center">Bu talep kapatıldığı için yanıt gönderilemez.</p>
            )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
