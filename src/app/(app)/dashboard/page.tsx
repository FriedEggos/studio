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
import { useRouter } from "next/navigation";


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
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">No Checkout Yet</Badge>;
    }
    
    switch (attendance.checkOutStatus) {
        case 'ok':
            return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Verified</Badge>;
        case 'admin_override':
            return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">Admin Verified</Badge>;
        case 'too_early':
        case 'outside_window':
        case 'too_short':
            return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">Invalid Checkout</Badge>;
        default:
            return <Badge variant="secondary">Checked Out</Badge>;
    }
}


export default function StudentDashboard() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();

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
                // Step 1: Fetch all programs and create a Map for quick lookup
                const programsSnapshot = await getDocs(collection(firestore, 'programs'));
                const programsMap = new Map<string, Program>();
                programsSnapshot.docs.forEach(doc => {
                    programsMap.set(doc.id, { id: doc.id, ...doc.data() } as Program);
                });

                // Step 2: For each program, attempt to fetch the user's specific attendance document.
                // This avoids the collectionGroup query that requires a special index.
                const userEmail = user.email.toLowerCase();
                const attendancePromises = programsSnapshot.docs.map(programDoc => 
                    getDoc(doc(firestore, 'programs', programDoc.id, 'attendances', userEmail))
                );
                
                const attendanceSnapshots = await Promise.all(attendancePromises);

                // Step 3: Filter for existing attendances and join with program data
                const populatedAttendances: AttendedProgram[] = [];
                attendanceSnapshots.forEach(docSnap => {
                    if (docSnap.exists()) {
                        const attendance = { id: docSnap.id, ...docSnap.data() } as Attendance;
                        const program = programsMap.get(attendance.programId);
                        if (program) {
                            populatedAttendances.push({
                                ...attendance,
                                programTitle: program.title,
                                programStartDate: program.startDate,
                            });
                        }
                    }
                });

                // Step 4: Sort and set state
                populatedAttendances.sort((a, b) => {
                    const dateA = a.createdAt?.toDate()?.getTime() || 0;
                    const dateB = b.createdAt?.toDate()?.getTime() || 0;
                    return dateB - dateA;
                });
                
                setAttendedPrograms(populatedAttendances);

                // Step 5: Find program needing checkout reminder
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
    
    const handleCheckout = (programId: string) => {
        router.push(`/checkout/${programId}`);
    };
    
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
                        <CardFooter className="flex-col items-start gap-2">
                            <CheckoutStatusBadge attendance={item} />
                            {!item.checkOutAt && (
                                <button
                                    onClick={() => handleCheckout(item.programId)}
                                    className="mt-2 rounded-md bg-yellow-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-yellow-700"
                                >
                                    Check-out Now
                                </button>
                            )}
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
                        <span>Peringatan: Anda belum melakukan Check-out untuk program <strong>{programToCheckout.programTitle}</strong>. Sila lakukan segera!</span>
                        <Button asChild size="sm" className="bg-[#966b2d] text-white hover:bg-[#966b2d]/90 mt-2 md:mt-0">
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
