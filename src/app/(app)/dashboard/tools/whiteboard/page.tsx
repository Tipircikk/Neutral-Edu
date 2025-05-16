
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, Eraser, Download, Trash2, FileImage, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as pdfjsLib from 'pdfjs-dist';

// Ensure pdfjs worker is configured (ideally from CDN)
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  const pdfJsVersion = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfJsVersion}/pdf.worker.min.mjs`;
}

const colors = [
  { name: "Siyah", value: "#000000" },
  { name: "Kırmızı", value: "#FF0000" },
  { name: "Mavi", value: "#0000FF" },
  { name: "Yeşil", value: "#008000" },
  { name: "Sarı", value: "#FFFF00" },
  { name: "Turuncu", value: "#FFA500" },
  { name: "Mor", value: "#800080" },
  { name: "Pembe", value: "#FFC0CB" },
  { name: "Kahverengi", value: "#A52A2A" },
  { name: "Açık Mavi", value: "#ADD8E6" },
  { name: "Gri", value: "#808080" },
  { name: "Silgi (Beyaz)", value: "#FFFFFF" }, // Eraser is white
];

const brushSizes = [
  { name: "İnce", value: 2 },
  { name: "Orta", value: 5 },
  { name: "Kalın", value: 10 },
];

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export default function WhiteboardPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState(colors[0].value);
  const [currentBrushSize, setCurrentBrushSize] = useState(brushSizes[1].value);
  const { toast } = useToast();

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);

  const [backgroundImageSrc, setBackgroundImageSrc] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);


  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Set initial canvas size for drawing without background
    if (!pdfDoc && !backgroundImageSrc) {
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
    }
    
    const context = canvas.getContext("2d");
    if (!context) return;
    context.lineCap = "round";
    context.strokeStyle = currentColor;
    context.lineWidth = currentBrushSize;
    contextRef.current = context;

    // Draw initial white background or current background
    if (backgroundImageSrc) {
      renderImageOnCanvas(backgroundImageSrc, false); // false to not clear annotations
    } else if (pdfDoc) {
      renderPdfPage(pdfDoc, currentPageNum, false); // false to not clear annotations
    } else {
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [currentColor, currentBrushSize, pdfDoc, currentPageNum, backgroundImageSrc]); // Dependencies for re-initialization

  useEffect(() => {
    initializeCanvas();
  }, [initializeCanvas]);


  useEffect(() => {
    const context = contextRef.current;
    if (context) {
      context.strokeStyle = currentColor;
      context.lineWidth = currentBrushSize;
    }
  }, [currentColor, currentBrushSize]);

  const startDrawing = ({ nativeEvent }: React.MouseEvent<HTMLCanvasElement>) => {
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current?.beginPath();
    contextRef.current?.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const finishDrawing = () => {
    contextRef.current?.closePath();
    setIsDrawing(false);
  };

  const draw = ({ nativeEvent }: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current?.lineTo(offsetX, offsetY);
    contextRef.current?.stroke();
  };

  const renderPdfPage = useCallback(async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number, clearPreviousAnnotations = true) => {
    if (!canvasRef.current || !contextRef.current) return;
    setIsProcessingPdf(true);
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 }); // Start with scale 1 to get original dimensions

    const canvas = canvasRef.current;
    const context = contextRef.current;

    const scale = Math.min(CANVAS_WIDTH / viewport.width, CANVAS_HEIGHT / viewport.height);
    const scaledViewport = page.getViewport({ scale });

    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    
    // Clear canvas (either to white or transparent, then draw PDF)
    context.clearRect(0, 0, canvas.width, canvas.height); // Clear to transparent first
    context.fillStyle = "white"; // PDF pages are usually on white
    context.fillRect(0, 0, canvas.width, canvas.height);


    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport,
    };
    await page.render(renderContext).promise;
    setCurrentPageNum(pageNum);
    setIsProcessingPdf(false);
  }, []);

  const renderImageOnCanvas = useCallback((dataUrl: string, clearPreviousAnnotations = true) => {
    if (!canvasRef.current || !contextRef.current) return;
    setIsProcessingImage(true);
    const canvas = canvasRef.current;
    const context = contextRef.current;
    const img = new Image();
    img.onload = () => {
      const hRatio = CANVAS_WIDTH / img.width;
      const vRatio = CANVAS_HEIGHT / img.height;
      const ratio = Math.min(hRatio, vRatio);
      const scaledWidth = img.width * ratio;
      const scaledHeight = img.height * ratio;

      canvas.width = scaledWidth; 
      canvas.height = scaledHeight;
      
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0, scaledWidth, scaledHeight);
      setIsProcessingImage(false);
    };
    img.onerror = () => {
        toast({ title: "Resim Çizme Hatası", description: "Resim tuvale çizilemedi.", variant: "destructive" });
        setIsProcessingImage(false);
    }
    img.src = dataUrl;
  }, [toast]);


  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCurrentFileName(file.name);
    setPdfDoc(null); // Clear previous PDF if any
    setBackgroundImageSrc(null); // Clear previous image if any

    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (canvas && context) { // Reset canvas to default state before loading new content
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
    }


    if (file.type === "application/pdf") {
      setIsProcessingPdf(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadedPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setPdfDoc(loadedPdf); // Set PDF doc first
        await renderPdfPage(loadedPdf, 1, true); // Then render
      } catch (error) {
        console.error("Error loading PDF:", error);
        toast({ title: "PDF Yükleme Hatası", description: "PDF dosyası yüklenirken bir sorun oluştu.", variant: "destructive" });
        setPdfDoc(null);
      } finally {
        setIsProcessingPdf(false);
      }
    } else if (file.type.startsWith("image/")) {
      setIsProcessingImage(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        setBackgroundImageSrc(dataUrl); // Set image src first
        renderImageOnCanvas(dataUrl, true); // Then render
      };
      reader.onerror = () => {
          console.error("Error reading image file:", reader.error);
          toast({ title: "Dosya Okuma Hatası", description: "Resim dosyası okunurken bir sorun oluştu.", variant: "destructive" });
          setIsProcessingImage(false);
          setBackgroundImageSrc(null);
      };
      reader.readAsDataURL(file);
    } else {
      toast({ title: "Geçersiz Dosya Türü", description: "Lütfen bir PDF veya resim dosyası (PNG, JPG, GIF, WebP) yükleyin.", variant: "destructive" });
    }
     event.target.value = ""; 
  };


  const clearCanvasAndAnnotations = () => { // Renamed for clarity
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    if (pdfDoc) {
      renderPdfPage(pdfDoc, currentPageNum, true); // true to also clear annotations
    } else if (backgroundImageSrc) {
      renderImageOnCanvas(backgroundImageSrc, true); // true to also clear annotations
    } else {
      // No background, just clear to white
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    toast({ title: "Tuval Temizlendi", description: "Tüm çizimler temizlendi." });
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = image;
    link.download = currentFileName ? `${currentFileName.split('.')[0]}_karalama.png` : "karalama.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "İndirildi", description: "Karalama PNG olarak indirildi." });
  };
  
  const isBusy = isProcessingPdf || isProcessingImage;

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Palette className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl">Dijital Karalama Tahtası</CardTitle>
          </div>
          <CardDescription>
            Serbestçe çizin, not alın veya bir PDF/Resim yükleyip üzerine işaretlemeler yapın.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
        {/* Controls Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kontroller</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="fileUpload" className="text-sm font-medium">Dosya Yükle (PDF/Resim)</Label>
              <Input
                id="fileUpload"
                type="file"
                className="mt-1"
                accept="application/pdf,image/png,image/jpeg,image/gif,image/webp"
                onChange={handleFileChange}
                disabled={isBusy}
              />
              {isBusy && (
                <div className="flex items-center mt-2 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isProcessingPdf ? "PDF işleniyor..." : "Resim işleniyor..."}
                </div>
              )}
              {currentFileName && !isBusy && (
                <div className="mt-2 text-xs text-muted-foreground">Yüklü: {currentFileName}</div>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium">Renk Seçimi</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {colors.map((color) => (
                  <Button
                    key={color.name}
                    variant={currentColor === color.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentColor(color.value)}
                    style={{ 
                      backgroundColor: currentColor === color.value ? color.value : undefined, 
                      color: currentColor === color.value && (color.value === '#FFFFFF' || color.value === '#FFFF00' || color.value === '#ADD8E6' || color.value === '#FFC0CB') ? '#000000' : 
                             currentColor === color.value ? '#FFFFFF' : undefined,
                      borderColor: color.value === '#FFFFFF' && currentColor !== color.value ? '#000000' : undefined // Make white button border visible
                    }}
                    title={color.name}
                    className="h-8 w-full flex items-center justify-center"
                  >
                    {color.name.startsWith("Silgi") ? <Eraser className="h-4 w-4"/> : <span className="h-4 w-4 rounded-full border" style={{backgroundColor: color.value }}/>}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Fırça Kalınlığı</Label>
              <div className="flex space-x-2 mt-1">
                {brushSizes.map((size) => (
                  <Button
                    key={size.name}
                    variant={currentBrushSize === size.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentBrushSize(size.value)}
                    className="flex-1"
                    disabled={isBusy}
                  >
                    {size.name}
                  </Button>
                ))}
              </div>
            </div>

            <Button onClick={clearCanvasAndAnnotations} variant="destructive" className="w-full" disabled={isBusy}>
              <Trash2 className="mr-2 h-4 w-4" />
              Çizimleri Temizle
            </Button>
            <Button onClick={downloadImage} className="w-full" disabled={isBusy}>
              <Download className="mr-2 h-4 w-4" />
              Resim Olarak İndir
            </Button>
          </CardContent>
        </Card>

        {/* Canvas Area */}
        <Card className="overflow-hidden flex justify-center items-center bg-muted/20 p-2">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseUp={finishDrawing}
            onMouseMove={draw}
            onMouseOut={finishDrawing} 
            className="cursor-crosshair bg-white border border-input shadow-lg"
            // Style is managed by canvas width/height attributes for intrinsic sizing
          />
        </Card>
      </div>
    </div>
  );
}

    