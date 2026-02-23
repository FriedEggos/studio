
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
import { collectionGroup, query, where, getDocs, collection, doc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Ticket } from "lucide-react";

// Interfaces for our data structures
interface Attendance {
    id: string;
    programId: string;
    createdAt: { toDate: () => Date };
    checkOutAt?: { toDate: () => Date };
    checkOutStatus?: 'ok' | 'geo_failed';
    email: string;
}

interface Program {
    id: string;
    title: string;
    startDate: string; // ISO string
}

interface UserProfile {
    role: 'student' | 'admin';
}

// Combined type for easy rendering
type AttendedProgram = Attendance & {
    programTitle: string;
    programStartDate: string;
};

const StatusBadge = ({ status }: { status: Attendance['checkOutStatus'] }) => {
    if (status === 'ok') {
        return <Badge variant="secondary" className="bg-green-100 text-green-800">GPS Verified</Badge>;
    }
    if (status === 'geo_failed') {
        return <Badge variant="destructive">GPS Failed</Badge>;
    }
    return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">No Checkout Yet</Badge>;
};


export default function StudentDashboard() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

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
                // 1. Get all attendance records for the user's email
                const attendanceQuery = query(
                    collectionGroup(firestore, 'attendances'),
                    where('email', '==', user.email)
                );
                const attendanceSnapshot = await getDocs(attendanceQuery);
                const attendances = attendanceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Attendance[];

                if (attendances.length === 0) {
                    setAttendedPrograms([]);
                    setIsLoading(false);
                    return;
                }

                // 2. Get unique program IDs from the attendance records
                const programIds = [...new Set(attendances.map(a => a.programId))];
                
                // 3. Fetch the details for all attended programs in a single query
                const programsQuery = query(collection(firestore, 'programs'), where('__name__', 'in', programIds));
                const programsSnapshot = await getDocs(programsQuery);
                const programsMap = new Map<string, Program>();
                programsSnapshot.forEach(doc => {
                    programsMap.set(doc.id, { id: doc.id, ...doc.data() } as Program);
                });

                // 4. Merge program details into attendance records
                const populatedAttendances = attendances.map(att => {
                    const program = programsMap.get(att.programId);
                    return {
                        ...att,
                        programTitle: program?.title || 'Unknown Program',
                        programStartDate: program?.startDate || new Date().toISOString(),
                    };
                }).sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()); // 5. Sort by latest first
                
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
            setIsLoading(false); // No user, so not loading
        }
    }, [user, firestore, isUserLoading]);
    
    const renderContent = () => {
        if (isLoading || isUserLoading || isProfileLoading) {
            return (
                <div className="grid gap-6">
                    {[...Array(3)].map((_, i) => (
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
                                <Skeleton className="h-6 w-24" />
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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {attendedPrograms.map(item => (
                    <Card key={item.id} className="rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col">
                        <CardHeader>
                            <CardTitle className="font-bold">{item.programTitle}</CardTitle>
                            <CardDescription>{format(parseISO(item.programStartDate), 'd MMMM yyyy')}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow space-y-3 text-sm">
                            <div>
                                <p className="font-medium text-muted-foreground">Check-in</p>
                                <p>{format(item.createdAt.toDate(), 'p, d MMM yyyy')}</p>
                            </div>
                             <div>
                                <p className="font-medium text-muted-foreground">Check-out</p>
                                <p>{item.checkOutAt ? format(item.checkOutAt.toDate(), 'p, d MMM yyyy') : 'N/A'}</p>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <StatusBadge status={item.checkOutStatus} />
                        </CardFooter>
                    </Card>
                ))}
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
