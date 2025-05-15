
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldAlert, Users, BarChart3, Settings, MessageSquareWarning, Edit3, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { UserProfile, SupportTicket } from "@/types";
import { db } from "@/lib/firebase/config";
import { collection, getDocs, query, orderBy, Timestamp as FirestoreTimestamp } from "firebase/firestore";
import { getDefaultQuota } from "@/lib/firebase/firestore";
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import EditUserDialog from "@/components/admin/EditUserDialog"; 

export default function AdminPage() {
  const { userProfile: adminUserProfile, loading: adminLoading } = useUser();
  const router = useRouter();
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);

  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);

  useEffect(() => {
    if (!adminLoading && !adminUserProfile?.isAdmin) {
      router.replace("/dashboard");
    }
  }, [adminUserProfile, adminLoading, router]);

  const fetchAllUsers = async () => {
    setUsersLoading(true);
    try {
      const usersCollection = collection(db, "users");
      // Sort by isAdmin, then by plan (pro > premium > free), then by email
      const usersQuery = query(usersCollection); // Simpler query, sorting done client-side for plan
      const querySnapshot = await getDocs(usersQuery);
      const usersList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        let lastSummaryDate = data.lastSummaryDate;
        if (lastSummaryDate && typeof lastSummaryDate === 'object' && 'seconds' in lastSummaryDate && 'nanoseconds' in lastSummaryDate) {
            lastSummaryDate = new FirestoreTimestamp(lastSummaryDate.seconds, lastSummaryDate.nanoseconds);
        }
        return {
            uid: doc.id, 
            ...data,
            lastSummaryDate: lastSummaryDate,
        } as UserProfile;
      });
      setAllUsers(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (adminUserProfile?.isAdmin) {
      fetchAllUsers();

      const fetchSupportTickets = async () => {
        setTicketsLoading(true);
        try {
          const ticketsCollection = collection(db, "supportTickets");
          const ticketsQuery = query(ticketsCollection, orderBy("status", "asc"), orderBy("createdAt", "desc"));
          const querySnapshot = await getDocs(ticketsQuery);
          const ticketsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket));
          setSupportTickets(ticketsList);
        } catch (error) {
          console.error("Error fetching support tickets:", error);
        } finally {
          setTicketsLoading(false);
        }
      };
      fetchSupportTickets();
    }
  }, [adminUserProfile]);

  const planOrder: Record<UserProfile['plan'], number> = {
    pro: 0,
    premium: 1,
    free: 2,
  };

  const sortedUsers = useMemo(() => {
    return [...allUsers].sort((a, b) => {
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      if (planOrder[a.plan] < planOrder[b.plan]) return -1;
      if (planOrder[a.plan] > planOrder[b.plan]) return 1;
      return (a.email || "").localeCompare(b.email || "");
    });
  }, [allUsers]);

  const getUsageToday = (user: UserProfile): number => {
    if (!user.lastSummaryDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let lastDate: Date;
    if (user.lastSummaryDate instanceof FirestoreTimestamp) {
        lastDate = user.lastSummaryDate.toDate();
    } else if (typeof user.lastSummaryDate === 'string') {
        lastDate = new Date(user.lastSummaryDate);
    } else { 
        return 0;
    }
    lastDate.setHours(0,0,0,0);

    if (lastDate.getTime() === today.getTime()) {
      const totalQuota = getDefaultQuota(user.plan);
      const remainingQuota = typeof user.dailyRemainingQuota === 'number' ? user.dailyRemainingQuota : 0;
      return totalQuota - remainingQuota;
    }
    return 0;
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

  const formatTicketStatus = (status: SupportTicket['status']): string => {
    switch (status) {
      case "open": return "Açık";
      case "answered": return "Yanıtlandı";
      case "closed_by_user": return "Kullanıcı Kapattı";
      case "closed_by_admin": return "Admin Kapattı";
      default: return status;
    }
  };

  const handleOpenEditUserDialog = (user: UserProfile) => {
    setEditingUser(user);
    setIsEditUserDialogOpen(true);
  };

  const handleUserUpdate = (updatedUser: UserProfile) => {
    setAllUsers(prevUsers => prevUsers.map(u => u.uid === updatedUser.uid ? updatedUser : u));
  };


  if (adminLoading || (adminUserProfile?.isAdmin && (usersLoading || ticketsLoading))) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Admin Paneli Yükleniyor...</p>
      </div>
    );
  }

  if (!adminUserProfile?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive">Erişim Engellendi</h2>
        <p className="text-muted-foreground mt-2">Bu sayfayı görüntüleme yetkiniz yok.</p>
        <p className="text-muted-foreground">Yönlendiriliyorsunuz...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Paneli</h1>
        <p className="text-muted-foreground">
          Kullanıcıları, destek taleplerini ve uygulama ayarlarını yönetin.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-6 w-6" /> Kullanıcı Yönetimi</CardTitle>
          <CardDescription>Kullanıcıların planlarını ve rollerini görüntüleyin ve düzenleyin.</CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
             <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Kullanıcılar yükleniyor...</p>
             </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Kalan Kota</TableHead>
                  <TableHead>Bugünkü Kullanım</TableHead>
                  <TableHead>Rolü</TableHead>
                  <TableHead className="text-right">Eylemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.map((user) => (
                  <TableRow key={user.uid}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={user.plan === 'pro' ? 'default' : user.plan === 'premium' ? 'secondary' : 'outline'}
                        className={user.plan === 'pro' ? 'bg-purple-600 hover:bg-purple-700 text-white' : user.plan === 'premium' ? 'bg-blue-500 hover:bg-blue-600 text-white' : ''}
                      >
                        {user.plan === 'pro' ? 'Pro' : user.plan === 'premium' ? 'Premium' : 'Ücretsiz'}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.dailyRemainingQuota}</TableCell>
                    <TableCell>{getUsageToday(user)}</TableCell>
                    <TableCell>
                      <Badge variant={user.isAdmin ? 'destructive' : 'outline'}>
                        {user.isAdmin ? "Admin" : "Kullanıcı"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleOpenEditUserDialog(user)}>
                        <Edit3 className="mr-2 h-3 w-3"/> Düzenle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Inbox className="h-6 w-6" /> Destek Talepleri</CardTitle>
          <CardDescription>Kullanıcı destek taleplerini görüntüleyin.</CardDescription>
        </CardHeader>
        <CardContent>
          {ticketsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Destek talepleri yükleniyor...</p>
            </div>
          ) : supportTickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Görüntülenecek destek talebi bulunmamaktadır.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kullanıcı</TableHead>
                  <TableHead>Konu</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Mesaj (Önizleme)</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead className="text-right">Eylemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supportTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">{ticket.userEmail || ticket.userId}</TableCell>
                    <TableCell>{formatTicketSubject(ticket.subject)}</TableCell>
                    <TableCell>
                      <Badge variant={ticket.status === 'open' ? 'destructive' : 'secondary'}>
                        {formatTicketStatus(ticket.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{ticket.message}</TableCell>
                    <TableCell>
                      {ticket.createdAt instanceof FirestoreTimestamp 
                        ? format(ticket.createdAt.toDate(), 'PPpp', { locale: tr })
                        : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" disabled> 
                        <MessageSquareWarning className="mr-2 h-3 w-3"/> Yanıtla
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-6 w-6" /> Kullanım İstatistikleri</CardTitle>
          <CardDescription>Uygulama genelindeki kullanım verilerini ve özet istatistiklerini görüntüleyin.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Bu bölüm yakında detaylı kullanım raporları ve grafikleri içerecektir.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Card className="bg-muted/50">
              <CardHeader><CardTitle className="text-lg">Toplam Kullanıcı</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{allUsers.length}</p></CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardHeader><CardTitle className="text-lg">Bugünkü Toplam Kullanım</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{allUsers.reduce((sum, user) => sum + getUsageToday(user), 0)}</p></CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardHeader><CardTitle className="text-lg">Aktif Pro/Premium Üye</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{allUsers.filter(u => u.plan === 'premium' || u.plan === 'pro').length}</p></CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="h-6 w-6" /> Uygulama Ayarları</CardTitle>
          <CardDescription>Genel uygulama ayarlarını ve yapılandırmalarını yönetin.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Bu bölüm gelecekte eklenecek genel uygulama ayarları için bir yer tutucudur (Örn: Bakım modu, AI model seçimi vb.).</p>
        </CardContent>
      </Card>
      {editingUser && (
        <EditUserDialog
          user={editingUser}
          isOpen={isEditUserDialogOpen}
          onOpenChange={setIsEditUserDialogOpen}
          onUserUpdate={handleUserUpdate}
        />
      )}
    </div>
  );
}
