
"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Logo } from "@/components/logo";
import { ArrowRight, FileCheck, QrCode, CheckCircle } from "lucide-react";
import { useUser } from "@/firebase";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const heroImage = PlaceHolderImages.find((img) => img.id === "landing-hero");
  const { user, isUserLoading } = useUser();

  const AuthButtons = () => {
    if (isUserLoading) {
      return (
        <div className="flex gap-4">
          <Skeleton className="h-10 w-28" />
        </div>
      );
    }

    if (user) {
      return (
        <Button asChild>
          <Link href="/login">
            Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      );
    }

    return (
      <>
        <Button variant="ghost" asChild>
          <Link href="/login">Log In</Link>
        </Button>
        <Button asChild>
          <Link href="/register">
            Sign Up <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </>
    );
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center bg-background/95 backdrop-blur-sm fixed top-0 w-full z-50 border-b">
        <Logo />
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <AuthButtons />
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full pt-24 md:pt-32 lg:pt-40">
          <div className="px-4 md:px-6 space-y-10 xl:space-y-16">
            <div className="grid max-w-[1300px] mx-auto gap-4 px-4 sm:px-6 md:px-10 md:grid-cols-2 md:gap-16">
              <div className="flex flex-col justify-center space-y-4">
                <h1 className="lg:leading-tighter text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl xl:text-6xl/none font-headline">
                  Welcome to JTMK+
                </h1>
                <p className="max-w-[700px] text-muted-foreground md:text-xl">
                  A QR-Based Program Participation & Digital Certification System.
                  Register, participate, and track your achievements easily.
                </p>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button size="lg" asChild>
                    <Link href="/login">{user ? "Go to Dashboard" : "Get Started"}</Link>
                  </Button>
                </div>
              </div>
              <div className="w-full h-full min-h-[300px] md:min-h-[400px]">
                {heroImage && (
                  <Image
                    src={heroImage.imageUrl}
                    alt={heroImage.description}
                    width={1200}
                    height={800}
                    data-ai-hint={heroImage.imageHint}
                    className="mx-auto aspect-[3/2] overflow-hidden rounded-xl object-cover"
                  />
                )}
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/40">
          <div className="container space-y-12 px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">
                  Key Features
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Designed to simplify program management and student participation
                  at JTMK.
                </p>
              </div>
            </div>
            <div className="mx-auto grid items-start gap-8 sm:max-w-4xl sm:grid-cols-2 md:gap-12 lg:max-w-5xl lg:grid-cols-3">
              <div className="grid gap-1 p-4 rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-lg font-bold font-headline flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-primary" />
                  QR Registration
                </h3>
                <p className="text-sm text-muted-foreground">
                  Check-in to programs quickly using a QR code scan.
                </p>
              </div>
              <div className="grid gap-1 p-4 rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-lg font-bold font-headline flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Self Check-in & Check-out
                </h3>
                <p className="text-sm text-muted-foreground">
                  Easily record your attendance with self-service check-in and check-out options.
                </p>
              </div>
              <div className="grid gap-1 p-4 rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-lg font-bold font-headline flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-primary" />
                  Verified Contributions
                </h3>
                <p className="text-sm text-muted-foreground">
                  Get program roles and contributions officially verified by admins to build a credible digital portfolio.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} JTMK+. All rights
          reserved.
        </p>
      </footer>
    </div>
  );
}
