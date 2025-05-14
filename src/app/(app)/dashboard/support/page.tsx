
"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Send, LifeBuoy, CheckCircle } from "lucide-react"; // Changed MessageSquareQuestion to LifeBuoy
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase/config";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import type { SupportTicketSubject, SupportTicketStatus } from "@/types";

const supportTicketSchema = z.object({
  subject: z.enum(["premium", "ai_tools", "account", "bug_report", "other"], {
    required_error: "Lütfen bir konu seçin.",
  }),
  message: z.string().min(20, { message: "Mesajınız en az 20 karakter olmalıdır." }).max(2000, { message: "Mesajınız en fazla 2000 karakter olabilir." }),
});

type SupportTicketFormValues = z.infer<typeof supportTicketSchema>;

export default function SupportPage() {
  const { userProfile, loading: userLoading } = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  const { register, handleSubmit, control, formState: { errors }, reset } = useForm<SupportTicketFormValues>({
    resolver: zodResolver(supportTicketSchema),
    defaultValues: {
      subject: undefined, // Ensures placeholder is shown
      message: "",
    },
  });

  const onSubmit: SubmitHandler<SupportTicketFormValues> = async (data) => {
    if (!userProfile) {
      toast({ title: "Hata", description: "Destek talebi göndermek için giriş yapmalısınız.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    setSubmissionSuccess(false);
    try {
      await addDoc(collection(db, "supportTickets"), {
        userId: userProfile.uid,
        userEmail: userProfile.email,
        userName: userProfile.displayName,
        subject: data.subject as SupportTicketSubject,
        message: data.message,
        status: "open" as SupportTicketStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Talep Gönderildi", description: "Destek talebiniz başarıyla alındı. En kısa sürede size dönüş yapacağız." });
      setSubmissionSuccess(true);
      reset(); // Reset form after successful submission
    } catch (error) {
      console.error("Error submitting support ticket:", error);
      toast({ title: "Gönderim Hatası", description: "Destek talebiniz gönderilirken bir hata oluştu. Lütfen tekrar deneyin.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (userLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Destek Sayfası Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <LifeBuoy className="h-8 w-8 text-primary" /> {/* Changed MessageSquareQuestion to LifeBuoy */}
            <CardTitle className="text-3xl">Destek Talebi Oluştur</CardTitle>
          </div>
          <CardDescription>
            NeutralEdu AI ile ilgili soru, sorun veya geri bildirimleriniz için bize ulaşın.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submissionSuccess ? (
            <Alert variant="default" className="bg-green-100 dark:bg-green-900/30 border-green-500">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <AlertTitle className="text-green-700 dark:text-green-300">Talebiniz Başarıyla Gönderildi!</AlertTitle>
              <AlertDescription className="text-green-600 dark:text-green-400">
                Destek ekibimiz talebinizi aldı ve en kısa sürede inceleyecektir. Yanıtlar genellikle e-posta adresinize gönderilir.
                <Button variant="link" onClick={() => setSubmissionSuccess(false)} className="mt-2 p-0 h-auto text-primary">Yeni bir talep oluştur</Button>
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <Label htmlFor="subject" className="mb-1 block">Konu</Label>
                 <Select
                    onValueChange={(value) => control._fields.subject!.onChange(value)}
                    // defaultValue={control._defaultValues.subject} // Removed to let placeholder work consistently
                    disabled={isSubmitting}
                  >
                  <SelectTrigger id="subject" className="w-full">
                    <SelectValue placeholder="Bir konu seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="premium">Premium Üyelik Hakkında</SelectItem>
                    <SelectItem value="ai_tools">Yapay Zeka Araçları Hakkında</SelectItem>
                    <SelectItem value="account">Hesap Sorunları</SelectItem>
                    <SelectItem value="bug_report">Hata Bildirimi</SelectItem>
                    <SelectItem value="other">Diğer</SelectItem>
                  </SelectContent>
                </Select>
                {errors.subject && <p className="text-sm text-destructive mt-1">{errors.subject.message}</p>}
              </div>

              <div>
                <Label htmlFor="message" className="mb-1 block">Mesajınız</Label>
                <Textarea
                  id="message"
                  placeholder="Lütfen sorununuzu veya geri bildiriminizi detaylı bir şekilde açıklayın..."
                  rows={8}
                  {...register("message")}
                  className={errors.message ? "border-destructive" : ""}
                  disabled={isSubmitting}
                />
                {errors.message && <p className="text-sm text-destructive mt-1">{errors.message.message}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Destek Talebi Gönder
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
