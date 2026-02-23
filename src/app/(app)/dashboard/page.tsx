
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
import { AlertCircle, Ticket, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// Interfaces for our data structures
interface Attendance {
    id: string;
    programId: string;
    createdAt: { toDate: () => Date };
    checkOutAt?: { toDate: () => Date };
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

export default function StudentDashboard() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [attendedPrograms, setAttendedPrograms] = useState<AttendedProgram[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
    
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
                // 1. Get all programs. This is less efficient but avoids the index requirement.
                const programsSnapshot = await getDocs(collection(firestore, 'programs'));
                const programs = programsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Program[];

                if (programs.length === 0) {
                    setAttendedPrograms([]);
                    setIsLoading(false);
                    return;
                }

                // 2. For each program, create a promise to get the user's specific attendance doc.
                const attendancePromises = programs.map(p => 
                    getDoc(doc(firestore, `programs/${p.id}/attendances`, user.email!))
                );
                
                const attendanceSnapshots = await Promise.all(attendancePromises);

                // 3. Filter for attendances that exist and merge with program data.
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

                // 4. Sort by latest first
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
            setIsLoading(false); // No user, so not loading
        }
    }, [user, firestore, isUserLoading]);

    const handleCheckout = async (programId: string, email: string) => {
        if (!firestore) return;
        const attendanceId = email; 
        setCheckingOutId(attendanceId);
        try {
            const attendanceDocRef = doc(firestore, `programs/${programId}/attendances`, attendanceId);
            await updateDoc(attendanceDocRef, {
                checkOutAt: serverTimestamp(),
            });

            // Update local state to reflect the change immediately
            const now = new Date();
            setAttendedPrograms(prev =>
                prev.map(att =>
                    att.programId === programId && att.email === email
                        ? { ...att, checkOutAt: { toDate: () => now } }
                        : att
                )
            );

            toast({
                title: "Check-out Berjaya",
                description: "Waktu keluar anda telah direkodkan.",
            });
        } catch (error) {
            console.error("Error during check-out:", error);
            toast({
                variant: "destructive",
                title: "Gagal Check-out",
                description: "Gagal merekodkan waktu keluar anda. Sila hubungi penganjur.",
            });
        } finally {
            setCheckingOutId(null);
        }
    };
    
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
                                <p>{item.checkOutAt ? format(item.checkOutAt.toDate(), 'p, d MMM') : 'N/A'}</p>
                            </div>
                        </CardContent>
                        <CardFooter>
                           {item.checkOutAt ? (
                                <Badge variant="secondary" className="bg-green-100 text-green-800">Checked Out</Badge>
                            ) : (
                                <Button
                                    onClick={() => handleCheckout(item.programId, item.email)}
                                    disabled={checkingOutId === item.email}
                                    size="sm"
                                >
                                    {checkingOutId === item.email ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Sila tunggu...
                                        </>
                                    ) : (
                                        'Check-out'
                                    )}
                                </Button>
                            )}
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
