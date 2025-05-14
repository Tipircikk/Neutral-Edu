
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldAlert, Users, BarChart3, Settings, MessageSquareWarning, Edit3 } from "lucide-react";
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
import type { UserProfile } from "@/types"; // Assuming UserProfile is defined in types
import { db } from "@/lib/firebase/config";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { getDefaultQuota } from "@/lib/firebase/firestore";
import { Timestamp } from "firebase/firestore";

export default function AdminPage() {
  const { userProfile: adminUserProfile, loading: adminLoading } = useUser();
  const router = useRouter();
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    if (!adminLoading && !adminUserProfile?.isAdmin) {
      router.replace("/dashboard");
    }
  }, [adminUserProfile, adminLoading, router]);

  useEffect(() => {
    if (adminUserProfile?.isAdmin) {
      const fetchUsers = async () => {
        setUsersLoading(true);
        try {
          const usersCollection = collection(db, "users");
          const usersQuery = query(usersCollection, orderBy("isAdmin", "desc"), orderBy("plan", "desc"), orderBy("email")); // Premium and admins first
          const querySnapshot = await getDocs(usersQuery);
          const usersList = querySnapshot.docs.map(doc => {
            const data = doc.data();
             // Ensure lastSummaryDate is handled correctly (it might be string or Timestamp)
            let lastSummaryDate = data.lastSummaryDate;
            if (lastSummaryDate && typeof lastSummaryDate === 'object' && 'seconds' in lastSummaryDate && 'nanoseconds' in lastSummaryDate) {
                lastSummaryDate = new Timestamp(lastSummaryDate.seconds, lastSummaryDate.nanoseconds);
            }

            return {
                uid: doc.id,
                ...data,
                lastSummaryDate: lastSummaryDate, // Store as is, or convert to Date if preferred for display
            } as UserProfile;
          });
          setAllUsers(usersList);
        } catch (error) {
          console.error("Error fetching users:", error);
          // Add toast notification for error
        } finally {
          setUsersLoading(false);
        }
      };
      fetchUsers();
    }
  }, [adminUserProfile]);

  const sortedUsers = useMemo(() => {
    return [...allUsers].sort((a, b) => {
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      if (a.plan === 'premium' && b.plan !== 'premium') return -1;
      if (a.plan !== 'premium' && b.plan === 'premium') return 1;
      return (a.email || "").localeCompare(b.email || "");
    });
  }, [allUsers]);

  const getUsageToday = (user: UserProfile): number => {
    if (!user.lastSummaryDate) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let lastDate: Date;
    if (user.lastSummaryDate instanceof Timestamp) {
        lastDate = user.lastSummaryDate.toDate();
    } else if (typeof user.lastSummaryDate === 'string') {
        lastDate = new Date(user.lastSummaryDate);
    } else {
        return 0; // Should not happen if data is clean
    }
    lastDate.setHours(0,0,0,0);

    if (lastDate.getTime() === today.getTime()) {
      const totalQuota = getDefaultQuota(user.plan);
      return totalQuota - user.dailyRemainingQuota;
    }
    return 0;
  };


  if (adminLoading || (adminUserProfile?.isAdmin && usersLoading)) {
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
                  <TableHead>Admin?</TableHead>
                  <TableHead className="text-right">Eylemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.map((user) => (
                  <TableRow key={user.uid}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.plan === 'premium' ? 'default' : 'secondary'}>
                        {user.plan}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.dailyRemainingQuota}</TableCell>
                    <TableCell>{getUsageToday(user)}</TableCell>
                    <TableCell>
                      <Badge variant={user.isAdmin ? 'destructive' : 'outline'}>
                        {user.isAdmin ? "Evet" : "Hayır"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" disabled>
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
          <CardTitle className="flex items-center gap-2"><MessageSquareWarning className="h-6 w-6" /> Destek Talepleri</CardTitle>
          <CardDescription>Kullanıcı destek taleplerini görüntüleyin ve yanıtlayın.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Bu bölüm yakında kullanıcı destek taleplerini listeleyecek ve yanıtlamanıza olanak tanıyacaktır. Yanıtlanmamış talepler burada öncelikli olarak görünecektir.
          </p>
          {/* Placeholder for support tickets list - to be implemented */}
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
              <CardHeader><CardTitle className="text-lg">Aktif Premium Üye</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{allUsers.filter(u => u.plan === 'premium').length}</p></CardContent>
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
    </div>
  );
}
