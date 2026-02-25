
'use client';

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
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc, collection, collectionGroup, getDocs, query, where } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Star, Trophy, Award, Shield, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";


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

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.userId as string;
  const firestore = useFirestore();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => {
    if (!userId || !firestore) return null;
    return doc(firestore, 'users', userId);
  }, [userId, firestore]);

  const { data: userProfile, isLoading } = useDoc<UserProfile>(userDocRef);

  const [history, setHistory] = useState<ParticipationHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    if (!userProfile?.email || !firestore) {
        // If it's an admin, no need to fetch history.
        if (userProfile && userProfile.role === 'admin') {
            setIsLoadingHistory(false);
        }
        return;
    };

    const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const programsSnap = await getDocs(collection(firestore, 'programs'));
            const programsMap = new Map(programsSnap.docs.map(doc => [doc.id, doc.data().title]));

            const attendancesQuery = query(
                collectionGroup(firestore, 'attendances'),
                where('email', '==', userProfile.email)
            );
            const attendancesSnap = await getDocs(attendancesQuery);

            const participationHistory = attendancesSnap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
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
                description: "There was an error fetching the user's participation history.",
            });
        } finally {
            setIsLoadingHistory(false);
        }
    };

    fetchHistory();
  }, [userProfile, firestore, toast]);


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
                          <AvatarImage src={userProfile.photoURL || `https://picsum.photos/seed/${userProfile.id}/200/200`} />
                          <AvatarFallback>{userProfile.displayName?.[0].toUpperCase() || userProfile.email?.[0].toUpperCase()}</AvatarFallback>
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
            <AvatarImage src={userProfile.photoURL || `https://picsum.photos/seed/${userProfile.id}/200/200`} />
            <AvatarFallback>{userProfile.displayName?.[0].toUpperCase() || userProfile.email?.[0].toUpperCase()}</AvatarFallback>
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
      
      <Card>
          <CardHeader>
              <CardTitle>Achievement Gallery</CardTitle>
              <CardDescription>The student's engagement progress and badges.</CardDescription>
          </CardHeader>
          <CardContent>
               <div className="grid grid-cols-2 gap-4 my-4">
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

              <div className="mt-6">
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
            <CardDescription>A record of all programs this student has attended.</CardDescription>
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
                                This student has not joined any programs yet.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
    </div>
  );
}
