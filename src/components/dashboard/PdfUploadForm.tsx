
"use client";

import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, UploadCloud, FileText } from "lucide-react";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const PdfUploadSchema = z.object({
  pdfFile: z
    .custom<FileList>()
    .refine((files) => files && files.length > 0, "A PDF file is required.")
    .refine(
      (files) => files && files[0]?.type === "application/pdf",
      "Only PDF files are allowed."
    )
    .refine(
      (files) => files && files[0]?.size <= MAX_FILE_SIZE_BYTES,
      `File size must be less than ${MAX_FILE_SIZE_MB}MB.`
    ),
});

type PdfUploadFormValues = z.infer<typeof PdfUploadSchema>;

type PdfUploadFormProps = {
  onSubmit: (file: File) => Promise<void>;
  isSummarizing: boolean;
  isDisabled?: boolean;
};

export default function PdfUploadForm({ onSubmit, isSummarizing, isDisabled = false }: PdfUploadFormProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  
  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<PdfUploadFormValues>({
    resolver: zodResolver(PdfUploadSchema),
  });

  const fileList = watch("pdfFile");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setFileName(files[0].name);
    } else {
      setFileName(null);
    }
  };

  const handleFormSubmit: SubmitHandler<PdfUploadFormValues> = async (data) => {
    if (data.pdfFile && data.pdfFile.length > 0) {
      await onSubmit(data.pdfFile[0]);
      // Optionally reset form or filename after submission
      // reset(); 
      // setFileName(null);
    }
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <UploadCloud className="mr-3 h-7 w-7 text-primary" />
          Upload PDF for Summarization
        </CardTitle>
        <CardDescription>
          Select a PDF document (max {MAX_FILE_SIZE_MB}MB) to generate an AI-powered summary.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pdfFile" className="sr-only">PDF File</Label>
            <div className="flex items-center justify-center w-full">
                <label htmlFor="pdfFile-upload" className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted border-input transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                        <p className="text-xs text-muted-foreground">PDF (MAX. {MAX_FILE_SIZE_MB}MB)</p>
                    </div>
                    <Input 
                      id="pdfFile-upload" 
                      type="file" 
                      className="hidden" 
                      accept=".pdf" 
                      {...register("pdfFile")}
                      onChange={handleFileChange}
                      disabled={isSummarizing || isDisabled}
                    />
                </label>
            </div>
            {fileName && !errors.pdfFile && (
              <div className="mt-2 flex items-center text-sm text-muted-foreground bg-muted p-2 rounded-md">
                <FileText className="h-5 w-5 mr-2 text-primary" />
                Selected: {fileName}
              </div>
            )}
            {errors.pdfFile && <p className="text-sm text-destructive mt-1">{errors.pdfFile.message}</p>}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isSummarizing || isDisabled || !fileList || fileList.length === 0}>
            {isSummarizing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Summarizing...
              </>
            ) : "Summarize PDF"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
