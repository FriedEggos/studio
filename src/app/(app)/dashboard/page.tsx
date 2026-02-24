
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
import { getDocs, collection, doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { format, parseISO, isToday } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Ticket, Star, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";


// Interfaces for our data structures
interface Attendance {
    id: string;
    programId: string;
    createdAt: { toDate: () => Date };
    checkOutAt?: { toDate: () => Date };
    checkOutStatus?: 'ok' | 'too_early' | 'outside_window' | 'too_short' | 'admin_override';
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

const CheckoutStatusBadge = ({ attendance }: { attendance: AttendedProgram }) => {
    if (!attendance.checkOutAt) {
        return <Badge variant="outline">No Checkout Yet</Badge>;
    }
    
    switch (attendance.checkOutStatus) {
        case 'ok':
            return <Badge className="bg-green-100 text-green-800 border-green-200">Verified</Badge>;
        case 'admin_override':
            return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Admin Verified</Badge>;
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

    const [attendedPrograms, setAttendedPrograms] = useState<AttendedProgram[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [programToCheckout, setProgramToCheckout] = useState<AttendedProgram | null>(null);
    
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

                // Logic to find program needing checkout reminder
                const reminderProgram = populatedAttendances.find(p => 
                    !p.checkOutAt && isToday(parseISO(p.programStartDate))
                );
                setProgramToCheckout(reminderProgram || null);

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
                <div className="grid gap-6 md:grid-cols-2">
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
            <div className="grid gap-6 md:grid-cols-2">
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
        );
    };


    return (
        <div className="space-y-8">
            {programToCheckout && (
                <Alert className="bg-yellow-100 border-yellow-300 text-yellow-900 [&>svg]:text-yellow-800">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="font-bold">Peringatan</AlertTitle>
                    <AlertDescription className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <span>Anda belum melakukan Check-out untuk acara <strong>{programToCheckout.programTitle}</strong>. Sila lakukan segera!</span>
                        <Button asChild size="sm" className="bg-yellow-800 text-white hover:bg-yellow-900 mt-2 md:mt-0">
                            <Link href={`/checkout/${programToCheckout.programId}`}>Check Out Sekarang</Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <div className="space-y-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
                    My Attendance
                </h1>
                <p className="text-muted-foreground">
                    These are your attendance records recorded in the system.
                </p>
            </div>
            
            <div>
                {renderContent()}
            </div>
        </div>
    );
}
