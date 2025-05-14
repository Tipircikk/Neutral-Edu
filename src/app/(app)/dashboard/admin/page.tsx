
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldAlert, Users, BarChart3, Settings } from "lucide-react";
import { Button } from "@/components/ui/button"; // Added Button
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table" // Added Table components
import { Badge } from "@/components/ui/badge"; // Added Badge

// Mock data for users - replace with actual Firestore data fetching
const mockUsers = [
  { id: "1", email: "user1@example.com", plan: "free", dailyRemainingQuota: 1, lastSummaryDate: "2024-07-28", isAdmin: false, usageToday: 1 },
  { id: "2", email: "user2@example.com", plan: "premium", dailyRemainingQuota: 8, lastSummaryDate: "2024-07-28", isAdmin: false, usageToday: 2 },
  { id: "3", email: "admin@example.com", plan: "premium", dailyRemainingQuota: 10, lastSummaryDate: "2024-07-27", isAdmin: true, usageToday: 0 },
];


export default function AdminPage() {
  const { userProfile, loading: userLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!userLoading && !userProfile?.isAdmin) {
      router.replace("/dashboard"); 
    }
  }, [userProfile, userLoading, router]);

  if (userLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Admin Paneli Yükleniyor...</p>
      </div>
    );
  }

  if (!userProfile?.isAdmin) {
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
          Kullanıcıları ve uygulama ayarlarını yönetin.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-6 w-6" /> Kullanıcı Yönetimi</CardTitle>
          <CardDescription>Kullanıcıların planlarını ve rollerini görüntüleyin ve düzenleyin.</CardDescription>
        </CardHeader>
        <CardContent>
           <p className="text-sm text-muted-foreground mb-4">Bu bölüm yakında tüm kullanıcıları listeleyecek ve düzenleme seçenekleri sunacaktır.</p>
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
              {mockUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.plan === 'premium' ? 'default' : 'secondary'}>
                      {user.plan}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.dailyRemainingQuota}</TableCell>
                  <TableCell>{user.usageToday}</TableCell>
                  <TableCell>
                     <Badge variant={user.isAdmin ? 'destructive' : 'outline'}>
                        {user.isAdmin ? "Evet" : "Hayır"}
                     </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" disabled>Düzenle</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-6 w-6" /> Kullanım İstatistikleri</CardTitle>
          <CardDescription>Uygulama genelindeki kullanım verilerini ve özet istatistiklerini görüntüleyin.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Bu bölüm yakında detaylı kullanım raporları ve grafikleri içerecektir.</p>
          {/* Placeholder for stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Card className="bg-muted/50">
              <CardHeader><CardTitle className="text-lg">Toplam Kullanıcı</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">125</p></CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardHeader><CardTitle className="text-lg">Bugünkü Özet Sayısı</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">42</p></CardContent>
            </Card>
             <Card className="bg-muted/50">
              <CardHeader><CardTitle className="text-lg">Aktif Premium Üye</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">15</p></CardContent>
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
          <p className="text-sm text-muted-foreground">Bu bölüm gelecekte eklenecek genel uygulama ayarları için bir yer tutucudur.</p>
        </CardContent>
      </Card>
    </div>
  );
}

    