
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
      toast({ title: "Kayıt Başarılı", description: "NeutralEdu AI'a hoş geldiniz!" });
      router.push("/dashboard"); 
    } catch (error: any) {
      // Hata mesajı AuthForm tarafından yönetilir
      console.error("Kayıt başarısız:", error.message);
      throw error; // AuthForm'un yakalaması için hatayı tekrar fırlat
    }
  };

  return (
    <div className="w-full max-w-md">
      <AuthForm mode="signup" onSubmit={handleSignup} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Zaten bir hesabınız var mı?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Giriş Yapın
        </Link>
      </p>
    </div>
  );
}
