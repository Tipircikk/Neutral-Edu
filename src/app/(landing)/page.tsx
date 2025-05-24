
"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Presentation, HelpCircle, FileTextIcon, LayoutGrid, CalendarDays, Wand2, FileUp, BotMessageSquare, BookOpenCheck, ArrowRight, Zap, Clock, Brain, ThumbsUp, Users, ShieldCheck } from "lucide-react";
import LandingHeader from "@/components/layout/LandingHeader";
import Footer from "@/components/layout/Footer";
import { useState, useEffect, useRef } from "react";

const features = [
  {
    icon: <Presentation className="h-8 w-8 md:h-10 md:w-10 text-primary mb-4" />,
    title: "AI Konu Anlatımı ve Özetleme",
    description: "YKS konularını yapay zekadan detaylıca öğrenin veya uzun metinleri/PDF'leri saniyeler içinde anlaşılır özetlere dönüştürün. Farklı anlatım seviyeleri ve hoca tarzları seçin!",
  },
  {
    icon: <HelpCircle className="h-8 w-8 md:h-10 md:w-10 text-primary mb-4" />,
    title: "AI Test Oluşturucu ve Soru Çözücü",
    description: "Belirlediğiniz YKS konularından pratik testler oluşturun veya zorlandığınız sorulara adım adım çözümler alın. (Soru Çözücü Beta)",
  },
   {
    icon: <LayoutGrid className="h-8 w-8 md:h-10 md:w-10 text-primary mb-4" />,
    title: "AI Bilgi Kartları ve Sınav Analizi",
    description: "Önemli kavramlardan etkileşimli bilgi kartları oluşturun veya deneme sınavı raporlarınızı analiz ederek gelişim alanlarınızı keşfedin.",
  },
  {
    icon: <CalendarDays className="h-8 w-8 md:h-10 md:w-10 text-primary mb-4" />,
    title: "AI Çalışma Planı ve Yardımcı Araçlar",
    description: "Kişiselleştirilmiş YKS çalışma planı taslakları edinin ve Pomodoro, Geri Sayım gibi yardımcı araçlarla verimliliğinizi artırın.",
  },
];

const benefits = [
 {
    icon: <Clock className="h-8 w-8 md:h-10 md:w-10 text-primary mb-4" />,
    title: "Verimli ve Odaklı Çalışma",
    description: "Yapay zeka destekli araçlarla öğrenme sürenizi optimize edin, YKS için gerçekten önemli olan bilgilere ve stratejilere odaklanın.",
  },
  {
    icon: <Brain className="h-8 w-8 md:h-10 md:w-10 text-primary mb-4" />,
    title: "Kapsamlı Konu Anlayışı",
    description: "AI destekli konu anlatımları, özetler, bilgi kartları ve testlerle konuları derinlemesine kavrayın, ana fikirleri kolayca yakalayın.",
  },
  {
    icon: <Zap className="h-8 w-8 md:h-10 md:w-10 text-primary mb-4" />,
    title: "Akıllı Sınav Hazırlığı ve Analiz",
    description: "YKS odaklı testler, soru çözümleri, sınav raporu analizleri ve kişiye özel çalışma planlarıyla hedefinize daha emin adımlarla ilerleyin.",
  },
];

const howItWorksSteps = [
  {
    icon: <Wand2 className="h-10 w-10 md:h-12 md:w-12 text-primary mb-4" />,
    title: "1. Aracınızı Seçin",
    description: "İhtiyacınıza uygun AI aracını (Konu Anlatımı, Soru Çözücü, Test Oluşturucu vb.) seçin.",
  },
  {
    icon: <FileUp className="h-10 w-10 md:h-12 md:w-12 text-primary mb-4" />,
    title: "2. Girdinizi Sağlayın",
    description: "Öğrenmek istediğiniz konuyu, PDF'inizi, soru metnini/görselini, sınav raporunuzu veya çalışma tercihlerinizi sisteme girin.",
  },
  {
    icon: <BookOpenCheck className="h-10 w-10 md:h-12 md:w-12 text-primary mb-4" />,
    title: "3. AI Destekli Çıktınızı Anında Alın!",
    description: "Yapay zekanın sizin için hazırladığı detaylı konu anlatımlarına, kişiselleştirilmiş testlere, özetlere, analizlere veya planlara saniyeler içinde erişin!",
  },
];

