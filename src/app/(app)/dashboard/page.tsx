
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { getDocs, collection, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Ticket, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Interfaces for our data structures
interface Attendance {
    id: string;
    programId: string;
    createdAt: { toDate: () => Date };
    checkOutAt?: { toDate: () => Date };
    checkOutStatus?: 'ok' | 'geo_failed' | 'too_early' | 'outside_window' | 'too_short';
    email: string;
}

interface Program {
    id: string;
    title: string;
    startDate: string; // ISO string
}

interface UserProfile {
    role: 'student' | 'admin';
    badge?: string;
    rating?: number;
    displayName?: string;
}

// Combined type for easy rendering
type AttendedProgram = Attendance & {
    programTitle: string;
    programStartDate: string;
};

const ActivityStatsCard = ({ badge, rating }: { badge?: string; rating?: number; }) => {
    if (!badge && (rating === undefined || rating === null)) {
        return null; // Don't render if there's no data
    }

    const renderStars = () => {
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

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-xl font-headline">My Activity Stats</CardTitle>
                <CardDescription>Your current rank and rating.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium text-muted-foreground">Rank</p>
                    {badge ? (
                         <Badge className={cn('text-sm', getBadgeColor(badge))}>{badge}</Badge>
                    ) : (
                        <span className="text-sm font-semibold">Not Ranked</span>
                    )}
                </div>
                 <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium text-muted-foreground">Rating</p>
                    <div className="flex items-center">
                        {renderStars()}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const CheckoutStatusBadge = ({ attendance }: { attendance: AttendedProgram }) => {
    if (!attendance.checkOutAt) {
        return <Badge variant="outline">No Checkout Yet</Badge>;
    }
    
    switch (attendance.checkOutStatus) {
        case 'ok':
            return <Badge className="bg-green-100 text-green-800 border-green-200">Verified</Badge>;
        case 'geo_failed':
            return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">GPS Failed</Badge>;
        case 'too_early':
        case 'outside_window':
        case 'too_short':
            return <Badge className="bg-red-100 text-red-800 border-red-200">Invalid Checkout</Badge>;
        default:
            return <Badge variant="secondary">Checked Out</Badge>;
    }
}


export default function StudentDashboard() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [attendedPrograms, setAttendedPrograms] = useState<AttendedProgram[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const userDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, 'users', user.uid);
    }, [user, firestore]);
    
    const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

    useEffect(() => {
        const fetchAttendanceHistory = async () => {
            if (!user || !firestore || !user.email) return;

            setIsLoading(true);
            try {
                const programsSnapshot = await getDocs(collection(firestore, 'programs'));
                const programs = programsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Program[];

                if (programs.length === 0) {
                    setAttendedPrograms([]);
                    setIsLoading(false);
                    return;
                }

                const attendancePromises = programs.map(p => 
                    getDoc(doc(firestore, `programs/${p.id}/attendances`, user.email!))
                );
                
                const attendanceSnapshots = await Promise.all(attendancePromises);

                const populatedAttendances: AttendedProgram[] = [];
                attendanceSnapshots.forEach((attendanceSnap, index) => {
                    if (attendanceSnap.exists()) {
                        const program = programs[index];
                        const attendance = { id: attendanceSnap.id, ...attendanceSnap.data() } as Attendance;
                        populatedAttendances.push({
                            ...attendance,
                            programTitle: program.title,
                            programStartDate: program.startDate,
                        });
                    }
                });

                populatedAttendances.sort((a, b) => {
                    const dateA = a.createdAt?.toDate()?.getTime() || 0;
                    const dateB = b.createdAt?.toDate()?.getTime() || 0;
                    return dateB - dateA;
                });
                
                setAttendedPrograms(populatedAttendances);

            } catch (error) {
                console.error("Error fetching attendance history:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (user && !isUserLoading) {
            fetchAttendanceHistory();
        } else if (!isUserLoading) {
            setIsLoading(false);
        }
    }, [user, firestore, isUserLoading]);
    
    const renderContent = () => {
        if (isLoading || isUserLoading || isProfileLoading) {
            return (
                <div className="grid gap-6">
                    <ActivityStatsCard />
                    {[...Array(2)].map((_, i) => (
                        <Card key={i} className="rounded-xl">
                            <CardHeader>
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-4 w-1/2 mt-2" />
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-4">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </CardContent>
                            <CardFooter>
                                <Skeleton className="h-10 w-28" />
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            );
        }

        if (!user) {
            return (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Not Logged In</AlertTitle>
                    <AlertDescription>
                        Please log in to view your attendance records.
                    </AlertDescription>
                </Alert>
            );
        }

        if (userProfile && userProfile.role !== 'student') {
             return (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>
                        This page is for students only.
                    </AlertDescription>
                </Alert>
            );
        }

        if (attendedPrograms.length === 0) {
            return (
                 <div className="text-center py-10 border-2 border-dashed rounded-xl">
                    <Ticket className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No attendance records found.</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Attend a program to see your history here.
                    </p>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                <ActivityStatsCard badge={userProfile?.badge} rating={userProfile?.rating} />
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {attendedPrograms.map(item => (
                        <Card key={`${item.programId}-${item.email}`} className="rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col">
                            <CardHeader>
                                <CardTitle className="font-bold">{item.programTitle}</CardTitle>
                                <CardDescription>{format(parseISO(item.programStartDate), 'd MMMM yyyy')}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="font-medium text-muted-foreground">Check-in</p>
                                    <p>{item.createdAt ? format(item.createdAt.toDate(), 'p, d MMM') : 'N/A'}</p>
                                </div>
                                 <div>
                                    <p className="font-medium text-muted-foreground">Check-out</p>
                                    <p>{item.checkOutAt ? format(item.checkOutAt.toDate(), 'p, d MMM') : '-'}</p>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <CheckoutStatusBadge attendance={item} />
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        );
    };


    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
                    My Attendance
                </h1>
                <p className="text-muted-foreground">
                    These are your attendance records recorded in the system.
                </p>
            </div>
            
            {renderContent()}
        </div>
    );
}
