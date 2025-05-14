
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText, LogOut, UserCircle, Settings, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth, signOut } from "@/hooks/useAuth";
import { useUser } from "@/hooks/useUser";
import QuotaDisplay from "@/components/dashboard/QuotaDisplay";
import { getDefaultQuota } from "@/lib/firebase/firestore"; // Import getDefaultQuota

export default function AppHeader() {
  const { user } = useAuth();
  const { userProfile, loading: userProfileLoading } = useUser();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/"); // Redirect to main landing page
  };

  const getInitials = (email?: string | null) => {
    if (!email) return "U";
    return email.substring(0, 2).toUpperCase();
  };

  const totalQuota = userProfile ? getDefaultQuota(userProfile.plan) : 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <BookOpenText className="h-7 w-7 text-primary" />
          <span className="text-xl font-semibold text-foreground">NeutralEdu AI</span>
        </Link>
        <div className="flex items-center gap-4">
          {userProfileLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : userProfile ? (
            <QuotaDisplay 
              remaining={userProfile.dailyRemainingQuota} 
              total={totalQuota} 
            />
          ) : null}
          
          {userProfile?.isAdmin && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Admin Paneli
              </Link>
            </Button>
          )}

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    {/* <AvatarImage src={user.photoURL || ""} alt={user.displayName || "User"} /> */}
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(user.email)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {userProfile?.displayName || user.email}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Ayarlar</span>
                </DropdownMenuItem> */}
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Çıkış Yap</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
