
"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { CheckCircle, UploadCloud, Sparkles, Lightbulb, MessageSquareQuestion, FileUp, BotMessageSquare, BookOpenCheck, ArrowRight } from "lucide-react";

const features = [
  {
    icon: <UploadCloud className="h-10 w-10 text-primary mb-4" />,
    title: "Easy PDF Upload",
    description: "Simply drag and drop or select your PDF files. We handle the rest, extracting text seamlessly.",
  },
  {
    icon: <Sparkles className="h-10 w-10 text-primary mb-4" />,
    title: "AI-Powered Summaries",
    description: "Our advanced AI condenses long documents into concise summaries, highlighting key points and main concepts.",
  },
  {
    icon: <Lightbulb className="h-10 w-10 text-primary mb-4" />,
    title: "Simplified Explanations",
    description: "Complex topics are broken down into easy-to-understand language, perfect for student comprehension.",
  },
  {
    icon: <MessageSquareQuestion className="h-10 w-10 text-primary mb-4" />,
    title: "Sample Questions",
    description: "Reinforce learning with AI-generated sample questions based on the summarized content to test understanding.",
  },
];

const howItWorksSteps = [
  {
    icon: <FileUp className="h-12 w-12 text-primary mb-4" />,
    title: "1. Upload Your PDF",
    description: "Select any PDF document you need to understand better. Articles, textbooks, research papers - we take them all.",
  },
  {
    icon: <BotMessageSquare className="h-12 w-12 text-primary mb-4" />,
    title: "2. AI Crafts Summary",
    description: "Our intelligent system processes the document and generates a structured, student-friendly summary in moments.",
  },
  {
    icon: <BookOpenCheck className="h-12 w-12 text-primary mb-4" />,
    title: "3. Review & Learn",
    description: "Access your summary with key points, simplified explanations, and even potential exam questions. Study smarter!",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-background to-background/90">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6">
            Scholar Summarizer
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10">
            Tired of endless reading? Upload your PDFs and let our AI provide clear, concise summaries tailored for students. Focus on understanding, not just reading.
          </p>
          <div className="flex justify-center gap-4">
            <Button size="lg" asChild className="text-lg px-8 py-6 shadow-lg hover:shadow-primary/50 transition-shadow">
              <Link href="/signup">Get Started for Free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-lg px-8 py-6 shadow-md hover:shadow-accent/50 transition-shadow">
              <Link href="#pricing">View Pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-4 text-foreground">Understand Faster, Study Smarter</h2>
          <p className="text-lg text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
            Scholar Summarizer is packed with features designed to accelerate your learning and boost comprehension.
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
      <section id="how-it-works" className="py-16 md:py-24 bg-background/90">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-4 text-foreground">Get Summaries in 3 Simple Steps</h2>
          <p className="text-lg text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
            Our process is designed to be quick, easy, and efficient, getting you the information you need without the hassle.
          </p>
          <div className="grid md:grid-cols-3 gap-8 items-start relative">
            {howItWorksSteps.map((step, index) => (
              <div key={index} className="flex flex-col items-center text-center p-6 relative">
                {step.icon}
                <h3 className="text-2xl font-semibold mb-2 text-foreground">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
                {index < howItWorksSteps.length - 1 && (
                  <ArrowRight className="h-8 w-8 text-primary mt-8 hidden md:block absolute left-1/2 top-1/2 -translate-y-1/2 transform translate-x-[calc(50%_+_2rem)] xl:translate-x-[calc(50%_+_4rem)]" 
                  style={{ right: 'auto', marginLeft: 'auto', marginRight: 'auto' }}
                  />
                )}
              </div>
            ))}
          </div>
           <div className="text-center mt-12">
            <Button size="lg" asChild className="shadow-lg hover:shadow-primary/50 transition-shadow">
              <Link href="/signup">Try It Now <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
          </div>
        </div>
      </section>
      
      {/* Dashboard Preview Section */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-4 text-foreground">See It In Action</h2>
          <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            A glimpse into your future dashboard – clean, intuitive, and focused on your learning.
          </p>
          <Card className="overflow-hidden shadow-2xl border-2 border-primary/30">
            <CardContent className="p-0">
              <Image
                src="https://placehold.co/1200x750.png"
                alt="Dashboard Preview"
                width={1200}
                height={750}
                className="w-full h-auto"
                data-ai-hint="dashboard student summary dark"
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 md:py-24 bg-background/90">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-4 text-foreground">Simple, Transparent Pricing</h2>
          <p className="text-lg text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
            Choose the plan that fits your study needs. Start for free, upgrade anytime.
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="border-2 border-primary/70 shadow-xl transform hover:scale-105 transition-transform duration-300 bg-card">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl text-primary">Free Plan</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">Perfect for getting started</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-center">
                <p className="text-5xl font-bold text-foreground">$0<span className="text-lg text-muted-foreground">/month</span></p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center justify-center gap-2"><CheckCircle className="h-5 w-5 text-primary" /> 5 Summaries per Day</li>
                  <li className="flex items-center justify-center gap-2"><CheckCircle className="h-5 w-5 text-primary" /> Standard AI Model</li>
                  <li className="flex items-center justify-center gap-2"><CheckCircle className="h-5 w-5 text-primary" /> Key Points & Explanations</li>
                  <li className="flex items-center justify-center gap-2"><CheckCircle className="h-5 w-5 text-primary" /> Sample Questions</li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button size="lg" className="w-full text-lg py-6" asChild>
                  <Link href="/signup">Sign Up for Free</Link>
                </Button>
              </CardFooter>
            </Card>
            <Card className="bg-card shadow-lg border border-border">
              <CardHeader className="text-center relative">
                 <div className="absolute top-2 right-2 bg-accent text-accent-foreground text-xs font-semibold px-3 py-1 rounded-md">Coming Soon</div>
                <CardTitle className="text-3xl text-foreground">Premium Plan</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">For the dedicated scholar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-center">
                <p className="text-5xl font-bold text-foreground">$10<span className="text-lg text-muted-foreground">/month</span></p>
                 <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center justify-center gap-2"><CheckCircle className="h-5 w-5 text-primary" /> 50 Summaries per Day</li>
                  <li className="flex items-center justify-center gap-2"><CheckCircle className="h-5 w-5 text-primary" /> Advanced AI Models</li>
                  <li className="flex items-center justify-center gap-2"><CheckCircle className="h-5 w-5 text-primary" /> Deeper Analysis Features</li>
                  <li className="flex items-center justify-center gap-2"><CheckCircle className="h-5 w-5 text-primary" /> Priority Support</li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button size="lg" variant="outline" className="w-full text-lg py-6" disabled>
                  Get Notified
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}
