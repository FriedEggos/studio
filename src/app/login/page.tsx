
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
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // This effect handles users who are already logged in when they visit the page.
  useEffect(() => {
    if (user && !isUserLoading && firestore && !isSubmitting) {
      const userDocRef = doc(firestore, "users", user.uid);
      getDoc(userDocRef).then(userDoc => {
        if (userDoc.exists()) {
          const role = userDoc.data().role;
          router.push(role === 'admin' ? '/admin/dashboard' : '/dashboard');
        } else {
          // Inconsistent state: user is authed but has no profile.
          // Safest action is to sign them out.
          signOut(auth);
        }
      });
    }
  }, [user, isUserLoading, firestore, auth, router, isSubmitting]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || !password || !auth || !firestore) {
      toast({ variant: "destructive", title: "Please fill all fields" });
      return;
    }
    setIsSubmitting(true);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const loggedInUser = userCredential.user;
      
      const userDocRef = doc(firestore, "users", loggedInUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const role = userData.role;
        toast({ title: "Login Successful", description: "Welcome back!" });
        router.push(role === 'admin' ? '/admin/dashboard' : '/dashboard');
      } else {
        // This handles successful auth but a missing profile, which can happen in a race condition.
        toast({ 
            variant: "destructive", 
            title: "Profile not found", 
            description: "Your user profile does not exist. Please register again." 
        });
        await signOut(auth); // Sign out to clear the broken auth state.
        router.push('/register');
      }
    } catch (error: any) {
      toast({ 
          variant: "destructive", 
          title: "Login Failed", 
          description: "Invalid email or password." 
      });
      setIsSubmitting(false); // Only set to false on failure, otherwise wait for redirect.
    }
  };

  // Show a full page loading indicator while checking initial auth state or during login submission.
  if (isUserLoading || isSubmitting) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <p className="text-lg font-semibold">Please wait...</p>
          <p className="text-muted-foreground">Verifying your details.</p>
        </div>
      </div>
    );
  }

  // If the user object exists but we are not in a submission flow, it means they were already logged in.
  if (user) {
      return (
         <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="text-center">
              <p className="text-lg font-semibold">Welcome back!</p>
              <p className="text-muted-foreground">Redirecting you to your dashboard...</p>
            </div>
        </div>
      );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
      <Card className="w-full max-w-sm mx-auto">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Logo />
          </div>
          <CardTitle className="text-2xl font-headline">Login</CardTitle>
          <CardDescription>
            Enter your email and password to access your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="#"
                  className="ml-auto inline-block text-sm underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                 <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 right-2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              Login
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            No account?{" "}
            <Link href="/register" className="underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
