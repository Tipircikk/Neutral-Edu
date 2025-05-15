
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, LifeBuoy, PlusCircle, Eye } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, orderBy, Timestamp as FirestoreTimestamp } from "firebase/firestore";
import type { SupportTicket, SupportTicketStatus } from "@/types";
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

// TODO: Implement CreateTicketDialog and TicketDetailViewDialog
// import CreateTicketDialog from "@/components/dashboard/support/CreateTicketDialog";
// import TicketDetailViewDialog from "@/components/dashboard/support/TicketDetailViewDialog";

export default function SupportPage() {
  const { userProfile, loading: userLoading } = useUser();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isCreateTicketDialogOpen, setIsCreateTicketDialogOpen] = useState(false);
  const [selectedTicketToView, setSelectedTicketToView] = useState<SupportTicket | null>(null);

  const fetchUserTickets = useCallback(async () => {
    if (!userProfile) return;
    setIsLoadingTickets(true);
    try {
      const ticketsCollection = collection(db, "supportTickets");
      const q = query(
        ticketsCollection,
        where("userId", "==", userProfile.uid),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const userTickets = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof FirestoreTimestamp ? data.createdAt : FirestoreTimestamp.now(),
          updatedAt: data.updatedAt instanceof FirestoreTimestamp ? data.updatedAt : undefined,
          lastReplyAt: data.lastReplyAt instanceof FirestoreTimestamp ? data.lastReplyAt : undefined,
        } as SupportTicket;
      });
      setTickets(userTickets);
    } catch (error) {
      console.error("Error fetching user tickets:", error);
      toast({ title: "Hata", description: "Destek talepleriniz çekilirken bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsLoadingTickets(false);
    }
  }, [userProfile, toast]);

  useEffect(() => {
    if (userProfile) {
      fetchUserTickets();
    }
  }, [userProfile, fetchUserTickets]);

  const getStatusBadgeVariant = (status: SupportTicketStatus) => {
    switch (status) {
      case "open":
        return "destructive";
      case "answered":
        return "secondary"; // Or some other color like green
      case "closed_by_user":
      case "closed_by_admin":
        return "outline";
      default:
        return "default";
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
          <Button onClick={() => { /*setIsCreateTicketDialogOpen(true) */ toast({title: "Yakında!", description: "Yeni destek talebi oluşturma özelliği yakında eklenecektir."})}}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Yeni Destek Talebi Oluştur
          </Button>
        </CardHeader>
        <CardDescription className="px-6 pb-2">
            Oluşturduğunuz destek taleplerini buradan takip edebilirsiniz.
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
                  <TableHead>Son Güncelleme</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">{formatTicketSubject(ticket.subject)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(ticket.status)}
                        className={ticket.status === 'answered' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}
                      >
                        {formatTicketStatus(ticket.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format( (ticket.lastReplyAt || ticket.updatedAt || ticket.createdAt).toDate(), 'PPpp', { locale: tr })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => { /*setSelectedTicketToView(ticket) */ toast({title: "Yakında!", description: "Talep detaylarını görüntüleme yakında eklenecektir."}) }}>
                        <Eye className="mr-2 h-3 w-3" /> Görüntüle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Placeholder for CreateTicketDialog - To be implemented later
      {isCreateTicketDialogOpen && (
        <CreateTicketDialog
          isOpen={isCreateTicketDialogOpen}
          onOpenChange={setIsCreateTicketDialogOpen}
          onTicketCreated={() => {
            fetchUserTickets(); // Refresh list after creation
            setIsCreateTicketDialogOpen(false);
          }}
        />
      )}
      */}

      {/* Placeholder for TicketDetailViewDialog - To be implemented later
      {selectedTicketToView && (
        <TicketDetailViewDialog
          ticket={selectedTicketToView}
          isOpen={!!selectedTicketToView}
          onOpenChange={() => setSelectedTicketToView(null)}
          onReplySuccess={fetchUserTickets} // Refresh list after reply
        />
      )}
      */}
    </div>
  );
}
