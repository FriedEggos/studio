
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
import { useUser, useFirestore, useMemoFirebase, useCollection, useDoc } from "@/firebase";
import { getDocs, collection, doc, getDoc, Timestamp, updateDoc, query, orderBy, collectionGroup, where } from "firebase/firestore";
import { useEffect, useState, useCallback }from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Ticket, AlertTriangle, Loader2, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
interface CombinedProgram extends Program {
  attendance?: Attendance;
}

const ProgramStatusBadge = ({ status }: { status: 'upcoming' | 'ongoing' | 'completed' }) => {
    const variant = status === 'completed' ? 'outline' : status === 'ongoing' ? 'default' : 'secondary';
    return <Badge variant={variant} className="capitalize">{status}</Badge>;
}

const CheckoutStatusBadge = ({ attendance }: { attendance: Attendance }) => {
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
    const { toast } = useToast();

    const [programs, setPrograms] = useState<CombinedProgram[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null);
    const [now, setNow] = useState(new Date());

    const userDocRef = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return doc(firestore, 'users', user.uid);
    }, [user, firestore]);
    
    const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000); // Update time every 30 seconds
        return () => clearInterval(timer);
    }, []);

    const fetchProgramsAndAttendance = useCallback(async () => {
        if (!user || !firestore || !user.email) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);

        try {
            const programsQuery = query(collection(firestore, 'programs'), orderBy('startDateTime', 'desc'));
            const attendancesQuery = query(collectionGroup(firestore, 'attendances'), where('email', '==', user.email));
            
            const [programsSnap, attendancesSnap] = await Promise.all([
                getDocs(programsQuery),
                getDocs(attendancesQuery)
            ]);

            const allPrograms = programsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Program));
            
            const userAttendances = new Map<string, Attendance>();
            attendancesSnap.forEach(doc => {
                const att = doc.data();
                userAttendances.set(att.programId, { id: doc.id, ...att } as Attendance);
            });

            const combinedPrograms = allPrograms.map(prog => ({
                ...prog,
                attendance: userAttendances.get(prog.id),
            }));

            setPrograms(combinedPrograms);
        } catch (error) {
            console.error("Error fetching programs and attendance:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not load program data." });
        } finally {
            setIsLoading(false);
        }
    }, [user, firestore, toast]);

    useEffect(() => {
        if (user && !isUserLoading) {
            fetchProgramsAndAttendance();
        }
    }, [user, isUserLoading, fetchProgramsAndAttendance]);

    const handleCheckout = async (programId: string) => {
        if (!firestore || !user || !user.email) return;
        setIsCheckingOut(programId);

        const studentEmail = user.email.toLowerCase();
        const programDocRef = doc(firestore, 'programs', programId);
        const attendanceDocRef = doc(firestore, 'programs', programId, 'attendances', studentEmail);

        try {
            const [programSnap, attendanceSnap] = await Promise.all([ getDoc(programDocRef), getDoc(attendanceDocRef) ]);

            if (!attendanceSnap.exists()) { throw new Error('Rekod kehadiran tidak dijumpai.'); }
            if (attendanceSnap.data().checkOutAt) { toast({ title: 'Info', description: 'Anda sudah check-out untuk program ini.' }); return; }
            if (!programSnap.exists()) { throw new Error('Program not found.'); }
            
            const program = programSnap.data() as Program;
            const attendance = attendanceSnap.data();
            const checkInAt = (attendance.createdAt as Timestamp).toDate();
            
            let checkOutStatus: string = "ok";
            if (now <= checkInAt) { checkOutStatus = "too_early"; }
            const checkOutOpenTime = program.checkOutOpenTime ? program.checkOutOpenTime.toDate() : null;
            const checkOutCloseTime = program.checkOutCloseTime ? program.checkOutCloseTime.toDate() : null;
            if ((checkOutOpenTime && now < checkOutOpenTime) || (checkOutCloseTime && now > checkOutCloseTime)) { checkOutStatus = "outside_window"; }
            const durationMinutes = Math.floor((now.getTime() - checkInAt.getTime()) / 60000);
            if (durationMinutes < 60) { checkOutStatus = "too_short"; }

            await updateDoc(attendanceDocRef, {
                checkOutAt: Timestamp.fromDate(now),
                durationMinutes: durationMinutes,
                checkOutStatus: checkOutStatus,
            });

            if (checkOutStatus === 'ok') { toast({ title: 'Success!', description: 'Check-out berjaya dan disahkan.' }); } 
            else { toast({ variant: 'destructive', title: 'Check-out Recorded', description: 'Check-out direkodkan tetapi status tidak sah.' }); }

            fetchProgramsAndAttendance();
        } catch (error: any) {
            console.error("Checkout error:", error);
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'An error occurred during checkout.' });
        } finally {
            setIsCheckingOut(null);
        }
    };

    const ProgramCard = ({ program }: { program: CombinedProgram }) => {
        const { attendance } = program;
        const startTime = (program.startDateTime as Timestamp).toDate();
        const endTime = (program.endDateTime as Timestamp).toDate();

        const programStatus = now > endTime ? 'completed' : now >= startTime ? 'ongoing' : 'upcoming';
        
        const showPreProgramBonus = !attendance && programStatus === 'upcoming' && now > new Date(startTime.getTime() - 60 * 60 * 1000) && now < startTime;

        const checkOutOpenTime = program.checkOutOpenTime ? (program.checkOutOpenTime as Timestamp).toDate() : null;
        const isEarlyCheckoutWindow = 
            attendance && 
            !attendance.checkOutAt && 
            checkOutOpenTime &&
            now >= checkOutOpenTime &&
            now < new Date(checkOutOpenTime.getTime() + 30 * 60 * 1000);

        return (
            <Card className="rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <CardTitle className="font-bold text-lg leading-tight">{program.title}</CardTitle>
                        <ProgramStatusBadge status={programStatus} />
                    </div>
                    <CardDescription>{format(startTime, 'd MMMM yyyy')}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-4">
                    {attendance && (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><p className="font-medium text-muted-foreground">Check-in</p><p>{format(attendance.createdAt.toDate(), 'p, d MMM')}</p></div>
                            <div><p className="font-medium text-muted-foreground">Check-out</p><p>{attendance.checkOutAt ? format(attendance.checkOutAt.toDate(), 'p, d MMM') : '-'}</p></div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col items-start gap-2 pt-4">
                    {attendance ? (
                        <>
                            <CheckoutStatusBadge attendance={attendance} />
                            {!attendance.checkOutAt && (
                                <>
                                    {isEarlyCheckoutWindow && (
                                        <Badge variant="outline" className="mt-2 border-green-600 text-green-700 bg-green-50">
                                            🎁 Claim +30 Early Bird Points!
                                        </Badge>
                                    )}
                                    <Button onClick={() => handleCheckout(program.id)} disabled={isCheckingOut === program.id} className="mt-2" size="sm">
                                        {isCheckingOut === program.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Check-out Now
                                    </Button>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            {showPreProgramBonus && (
                                <Badge variant="outline" className="border-blue-600 text-blue-700 bg-blue-50">
                                    🎁 Check-in early for +30 points!
                                </Badge>
                            )}
                            <p className="text-sm text-muted-foreground">Scan the program QR code to check in.</p>
                        </>
                    )}
                </CardFooter>
            </Card>
        )
    }
    
    const renderContent = () => {
        if (isLoading || isUserLoading || isProfileLoading) {
            return (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i} className="rounded-xl"><CardHeader><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent><CardFooter><Skeleton className="h-10 w-28" /></CardFooter></Card>
                    ))}
                </div>
            );
        }

        if (!user) { return <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Not Logged In</AlertTitle><AlertDescription>Please log in to view your attendance records.</AlertDescription></Alert>; }
        if (userProfile && userProfile.role !== 'student') { return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Access Denied</AlertTitle><AlertDescription>This page is for students only.</AlertDescription></Alert>; }
        if (programs.length === 0) { return <div className="text-center py-10 border-2 border-dashed rounded-xl"><Ticket className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-medium">No programs found.</h3><p className="mt-1 text-sm text-muted-foreground">Check back later for upcoming programs.</p></div>; }

        return (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {programs.map(p => <ProgramCard key={p.id} program={p} />)}
            </div>
        );
    };

    return (
        <div className="space-y-8">
            <div className="space-y-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">Program Dashboard</h1>
                <p className="text-muted-foreground">Browse all available programs and track your participation.</p>
            </div>
            <div>{renderContent()}</div>
        </div>
    );
}
