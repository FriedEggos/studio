
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
import { Camera, Star } from "lucide-react";
import { useUser, useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
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

  const renderStars = (rating?: number) => {
    const stars = [];
    const totalStars = 5;
    const filledStars = rating || 0;
    for (let i = 1; i <= totalStars; i++) {
        stars.push(
            <Star
                key={i}
                className={`h-5 w-5 ${i <= filledStars ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`}
            />
        );
    }
    return stars;
  };

  const getBadgeColor = (badgeName?: string) => {
      switch (badgeName?.toLowerCase()) {
          case 'legend':
              return 'bg-yellow-400 text-yellow-900 hover:bg-yellow-400/90';
          case 'active':
              return 'bg-blue-500 text-white hover:bg-blue-500/90';
          case 'rookie':
              return 'bg-gray-400 text-gray-900 hover:bg-gray-400/90';
          default:
              return 'bg-secondary text-secondary-foreground';
      }
  };

  if (isUserLoading || isProfileLoading || !user || !userProfile) {
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
    <>
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
          My Profile
        </h1>
        <Card>
          <CardHeader className="items-center text-center">
            <Link href="/profile/edit" className="relative group">
              <Avatar className="w-24 h-24 mb-4">
                <AvatarImage src={user.photoURL || `https://picsum.photos/seed/${user.uid}/200/200`} />
                <AvatarFallback>{userProfile?.displayName?.[0].toUpperCase() || user.email?.[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 mb-4 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Camera className="h-8 w-8 text-white" />
              </div>
            </Link>
            <CardTitle className="font-headline">{userProfile?.displayName || "JTMK Student"}</CardTitle>
            <CardDescription>{userProfile?.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 my-4">
                <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium text-muted-foreground">Rank</p>
                    {userProfile?.badge ? (
                         <Badge className={cn('text-sm', getBadgeColor(userProfile.badge))}>{userProfile.badge}</Badge>
                    ) : (
                        <span className="text-sm font-semibold">Not Ranked</span>
                    )}
                </div>
                 <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium text-muted-foreground">Rating</p>
                    <div className="flex items-center">
                        {renderStars(userProfile?.rating)}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4 my-4 text-sm border-t pt-4">
              <div className="flex justify-between items-center">
                  <span className="font-semibold text-muted-foreground">Matric ID</span>
                  <span>{userProfile?.matricId || 'Not set'}</span>
              </div>
              <div className="flex justify-between items-center">
                  <span className="font-semibold text-muted-foreground">Phone Number</span>
                  <span>{userProfile?.phoneNumber || 'Not set'}</span>
              </div>
              <div className="flex justify-between items-center">
                  <span className="font-semibold text-muted-foreground">Department</span>
                  <span>{userProfile?.course || 'Not set'}</span>
              </div>
            </div>
            <Button className="w-full" asChild>
              <Link href="/profile/edit">Edit Profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
