
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, Eraser, Download, Trash2, FileImage, FileText, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as pdfjsLib from 'pdfjs-dist';

// Ensure pdfjs worker is configured (ideally from CDN)
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions && pdfjsLib.version) {
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
  { name: "Silgi (Beyaz)", value: "#FFFFFF" },
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
  const [totalPages, setTotalPages] = useState(0);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [inputPageNum, setInputPageNum] = useState("");

  const [backgroundImageSrc, setBackgroundImageSrc] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);

  const getCoordinates = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { offsetX: 0, offsetY: 0 };

    const rect = canvas.getBoundingClientRect();
    if ('touches' in event) { // Touch event
      return {
        offsetX: event.touches[0].clientX - rect.left,
        offsetY: event.touches[0].clientY - rect.top
      };
    } else { // Mouse event
      return {
        offsetX: event.nativeEvent.offsetX,
        offsetY: event.nativeEvent.offsetY
      };
    }
  };

  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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

    if (backgroundImageSrc) {
      renderImageOnCanvas(backgroundImageSrc, false);
    } else if (pdfDoc) {
      renderPdfPage(pdfDoc, currentPageNum, false);
    } else {
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [currentColor, currentBrushSize, pdfDoc, currentPageNum, backgroundImageSrc]);

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

  const startDrawing = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in event) event.preventDefault(); // Prevent scrolling on touch
    const { offsetX, offsetY } = getCoordinates(event);
    contextRef.current?.beginPath();
    contextRef.current?.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const finishDrawing = () => {
    contextRef.current?.closePath();
    setIsDrawing(false);
  };

  const draw = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if ('touches' in event) event.preventDefault();
    const { offsetX, offsetY } = getCoordinates(event);
    contextRef.current?.lineTo(offsetX, offsetY);
    contextRef.current?.stroke();
  };

  const renderPdfPage = useCallback(async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number, clearPreviousAnnotations = true) => {
    if (!canvasRef.current || !contextRef.current) return;
    setIsProcessingPdf(true); 
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 }); 

      const canvas = canvasRef.current;
      const context = contextRef.current;

      const scale = Math.min(CANVAS_WIDTH / viewport.width, CANVAS_HEIGHT / viewport.height);
      const scaledViewport = page.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      
      if(clearPreviousAnnotations) {
        context.clearRect(0, 0, canvas.width, canvas.height); 
      }
      context.fillStyle = "white"; 
      context.fillRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
      };
      await page.render(renderContext).promise;
      setCurrentPageNum(pageNum);
      setInputPageNum(pageNum.toString()); 
    } catch (error) {
        console.error("Error rendering PDF page:", error);
        toast({ title: "PDF Sayfa Hatası", description: "PDF sayfası görüntülenirken bir sorun oluştu.", variant: "destructive" });
    } finally {
        setIsProcessingPdf(false);
    }
  }, [toast]); 

  const renderImageOnCanvas = useCallback((dataUrl: string, clearPreviousAnnotations = true) => {
    if (!canvasRef.current || !contextRef.current) return;
    setIsProcessingImage(true);
    const canvas = canvasRef.current;
    const context = contextRef.current;
    const img = new Image();
    img.onload = () => {
      const hRatio = CANVAS_WIDTH / img.width;
      const vRatio = CANVAS_HEIGHT / img.height;
      const ratio = Math.min(hRatio, vRatio, 1); 
      const scaledWidth = img.width * ratio;
      const scaledHeight = img.height * ratio;

      canvas.width = scaledWidth; 
      canvas.height = scaledHeight;
      
      if(clearPreviousAnnotations){
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
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

    const userConfirmed = window.confirm(
      `${file.type.startsWith("image/") ? "Resim" : "PDF"} dosyası yükleniyor. Bu işlem dosya boyutuna göre biraz zaman alabilir ve mevcut çizimleriniz silinecektir. Devam etmek istiyor musunuz?`
    );

    if (!userConfirmed) {
      event.target.value = ""; 
      return;
    }
    
    setCurrentFileName(file.name);
    setPdfDoc(null);
    setBackgroundImageSrc(null);
    setCurrentPageNum(1);
    setTotalPages(0);
    setInputPageNum("1");

    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (canvas && context) {
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (file.type === "application/pdf") {
      setBackgroundImageSrc(null); 
      setIsProcessingPdf(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadedPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setPdfDoc(loadedPdf);
        setTotalPages(loadedPdf.numPages);
        await renderPdfPage(loadedPdf, 1); 
      } catch (error) {
        console.error("Error loading PDF:", error);
        toast({ title: "PDF Yükleme Hatası", description: "PDF dosyası yüklenirken bir sorun oluştu.", variant: "destructive" });
        setPdfDoc(null);
        setTotalPages(0);
      } 
    } else if (file.type.startsWith("image/")) {
      setPdfDoc(null); 
      setTotalPages(0);
      setIsProcessingImage(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        setBackgroundImageSrc(dataUrl);
        renderImageOnCanvas(dataUrl);
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


  const clearCanvasAndAnnotations = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    if (pdfDoc) {
      renderPdfPage(pdfDoc, currentPageNum, true); 
    } else if (backgroundImageSrc) {
      renderImageOnCanvas(backgroundImageSrc, true);
    } else {
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    toast({ title: "Çizimler Temizlendi", description: "Mevcut sayfadaki çizimler temizlendi." });
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = image;
    const baseFileName = currentFileName ? currentFileName.split('.')[0] : "karalama";
    const pageSuffix = pdfDoc && totalPages > 1 ? `_sayfa_${currentPageNum}` : "";
    link.download = `${baseFileName}${pageSuffix}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "İndirildi", description: "Karalama PNG olarak indirildi." });
  };

  const goToPreviousPage = () => {
    if (pdfDoc && currentPageNum > 1) {
      renderPdfPage(pdfDoc, currentPageNum - 1);
    }
  };

  const goToNextPage = () => {
    if (pdfDoc && currentPageNum < totalPages) {
      renderPdfPage(pdfDoc, currentPageNum + 1);
    }
  };

  const handleGoToPage = () => {
    if (!pdfDoc) return;
    const pageNumber = parseInt(inputPageNum, 10);
    if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > totalPages) {
      toast({
        title: "Geçersiz Sayfa Numarası",
        description: `Lütfen 1 ile ${totalPages} arasında bir sayfa numarası girin.`,
        variant: "destructive",
      });
      setInputPageNum(currentPageNum.toString()); // Reset input to current page
      return;
    }
    renderPdfPage(pdfDoc, pageNumber);
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

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 items-start">
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

            {pdfDoc && totalPages > 0 && (
              <div className="space-y-2 border-t pt-4">
                <Label className="text-sm font-medium">PDF Navigasyonu</Label>
                <div className="flex items-center justify-between gap-2">
                  <Button onClick={goToPreviousPage} disabled={currentPageNum <= 1 || isBusy} variant="outline" size="sm" className="px-2">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Sayfa {currentPageNum} / {totalPages}</span>
                  <Button onClick={goToNextPage} disabled={currentPageNum >= totalPages || isBusy} variant="outline" size="sm" className="px-2">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                    <Input 
                        type="number" 
                        value={inputPageNum}
                        onChange={(e) => setInputPageNum(e.target.value)}
                        min="1"
                        max={totalPages}
                        className="h-9 w-20 text-center"
                        disabled={isBusy}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleGoToPage();}}
                    />
                    <Button onClick={handleGoToPage} size="sm" disabled={isBusy}>Git</Button>
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium">Renk Seçimi</Label>
              <div className="grid grid-cols-4 gap-1 mt-1">
                {colors.map((color) => (
                  <Button
                    key={color.value} 
                    variant={currentColor === color.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentColor(color.value)}
                    style={{ 
                      backgroundColor: currentColor === color.value ? color.value : (color.value === '#FFFFFF' ? '#FFFFFF' : undefined), 
                      color: currentColor === color.value && (color.value === '#FFFFFF' || color.value === '#FFFF00' || color.value === '#ADD8E6' || color.value === '#FFC0CB') ? '#000000' : 
                             currentColor === color.value ? '#FFFFFF' : 
                             (color.value === '#FFFFFF' ? '#AAAAAA' : color.value), // Text color for non-selected outline buttons
                      borderColor: color.value === '#FFFFFF' && currentColor !== color.value ? '#AAAAAA' : 
                                   currentColor === color.value && color.value === '#FFFFFF' ? '#000000' :
                                   color.value,
                      borderWidth: '2px'
                    }}
                    title={color.name}
                    className="h-8 w-full flex items-center justify-center p-0" 
                  >
                    {color.name.startsWith("Silgi") ? <Eraser className="h-4 w-4"/> : 
                     <span className="h-5 w-5 rounded-sm border border-transparent" style={{backgroundColor: color.value }}/>
                    }
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
        <div className="flex justify-center items-start bg-muted/20 p-2 rounded-md shadow-inner" style={{ width: '100%', maxWidth: `${CANVAS_WIDTH + 4}px`, aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}>
             <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseUp={finishDrawing}
                onMouseMove={draw}
                onMouseOut={finishDrawing} 
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={finishDrawing}
                className="cursor-crosshair bg-white border border-input shadow-lg"
                style={{ display: 'block', touchAction: 'none' }} 
            />
        </div>
      </div>
    </div>
  );
}

    