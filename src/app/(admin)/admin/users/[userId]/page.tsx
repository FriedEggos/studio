'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Star } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface UserProfile {
    id: string;
    displayName: string;
    email: string;
    role: string;
    matricId?: string;
    phoneNumber?: string;
    course?: string;
    badge?: string;
    rating?: number;
}

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.userId as string;
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!userId || !firestore) return null;
    return doc(firestore, 'users', userId);
  }, [userId, firestore]);

  const { data: userProfile, isLoading } = useDoc<UserProfile>(userDocRef);

  const renderStars = (rating?: number) => {
    const stars = [];
    const totalStars = 5;
    const filledStars = rating || 0;
    for (let i = 1; i <= totalStars; i++) {
        stars.push(
            <Star
                key={i}
                className={cn('h-5 w-5', i <= filledStars ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30')}
            />
        );
    }
    return stars;
  };

  const getBadgeColor = (badgeName?: string) => {
      const lowerCaseBadge = badgeName?.toLowerCase();
      switch (lowerCaseBadge) {
          case 'legend':
              return 'bg-yellow-400 text-yellow-900 hover:bg-yellow-400/90';
          case 'elite participant':
              return 'bg-indigo-500 text-white hover:bg-indigo-500/90';
          case 'commitment pro':
              return 'bg-purple-500 text-white hover:bg-purple-500/90';
          case 'active':
              return 'bg-blue-500 text-white hover:bg-blue-500/90';
          case 'rookie':
              return 'bg-green-500 text-white hover:bg-green-500/90';
          default:
              return 'bg-secondary text-secondary-foreground';
      }
  };

  if (isLoading || !userProfile) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Button variant="outline" asChild>
            <Link href="/admin/users">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Users
            </Link>
        </Button>
        <Card>
          <CardHeader className="items-center text-center">
            <Skeleton className="w-24 h-24 rounded-full mb-4" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-2 gap-4 my-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
        <Button variant="outline" asChild>
            <Link href="/admin/users">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Users
            </Link>
        </Button>

      <Card>
        <CardHeader className="items-center text-center">
          <Avatar className="w-24 h-24 mb-4">
            <AvatarImage src={`https://picsum.photos/seed/${userProfile.id}/200/200`} />
            <AvatarFallback>{userProfile.displayName?.[0].toUpperCase() || userProfile.email?.[0].toUpperCase()}</AvatarFallback>
          </Avatar>
          <CardTitle className="font-headline">{userProfile.displayName}</CardTitle>
          <CardDescription>{userProfile.email}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-6 border-t">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Role</p>
                    <p className="capitalize">{userProfile.role}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Matric ID</p>
                    <p>{userProfile.matricId || 'Not set'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
                    <p>{userProfile.phoneNumber || 'Not set'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Department</p>
                    <p>{userProfile.course || 'Not set'}</p>
                </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
