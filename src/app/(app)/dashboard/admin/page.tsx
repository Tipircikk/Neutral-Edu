
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldAlert, Users, BarChart3, Settings, DollarSign, CalendarClock, TicketPlus, Tag, BarChartHorizontalBig } from "lucide-react"; // Removed Inbox, MessageSquareWarning
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
import type { UserProfile, PricingConfig, ExamDatesConfig, CouponCode } from "@/types";
import { db } from "@/lib/firebase/config";
import { collection, getDocs, query, orderBy, Timestamp as FirestoreTimestamp, doc, updateDoc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { getDefaultQuota } from "@/lib/firebase/firestore";
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import EditUserDialog from "@/components/admin/EditUserDialog";
// import ReplyTicketDialog from "@/components/admin/ReplyTicketDialog"; // Removed, functionality moved to new page
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCouponAction, type CouponCreationFormData } from "@/app/actions/couponActions";
import { ScrollArea } from "@/components/ui/scroll-area";


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
  // Support tickets state and fetching removed from here
  const [allCoupons, setAllCoupons] = useState<CouponCode[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(true);
  const { toast } = useToast();

  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);

  // Selected ticket and dialog state removed from here
  // const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  // const [isReplyTicketDialogOpen, setIsReplyTicketDialogOpen] = useState(false);

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

  // fetchSupportTickets function removed

  const fetchAllCoupons = async () => {
    setCouponsLoading(true);
    try {
      const couponsCollection = collection(db, "coupons");
      const couponsQuery = query(couponsCollection, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(couponsQuery);
      const couponsList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof FirestoreTimestamp ? data.createdAt : FirestoreTimestamp.now(),
          updatedAt: data.updatedAt instanceof FirestoreTimestamp ? data.updatedAt : FirestoreTimestamp.now(),
        } as CouponCode;
      });
      setAllCoupons(couponsList);
    } catch (error: any) {
      console.error("Error fetching coupons:", error);
      toast({ title: "Kuponlar Yüklenemedi", description: error.message || "Kupon listesi çekilirken bir hata oluştu.", variant: "destructive" });
    } finally {
      setCouponsLoading(false);
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
      // fetchSupportTickets(); // Removed
      fetchAllCoupons();
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

  const handleOpenEditUserDialog = (user: UserProfile) => {
    setEditingUser(user);
    setIsEditUserDialogOpen(true);
  };

  const handleUserUpdateSuccess = (updatedUser: UserProfile) => {
    setAllUsers(prevUsers => prevUsers.map(u => u.uid === updatedUser.uid ? updatedUser : u));
  };

  // handleOpenReplyDialog and handleTicketReplySuccess removed

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
        fetchAllCoupons(); // Refresh coupon list
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


  if (adminLoading || (adminUserProfile?.isAdmin && (usersLoading || couponsLoading))) { // Removed ticketsLoading
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
          Kullanıcıları, kuponları ve uygulama ayarlarını yönetin. Destek talepleri için <a href="/dashboard/admin/support-tickets" className="text-primary hover:underline">Destek Talepleri Yönetimi</a> sayfasını ziyaret edin.
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TicketPlus className="h-6 w-6" /> Kupon Kodu Yönetimi</CardTitle>
          <CardDescription>Yeni kupon kodları oluşturun ve mevcut kuponları görüntüleyin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold mb-2">Yeni Kupon Oluştur</h3>
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
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Mevcut Kuponlar</h3>
            {couponsLoading ? (
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Kuponlar yükleniyor...</p>
                </div>
            ) : allCoupons.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz oluşturulmuş kupon bulunmamaktadır.</p>
            ) : (
                <ScrollArea className="h-[300px] w-full rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Kod</TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead>Süre</TableHead>
                                <TableHead>Limit</TableHead>
                                <TableHead>Kullanıldı</TableHead>
                                <TableHead>Aktif Mi?</TableHead>
                                <TableHead>Oluşturan</TableHead>
                                <TableHead>Tarih</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allCoupons.map((coupon) => (
                                <TableRow key={coupon.id}>
                                    <TableCell className="font-medium">{coupon.id}</TableCell>
                                    <TableCell>
                                        <Badge variant={coupon.planApplied === 'pro' ? 'default' : 'secondary'} className={coupon.planApplied === 'pro' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}>
                                            {coupon.planApplied.charAt(0).toUpperCase() + coupon.planApplied.slice(1)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{coupon.durationDays} gün</TableCell>
                                    <TableCell>{coupon.usageLimit}</TableCell>
                                    <TableCell>{coupon.timesUsed}</TableCell>
                                    <TableCell>
                                        <Badge variant={coupon.isActive ? 'default' : 'outline'} className={coupon.isActive ? 'bg-green-500 hover:bg-green-600' : ''}>
                                            {coupon.isActive ? "Evet" : "Hayır"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs">{coupon.createdByAdminEmail || coupon.createdByAdminId.substring(0,8)+'...'}</TableCell>
                                    <TableCell className="text-xs">
                                        {coupon.createdAt instanceof FirestoreTimestamp
                                        ? format(coupon.createdAt.toDate(), 'dd/MM/yy HH:mm', { locale: tr })
                                        : 'N/A'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            )}
          </div>
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
            <ScrollArea className="h-[400px] w-full rounded-md border">
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
                            <Users className="mr-2 h-3 w-3"/> Düzenle
                        </Button>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Support Tickets Card Removed */}

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
      {/* ReplyTicketDialog removed */}
    </div>
  );
}
    
