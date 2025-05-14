
"use client";

import { AuthForm } from "@/components/auth/AuthForm";
import { signInWithEmail } from "@/lib/firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (values: any) => {
    try {
      await signInWithEmail(values);
      toast({ title: "Login Successful", description: "Welcome back!" });
      router.push("/dashboard"); // Redirect handled by AuthLayout too, but good for immediate feedback
    } catch (error: any) {
      // Error toast is handled by AuthForm
      console.error("Login failed:", error.message);
      throw error; // Re-throw to be caught by AuthForm
    }
  };

  return (
    <div className="w-full max-w-md">
      <AuthForm mode="login" onSubmit={handleLogin} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
