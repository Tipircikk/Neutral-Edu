
"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { UploadCloud, Sparkles, Lightbulb, MessageCircleQuestion, FileUp, BotMessageSquare, BookOpenCheck, ArrowRight, Zap, Clock, Brain, FileText, BarChart3, ThumbsUp } from "lucide-react";
import LandingHeader from "@/components/layout/LandingHeader";
import Footer from "@/components/layout/Footer";

const features = [
  {
    icon: <UploadCloud className="h-10 w-10 text-primary mb-4" />,
    title: "Kolay PDF Yükleme",
    description: "PDF dosyalarınızı sürükleyip bırakın veya seçin. Gerisini biz hallederiz, metni sorunsuz bir şekilde çıkarırız.",
  },
  {
    icon: <Sparkles className="h-10 w-10 text-primary mb-4" />,
    title: "Yapay Zeka Destekli Özetler",
    description: "Gelişmiş yapay zekamız uzun belgeleri kısa özetlere yoğunlaştırır, anahtar noktaları ve ana kavramları vurgular.",
  },
  {
    icon: <Lightbulb className="h-10 w-10 text-primary mb-4" />,
    title: "Basitleştirilmiş Açıklamalar",
    description: "Karmaşık konular, öğrenci anlayışı için mükemmel, anlaşılması kolay bir dile indirgenir.",
  },
  {
    icon: <MessageCircleQuestion className="h-10 w-10 text-primary mb-4" />,
    title: "Örnek Sorular",
    description: "Anlamayı test etmek için özetlenmiş içeriğe dayalı yapay zeka tarafından oluşturulmuş örnek sorularla öğrenmeyi pekiştirin.",
  },
];

const benefits = [
 {
    icon: <Clock className="h-10 w-10 text-primary mb-4" />,
    title: "Çalışma Süresinden Tasarruf Edin",
    description: "Okuma saatlerini azaltın ve sınavlarınız ve ödevleriniz için gerçekten önemli olan şeylere odaklanın.",
  },
  {
    icon: <Brain className="h-10 w-10 text-primary mb-4" />,
    title: "Sadece Anahtar Noktaları Alın",
    description: "Yapay zekamız karmaşık bilgileri en önemli çıkarımlara ve ana fikirlere indirger.",
  },
  {
    icon: <Zap className="h-10 w-10 text-primary mb-4" />,
    title: "Gemini AI Destekli",
    description: "Öğrencilere özel doğru ve anlayışlı özetler için Google'ın son teknoloji yapay zekasından yararlanın.",
  },
];

const howItWorksSteps = [
  {
    icon: <FileUp className="h-12 w-12 text-primary mb-4" />,
    title: "1. PDF'inizi Yükleyin",
    description: "Daha iyi anlamanız gereken herhangi bir PDF belgesini seçin. Makaleler, ders kitapları, araştırma makaleleri - hepsini kabul ediyoruz.",
  },
  {
    icon: <BotMessageSquare className="h-12 w-12 text-primary mb-4" />,
    title: "2. Yapay Zeka Özeti Hazırlar",
    description: "Akıllı sistemimiz belgeyi işler ve saniyeler içinde yapılandırılmış, öğrenci dostu bir özet oluşturur.",
  },
  {
    icon: <BookOpenCheck className="h-12 w-12 text-primary mb-4" />,
    title: "3. İnceleyin ve Öğrenin",
    description: "Anahtar noktalar, basitleştirilmiş açıklamalar ve hatta potansiyel sınav soruları içeren özetinize erişin. Daha akıllı çalışın!",
  },
];

const testimonials = [
  {
    quote: "NeutralEdu AI, finallerime çalışma şeklimi değiştirdi. Daha az zamanda daha fazla konuyu kapsayabiliyorum!",
    name: "Ayşe L., Üniversite Öğrencisi",
    avatarFallback: "AL",
  },
  {
    quote: "Yapay zeka özetleri inanılmaz derecede doğru ve tam olarak odaklanmam gerekenleri vurguluyor. Gerçek bir ezber bozan.",
    name: "Mehmet Y., Yüksek Lisans Öğrencisi",
    avatarFallback: "MY",
  },
  {
    quote: "Uzun araştırma makaleleri eskiden beni bunaltırdı. Şimdi, ana fikri dakikalar içinde alıyorum. Şiddetle tavsiye ederim!",
    name: "Zeynep K., Doktora Adayı",
    avatarFallback: "ZK",
  },
];


