
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
import { getDocs, collection, doc, getDoc, Timestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Ticket, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";


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
    startDateTime: Timestamp;
    endDateTime: Timestamp;
    checkOutOpenTime?: Timestamp;
    checkOutCloseTime?: Timestamp;
}

// Combined type for easy rendering
type AttendedProgram = Attendance & {
    programTitle: string;
    programStartDateTime: Timestamp;
    programEndDateTime: Timestamp;
};

const CheckoutStatusBadge = ({ attendance }: { attendance: AttendedProgram }) => {
    if (!attendance.checkOutAt) {
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">No Checkout Yet</Badge>;
    }
    
    switch (attendance.checkOutStatus) {
        case 'ok':
            return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Checked Out (Verified)</Badge>;
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
    const { toast } = useToast();

    const [attendedPrograms, setAttendedPrograms] = useState<AttendedProgram[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null);
    const [programToCheckout, setProgramToCheckout] = useState<AttendedProgram | null>(null);
    
    const userDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, 'users', user.uid);
    }, [user, firestore]);
    
    const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

    const fetchAttendanceHistory = useCallback(async () => {
        if (!user || !firestore || !user.email) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const programsSnapshot = await getDocs(collection(firestore, 'programs'));
            const programsMap = new Map<string, Program>();
            programsSnapshot.docs.forEach(doc => {
                programsMap.set(doc.id, { id: doc.id, ...doc.data() } as Program);
            });

            const userEmail = user.email.toLowerCase();
            const attendancePromises = programsSnapshot.docs.map(programDoc => 
                getDoc(doc(firestore, 'programs', programDoc.id, 'attendances', userEmail))
            );
            
            const attendanceSnapshots = await Promise.all(attendancePromises);

            const populatedAttendances: AttendedProgram[] = [];
            attendanceSnapshots.forEach(docSnap => {
                if (docSnap.exists()) {
                    const attendance = { id: docSnap.id, ...docSnap.data() } as Attendance;
                    const program = programsMap.get(attendance.programId);
                    if (program) {
                        populatedAttendances.push({
                            ...attendance,
                            programTitle: program.title,
                            programStartDateTime: program.startDateTime,
                            programEndDateTime: program.endDateTime,
                        });
                    }
                }
            });

            populatedAttendances.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
            setAttendedPrograms(populatedAttendances);
            
            const now = new Date();
            const reminderProgram = populatedAttendances.find(p => {
                if (p.checkOutAt || !p.programEndDateTime) return false;
                const programEndDateTime = p.programEndDateTime.toDate();
                const cutoff3Hours = new Date(programEndDateTime.getTime() + 3 * 60 * 60 * 1000);
                return now <= cutoff3Hours;
            });
            setProgramToCheckout(reminderProgram || null);

        } catch (error) {
            console.error("Error fetching attendance history:", error);
        } finally {
            setIsLoading(false);
        }
    }, [user, firestore]);


    useEffect(() => {
        if (user && !isUserLoading) {
            fetchAttendanceHistory();
        }
    }, [user, isUserLoading, fetchAttendanceHistory]);
    
    const handleCheckout = async (programId: string) => {
        if (!firestore || !user || !user.email) return;
        setIsCheckingOut(programId);

        const studentEmail = user.email.toLowerCase();
        const programDocRef = doc(firestore, 'programs', programId);
        const attendanceDocRef = doc(firestore, 'programs', programId, 'attendances', studentEmail);

        try {
            const [programSnap, attendanceSnap] = await Promise.all([
                getDoc(programDocRef),
                getDoc(attendanceDocRef),
            ]);

            if (!attendanceSnap.exists()) {
                toast({ variant: 'destructive', title: 'Error', description: 'Rekod kehadiran tidak dijumpai.' });
                return;
            }
            if (attendanceSnap.data().checkOutAt) {
                toast({ title: 'Info', description: 'Anda sudah check-out untuk program ini.' });
                return;
            }
            if (!programSnap.exists()) {
                toast({ variant: 'destructive', title: 'Error', description: 'Program not found.' });
                return;
            }
            
            const program = programSnap.data() as Program;
            const attendance = attendanceSnap.data();
            const now = new Date();
            const checkInAt = (attendance.createdAt as Timestamp).toDate();
            
            let checkOutStatus: string | null = null;
            
            // Rule A — Must be after check-in
            if (now <= checkInAt) {
                checkOutStatus = "too_early";
            }
            
            // Rule D — Hard cut-off
            if (!checkOutStatus && program.endDateTime) {
                const endDateTime = program.endDateTime.toDate();
                const cutoff3Hours = new Date(endDateTime.getTime() + 3 * 60 * 60 * 1000);
                if (now > cutoff3Hours) {
                    checkOutStatus = "outside_window";
                }
            }

            // Rule B — Must be inside admin check-out window
            if (!checkOutStatus) {
                const checkOutOpenTime = program.checkOutOpenTime ? program.checkOutOpenTime.toDate() : null;
                const checkOutCloseTime = program.checkOutCloseTime ? program.checkOutCloseTime.toDate() : null;
                if ((checkOutOpenTime && now < checkOutOpenTime) || (checkOutCloseTime && now > checkOutCloseTime)) {
                    checkOutStatus = "outside_window";
                }
            }
            
            // Rule C — Minimum duration
            const durationMinutes = Math.floor((now.getTime() - checkInAt.getTime()) / 60000);
            if (!checkOutStatus && durationMinutes < 60) {
                checkOutStatus = "too_short";
            }
            
            if (!checkOutStatus) {
                checkOutStatus = "ok";
            }

            await updateDoc(attendanceDocRef, {
                checkOutAt: Timestamp.fromDate(now),
                durationMinutes: durationMinutes,
                checkOutStatus: checkOutStatus,
            });

            if (checkOutStatus === 'ok') {
                toast({ title: 'Success!', description: 'Check-out berjaya dan disahkan.' });
            } else {
                toast({ variant: 'destructive', title: 'Check-out Recorded', description: 'Check-out direkodkan tetapi status tidak sah.' });
            }

            fetchAttendanceHistory();

        } catch (error) {
            console.error("Checkout error:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'An error occurred during checkout.' });
        } finally {
            setIsCheckingOut(null);
        }
    };
    
    const renderContent = () => {
        if (isLoading || isUserLoading || isProfileLoading) {
            return (
                <div className="grid gap-6 md:grid-cols-2">
                    {[...Array(2)].map((_, i) => (
                        <Card key={i} className="rounded-xl">
                            <CardHeader> <Skeleton className="h-6 w-3/4" /> <Skeleton className="h-4 w-1/2 mt-2" /> </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-4"> <Skeleton className="h-10 w-full" /> <Skeleton className="h-10 w-full" /> </CardContent>
                            <CardFooter> <Skeleton className="h-10 w-28" /> </CardFooter>
                        </Card>
                    ))}
                </div>
            );
        }

        if (!user) {
            return (
                <Alert> <AlertCircle className="h-4 w-4" /> <AlertTitle>Not Logged In</AlertTitle> <AlertDescription> Please log in to view your attendance records. </AlertDescription> </Alert>
            );
        }

        if (userProfile && userProfile.role !== 'student') {
             return (
                <Alert variant="destructive"> <AlertCircle className="h-4 w-4" /> <AlertTitle>Access Denied</AlertTitle> <AlertDescription> This page is for students only. </AlertDescription> </Alert>
            );
        }

        if (attendedPrograms.length === 0) {
            return (
                 <div className="text-center py-10 border-2 border-dashed rounded-xl">
                    <Ticket className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No attendance records found.</h3>
                    <p className="mt-1 text-sm text-muted-foreground"> Attend a program to see your history here. </p>
                </div>
            );
        }

        return (
            <div className="grid gap-6 md:grid-cols-2">
                {attendedPrograms.map(item => (
                    <Card key={`${item.programId}-${item.id}`} className="rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col">
                        <CardHeader>
                            <CardTitle className="font-bold">{item.programTitle}</CardTitle>
                            <CardDescription>{format(item.programStartDateTime.toDate(), 'd MMMM yyyy')}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow grid grid-cols-2 gap-4 text-sm">
                            <div> <p className="font-medium text-muted-foreground">Check-in</p> <p>{item.createdAt ? format(item.createdAt.toDate(), 'p, d MMM') : 'N/A'}</p> </div>
                            <div> <p className="font-medium text-muted-foreground">Check-out</p> <p>{item.checkOutAt ? format(item.checkOutAt.toDate(), 'p, d MMM') : '-'}</p> </div>
                        </CardContent>
                        <CardFooter className="flex-col items-start gap-2 pt-4">
                            <CheckoutStatusBadge attendance={item} />
                            {!item.checkOutAt && (
                                <Button
                                    onClick={() => handleCheckout(item.programId)}
                                    disabled={isCheckingOut === item.programId}
                                    className="mt-2 rounded-md bg-yellow-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-yellow-700"
                                >
                                    {isCheckingOut === item.programId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Check-out Now
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
            {programToCheckout && (
                <Alert className="bg-yellow-100 border-yellow-300 text-yellow-900 [&>svg]:text-yellow-800">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="font-bold">Peringatan</AlertTitle>
                    <AlertDescription className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <span>Peringatan: Anda belum melakukan Check-out untuk program <strong>{programToCheckout.programTitle}</strong>. Sila lakukan segera!</span>
                        <Button 
                            onClick={() => handleCheckout(programToCheckout.programId)}
                            disabled={isCheckingOut === programToCheckout.programId}
                            size="sm" 
                            className="bg-[#966b2d] text-white hover:bg-[#966b2d]/90 mt-2 md:mt-0"
                        >
                            {isCheckingOut === programToCheckout.programId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Check Out Sekarang
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <div className="space-y-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline"> My Attendance </h1>
                <p className="text-muted-foreground"> These are your attendance records recorded in the system. </p>
            </div>
            
            <div>
                {renderContent()}
            </div>
        </div>
    );
}


    
