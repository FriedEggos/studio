'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
import { Camera, Star, Trophy, Award, Shield, CheckCircle, PiggyBank } from "lucide-react";
import { useUser, useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc, collectionGroup, getDocs, query, where, collection } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
    id: string;
    displayName: string;
    email: string;
    role: 'student' | 'admin';
    matricId?: string;
    phoneNumber?: string;
    course?: string;
    badge?: string;
    rating?: number;
    rank?: number;
    totalScore?: number;
    photoURL?: string;
}

interface ParticipationHistoryItem {
    id: string;
    programTitle: string;
    createdAt: { toDate: () => Date };
    checkOutAt?: { toDate: () => Date };
}

const allBadges = [
    { name: 'Legend', icon: Trophy, criteria: 'Achieve a rating of 5 stars by high participation.', color: 'text-yellow-500' },
    { name: 'Elite Participant', icon: Award, criteria: 'Accumulate over 1000 minutes of participation.', color: 'text-indigo-500' },
    { name: 'Commitment Pro', icon: CheckCircle, criteria: 'Attend 10 or more programs.', color: 'text-purple-500' },
    { name: 'Active', icon: Shield, criteria: 'Attend 5 or more programs.', color: 'text-blue-500' },
    { name: 'Rookie', icon: Shield, criteria: 'Attend your first program.', color: 'text-green-500' },
];

export default function ProfilePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const [history, setHistory] = useState<ParticipationHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  useEffect(() => {
    if (!user?.email || !firestore) return;

    const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const programsSnap = await getDocs(collection(firestore, 'programs'));
            const programsMap = new Map(programsSnap.docs.map(doc => [doc.id, doc.data().title]));

            const attendancesQuery = query(
                collectionGroup(firestore, 'attendances'),
                where('email', '==', user.email)
            );
            const attendancesSnap = await getDocs(attendancesQuery);

            const participationHistory = attendancesSnap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: `${data.programId}_${doc.id}`,
                    programTitle: programsMap.get(data.programId) || 'Unknown Program',
                    createdAt: data.createdAt,
                    checkOutAt: data.checkOutAt,
                };
            }).sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());

            setHistory(participationHistory as ParticipationHistoryItem[]);
        } catch (error) {
            console.error("Error fetching participation history:", error);
            toast({
                variant: "destructive",
                title: "Could not load history",
                description: "There was an error fetching your participation history.",
            });
        } finally {
            setIsLoadingHistory(false);
        }
    };

    fetchHistory();
  }, [user, firestore, toast]);

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
          </CardHeader>
          <CardContent className="space-y-4">
             <Skeleton className="h-10 w-full" />
             <Skeleton className="h-40 w-full" />
             <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (userProfile.role === 'admin') {
      return (
         <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
                This profile page is for students. Please go to the{' '}
                <Link href="/admin/dashboard" className="font-bold underline">Admin Dashboard</Link>.
            </AlertDescription>
        </Alert>
      )
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

        <Card>
          <CardHeader>
              <CardTitle>Achievement Gallery</CardTitle>
              <CardDescription>Your engagement progress and badges.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
               <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-muted/50">
                      <p className="text-sm font-medium text-muted-foreground">Global Rank</p>
                       <p className="text-3xl font-bold">#{userProfile.rank || 'N/A'}</p>
                  </div>
                   <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-muted/50">
                      <p className="text-sm font-medium text-muted-foreground">Rating</p>
                      <div className="flex items-center">
                          {renderStars(userProfile?.rating)}
                      </div>
                  </div>
              </div>
               <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <PiggyBank className="h-6 w-6 text-primary" />
                      <p className="text-sm font-medium text-muted-foreground">Accumulated Points</p>
                    </div>
                    <p className="text-2xl font-bold">{userProfile.totalScore || 0}</p>
                </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3 text-center">Badges</p>
                <TooltipProvider>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-4 text-center">
                    {allBadges.map((badge) => {
                      const hasBadge = userProfile.badge === badge.name;
                       return (
                        <Tooltip key={badge.name}>
                          <TooltipTrigger>
                             <div className="flex flex-col items-center gap-2">
                                <div className={cn(
                                    "h-16 w-16 rounded-full flex items-center justify-center bg-muted",
                                    hasBadge && "bg-primary/10 border-2 border-primary"
                                )}>
                                    <badge.icon className={cn(
                                        "h-8 w-8",
                                        hasBadge ? badge.color : "text-muted-foreground/40"
                                    )} />
                                </div>
                                <p className={cn(
                                    "text-xs font-medium",
                                    hasBadge ? "text-foreground" : "text-muted-foreground"
                                )}>{badge.name}</p>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-semibold">{badge.name}</p>
                            <p className="text-xs text-muted-foreground">{badge.criteria}</p>
                            {!hasBadge && <p className="text-xs text-destructive mt-1">(Locked)</p>}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </TooltipProvider>
              </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Program Participation History</CardTitle>
                <CardDescription>A record of all the programs you have attended.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Program Name</TableHead>
                            <TableHead>Date Joined</TableHead>
                            <TableHead>Check-out Time</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingHistory ? (
                             [...Array(3)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-5" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                </TableRow>
                            ))
                        ) : history.length > 0 ? (
                            history.map((item, index) => (
                                <TableRow key={item.id}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell className="font-medium">{item.programTitle}</TableCell>
                                    <TableCell>{item.createdAt ? format(item.createdAt.toDate(), 'Pp') : '-'}</TableCell>
                                    <TableCell>{item.checkOutAt ? format(item.checkOutAt.toDate(), 'Pp') : '-'}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    No programs joined yet. Start participating to earn badges!
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
    </>
  );
}
