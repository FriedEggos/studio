
'use client';

import Link from 'next/link';
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
import { Download, Camera } from "lucide-react";
import { useUser, useCollection, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, doc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { format } from 'date-fns';


export default function ProfilePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

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

  if (isUserLoading || isProfileLoading || !user) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
          My Profile
        </h1>
        <Card>
          <CardHeader className="items-center text-center">
            <Skeleton className="w-24 h-24 rounded-full mb-4" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-1" />
            <Skeleton className="h-4 w-2/3 mt-1" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
        My Profile
      </h1>
      <Card>
        <CardHeader className="items-center text-center">
          <Link href="/profile/edit" className="relative group">
            <Avatar className="w-24 h-24 mb-4">
              <AvatarImage src={user.photoURL || `https://picsum.photos/seed/${user.uid}/200/200`} />
              <AvatarFallback>{userProfile?.fullName?.[0].toUpperCase() || user.email?.[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 mb-4 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Camera className="h-8 w-8 text-white" />
            </div>
          </Link>
          <CardTitle className="font-headline">{userProfile?.fullName || "JTMK Student"}</CardTitle>
          <CardDescription>{userProfile?.email}</CardDescription>
          <CardDescription className="text-xs">{userProfile?.course}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" asChild>
            <Link href="/profile/edit">Edit Profile</Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Participation History</CardTitle>
          <CardDescription>
            Record of programs and activities you have participated in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">E-Certificate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingHistory ? (
                <TableRow><TableCell colSpan={4} className="text-center">Loading history...</TableCell></TableRow>
              ) : participationHistory && participationHistory.length > 0 ? (
                participationHistory.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {item.programName || item.programId}
                    </TableCell>
                    <TableCell>{item.participationDate ? format(item.participationDate.toDate(), 'd MMM yyyy') : 'N/A'}</TableCell>
                    <TableCell>
                      <UiBadge
                        variant={
                          item.verificationStatus === "approved" ? "default" : item.verificationStatus === 'rejected' ? 'destructive' : "secondary"
                        }
                        className={
                          item.verificationStatus === "approved"
                            ? "bg-green-600 hover:bg-green-700 text-white"
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
                            Download
                          </a>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={4} className="text-center">No participation history.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
