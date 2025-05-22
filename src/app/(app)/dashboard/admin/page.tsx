
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldAlert, Users, BarChart3, Settings, Inbox, Edit3, DollarSign, MessageSquareWarning, CalendarClock, TicketPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { UserProfile, SupportTicket, PricingConfig, ExamDatesConfig, CouponCode } from "@/types";
import { db } from "@/lib/firebase/config";
import { collection, getDocs, query, orderBy, Timestamp as FirestoreTimestamp, doc, updateDoc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { getDefaultQuota } from "@/lib/firebase/firestore";
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import EditUserDialog from "@/components/admin/EditUserDialog";
import ReplyTicketDialog from "@/components/admin/ReplyTicketDialog";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCouponAction, type CouponCreationFormData } from "@/app/actions/couponActions";


const CreateCouponSchema = z.object({
  couponCodeId: z.string()
    .min(5, { message: "Kupon kodu en az 5 karakter olmalıdır." })
    .max(50, { message: "Kupon kodu en fazla 50 karakter olabilir." })
    .regex(/^[a-zA-Z0-9_-]+$/, { message: "Kupon kodu sadece harf, rakam, tire (-) ve alt çizgi (_) içerebilir." }),
  planApplied: z.enum(["premium", "pro"], {
    required_error: "Uygulanacak plan seçimi zorunludur.",
    invalid_type_error: "Geçerli bir plan seçin."
  }),
  durationDays: z.coerce.number()
    .int({ message: "Süre tam sayı olmalıdır." })
    .positive({ message: "Süre pozitif olmalıdır." })
    .min(1, { message: "Geçerlilik süresi en az 1 gün olmalıdır." }),
  usageLimit: z.coerce.number()
    .int({ message: "Kullanım limiti tam sayı olmalıdır." })
    .positive({ message: "Kullanım limiti pozitif olmalıdır." })
    .min(1, { message: "Kullanım limiti en az 1 olmalıdır." }),
});
type CreateCouponFormValues = z.infer<typeof CreateCouponSchema>;


