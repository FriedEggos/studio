"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useFirestore, useUser } from "@/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // If user is logged in, fetch role and redirect
    if (user && firestore) {
      setIsSubmitting(true);
      getDoc(doc(firestore, "users", user.uid)).then(userDoc => {
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const role = userData.role;
          toast({ title: "Log Masuk Berjaya", description: "Selamat datang kembali!" });
          router.push(role === 'admin' ? '/admin/dashboard' : '/dashboard');
        } else {
          toast({ variant: "destructive", title: "Profil tidak ditemui", description: "Sila daftar semula." });
          router.push('/register');
        }
      }).catch(error => {
          console.error("Error fetching user role:", error);
          toast({ variant: "destructive", title: "Ralat", description: "Gagal mendapatkan peranan pengguna." });
          setIsSubmitting(false);
      })
    }
  }, [user, firestore, router, toast]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ variant: "destructive", title: "Sila isi semua medan" });
      return;
    }
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // The useEffect will handle redirection
    } catch (error: any) {
      toast({ variant: "destructive", title: "Log Masuk Gagal", description: "E-mel atau kata laluan tidak sah." });
      setIsSubmitting(false);
    }
  };

  // Show loading indicator while checking auth state or during login process
  if (isUserLoading || (isSubmitting && !user)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <p className="text-lg font-semibold">Sila tunggu...</p>
          <p className="text-muted-foreground">Mengesahkan butiran anda.</p>
        </div>
      </div>
    );
  }

  // If user is already logged in (and useEffect is running), don't show the form
  if(user) {
      return (
         <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="text-center">
              <p className="text-lg font-semibold">Mengarahkan...</p>
              <p className="text-muted-foreground">Anda telah log masuk.</p>
            </div>
        </div>
      )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
      <Card className="w-full max-w-sm mx-auto">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Logo />
          </div>
          <CardTitle className="text-2xl font-headline">Log Masuk</CardTitle>
          <CardDescription>
            Masukkan e-mel dan kata laluan anda untuk mengakses akaun.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">E-mel</Label>
              <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Kata Laluan</Label>
                <Link
                  href="#"
                  className="ml-auto inline-block text-sm underline"
                >
                  Lupa kata laluan?
                </Link>
              </div>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Sila tunggu..." : "Log Masuk"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Tiada akaun?{" "}
            <Link href="/register" className="underline">
              Daftar
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