const testimonials = [
  {
    quote: "NeutralEdu AI, YKS hazırlık sürecimde en büyük yardımcım oldu. Özellikle konu anlatımları ve test oluşturucu harika!",
    name: "Elif A., 12. Sınıf Öğrencisi",
    avatarFallback: "EA",
  },
  {
    quote: "Deneme sınavı analizleri sayesinde hangi konulara daha çok ağırlık vermem gerektiğini net bir şekilde gördüm. Teşekkürler!",
    name: "Ahmet C., Mezun Öğrenci",
    avatarFallback: "AC",
  },
  {
    quote: "PDF'leri bu kadar hızlı ve anlaşılır özetlemesi inanılmaz. Çalışma süremden büyük tasarruf sağlıyorum.",
    name: "Zeynep T., Üniversite Hazırlık",
    avatarFallback: "ZT",
  },
  {
    quote: "AI Soru Çözücü, takıldığım en zor soruları bile anlamamı sağladı. Kesinlikle tavsiye ederim.",
    name: "Burak S., Öğrenci",
    avatarFallback: "BS",
  },
  {
    quote: "Çalışma planı oluşturucu sayesinde hangi konuya ne zaman çalışacağımı artık biliyorum. Çok organize oldum!",
    name: "Selin M., Öğrenci",
    avatarFallback: "SM",
  },
   {
    quote: "Bilgi kartları özelliği konuları tekrar etmek için mükemmel. Çok pratik!",
    name: "Fatma G., Öğrenci",
    avatarFallback: "FG",
  },
  {
    quote: "Bu platform sayesinde YKS'ye daha bilinçli ve motive bir şekilde hazırlanıyorum. Emeği geçenlere teşekkürler!",
    name: "Mehmet K., Öğrenci",
    avatarFallback: "MK",
  }
];


