
"use client";

import { AuthForm } from "@/components/auth/AuthForm";
import { signUpWithEmail } from "@/lib/firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleSignup = async (values: any) => {
    try {
      await signUpWithEmail(values);
      toast({ title: "Signup Successful", description: "Welcome to NeutralEdu AI!" });
      router.push("/dashboard"); // Redirect handled by AuthLayout too
    } catch (error: any) {
      // Error toast is handled by AuthForm
      console.error("Signup failed:", error.message);
      throw error; // Re-throw to be caught by AuthForm
    }
  };

  return (
    <div className="w-full max-w-md">
      <AuthForm mode="signup" onSubmit={handleSignup} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
