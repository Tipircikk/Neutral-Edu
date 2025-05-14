
"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation"; // Added usePathname
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/hooks/useUser"; // Added useUser
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
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card"; // Added this import
import { BookOpenText, Home, Wand2, FileScan, HelpCircle, FileTextIcon, Lightbulb, ShieldCheck, Settings, LogOut, Star, Gem, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import QuotaDisplay from "@/components/dashboard/QuotaDisplay";
import { getDefaultQuota } from "@/lib/firebase/firestore";
import { signOut } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import Footer from "@/components/layout/Footer"; // Re-added for nested layout consistency

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { userProfile, loading: userProfileLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/landing");
    }
  }, [user, authLoading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const getInitials = (email?: string | null) => {
    if (!email) return "U";
    return email.substring(0, 2).toUpperCase();
  };
  
  const totalQuota = userProfile ? getDefaultQuota(userProfile.plan) : 0;

  // Loading state for the entire layout
  if (authLoading || userProfileLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const isAiToolsPath = pathname.startsWith('/dashboard/ai-tools');


  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 md:justify-end">
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
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(user.email)}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <div className="flex flex-1">
          <Sidebar collapsible="icon" className="border-r">
            <SidebarHeader className="p-4">
              <Link href="/dashboard" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
                <BookOpenText className="h-7 w-7 text-primary" />
                <span className="text-xl font-semibold text-foreground group-data-[collapsible=icon]:hidden">NeutralEdu AI</span>
              </Link>
            </SidebarHeader>
            <SidebarContent className="p-2">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/dashboard"} tooltip="Ana Sayfa">
                    <Link href="/dashboard"><Home /><span>Ana Sayfa</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton className="justify-between" isActive={isAiToolsPath} isSubmenu tooltip="Yapay Zeka Araçları">
                    <div className="flex items-center gap-2"><Wand2 /> <span>Yapay Zeka Araçları</span></div>
                    <ChevronDown className="size-4 submenu-arrow group-data-[state=open]:hidden" />
                    <ChevronUp className="size-4 submenu-arrow group-data-[state=open]:!block hidden" />
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === "/dashboard/ai-tools/pdf-summarizer"}>
                        <Link href="/dashboard/ai-tools/pdf-summarizer"><FileScan /><span>AI PDF Özetleyici</span></Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === "/dashboard/ai-tools/question-solver"}>
                        <Link href="/dashboard/ai-tools/question-solver"><HelpCircle /><span>AI Soru Çözücü</span></Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                     <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === "/dashboard/ai-tools/test-generator"}>
                        <Link href="/dashboard/ai-tools/test-generator"><FileTextIcon /><span>AI Test Oluşturucu</span></Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === "/dashboard/ai-tools/topic-summarizer"}>
                        <Link href="/dashboard/ai-tools/topic-summarizer"><Lightbulb /><span>AI Konu Özetleyici</span></Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>

                {userProfile?.isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname.startsWith("/dashboard/admin")} tooltip="Admin Paneli">
                      <Link href="/dashboard/admin"><ShieldCheck /><span>Admin Paneli</span></Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="p-2 mt-auto">
               {userProfile?.plan !== 'premium' && (
                <Card className="bg-gradient-to-br from-primary/20 to-accent/20 border-primary/50 my-2 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:border-none">
                  <CardContent className="p-4 group-data-[collapsible=icon]:p-0">
                    <div className="flex flex-col items-center text-center group-data-[collapsible=icon]:hidden">
                      <Gem className="h-8 w-8 text-primary mb-2" />
                      <p className="font-semibold text-foreground">Premium'a Yükselt!</p>
                      <p className="text-xs text-muted-foreground mb-3">Sınırsız özelliklerin kilidini açın.</p>
                      <Button size="sm" className="w-full" asChild>
                        <Link href="/pricing">Şimdi Yükselt</Link>
                      </Button>
                    </div>
                     <div className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                       <SidebarMenuButton asChild tooltip="Premium'a Yükselt" className="bg-primary/80 hover:bg-primary text-primary-foreground hover:text-primary-foreground">
                          <Link href="/pricing"><Star/></Link>
                       </SidebarMenuButton>
                    </div>
                  </CardContent>
                </Card>
               )}
              <SidebarMenu>
                {/* <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/dashboard/settings"} tooltip="Ayarlar">
                    <Link href="#"><Settings /><span>Ayarlar</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem> */}
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={handleSignOut} tooltip="Çıkış Yap">
                    <LogOut /><span>Çıkış Yap</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset className="flex-1 overflow-y-auto">
            <main className="container mx-auto px-4 py-8">
              {children}
            </main>
            <Footer appName="NeutralEdu AI" />
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
