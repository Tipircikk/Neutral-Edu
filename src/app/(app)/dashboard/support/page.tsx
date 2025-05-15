
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, LifeBuoy, PlusCircle, Eye, Send, MessageSquare } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, orderBy, Timestamp as FirestoreTimestamp, addDoc, serverTimestamp, doc, updateDoc, Timestamp } from "firebase/firestore";
import type { SupportTicket, SupportTicketStatus, SupportTicketSubject, SupportMessage, UserProfile } from "@/types";
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useForm, Controller, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";


const CreateTicketSchema = z.object({
  subject: z.custom<SupportTicketSubject>((val) => ["premium", "ai_tools", "account", "bug_report", "other"].includes(val as string), {
    message: "Lütfen geçerli bir konu seçin.",
  }),
  message: z.string().min(10, { message: "Mesajınız en az 10 karakter olmalıdır." }).max(1000, { message: "Mesajınız en fazla 1000 karakter olabilir." }),
});
type CreateTicketFormValues = z.infer<typeof CreateTicketSchema>;

export default function SupportPage() {
  const { userProfile, loading: userLoading } = useUser();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isCreateTicketDialogOpen, setIsCreateTicketDialogOpen] = useState(false);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  const [selectedTicketToView, setSelectedTicketToView] = useState<SupportTicket | null>(null);
  const [isViewTicketDialogOpen, setIsViewTicketDialogOpen] = useState(false);
  const [ticketMessages, setTicketMessages] = useState<SupportMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [newMessageText, setNewMessageText] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);


  const { control, handleSubmit, register, reset: resetCreateTicketForm, formState: { errors } } = useForm<CreateTicketFormValues>({
    resolver: zodResolver(CreateTicketSchema),
    defaultValues: {
      subject: "other",
      message: "",
    },
  });

  const fetchUserTickets = useCallback(async () => {
    if (!userProfile) return;
    setIsLoadingTickets(true);
    try {
      const ticketsCollectionRef = collection(db, "supportTickets");
      const q = query(
        ticketsCollectionRef,
        where("userId", "==", userProfile.uid),
        orderBy("lastMessageAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const userTickets = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt : FirestoreTimestamp.fromDate(new Date()),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : undefined,
          lastMessageAt: data.lastMessageAt instanceof Timestamp ? data.lastMessageAt : (data.createdAt instanceof Timestamp ? data.createdAt : FirestoreTimestamp.fromDate(new Date())),
        } as SupportTicket;
      });
      setTickets(userTickets);
    } catch (error: any) {
      console.error("Error fetching user tickets:", error);
      toast({ title: "Hata", description: error.message || "Destek talepleriniz çekilirken bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsLoadingTickets(false);
    }
  }, [userProfile, toast]);

  useEffect(() => {
    if (userProfile && !userLoading) {
      fetchUserTickets();
    }
  }, [userProfile, userLoading, fetchUserTickets]);

  const fetchTicketMessages = async (ticketId: string) => {
    if (!selectedTicketToView || selectedTicketToView.id !== ticketId) return;
    setIsLoadingMessages(true);
    setTicketMessages([]);
    try {
      const messagesCollectionRef = collection(db, "supportTickets", ticketId, "messages");
      const q = query(messagesCollectionRef, orderBy("timestamp", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedMessages = querySnapshot.docs.map(doc => {
        const msgData = doc.data();
        return {
          id: doc.id,
          ...msgData,
          timestamp: msgData.timestamp instanceof Timestamp ? msgData.timestamp : FirestoreTimestamp.fromDate(new Date()),
        } as SupportMessage
      });
      setTicketMessages(fetchedMessages);
    } catch (error: any) {
      console.error("Error fetching ticket messages:", error);
      toast({ title: "Hata", description: error.message || "Mesajlar çekilirken bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (selectedTicketToView && isViewTicketDialogOpen) {
      fetchTicketMessages(selectedTicketToView.id);
    } else {
      setTicketMessages([]);
    }
  }, [selectedTicketToView, isViewTicketDialogOpen]);


  const handleCreateTicketSubmit: SubmitHandler<CreateTicketFormValues> = async (values) => {
    if (!userProfile) {
      toast({ title: "Hata", description: "Yeni talep oluşturmak için giriş yapmalısınız.", variant: "destructive" });
      return;
    }
    setIsSubmittingTicket(true);
    try {
      const nowServerTimestamp = serverTimestamp() as Timestamp;
      const initialMessageText = values.message;
      
      const newTicketRef = await addDoc(collection(db, "supportTickets"), {
        userId: userProfile.uid,
        userEmail: userProfile.email,
        userName: userProfile.displayName || userProfile.email?.split('@')[0] || "Kullanıcı",
        userPlan: userProfile.plan, // Save user's plan
        subject: values.subject,
        status: "open" as SupportTicketStatus,
        createdAt: nowServerTimestamp,
        updatedAt: nowServerTimestamp,
        lastMessageSnippet: initialMessageText.substring(0, 70) + (initialMessageText.length > 70 ? "..." : ""),
        lastMessageAt: nowServerTimestamp,
        lastRepliedByAdmin: false,
      });

      await addDoc(collection(db, "supportTickets", newTicketRef.id, "messages"), {
        senderId: userProfile.uid,
        senderType: "user",
        senderName: userProfile.displayName || userProfile.email?.split('@')[0] || "Kullanıcı",
        text: initialMessageText,
        timestamp: nowServerTimestamp,
      });

      toast({ title: "Talep Oluşturuldu", description: "Destek talebiniz başarıyla oluşturuldu." });
      resetCreateTicketForm({ subject: "other", message: "" });
      setIsCreateTicketDialogOpen(false);
      fetchUserTickets(); 
    } catch (error: any) {
      console.error("Error creating ticket:", error);
      toast({ title: "Talep Oluşturma Hatası", description: error.message || "Destek talebi oluşturulurken bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedTicketToView || !newMessageText.trim() || !userProfile) return;
    setIsSendingMessage(true);
    try {
        const nowServerTimestamp = serverTimestamp() as Timestamp;
        const messagesCollectionRef = collection(db, "supportTickets", selectedTicketToView.id, "messages");
        
        await addDoc(messagesCollectionRef, {
            senderId: userProfile.uid,
            senderType: "user",
            senderName: userProfile.displayName || userProfile.email?.split('@')[0] || "Kullanıcı",
            text: newMessageText.trim(),
            timestamp: nowServerTimestamp,
        });

        const ticketDocRef = doc(db, "supportTickets", selectedTicketToView.id);
        await updateDoc(ticketDocRef, {
            status: "open", 
            updatedAt: nowServerTimestamp,
            lastMessageSnippet: newMessageText.trim().substring(0, 70) + (newMessageText.trim().length > 70 ? "..." : ""),
            lastMessageAt: nowServerTimestamp,
            lastRepliedByAdmin: false,
        });

        setNewMessageText("");
        fetchTicketMessages(selectedTicketToView.id); // Re-fetch messages after sending
        fetchUserTickets(); // Refresh the main ticket list to update lastMessageAt etc.
        toast({title: "Mesaj Gönderildi"});

    } catch (error: any) {
        console.error("Error sending message:", error);
        toast({ title: "Mesaj Gönderme Hatası", description: error.message || "Mesajınız gönderilirken bir hata oluştu.", variant: "destructive"});
    } finally {
        setIsSendingMessage(false);
    }
  };


  const getStatusBadgeVariant = (status: SupportTicketStatus) => {
    switch (status) {
      case "open": return "destructive";
      case "answered": return "secondary"; 
      case "closed_by_user":
      case "closed_by_admin": return "outline";
      default: return "default";
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


  if (userLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Destek Sayfası Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <LifeBuoy className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl">Destek Taleplerim</CardTitle>
          </div>
          <Dialog open={isCreateTicketDialogOpen} onOpenChange={setIsCreateTicketDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetCreateTicketForm(); setIsCreateTicketDialogOpen(true); }}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Yeni Destek Talebi Oluştur
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Yeni Destek Talebi Oluştur</DialogTitle>
                <DialogDescription>
                  Sorununuzu veya geri bildiriminizi bize iletin. En kısa sürede yanıtlayacağız.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(handleCreateTicketSubmit)} className="space-y-4 py-4">
                <div>
                  <Label htmlFor="subject">Konu</Label>
                  <Controller
                    name="subject"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger id="subject" className="mt-1">
                          <SelectValue placeholder="Bir konu seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="premium">Premium Üyelik Hakkında</SelectItem>
                          <SelectItem value="ai_tools">Yapay Zeka Araçları Hakkında</SelectItem>
                          <SelectItem value="account">Hesap Sorunları</SelectItem>
                          <SelectItem value="bug_report">Hata Bildirimi</SelectItem>
                          <SelectItem value="other">Diğer Konular</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.subject && <p className="text-sm text-destructive mt-1">{errors.subject.message}</p>}
                </div>
                <div>
                  <Label htmlFor="message">Mesajınız</Label>
                  <Textarea
                    id="message"
                    placeholder="Sorununuzu detaylı bir şekilde açıklayın..."
                    rows={6}
                    className="mt-1"
                    {...register("message")}
                  />
                  {errors.message && <p className="text-sm text-destructive mt-1">{errors.message.message}</p>}
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                     <Button type="button" variant="outline" disabled={isSubmittingTicket}>İptal</Button>
                  </DialogClose>
                  <Button type="submit" disabled={isSubmittingTicket}>
                    {isSubmittingTicket ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Talep Gönder"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardDescription className="px-6 pb-2">
            Oluşturduğunuz destek taleplerini buradan takip edebilir ve yanıtlayabilirsiniz.
        </CardDescription>
        <CardContent>
          {isLoadingTickets ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Talepleriniz yükleniyor...</p>
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">Henüz oluşturulmuş bir destek talebiniz bulunmuyor.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Konu</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Son Mesaj</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">{formatTicketSubject(ticket.subject)}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={getStatusBadgeVariant(ticket.status)}
                        className={ticket.status === 'answered' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}
                      >
                        {formatTicketStatus(ticket.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {ticket.lastMessageAt ? format(ticket.lastMessageAt.toDate(), 'PPpp', { locale: tr }) : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                       <Dialog 
                          open={selectedTicketToView?.id === ticket.id && isViewTicketDialogOpen} 
                          onOpenChange={(isOpen) => {
                            if (!isOpen) {
                              setSelectedTicketToView(null);
                              setIsViewTicketDialogOpen(false);
                            } else if (isOpen && ticket.id !== selectedTicketToView?.id) {
                                setSelectedTicketToView(ticket); // Ensure correct ticket is set if switching
                            }
                          }}
                        >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => {setSelectedTicketToView(ticket); setIsViewTicketDialogOpen(true);}}>
                            <Eye className="mr-2 h-3 w-3" /> Görüntüle
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-xl">
                          <DialogHeader>
                            <DialogTitle>Destek Talebi: {formatTicketSubject(selectedTicketToView?.subject || ticket.subject)}</DialogTitle>
                            <DialogDescription>
                              Talep ID: {selectedTicketToView?.id || ticket.id} | Durum: {formatTicketStatus(selectedTicketToView?.status || ticket.status)}
                            </DialogDescription>
                          </DialogHeader>
                          <ScrollArea className="h-[300px] w-full rounded-md border p-4 my-4 bg-muted/30">
                            {isLoadingMessages ? (
                                <div className="flex justify-center items-center h-full">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : ticketMessages.length > 0 ? (
                                ticketMessages.map(msg => (
                                    <div key={msg.id} className={`mb-3 p-3 rounded-lg max-w-[80%] ${msg.senderType === 'user' ? 'bg-primary/10 ml-auto text-right' : 'bg-secondary/50 mr-auto text-left'}`}>
                                        <div className="text-xs font-semibold mb-1">{msg.senderName} {msg.senderType === 'admin' && <Badge variant="outline" className="ml-1 text-xs">Destek</Badge>}</div>
                                        <p className="text-sm whitespace-pre-line">{msg.text}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{msg.timestamp ? format(msg.timestamp.toDate(), 'PPpp', {locale: tr}) : 'Gönderiliyor...'}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground text-center">Bu talep için henüz mesaj yok.</p>
                            )}
                          </ScrollArea>
                          {selectedTicketToView && selectedTicketToView.status !== 'closed_by_admin' && selectedTicketToView.status !== 'closed_by_user' && (
                            <div className="space-y-2">
                                <Textarea 
                                    placeholder="Yanıtınızı yazın..."
                                    value={newMessageText}
                                    onChange={(e) => setNewMessageText(e.target.value)}
                                    rows={3}
                                    disabled={isSendingMessage}
                                />
                                <Button onClick={handleSendMessage} disabled={isSendingMessage || !newMessageText.trim()}>
                                    {isSendingMessage ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />} Gönder
                                </Button>
                            </div>
                          )}
                           <DialogFooter className="mt-4">
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">Kapat</Button>
                                </DialogClose>
                            </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