export default function AdminPage() {
  const { userProfile: adminUserProfile, loading: adminLoading } = useUser();
  const router = useRouter();
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const { toast } = useToast();

  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);

  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isReplyTicketDialogOpen, setIsReplyTicketDialogOpen] = useState(false);

  const [premiumPrice, setPremiumPrice] = useState("");
  const [proPrice, setProPrice] = useState("");
  const [premiumOriginalPrice, setPremiumOriginalPrice] = useState("");
  const [proOriginalPrice, setProOriginalPrice] = useState("");
  const [isSavingPrices, setIsSavingPrices] = useState(false);

  const [tytDate, setTytDate] = useState("");
  const [aytDate, setAytDate] = useState("");
  const [isSavingExamDates, setIsSavingExamDates] = useState(false);

  const [isCreatingCoupon, setIsCreatingCoupon] = useState(false);
  const {
    register: registerCoupon,
    handleSubmit: handleSubmitCoupon,
    control: controlCoupon,
    reset: resetCouponForm,
    formState: { errors: couponErrors }
  } = useForm<CreateCouponFormValues>({
    resolver: zodResolver(CreateCouponSchema),
    defaultValues: {
      planApplied: "premium",
      durationDays: 30,
      usageLimit: 1,
    }
  });

  useEffect(() => {
    if (!adminLoading && !adminUserProfile?.isAdmin) {
      router.replace("/dashboard");
    }
  }, [adminUserProfile, adminLoading, router]);

  const fetchAllUsers = async () => {
    setUsersLoading(true);
    try {
      const usersCollection = collection(db, "users");
      const usersQuery = query(usersCollection, orderBy("isAdmin", "desc"), orderBy("plan", "asc"));
      const querySnapshot = await getDocs(usersQuery);
      const usersList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        let lastSummaryDate = data.lastSummaryDate;
        if (lastSummaryDate && typeof lastSummaryDate === 'object' && 'seconds' in lastSummaryDate && 'nanoseconds' in lastSummaryDate) {
            lastSummaryDate = new FirestoreTimestamp(lastSummaryDate.seconds, lastSummaryDate.nanoseconds);
        }
        let planExpiryDate = data.planExpiryDate;
        if (planExpiryDate && typeof planExpiryDate === 'object' && 'seconds' in planExpiryDate && 'nanoseconds' in planExpiryDate) {
            planExpiryDate = new FirestoreTimestamp(planExpiryDate.seconds, planExpiryDate.nanoseconds);
        }

        return {
            uid: doc.id,
            ...data,
            lastSummaryDate: lastSummaryDate,
            planExpiryDate: planExpiryDate,
        } as UserProfile;
      });
      setAllUsers(usersList);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({ title: "Kullanıcılar Yüklenemedi", description: error.message || "Kullanıcı listesi çekilirken bir hata oluştu.", variant: "destructive" });
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchSupportTickets = async () => {
    setTicketsLoading(true);
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
            if (userDoc.exists()) {
              userPlan = (userDoc.data() as UserProfile).plan;
            }
          } catch (userFetchError) {
            console.warn(`Could not fetch user plan for ticket ${docSnapshot.id}:`, userFetchError);
          }
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
      const statusOrder: Record<SupportTicket["status"], number> = { open: 0, answered: 1, closed_by_user: 2, closed_by_admin: 3 };

      ticketsList.sort((a, b) => {
        const planAOrder = a.userPlan ? planOrder[a.userPlan] : planOrder.free;
        const planBOrder = b.userPlan ? planOrder[b.userPlan] : planOrder.free;
        if (planAOrder !== planBOrder) return planAOrder - planBOrder;

        const statusAOrder = statusOrder[a.status];
        const statusBOrder = statusOrder[b.status];
        if (statusAOrder !== statusBOrder) return statusAOrder - statusBOrder;
        
        const timeA = a.lastMessageAt?.toMillis() || 0;
        const timeB = b.lastMessageAt?.toMillis() || 0;
        return timeB - timeA;
      });
      
      setSupportTickets(ticketsList);
    } catch (error: any) {
      console.error("Error fetching support tickets:", error);
      toast({ title: "Destek Talepleri Yüklenemedi", description: error.message || "Destek talepleri çekilirken bir hata oluştu.", variant: "destructive" });
    } finally {
      setTicketsLoading(false);
    }
  };

  const fetchCurrentPrices = async () => {
    try {
      const priceConfigDocRef = doc(db, "pricingConfig", "currentPrices");
      const priceConfigDoc = await getDoc(priceConfigDocRef);
      if (priceConfigDoc.exists()) {
        const prices = priceConfigDoc.data() as PricingConfig;
        setPremiumPrice(prices.premium?.price || "");
        setProPrice(prices.pro?.price || "");
        setPremiumOriginalPrice(prices.premium?.originalPrice || "");
        setProOriginalPrice(prices.pro?.originalPrice || "");
      }
    } catch (err: any) {
      console.error("Error fetching prices:", err);
      toast({ title: "Fiyatlar Yüklenemedi", description: err.message || "Mevcut fiyatlandırma bilgileri çekilirken bir hata oluştu.", variant: "destructive" });
    }
  };

  const fetchExamDates = async () => {
    try {
      const examDatesDocRef = doc(db, "appConfig", "examDates");
      const examDatesDoc = await getDoc(examDatesDocRef);
      if (examDatesDoc.exists()) {
        const dates = examDatesDoc.data() as ExamDatesConfig;
        setTytDate(dates.tytDate || "");
        setAytDate(dates.aytDate || "");
      }
    } catch (err: any) {
      console.error("Error fetching exam dates:", err);
      toast({ title: "Sınav Tarihleri Yüklenemedi", description: err.message || "Sınav tarihleri çekilirken bir hata oluştu.", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (adminUserProfile?.isAdmin) {
      fetchAllUsers();
      fetchSupportTickets();
      fetchCurrentPrices();
      fetchExamDates();
    }
  }, [adminUserProfile]);

  const planOrder: Record<UserProfile['plan'], number> = { pro: 0, premium: 1, free: 2 };

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
        if (isNaN(lastDate.getTime())) return 0; 
    } else {
        return 0;
    }
    lastDate.setHours(0,0,0,0);

    if (lastDate.getTime() === today.getTime()) {
      const totalQuota = getDefaultQuota(user.plan);
      const remainingQuota = typeof user.dailyRemainingQuota === 'number' ? user.dailyRemainingQuota : totalQuota;
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

  const handleUserUpdateSuccess = (updatedUser: UserProfile) => {
    setAllUsers(prevUsers => prevUsers.map(u => u.uid === updatedUser.uid ? updatedUser : u));
  };

  const handleOpenReplyDialog = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setIsReplyTicketDialogOpen(true);
  };

  const handleTicketReplySuccess = (updatedTicketFromDialog: SupportTicket) => {
     setSupportTickets(prevTickets =>
      prevTickets.map(t => (t.id === updatedTicketFromDialog.id ? { ...t, ...updatedTicketFromDialog } : t))
    );
    fetchSupportTickets(); 
  };

  const handleSavePrices = async () => {
    setIsSavingPrices(true);
    const priceData: Partial<PricingConfig> = {}; 
    
    if (premiumPrice) priceData.premium = { ...(priceData.premium || {}), price: premiumPrice };
    if (premiumOriginalPrice) priceData.premium = { ...(priceData.premium || { price: premiumPrice }), originalPrice: premiumOriginalPrice };
    
    if (proPrice) priceData.pro = { ...(priceData.pro || {}), price: proPrice };
    if (proOriginalPrice) priceData.pro = { ...(priceData.pro || { price: proPrice }), originalPrice: proOriginalPrice };
    
    if (Object.keys(priceData).length === 0) {
        toast({ title: "Değişiklik Yok", description: "Kaydedilecek yeni fiyat bilgisi girilmedi.", variant: "default" });
        setIsSavingPrices(false);
        return;
    }

    priceData.updatedAt = serverTimestamp() as FirestoreTimestamp;

    try {
      const priceConfigRef = doc(db, "pricingConfig", "currentPrices");
      await setDoc(priceConfigRef, priceData, { merge: true });
      toast({ title: "Fiyatlar Güncellendi", description: "Yeni fiyatlar başarıyla kaydedildi." });
    } catch (error: any) {
      console.error("Error saving prices:", error);
      toast({ title: "Fiyat Kaydetme Hatası", description: error.message || "Fiyatlar güncellenirken bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsSavingPrices(false);
    }
  };

  const handleSaveExamDates = async () => {
    setIsSavingExamDates(true);
    if (!tytDate && !aytDate) {
      toast({ title: "Tarih Girilmedi", description: "Lütfen en az bir sınav tarihi girin.", variant: "default" });
      setIsSavingExamDates(false);
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if ((tytDate && !dateRegex.test(tytDate)) || (aytDate && !dateRegex.test(aytDate))) {
      toast({ title: "Geçersiz Tarih Formatı", description: "Lütfen tarihleri YYYY-AA-GG formatında girin.", variant: "destructive" });
      setIsSavingExamDates(false);
      return;
    }
    
    const examDatesData: ExamDatesConfig = {
      tytDate: tytDate || undefined,
      aytDate: aytDate || undefined,
      updatedAt: serverTimestamp() as FirestoreTimestamp,
    };

    try {
      const examDatesRef = doc(db, "appConfig", "examDates");
      await setDoc(examDatesRef, examDatesData, { merge: true });
      toast({ title: "Sınav Tarihleri Güncellendi", description: "Yeni sınav tarihleri başarıyla kaydedildi." });
    } catch (error: any) {
      console.error("Error saving exam dates:", error);
      toast({ title: "Tarih Kaydetme Hatası", description: error.message || "Sınav tarihleri güncellenirken bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsSavingExamDates(false);
    }
  };

  const handleCreateCoupon: SubmitHandler<CreateCouponFormValues> = async (data) => {
    if (!adminUserProfile) {
      toast({ title: "Yetkilendirme Hatası", description: "Kupon oluşturmak için admin olmalısınız.", variant: "destructive" });
      return;
    }
    setIsCreatingCoupon(true);
    try {
      const result = await createCouponAction(data, adminUserProfile.uid, adminUserProfile.email);
      if (result.success) {
        toast({ title: "Kupon Oluşturuldu", description: result.message });
        resetCouponForm({ couponCodeId: "", planApplied: "premium", durationDays: 30, usageLimit: 1 });
      } else {
        toast({ title: "Kupon Oluşturma Hatası", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error creating coupon (client):", error);
      toast({ title: "Kupon Oluşturma Hatası", description: error.message || "Beklenmedik bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsCreatingCoupon(false);
    }
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
          <CardTitle className="flex items-center gap-2"><TicketPlus className="h-6 w-6" /> Kupon Kodu Yönetimi</CardTitle>
          <CardDescription>Yeni kupon kodları oluşturun.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitCoupon(handleCreateCoupon)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="couponCodeId">Kupon Kodu</Label>
                <Input id="couponCodeId" {...registerCoupon("couponCodeId")} placeholder="örn: PRO30GUN" disabled={isCreatingCoupon} />
                {couponErrors.couponCodeId && <p className="text-sm text-destructive mt-1">{couponErrors.couponCodeId.message}</p>}
              </div>
              <div>
                <Label htmlFor="planApplied">Uygulanacak Plan</Label>
                <Controller
                  name="planApplied"
                  control={controlCoupon}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value} disabled={isCreatingCoupon}>
                      <SelectTrigger id="planApplied">
                        <SelectValue placeholder="Plan seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {couponErrors.planApplied && <p className="text-sm text-destructive mt-1">{couponErrors.planApplied.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="durationDays">Geçerlilik Süresi (Gün)</Label>
                <Input id="durationDays" type="number" {...registerCoupon("durationDays")} placeholder="örn: 30" disabled={isCreatingCoupon} />
                {couponErrors.durationDays && <p className="text-sm text-destructive mt-1">{couponErrors.durationDays.message}</p>}
              </div>
              <div>
                <Label htmlFor="usageLimit">Kullanım Limiti (Kişi Sayısı)</Label>
                <Input id="usageLimit" type="number" {...registerCoupon("usageLimit")} placeholder="örn: 1" disabled={isCreatingCoupon} />
                {couponErrors.usageLimit && <p className="text-sm text-destructive mt-1">{couponErrors.usageLimit.message}</p>}
              </div>
            </div>
            <Button type="submit" disabled={isCreatingCoupon}>
              {isCreatingCoupon ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Kupon Oluştur"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-6 w-6" /> Kullanıcı Yönetimi</CardTitle>
          <CardDescription>Kullanıcıların planlarını, rollerini ve abonelik sürelerini görüntüleyin ve düzenleyin.</CardDescription>
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
                  <TableHead>Plan Bitiş</TableHead>
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
                        className={
                            user.plan === 'pro' ? 'bg-purple-600 hover:bg-purple-700 text-white' :
                            user.plan === 'premium' ? 'bg-blue-500 hover:bg-blue-600 text-white' : ''
                        }
                      >
                        {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.planExpiryDate instanceof FirestoreTimestamp
                        ? format(user.planExpiryDate.toDate(), 'PP', { locale: tr })
                        : (user.plan === 'premium' || user.plan === 'pro') ? 'Süresiz' : 'Yok'}
                    </TableCell>
                    <TableCell>{typeof user.dailyRemainingQuota === 'number' ? user.dailyRemainingQuota : getDefaultQuota(user.plan)}</TableCell>
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
          <CardDescription>Kullanıcı destek taleplerini görüntüleyin ve yanıtlayın. Talepler önceliklendirilmiştir (Pro &gt; Premium &gt; Ücretsiz, Açık &gt; Yanıtlanmış).</CardDescription>
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
                  <TableHead>Plan</TableHead>
                  <TableHead>Konu</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Son Mesaj (Özet)</TableHead>
                  <TableHead>Son Mesaj Tarihi</TableHead>
                  <TableHead className="text-right">Eylemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supportTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">{ticket.userEmail || ticket.userId}</TableCell>
                    <TableCell>
                        {ticket.userPlan ? (
                            <Badge
                                variant={ticket.userPlan === 'pro' ? 'default' : ticket.userPlan === 'premium' ? 'secondary' : 'outline'}
                                className={
                                    ticket.userPlan === 'pro' ? 'bg-purple-600 hover:bg-purple-700 text-white' :
                                    ticket.userPlan === 'premium' ? 'bg-blue-500 hover:bg-blue-600 text-white' : ''
                                }
                            >
                                {ticket.userPlan.charAt(0).toUpperCase() + ticket.userPlan.slice(1)}
                            </Badge>
                        ) : <Badge variant="outline">Bilinmiyor</Badge>}
                    </TableCell>
                    <TableCell>{formatTicketSubject(ticket.subject)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={ticket.status === 'open' ? 'destructive' : ticket.status === 'answered' ? 'secondary' : 'outline'}
                        className={ticket.status === 'answered' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}
                      >
                        {formatTicketStatus(ticket.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{ticket.lastMessageSnippet || "İlk mesaj bekleniyor..."}</TableCell>
                    <TableCell>
                      {ticket.lastMessageAt instanceof FirestoreTimestamp
                        ? format(ticket.lastMessageAt.toDate(), 'PPpp', { locale: tr })
                        : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleOpenReplyDialog(ticket)}>
                        <MessageSquareWarning className="mr-2 h-3 w-3"/>
                        Görüntüle/Yanıtla
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
          <CardTitle className="flex items-center gap-2"><DollarSign className="h-6 w-6" /> Fiyatlandırma Yönetimi</CardTitle>
          <CardDescription>Premium ve Pro planlarının güncel ve orijinal fiyatlarını güncelleyin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4 p-4 border rounded-md">
                    <h3 className="text-lg font-semibold">Premium Plan</h3>
                    <div>
                        <Label htmlFor="premiumPrice">Güncel Fiyat (₺)</Label>
                        <Input
                            id="premiumPrice"
                            type="number"
                            placeholder="örn: 100"
                            value={premiumPrice}
                            onChange={(e) => setPremiumPrice(e.target.value)}
                            disabled={isSavingPrices}
                        />
                    </div>
                    <div>
                        <Label htmlFor="premiumOriginalPrice">Orijinal Fiyat (₺) (isteğe bağlı)</Label>
                        <Input
                            id="premiumOriginalPrice"
                            type="number"
                            placeholder="örn: 200"
                            value={premiumOriginalPrice}
                            onChange={(e) => setPremiumOriginalPrice(e.target.value)}
                            disabled={isSavingPrices}
                        />
                    </div>
                </div>
                <div className="space-y-4 p-4 border rounded-md">
                     <h3 className="text-lg font-semibold">Pro Plan</h3>
                    <div>
                        <Label htmlFor="proPrice">Güncel Fiyat (₺)</Label>
                        <Input
                            id="proPrice"
                            type="number"
                            placeholder="örn: 300"
                            value={proPrice}
                            onChange={(e) => setProPrice(e.target.value)}
                            disabled={isSavingPrices}
                        />
                    </div>
                    <div>
                        <Label htmlFor="proOriginalPrice">Orijinal Fiyat (₺) (isteğe bağlı)</Label>
                        <Input
                            id="proOriginalPrice"
                            type="number"
                            placeholder="örn: 600"
                            value={proOriginalPrice}
                            onChange={(e) => setProOriginalPrice(e.target.value)}
                            disabled={isSavingPrices}
                        />
                    </div>
                </div>
            </div>
          <Button onClick={handleSavePrices} disabled={isSavingPrices}>
            {isSavingPrices ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Fiyatları Kaydet"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="h-6 w-6" /> Sınav Tarihi Yönetimi</CardTitle>
          <CardDescription>YKS (TYT ve AYT) sınav tarihlerini güncelleyin. Bu tarihler YKS Geri Sayım aracında kullanılacaktır.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="tytDate">TYT Sınav Tarihi</Label>
                    <Input
                        id="tytDate"
                        type="date"
                        value={tytDate}
                        onChange={(e) => setTytDate(e.target.value)}
                        disabled={isSavingExamDates}
                    />
                     <p className="text-xs text-muted-foreground">Format: YYYY-AA-GG</p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="aytDate">AYT Sınav Tarihi</Label>
                    <Input
                        id="aytDate"
                        type="date"
                        value={aytDate}
                        onChange={(e) => setAytDate(e.target.value)}
                        disabled={isSavingExamDates}
                    />
                    <p className="text-xs text-muted-foreground">Format: YYYY-AA-GG</p>
                </div>
            </div>
          <Button onClick={handleSaveExamDates} disabled={isSavingExamDates}>
            {isSavingExamDates ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sınav Tarihlerini Kaydet"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-6 w-6" /> Kullanım İstatistikleri</CardTitle>
          <CardDescription>Uygulama genelindeki kullanım verilerini ve özet istatistiklerini görüntüleyin.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Bu bölüm yakında detaylı kullanım raporları ve grafikleri içerecektir.</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <Card className="bg-muted/50">
              <CardHeader><CardTitle className="text-lg">Toplam Kullanıcı</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{allUsers.length}</p></CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardHeader><CardTitle className="text-lg">Bugünkü Toplam Kullanım</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{allUsers.reduce((sum, user) => sum + getUsageToday(user), 0)}</p></CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardHeader><CardTitle className="text-lg">Aktif Premium Üyeler</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{allUsers.filter(u => u.plan === 'premium').length}</p></CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardHeader><CardTitle className="text-lg">Aktif Pro Üyeler</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{allUsers.filter(u => u.plan === 'pro').length}</p></CardContent>
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
          onUserUpdate={handleUserUpdateSuccess}
        />
      )}
      {selectedTicket && adminUserProfile && (
        <ReplyTicketDialog
          ticket={selectedTicket}
          isOpen={isReplyTicketDialogOpen}
          onOpenChange={setIsReplyTicketDialogOpen}
          onTicketReplySuccess={handleTicketReplySuccess}
        />
      )}
    </div>
  );
}

    