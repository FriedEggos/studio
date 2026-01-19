import Link from "next/link";
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

export default function RegisterPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
      <Card className="w-full max-w-sm mx-auto">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Logo />
          </div>
          <CardTitle className="text-2xl font-headline">Daftar Akaun</CardTitle>
          <CardDescription>
            Isi borang di bawah untuk mendaftar sebagai pengguna baru.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="full-name">Nama Penuh</Label>
              <Input id="full-name" placeholder="John Doe" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-mel</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Kata Laluan</Label>
              <Input id="password" type="password" />
            </div>
            <Button type="submit" className="w-full" asChild>
              <Link href="/login">Daftar</Link>
            </Button>
          </div>
          <div className="mt-4 text-center text-sm">
            Sudah mempunyai akaun?{" "}
            <Link href="/login" className="underline">
              Log Masuk
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
