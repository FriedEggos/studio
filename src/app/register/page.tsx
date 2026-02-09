
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
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useFirestore, setDocumentNonBlocking } from "@/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc } from "firebase/firestore";

const adminEmails = ["ahammedrasiah@gmail.com", "syazmiza0304@gmail.com"];

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const [fullName, setFullName] = useState("yassin bin kisman");
  const [email, setEmail] = useState("muhammadyassin@gmail.com");
  const [password, setPassword] = useState("yassin123");
  const [course, setCourse] = useState("Diploma in Digital Technology");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fullName || !email || !password || !course) {
      toast({
        variant: "destructive",
        title: "Please fill all fields",
      });
      return;
    }
    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user) {
        const role = adminEmails.includes(user.email || "") ? "admin" : "student";
        const userDocRef = doc(firestore, "users", user.uid);
        const userData = {
          id: user.uid,
          fullName: fullName,
          email: user.email,
          role: role,
          course: course,
        };
        
        setDocumentNonBlocking(userDocRef, userData, { merge: true });

        toast({
          title: "Registration Successful",
          description: "Please log in to continue.",
        });
        router.push("/login");
      }
    } catch (error: any) {
        console.error("Email sign-up error", error);
        toast({
            variant: "destructive",
            title: "Registration Failed",
            description: error.message,
        });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
      <Card className="w-full max-w-sm mx-auto">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Logo />
          </div>
          <CardTitle className="text-2xl font-headline">Create Account</CardTitle>
          <CardDescription>
            Fill the form below to register as a new user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="full-name">Full Name</Label>
              <Input
                id="full-name"
                placeholder="e.g., John Doe"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="course">Course</Label>
              <Input
                id="course"
                placeholder="e.g., Diploma in Digital Technology"
                required
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Registering..." : "Register"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Log In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
