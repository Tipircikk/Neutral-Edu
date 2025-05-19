
"use client";

// ... (diğer importlar aynı kalacak)
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/hooks/useUser";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card"; // Ensure Card is imported
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Home, Wand2, FileScan, HelpCircle, FileTextIcon, Lightbulb, ShieldCheck, LogOut, Gem, Loader2, ChevronDown, ChevronUp, LifeBuoy, LayoutGrid, ClipboardCheck, CreditCard, Bell, CalendarDays, Presentation, Timer, CalendarClock, ListChecks, Palette, Youtube, Brain, MessageSquareQuestion } from "lucide-react";
import Link from "next/link";
import QuotaDisplay from "@/components/dashboard/QuotaDisplay";
import { getDefaultQuota } from "@/lib/firebase/firestore";
import { signOut as firebaseSignOut } from "@/hooks/useAuth"; // Renamed to avoid conflict
import Footer from "@/components/layout/Footer";
import { SidebarInset } from "@/components/ui/sidebar";
import { ThemeToggleSidebar } from "@/components/layout/ThemeToggle";


export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { userProfile, loading: userProfileLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [isAiToolsSubmenuOpen, setIsAiToolsSubmenuOpen] = useState(false);
  const [isHelperToolsSubmenuOpen, setIsHelperToolsSubmenuOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/landing");
    }
  }, [user, authLoading, router]);

  const aiToolPaths = [
    "/dashboard/ai-tools/pdf-summarizer",
    "/dashboard/ai-tools/topic-summarizer",
    "/dashboard/ai-tools/topic-explainer",
    "/dashboard/ai-tools/flashcard-generator",
    "/dashboard/ai-tools/question-solver",
    "/dashboard/ai-tools/test-generator",
    "/dashboard/ai-tools/exam-report-analyzer",
    "/dashboard/ai-tools/study-plan-generator",
    "/dashboard/ai-tools/video-summarizer",
  ];

  const helperToolPaths = [
    "/dashboard/tools/pomodoro",
    "/dashboard/tools/countdown",
    "/dashboard/tools/goal-tracker",
    // "/dashboard/tools/whiteboard", // Karalama tahtası kaldırılmıştı
  ];

  useEffect(() => {
    if (aiToolPaths.some(path => pathname.startsWith(path))) {
      setIsAiToolsSubmenuOpen(true);
    } else {
      // Alt menüyü kapatmak için bu koşul eklenebilir, ancak isteğe bağlıdır.
      // Mevcut davranış, bir kez açıldıktan sonra manuel olarak kapatılana kadar açık kalmasıdır.
      // Eğer farklı bir sayfaya gidildiğinde kapanmasını isterseniz buraya setIsAiToolsSubmenuOpen(false); eklenebilir.
    }

    if (helperToolPaths.some(path => pathname.startsWith(path))) {
      setIsHelperToolsSubmenuOpen(true);
    } else {
      // Benzer şekilde yardımcı araçlar için de kapanma mantığı eklenebilir.
    }
  }, [pathname]);


  const handleSignOut = async () => {
    await firebaseSignOut();
    router.push("/");
  };

  const getInitials = (email?: string | null) => {
    if (!email) return "U";
    return email.substring(0, 2).toUpperCase();
  };

  const totalQuota = userProfile ? getDefaultQuota(userProfile.plan) : 0;

  if (authLoading || userProfileLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  const isAiToolsPathActive = aiToolPaths.some(path => pathname.startsWith(path));
  const isHelperToolsPathActive = helperToolPaths.some(path => pathname.startsWith(path));
  const isSupportPath = pathname === "/dashboard/support";
  const isSubscriptionPath = pathname === "/dashboard/subscription";
  const isAdminPath = pathname.startsWith("/dashboard/admin");

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/80 backdrop-blur-sm px-4 md:px-6 md:justify-end">
          <div className="md:hidden">
            <SidebarTrigger />
          </div>
          <div className="flex items-center gap-4">
            {userProfile && (
              <QuotaDisplay
                remaining={userProfile.dailyRemainingQuota}
                total={totalQuota}
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" title="Bildirimler">
                    <Bell className="h-5 w-5" />
                    {/* İleride bildirim sayısı için bir badge eklenebilir */}
                    {/* <span className="absolute top-0 right-0 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                    </span> */}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Bildirimler</DropdownMenuLabel>
                <div className="p-2 text-sm text-muted-foreground text-center">
                  Henüz yeni bildiriminiz yok.
                </div>
                {/* <DropdownMenuSeparator />
                <DropdownMenuItem>Örnek Bildirim 1</DropdownMenuItem>
                <DropdownMenuItem>Örnek Bildirim 2</DropdownMenuItem> */}
              </DropdownMenuContent>
            </DropdownMenu>
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(user.email)}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <div className="flex flex-1">
          <Sidebar collapsible="icon" className="border-r bg-sidebar text-sidebar-foreground">
            <SidebarHeader className="p-4 mb-2">
              <Link href="/dashboard" className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
                <Brain className="h-8 w-8 text-primary" />
                <span className="text-xl font-bold text-foreground group-data-[collapsible=icon]:hidden">NeutralEdu AI</span>
              </Link>
            </SidebarHeader>
            <SidebarContent className="p-2">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/dashboard"} tooltip="Ana Sayfa"
                    className="hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                  >
                    <Link href="/dashboard"><Home /><span>Ana Sayfa</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="justify-between hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                    isActive={isAiToolsPathActive}
                    onClick={() => setIsAiToolsSubmenuOpen(!isAiToolsSubmenuOpen)}
                    data-state={isAiToolsSubmenuOpen ? "open" : "closed"}
                    tooltip="Yapay Zeka Araçları"
                  >
                    <div className="flex items-center gap-2"><Wand2 /> <span>Yapay Zeka Araçları</span></div>
                    {isAiToolsSubmenuOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </SidebarMenuButton>
                  {isAiToolsSubmenuOpen && (
                    <SidebarMenuSub>
                      {/* Özetleme ve Anlama Araçları */}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === "/dashboard/ai-tools/pdf-summarizer"} className="hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                          <Link href="/dashboard/ai-tools/pdf-summarizer"><FileScan /><span>AI PDF Anlatıcısı</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === "/dashboard/ai-tools/topic-summarizer"} className="hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                          <Link href="/dashboard/ai-tools/topic-summarizer"><Lightbulb /><span>AI Konu Özetleyici</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                       <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === "/dashboard/ai-tools/topic-explainer"} className="hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                          <Link href="/dashboard/ai-tools/topic-explainer"><Presentation /><span>AI Konu Anlatımı</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === "/dashboard/ai-tools/flashcard-generator"} className="hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                          <Link href="/dashboard/ai-tools/flashcard-generator"><LayoutGrid /><span>AI Bilgi Kartları</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === "/dashboard/ai-tools/video-summarizer"} className="hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                          <Link href="/dashboard/ai-tools/video-summarizer"><Youtube /><span>AI Video Özetleyici</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>

                      {/* Soru ve Test Araçları */}
                       <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === "/dashboard/ai-tools/question-solver"} className="hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                          <Link href="/dashboard/ai-tools/question-solver"><HelpCircle /><span>AI Soru Çözücü</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === "/dashboard/ai-tools/test-generator"} className="hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                          <Link href="/dashboard/ai-tools/test-generator"><FileTextIcon /><span>AI Test Oluşturucu</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>

                      {/* Analiz ve Planlama Araçları */}
                       <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === "/dashboard/ai-tools/exam-report-analyzer"} className="hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                          <Link href="/dashboard/ai-tools/exam-report-analyzer"><ClipboardCheck /><span>AI Sınav Analizcisi</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === "/dashboard/ai-tools/study-plan-generator"} className="hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                          <Link href="/dashboard/ai-tools/study-plan-generator"><CalendarDays /><span>AI Çalışma Planı</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="justify-between hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                    isActive={isHelperToolsPathActive}
                    onClick={() => setIsHelperToolsSubmenuOpen(!isHelperToolsSubmenuOpen)}
                    data-state={isHelperToolsSubmenuOpen ? "open" : "closed"}
                    tooltip="Yardımcı Araçlar"
                  >
                    <div className="flex items-center gap-2"><Timer /> <span>Yardımcı Araçlar</span></div>
                    {isHelperToolsSubmenuOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </SidebarMenuButton>
                  {isHelperToolsSubmenuOpen && (
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === "/dashboard/tools/pomodoro"} className="hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                          <Link href="/dashboard/tools/pomodoro"><Timer /><span>Pomodoro Zamanlayıcı</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                       <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === "/dashboard/tools/countdown"} className="hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                          <Link href="/dashboard/tools/countdown"><CalendarClock /><span>YKS Geri Sayım</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === "/dashboard/tools/goal-tracker"} className="hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                          <Link href="/dashboard/tools/goal-tracker"><ListChecks /><span>Hedef Takipçisi</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      {/* Karalama tahtası kaldırıldığı için burası yorum satırı
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === "/dashboard/tools/whiteboard"}>
                          <Link href="/dashboard/tools/whiteboard"><Palette /><span>Dijital Karalama Tahtası</span></Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      */}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isSubscriptionPath} tooltip="Aboneliğim" className="hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                    <Link href="/dashboard/subscription"><CreditCard /><span>Aboneliğim</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isSupportPath} tooltip="Destek Talebi" className="hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                    <Link href="/dashboard/support"><LifeBuoy /><span>Destek Talebi</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {userProfile?.isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isAdminPath} tooltip="Admin Paneli" className="hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                      <Link href="/dashboard/admin"><ShieldCheck /><span>Admin Paneli</span></Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="p-2 mt-auto space-y-2">
               {(userProfile?.plan !== 'premium' && userProfile?.plan !== 'pro') && (
                <Card className="bg-gradient-to-br from-primary/20 to-accent/20 border-primary/50 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:border-none">
                  <CardContent className="p-3 group-data-[collapsible=icon]:p-0">
                    <div className="flex flex-col items-center text-center group-data-[collapsible=icon]:hidden">
                      <Gem className="h-7 w-7 text-primary mb-1.5" />
                      <p className="font-semibold text-foreground text-sm">Pro'ya Yükselt!</p>
                      <p className="text-xs text-muted-foreground mb-2.5 px-1">Daha fazla özellik ve kota için.</p>
                      <Button size="sm" className="w-full text-xs" asChild>
                        <Link href="/pricing">Planları Gör</Link>
                      </Button>
                    </div>
                     <div className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                       <SidebarMenuButton asChild tooltip="Pro'ya Yükselt" className="bg-primary/80 hover:bg-primary text-primary-foreground hover:text-primary-foreground">
                          <Link href="/pricing"><Gem/></Link>
                       </SidebarMenuButton>
                    </div>
                  </CardContent>
                </Card>
               )}
              {/* AD_PLACEHOLDER_SIDEBAR: Gelecekteki reklam entegrasyonu için bir yer */}
              {userProfile?.plan === 'free' && (
                <div className="p-2 group-data-[collapsible=icon]:hidden text-center">
                  {/* Reklam Kodu Buraya Gelecek (örneğin, AdSense) */}
                  <div style={{width: '100%', height: '100px', background: '#333', color: '#777', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius)', fontSize: '0.8rem'}}>
                    Reklam Alanı (120x100)
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Daha iyi bir deneyim için Pro'ya geçin.</p>
                </div>
              )}
              <SidebarMenu className="border-t border-border/20 pt-2">
                <SidebarMenuItem>
                    <ThemeToggleSidebar />
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={handleSignOut} tooltip="Çıkış Yap" className="hover:bg-destructive/20 hover:text-destructive data-[active=true]:bg-destructive/20 data-[active=true]:text-destructive">
                    <LogOut /><span>Çıkış Yap</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset className="flex-1 overflow-y-auto bg-background">
            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              {/* AD_PLACEHOLDER_MAIN_CONTENT_TOP: Gelecekteki reklam entegrasyonu için bir yer */}
              {userProfile?.plan === 'free' && (
                <div className="mb-6 p-3 text-center bg-muted/50 border border-dashed rounded-md">
                   {/* Reklam Kodu Buraya Gelecek (örneğin, AdSense) */}
                   <div style={{width: '100%', minHeight: '90px', background: '#333', color: '#777', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius)', fontSize: '0.9rem'}}>
                    Reklam Alanı (Banner)
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Reklamsız bir deneyim ve daha fazla özellik için <Link href="/pricing" className="underline text-primary">Premium veya Pro'ya</Link> geçin!
                  </p>
                </div>
              )}
              {children}
            </main>
            <Footer appName="NeutralEdu AI" />
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}

    