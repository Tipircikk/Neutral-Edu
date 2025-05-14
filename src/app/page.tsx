
"use client";

import Link from "next/link";
import Image from "next/image"; 
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { UploadCloud, Sparkles, Lightbulb, MessageCircleQuestion, FileUp, BotMessageSquare, BookOpenCheck, ArrowRight, Zap, Clock, Users, ThumbsUp, Brain, FileText, BarChart3 } from "lucide-react";

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
    icon: <MessageCircleQuestion className="h-10 w-10 text-primary mb-4" />,
    title: "Sample Questions",
    description: "Reinforce learning with AI-generated sample questions based on the summarized content to test understanding.",
  },
];

const benefits = [
 {
    icon: <Clock className="h-10 w-10 text-primary mb-4" />,
    title: "Save Time Studying",
    description: "Cut down on reading hours and focus on what truly matters for your exams and assignments.",
  },
  {
    icon: <Brain className="h-10 w-10 text-primary mb-4" />,
    title: "Get Only Key Points",
    description: "Our AI distills complex information into the most crucial takeaways and main ideas.",
  },
  {
    icon: <Zap className="h-10 w-10 text-primary mb-4" />,
    title: "Powered by Gemini AI",
    description: "Leverage Google's state-of-the-art AI for accurate and insightful summaries tailored for students.",
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

const testimonials = [
  {
    quote: "Scholar Summarizer transformed how I study for my finals. I can cover more material in less time!",
    name: "Jessica L., University Student",
    avatarFallback: "JL",
  },
  {
    quote: "The AI summaries are incredibly accurate and highlight exactly what I need to focus on. A real game-changer.",
    name: "Mike P., Grad Student",
    avatarFallback: "MP",
  },
  {
    quote: "I used to get overwhelmed by long research papers. Now, I get the gist in minutes. Highly recommended!",
    name: "Sarah K., PhD Candidate",
    avatarFallback: "SK",
  },
];


export default function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-background to-background/90">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6">
            Turn any topic into a student-friendly summary in seconds
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10">
            Scholar Summarizer uses advanced AI to help you understand complex PDFs faster. Spend less time reading, more time learning.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Button size="lg" asChild className="text-lg px-8 py-6 shadow-lg hover:shadow-primary/50 transition-shadow">
              <Link href="/signup">Upload a PDF and get a summary now</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-lg px-8 py-6 shadow-md hover:shadow-accent/50 transition-shadow">
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>
          <div className="mt-16 md:mt-24 max-w-4xl mx-auto">
            <Image 
              src="https://placehold.co/1200x600.png" 
              alt="Scholar Summarizer App Demo" 
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
          <h2 className="text-4xl font-bold text-center mb-4 text-foreground">Unlock Your Study Potential</h2>
          <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Scholar Summarizer is designed to give you a clear advantage in your academic journey.
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
          <h2 className="text-4xl font-bold text-center mb-4 text-foreground">Understand Faster, Study Smarter</h2>
          <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Packed with features to accelerate your learning and boost comprehension.
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
          <h2 className="text-4xl font-bold text-center mb-4 text-foreground">Get Summaries in 3 Simple Steps</h2>
          <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Our process is designed to be quick, easy, and efficient.
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
      <section id="dashboard-preview" className="py-16 md:py-24 bg-background/90">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-4 text-foreground">See It In Action</h2>
          <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            A glimpse into your personalized dashboard where the magic happens.
          </p>
          <Card className="max-w-3xl mx-auto bg-card shadow-2xl overflow-hidden">
            <CardHeader className="bg-muted/30 p-4 border-b border-border">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl text-foreground">My Dashboard</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <span>Quota: 1/2</span> {/* Updated to reflect free plan quota */}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <Button variant="default" size="lg" className="w-full py-4 text-lg shadow-md">
                <UploadCloud className="mr-2 h-5 w-5" /> Upload New PDF
              </Button>
              <Card className="bg-background/50">
                <CardHeader>
                  <CardTitle className="text-lg">Sample Summary: "Introduction to Quantum Physics.pdf"</CardTitle>
                  <CardDescription>Generated a few seconds ago</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">Main Idea:</p>
                    <p>Quantum physics explores the bizarre world of atoms and subatomic particles, where classical rules don't apply...</p>
                    <p className="font-semibold text-foreground">Key Points:</p>
                    <ul className="list-disc list-inside ml-4">
                      <li>Wave-particle duality</li>
                      <li>Quantization of energy</li>
                      <li>Uncertainty Principle</li>
                    </ul>
                    <p className="font-semibold text-foreground">Potential Exam Questions:</p>
                    <ul className="list-disc list-inside ml-4">
                      <li>Explain Heisenberg's Uncertainty Principle.</li>
                      <li>What is quantum tunneling?</li>
                    </ul>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                  <Button variant="outline" size="sm"><FileText className="mr-2 h-4 w-4" /> View Full Summary</Button>
                </CardFooter>
              </Card>
            </CardContent>
          </Card>
        </div>
      </section>
      
      {/* Testimonials Section */}
      <section id="testimonials" className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-4 text-foreground">Loved by Students Like You</h2>
          <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Hear what others are saying about Scholar Summarizer.
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
           <h2 className="text-4xl font-bold text-center mb-4 text-foreground">Ready to Get Started?</h2>
          <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Choose a plan that fits your study habits and unlock smarter learning today.
          </p>
          <Button size="lg" variant="default" asChild className="text-lg px-8 py-6 shadow-lg hover:shadow-primary/50 transition-shadow">
            <Link href="/pricing">View Pricing Plans <ArrowRight className="ml-2 h-5 w-5" /></Link>
          </Button>
        </div>
      </section>
    </>
  );
}

    