export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingHeader />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-20 md:py-32 bg-gradient-to-b from-background to-background/90">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6">
              Herhangi bir konuyu saniyeler içinde öğrenci dostu bir özete dönüştürün
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10">
              NeutralEdu AI, karmaşık PDF'leri daha hızlı anlamanıza yardımcı olmak için gelişmiş yapay zeka kullanır. Daha az okuyun, daha çok öğrenin.
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              <Button size="lg" asChild className="text-lg px-8 py-6 shadow-lg hover:shadow-primary/50 transition-shadow">
                <Link href="/signup">PDF Yükle ve Özet Al</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="text-lg px-8 py-6 shadow-md hover:shadow-accent/50 transition-shadow">
                <Link href="/pricing">Fiyatları Gör</Link>
              </Button>
            </div>
            <div className="mt-16 md:mt-24 max-w-4xl mx-auto">
              <Image
                src="https://placehold.co/1200x600.png"
                alt="NeutralEdu AI Uygulama Demosu"
                width={1200}
                height={600}
                className="rounded-xl shadow-2xl border border-border"
                data-ai-hint="app dashboard screenshot"
                priority
              />
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section id="benefits" className="py-16 md:py-24 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-bold text-center mb-4 text-foreground">Çalışma Potansiyelinizin Kilidini Açın</h2>
            <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              NeutralEdu AI, akademik yolculuğunuzda size net bir avantaj sağlamak için tasarlanmıştır.
            </p>
            <div className="grid md:grid-cols-3 gap-8">
              {benefits.map((benefit, index) => (
                <Card key={index} className="bg-card hover:shadow-xl transition-shadow duration-300 ease-in-out transform hover:-translate-y-1">
                  <CardHeader className="items-center text-center">
                    {benefit.icon}
                    <CardTitle className="text-2xl text-foreground">{benefit.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <p className="text-muted-foreground">{benefit.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 md:py-24 bg-background/90">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-bold text-center mb-4 text-foreground">Daha Hızlı Anlayın, Daha Akıllı Çalışın</h2>
            <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Öğrenmenizi hızlandıracak ve anlamanızı artıracak özelliklerle dolu.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <Card key={index} className="bg-card hover:shadow-xl transition-shadow duration-300 ease-in-out transform hover:-translate-y-1">
                  <CardHeader className="items-center text-center">
                    {feature.icon}
                    <CardTitle className="text-2xl text-foreground">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-16 md:py-24 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-bold text-center mb-4 text-foreground">3 Basit Adımda Özet Alın</h2>
            <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Sürecimiz hızlı, kolay ve verimli olacak şekilde tasarlanmıştır.
            </p>
            <div className="grid md:grid-cols-3 gap-8 items-start relative">
              {howItWorksSteps.map((step, index) => (
                <div key={index} className="flex flex-col items-center text-center p-6 relative">
                  {step.icon}
                  <h3 className="text-2xl font-semibold mb-2 text-foreground">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                  {index < howItWorksSteps.length - 1 && (
                    <ArrowRight
                      className="h-8 w-8 text-primary mt-8 hidden md:block absolute top-1/2 -translate-y-1/2 transform
                                 md:left-[calc(100%_-_1rem)] lg:left-[calc(100%_-_0.5rem)] xl:left-[calc(100%_-_0rem)]"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="text-center mt-12">
              <Button size="lg" asChild className="shadow-lg hover:shadow-primary/50 transition-shadow">
                <Link href="/signup">Şimdi Dene <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Dashboard Preview Section */}
        <section id="dashboard-preview" className="py-16 md:py-24 bg-background/90">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-bold text-center mb-4 text-foreground">Çalışırken Görün</h2>
            <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Sihrin gerçekleştiği kişiselleştirilmiş kontrol panelinize bir bakış.
            </p>
            <Card className="max-w-3xl mx-auto bg-card shadow-2xl overflow-hidden">
              <CardHeader className="bg-muted/30 p-4 border-b border-border">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl text-foreground">Kontrol Panelim</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <span>Kota: 2/2</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <Button variant="default" size="lg" className="w-full py-4 text-lg shadow-md">
                  <UploadCloud className="mr-2 h-5 w-5" /> Yeni PDF Yükle
                </Button>
                <Card className="bg-background/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Örnek Özet: "Kuantum Fiziğine Giriş.pdf"</CardTitle>
                    <CardDescription>Birkaç saniye önce oluşturuldu</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="font-semibold text-foreground">Ana Fikir:</p>
                      <p>Kuantum fiziği, klasik kuralların geçerli olmadığı atomların ve atom altı parçacıkların tuhaf dünyasını keşfeder...</p>
                      <p className="font-semibold text-foreground">Anahtar Noktalar:</p>
                      <ul className="list-disc list-inside ml-4">
                        <li>Dalga-parçacık ikiliği</li>
                        <li>Enerjinin kuantizasyonu</li>
                        <li>Belirsizlik İlkesi</li>
                      </ul>
                      <p className="font-semibold text-foreground">Potansiyel Sınav Soruları:</p>
                      <ul className="list-disc list-inside ml-4">
                        <li>Heisenberg'in Belirsizlik İlkesi'ni açıklayınız.</li>
                        <li>Kuantum tünelleme nedir?</li>
                      </ul>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-2">
                    <Button variant="outline" size="sm"><FileText className="mr-2 h-4 w-4" /> Tam Özeti Görüntüle</Button>
                  </CardFooter>
                </Card>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-16 md:py-24 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-bold text-center mb-4 text-foreground">Sizin Gibi Öğrenciler Tarafından Seviliyor</h2>
            <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Başkalarının NeutralEdu AI hakkında ne söylediğini duyun.
            </p>
            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((testimonial, index) => (
                <Card key={index} className="bg-card flex flex-col">
                  <CardContent className="pt-6 flex-grow">
                    <ThumbsUp className="h-8 w-8 text-primary mb-4" />
                    <blockquote className="text-muted-foreground italic border-l-4 border-primary pl-4">
                      "{testimonial.quote}"
                    </blockquote>
                  </CardContent>
                  <CardFooter className="pt-4 mt-auto">
                    <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section Link */}
        <section id="pricing-link" className="py-16 md:py-24 bg-background/90">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold text-center mb-4 text-foreground">Başlamaya Hazır mısınız?</h2>
            <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Çalışma alışkanlıklarınıza uygun bir plan seçin ve bugün daha akıllı öğrenmenin kilidini açın.
            </p>
            <Button size="lg" variant="default" asChild className="text-lg px-8 py-6 shadow-lg hover:shadow-primary/50 transition-shadow">
              <Link href="/pricing">Fiyat Planlarını Görüntüle <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer appName="NeutralEdu AI" />
    </div>
  );
}
