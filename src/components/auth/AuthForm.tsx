
"use client";

import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";

const LoginSchema = z.object({
  email: z.string().email({ message: "Geçersiz e-posta adresi." }),
  password: z.string().min(6, { message: "Şifre en az 6 karakter olmalıdır." }),
});

const SignupSchema = z.object({
  email: z.string().email({ message: "Geçersiz e-posta adresi." }),
  password: z.string().min(6, { message: "Şifre en az 6 karakter olmalıdır." }),
  confirmPassword: z.string().min(6, { message: "Şifre en az 6 karakter olmalıdır." }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Şifreler eşleşmiyor.",
  path: ["confirmPassword"],
});


type AuthFormProps = {
  mode: "login" | "signup";
  onSubmit: (values: any) => Promise<void>; // Accepts zod schema values
};

export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const currentSchema = mode === "login" ? LoginSchema : SignupSchema;
  type FormValues = z.infer<typeof currentSchema>;

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(currentSchema),
  });

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword(!showConfirmPassword);

  const handleFormSubmit: SubmitHandler<FormValues> = async (data) => {
    setIsLoading(true);
    try {
      await onSubmit(data);
      // Success toast/redirect handled by page using the form
    } catch (error: any) {
      toast({
        title: "Kimlik Doğrulama Hatası",
        description: error.message || (mode === "login" ? "Giriş yapılamadı." : "Kayıt olunamadı."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-2xl">
      <CardHeader>
        <CardTitle className="text-3xl">{mode === "login" ? "Tekrar Hoş Geldiniz" : "Hesap Oluştur"}</CardTitle>
        <CardDescription>
          {mode === "login" ? "Kontrol panelinize erişmek için giriş yapın." : "Özetlemeye başlamak için kaydolun."}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" type="email" placeholder="ornek@eposta.com" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2 relative">
            <Label htmlFor="password">Şifre</Label>
            <Input 
              id="password" 
              type={showPassword ? "text" : "password"} 
              placeholder="••••••••" 
              {...register("password")} 
              className="pr-10"
            />
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              className="absolute right-1 top-7 h-7 w-7 px-0" 
              onClick={togglePasswordVisibility}
              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          {mode === "signup" && (
            <div className="space-y-2 relative">
              <Label htmlFor="confirmPassword">Şifreyi Onayla</Label>
              <Input 
                id="confirmPassword" 
                type={showConfirmPassword ? "text" : "password"} 
                placeholder="••••••••" 
                {...register("confirmPassword" as any)} 
                className="pr-10"
              />
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="absolute right-1 top-7 h-7 w-7 px-0" 
                onClick={toggleConfirmPasswordVisibility}
                aria-label={showConfirmPassword ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (mode === "login" ? "Giriş Yap" : "Kayıt Ol")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
