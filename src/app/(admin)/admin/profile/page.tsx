
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useUser, useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from '@/lib/utils';

export default function AdminProfilePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  if (isUserLoading || isProfileLoading || !user || !userProfile) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
          My Profile
        </h1>
        <Card>
          <CardHeader className="items-center text-center">
            <Skeleton className="w-24 h-24 rounded-full mb-4" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
        My Profile
      </h1>
      <Card>
        <CardHeader className="items-center text-center">
          <Link href="/admin/profile/edit">
            <Avatar className="w-24 h-24 mb-4">
              <AvatarImage src={user.photoURL || `https://ui-avatars.com/api/?name=${getInitials(userProfile.displayName || '')}&background=random&color=fff`} />
              <AvatarFallback>{getInitials(userProfile.displayName || user.email || '')}</AvatarFallback>
            </Avatar>
          </Link>
          <CardTitle className="font-headline">{userProfile?.displayName || "JTMK Administrator"}</CardTitle>
          <CardDescription>{userProfile?.email}</CardDescription>
          <CardDescription className="font-semibold capitalize mt-1">{userProfile?.role}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" asChild>
            <Link href="/admin/profile/edit">Edit Profile</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
