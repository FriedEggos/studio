
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
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";

interface UserProfile {
    id: string;
    displayName: string;
    email: string;
    role: 'student' | 'admin';
    matricId?: string;
    phoneNumber?: string;
    course?: string;
    photoURL?: string;
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
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Conditional Rendering based on role
  if (userProfile.role === 'admin') {
      return (
          <div className="space-y-6 max-w-2xl mx-auto">
              <Button variant="outline" asChild>
                  <Link href="/admin/users"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Users</Link>
              </Button>
              <Card>
                  <CardHeader className="items-center text-center">
                      <Avatar className="w-24 h-24 mb-4">
                          <AvatarImage src={userProfile.photoURL || `https://ui-avatars.com/api/?name=${getInitials(userProfile.displayName || '')}&background=random&color=fff`} />
                          <AvatarFallback>{getInitials(userProfile.displayName || userProfile.email || '')}</AvatarFallback>
                      </Avatar>
                      <CardTitle className="font-headline">{userProfile.displayName}</CardTitle>
                      <CardDescription>{userProfile.email}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-6 border-t">
                          <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground">Role</p>
                              <p className="capitalize font-semibold text-primary">{userProfile.role}</p>
                          </div>
                      </div>
                  </CardContent>
              </Card>
          </div>
      );
  }

  // Student Profile View
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
            <AvatarImage src={userProfile.photoURL || `https://ui-avatars.com/api/?name=${getInitials(userProfile.displayName || '')}&background=random&color=fff`} />
            <AvatarFallback>{getInitials(userProfile.displayName || userProfile.email || '')}</AvatarFallback>
          </Avatar>
          <CardTitle className="font-headline">{userProfile.displayName}</CardTitle>
          <CardDescription>{userProfile.email}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
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
