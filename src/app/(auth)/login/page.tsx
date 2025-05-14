
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
      toast({ title: "Giriş Başarılı", description: "Tekrar hoş geldiniz!" });
      router.push("/dashboard"); 
    } catch (error: any) {
      // Hata mesajı AuthForm tarafından yönetilir
      console.error("Giriş başarısız:", error.message);
      throw error; // AuthForm'un yakalaması için hatayı tekrar fırlat
    }
  };

  return (
    <div className="w-full max-w-md">
      <AuthForm mode="login" onSubmit={handleLogin} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Hesabınız yok mu?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Kayıt Olun
        </Link>
      </p>
    </div>
  );
}
