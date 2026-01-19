'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge as UiBadge } from "@/components/ui/badge";
import { badges } from "@/lib/data"; // Keep badges static for now
import { Download, Award, Shield, Code, Lightbulb, Star } from "lucide-react";
import { useUser, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const iconMap: { [key: string]: React.ElementType } = {
  Award,
  Shield,
  Code,
  Lightbulb,
  Star,
};

export default function ProfilePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const participationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, `users/${user.uid}/participations`));
  }, [user, firestore]);

  const { data: participationHistory, isLoading: isLoadingHistory } = useCollection(participationsQuery);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  if (isUserLoading || !user) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-1">
            <Card>
              <CardHeader className="items-center text-center">
                <Skeleton className="w-24 h-24 rounded-full mb-4" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
        Profil Saya
      </h1>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card>
            <CardHeader className="items-center text-center">
              <Avatar className="w-24 h-24 mb-4">
                <AvatarImage src={user.photoURL || `https://picsum.photos/seed/${user.uid}/200/200`} />
                <AvatarFallback>{user.email?.[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <CardTitle className="font-headline">{user.displayName || "Pelajar JTMK"}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled>Kemaskini Profil</Button>
            </CardContent>
          </Card>
        </div>
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Lencana Saya</CardTitle>
              <CardDescription>
                Kumpul lencana dengan menyertai program dan aktiviti anjuran
                JTMK.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {badges.map((badge) => {
                const Icon = iconMap[badge.icon] || Award;
                return (
                  <div
                    key={badge.name}
                    className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50"
                  >
                    <Icon className="w-10 h-10 text-primary mb-2" />
                    <p className="font-semibold text-sm">{badge.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {badge.description}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Sejarah Penyertaan</CardTitle>
          <CardDescription>
            Rekod program dan aktiviti yang telah anda sertai.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Program</TableHead>
                <TableHead>Tarikh</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">E-Sijil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingHistory ? (
                <TableRow><TableCell colSpan={4} className="text-center">Memuatkan sejarah...</TableCell></TableRow>
              ) : participationHistory && participationHistory.length > 0 ? (
                participationHistory.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {item.programId}
                    </TableCell>
                    <TableCell>{new Date(item.participationDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <UiBadge
                        variant={
                          item.verificationStatus === "approved" ? "default" : "secondary"
                        }
                        className={
                          item.verificationStatus === "approved"
                            ? "bg-green-600 text-white"
                            : ""
                        }
                      >
                        {item.verificationStatus}
                      </UiBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.certificateIssued ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={"#"} download>
                            <Download className="mr-2 h-4 w-4" />
                            Muat Turun
                          </a>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={4} className="text-center">Tiada sejarah penyertaan.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
