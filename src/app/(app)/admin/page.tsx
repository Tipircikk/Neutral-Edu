
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldAlert } from "lucide-react";

export default function AdminPage() {
  const { userProfile, loading: userLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!userLoading && !userProfile?.isAdmin) {
      router.replace("/dashboard"); // Redirect to dashboard if not admin
    }
  }, [userProfile, userLoading, router]);

  if (userLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading Admin Panel...</p>
      </div>
    );
  }

  if (!userProfile?.isAdmin) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
        <p className="text-muted-foreground mt-2">You do not have permission to view this page.</p>
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground">
          Manage users and application settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Welcome, Admin!</CardTitle>
          <CardDescription>This is a placeholder for admin functionalities.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Future admin tools will go here, such as:</p>
          <ul className="list-disc list-inside mt-2 text-muted-foreground">
            <li>User management (view users, modify roles/quotas)</li>
            <li>Application statistics</li>
            <li>Content moderation (if applicable)</li>
          </ul>
        </CardContent>
      </Card>
      
      {/* Example: Display user information (for testing) */}
      {userProfile && (
        <Card>
          <CardHeader><CardTitle>Your Admin Profile</CardTitle></CardHeader>
          <CardContent>
            <p><strong>UID:</strong> {userProfile.uid}</p>
            <p><strong>Email:</strong> {userProfile.email}</p>
            <p><strong>Plan:</strong> {userProfile.plan}</p>
            <p><strong>Is Admin:</strong> {userProfile.isAdmin ? 'Yes' : 'No'}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