export default function LandingPage() {
  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0);
  const autoPlayIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startAutoPlay = () => {
    stopAutoPlay();
    autoPlayIntervalRef.current = setInterval(() => {
      setCurrentTestimonialIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
    }, 5000);
  };

  const stopAutoPlay = () => {
    if (autoPlayIntervalRef.current) {
      clearInterval(autoPlayIntervalRef.current);
    }
  };

  useEffect(() => {
    startAutoPlay();
    return () => stopAutoPlay();
  }, []);

  const handleDotClick = (index: number) => {
    setCurrentTestimonialIndex(index);
    startAutoPlay();
  };


  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* LandingHeader is handled by the layout, so not repeated here */}
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-16 md:py-24 lg:py-32 bg-gradient-to-b from-background to-background/90">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground mb-6">
              YKS Hazırlığında Yapay Zeka Destekli Kapsamlı Yol Arkadaşınız
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10">
              NeutralEdu AI, konuları anlamaktan test oluşturmaya, sınav analizinden çalışma planlamasına kadar YKS'ye hazırlık sürecinizi A'dan Z'ye destekler. Akıllı araçlarla daha verimli çalışın, hedeflerinize ulaşın!
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" asChild className="text-md sm:text-lg px-6 sm:px-8 py-3 sm:py-6 shadow-lg hover:shadow-primary/50 transition-shadow">
                <Link href="/signup">Hemen Ücretsiz Başla</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="text-md sm:text-lg px-6 sm:px-8 py-3 sm:py-6 shadow-md hover:shadow-accent/50 transition-shadow">
                <Link href="/pricing">Planları İncele</Link>
              </Button>
            </div>
            <div className="mt-12 md:mt-16 lg:mt-24 max-w-4xl mx-auto px-2">
              <Image
                src="https://placehold.co/1200x600.png"
                alt="NeutralEdu AI Uygulama Arayüzü"
                width={1200}
                height={600}
                className="rounded-xl shadow-2xl border border-border"
                data-ai-hint="AI education platform"
                priority
              />
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section id="benefits" className="py-12 md:py-16 lg:py-24 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 text-foreground">NeutralEdu AI ile Kazanın</h2>
            <p className="text-md sm:text-lg text-muted-foreground text-center mb-10 md:mb-12 max-w-2xl mx-auto">
              YKS hazırlık sürecinizi daha verimli, etkili ve akıllı hale getirin.
            </p>
            <div className="grid md:grid-cols-3 gap-6 md:gap-8">
              {benefits.map((benefit, index) => (
                <Card key={index} className="bg-card hover:shadow-xl transition-shadow duration-300 ease-in-out transform hover:-translate-y-1">
                  <CardHeader className="items-center text-center">
                    {benefit.icon}
                    <CardTitle className="text-xl sm:text-2xl text-foreground">{benefit.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <p className="text-sm sm:text-base text-muted-foreground">{benefit.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-12 md:py-16 lg:py-24 bg-background/90">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 text-foreground">Kapsamlı YKS Hazırlık Araçları</h2>
            <p className="text-md sm:text-lg text-muted-foreground text-center mb-10 md:mb-12 max-w-2xl mx-auto">
              Öğrenmenizi hızlandıracak, anlayışınızı artıracak ve sınav performansınızı yükseltecek özelliklerle dolu.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-6 md:gap-8">
              {features.map((feature, index) => (
                <Card key={index} className="bg-card hover:shadow-xl transition-shadow duration-300 ease-in-out transform hover:-translate-y-1">
                  <CardHeader className="items-center text-center">
                    {feature.icon}
                    <CardTitle className="text-xl sm:text-2xl text-foreground">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <p className="text-sm sm:text-base text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
             <div className="text-center mt-10 md:mt-12">
              <Button size="lg" asChild className="text-md sm:text-lg px-6 sm:px-8 py-3 sm:py-6 shadow-lg hover:shadow-primary/50 transition-shadow">
                <Link href="/dashboard/ai-tools">Tüm Araçları Gör <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-12 md:py-16 lg:py-24 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 text-foreground">3 Basit Adımda Kullanmaya Başlayın</h2>
            <p className="text-md sm:text-lg text-muted-foreground text-center mb-10 md:mb-12 max-w-2xl mx-auto">
              Sürecimiz hızlı, kolay ve verimli olacak şekilde tasarlanmıştır.
            </p>
            <div className="grid md:grid-cols-3 gap-8 items-start relative">
              {howItWorksSteps.map((step, index) => (
                <div key={index} className="flex flex-col items-center text-center p-4 md:p-6 relative">
                  {step.icon}
                  <h3 className="text-xl sm:text-2xl font-semibold mb-2 text-foreground">{step.title}</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">{step.description}</p>
                   {index < howItWorksSteps.length - 1 && (
                    <ArrowRight
                      className="h-8 w-8 text-primary mt-6 hidden md:block absolute top-1/2 -translate-y-1/2 transform
                                 md:left-[calc(100%_-_1rem)] lg:left-[calc(100%_-_0.5rem)] xl:left-[calc(100%_-_0rem)]"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="text-center mt-10 md:mt-12">
              <Button size="lg" asChild className="text-md sm:text-lg px-6 sm:px-8 py-3 sm:py-6 shadow-lg hover:shadow-primary/50 transition-shadow">
                <Link href="/signup">Şimdi Ücretsiz Dene <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Testimonials Section - Updated Slider */}
        <section id="testimonials" className="py-12 md:py-16 lg:py-24 bg-background/90">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 text-foreground">Sizin Gibi Öğrenciler Tarafından Seviliyor</h2>
            <p className="text-md sm:text-lg text-muted-foreground text-center mb-10 md:mb-12 max-w-2xl mx-auto">
              Başkalarının NeutralEdu AI hakkında ne söylediğini duyun.
            </p>
            <div className="relative w-full max-w-2xl mx-auto overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentTestimonialIndex * 100}%)` }}
              >
                {testimonials.map((testimonial, index) => (
                  <div key={testimonial.name + "-" + index} className="w-full flex-shrink-0 px-2">
                    <Card className="bg-card flex flex-col h-full">
                      <CardContent className="pt-6 flex-grow">
                        <ThumbsUp className="h-8 w-8 text-primary mb-4" />
                        <blockquote className="text-sm sm:text-base text-muted-foreground italic border-l-4 border-primary pl-4">
                          "{testimonial.quote}"
                        </blockquote>
                      </CardContent>
                      <CardFooter className="pt-4 mt-auto">
                        <p className="text-xs sm:text-sm font-semibold text-foreground">{testimonial.name}</p>
                      </CardFooter>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center space-x-2 mt-6">
              {testimonials.map((_, index) => (
                <button
                  key={`dot-${index}`}
                  onClick={() => handleDotClick(index)}
                  className={`h-3 w-3 rounded-full transition-colors duration-300 ${
                    currentTestimonialIndex === index ? 'bg-primary scale-125' : 'bg-muted hover:bg-muted-foreground/50'
                  }`}
                  aria-label={`Yorum ${index + 1} git`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Sponsors Section */}
        <section id="sponsors" className="py-12 md:py-16 lg:py-24 bg-background/80">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 text-foreground">Sponsorlarımız</h2>
            <p className="text-md sm:text-lg text-muted-foreground text-center mb-10 md:mb-12 max-w-2xl mx-auto">
              Bu projeyi mümkün kılan değerli sponsorlarımıza teşekkür ederiz.
            </p>
            <div className="flex justify-center items-center">
              <Image
                src="/sponsor-matematikenstitusu.png"
                alt="Sponsor Matematik Enstitüsü Logosu"
                width={800}
                height={200}
                className="rounded-lg shadow-md border border-border object-contain max-h-[100px] sm:max-h-[150px]"
              />
            </div>
             <p className="text-sm text-muted-foreground mt-8">
              Sponsor olmak ve projemize destek vermek için lütfen bizimle <Link href="#contact" className="text-primary hover:underline">iletişime geçin</Link>.
            </p>
          </div>
        </section>

        {/* Pricing Section Link */}
        <section id="pricing-link" className="py-12 md:py-16 lg:py-24 bg-background">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 text-foreground">Başlamaya Hazır mısınız?</h2>
            <p className="text-md sm:text-lg text-muted-foreground text-center mb-10 md:mb-12 max-w-2xl mx-auto">
              Çalışma alışkanlıklarınıza uygun bir plan seçin ve bugün daha akıllı öğrenmenin kilidini açın.
            </p>
            <Button size="lg" variant="default" asChild className="text-md sm:text-lg px-6 sm:px-8 py-3 sm:py-6 shadow-lg hover:shadow-primary/50 transition-shadow">
              <Link href="/pricing">Fiyat Planlarını Görüntüle <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
          </div>
        </section>
      </main>
      {/* Footer is handled by the layout */}
    </div>
  );
}

    