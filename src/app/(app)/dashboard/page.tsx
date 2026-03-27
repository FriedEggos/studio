
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
import { useUser, useFirestore } from "@/firebase";
import { getDocs, collection, doc, getDoc, Timestamp, updateDoc, query, orderBy, collectionGroup, where } from "firebase/firestore";
import { useEffect, useState, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Ticket, AlertTriangle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    const colorClasses = {
        ongoing: 'bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-100',
        upcoming: 'bg-yellow-100 text-yellow-800 border border-yellow-200 hover:bg-yellow-100',
        completed: 'bg-green-100 text-green-800 border border-green-200 hover:bg-green-100',
    };
    return <Badge className={`capitalize ${colorClasses[status]}`}>{status}</Badge>;
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

const getProgramStatus = (program: Program, now: Date): 'upcoming' | 'ongoing' | 'completed' => {
    const startTime = (program.startDateTime as Timestamp).toDate();
    const endTime = (program.endDateTime as Timestamp).toDate();

    if (now < startTime) {
        return 'upcoming';
    }
    if (now > endTime) {
        return 'completed';
    }
    return 'ongoing';
};

export default function StudentDashboard() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [programs, setPrograms] = useState<CombinedProgram[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null);
    const [now, setNow] = useState(new Date());

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState<{ title: string; programs: CombinedProgram[] }>({ title: '', programs: [] });
    
    const [userProfile, setUserProfile] = useState<any>(null);
    const [isProfileLoading, setIsProfileLoading] = useState(true);

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

    const fetchUserProfile = useCallback(async () => {
        if (!user || !firestore) {
            setIsProfileLoading(false);
            return;
        }
        setIsProfileLoading(true);
        try {
            const userDoc = await getDoc(doc(firestore, 'users', user.uid));
            if(userDoc.exists()) {
                setUserProfile(userDoc.data());
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
        } finally {
            setIsProfileLoading(false);
        }
    }, [user, firestore]);

    useEffect(() => {
        if (user && !isUserLoading) {
            fetchProgramsAndAttendance();
            fetchUserProfile();
        }
    }, [user, isUserLoading, fetchProgramsAndAttendance, fetchUserProfile]);

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
            const checkOutOpenTime = program.checkOutOpenTime ? program.checkOutOpenTime.toDate() : null;
            const checkOutCloseTime = program.checkOutCloseTime ? program.checkOutCloseTime.toDate() : null;

            if (now <= checkInAt) {
                checkOutStatus = "too_early";
            } else if ((checkOutOpenTime && now < checkOutOpenTime) || (checkOutCloseTime && now > checkOutCloseTime)) {
                checkOutStatus = "outside_window";
            }

            const durationMinutes = Math.floor((now.getTime() - checkInAt.getTime()) / 60000);

            await updateDoc(attendanceDocRef, {
                checkOutAt: Timestamp.fromDate(now),
                durationMinutes: durationMinutes < 0 ? 0 : durationMinutes,
                checkOutStatus: checkOutStatus,
            });

            if (checkOutStatus === 'ok') { toast({ title: 'Success!', description: 'Check-out berjaya dan disahkan.' }); } 
            else { toast({ variant: 'destructive', title: 'Check-out Recorded with Warning', description: 'Your check-out was recorded, but flagged as invalid. Contact an admin if you believe this is an error.' }); }

            fetchProgramsAndAttendance();
        } catch (error: any) {
            console.error("Checkout error:", error);
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'An error occurred during checkout.' });
        } finally {
            setIsCheckingOut(null);
        }
    };
    
    // Memoize categorized programs
    const ongoingPrograms = useMemo(() => programs.filter(p => getProgramStatus(p, now) === 'ongoing'), [programs, now]);
    const upcomingPrograms = useMemo(() => programs.filter(p => getProgramStatus(p, now) === 'upcoming'), [programs, now]);
    const completedPrograms = useMemo(() => programs.filter(p => getProgramStatus(p, now) === 'completed'), [programs, now]);

    const handleViewMore = (title: string, programs: CombinedProgram[]) => {
      setModalContent({ title, programs });
      setIsModalOpen(true);
    };

    const ProgramCard = ({ program }: { program: CombinedProgram }) => {
        const { attendance } = program;
        const startTime = (program.startDateTime as Timestamp).toDate();
        const programStatus = getProgramStatus(program, now);

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
                                <Button onClick={() => handleCheckout(program.id)} disabled={isCheckingOut === program.id} className="mt-2" size="sm">
                                    {isCheckingOut === program.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Check-out Now
                                </Button>
                            )}
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">Scan the program QR code to check in.</p>
                    )}
                </CardFooter>
            </Card>
        )
    };

    const ProgramSection = ({ title, programsToShow, onSelectViewMore }: { title: string; programsToShow: CombinedProgram[], onSelectViewMore: () => void }) => {
      if (programsToShow.length === 0) return null;
      
      return (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold tracking-tight">{title}</h2>
            {programsToShow.length > 3 && (
              <Button variant="link" className="pr-0" onClick={onSelectViewMore}>
                View all <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {programsToShow.slice(0, 3).map(p => <ProgramCard key={p.id} program={p} />)}
          </div>
        </div>
      );
    };

    const renderContent = () => {
        if (isLoading || isUserLoading || isProfileLoading) {
            return (
                <div className="space-y-8">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="space-y-4">
                        <Skeleton className="h-8 w-48" />
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                          <Card className="rounded-xl"><CardHeader><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent><CardFooter><Skeleton className="h-10 w-28" /></CardFooter></Card>
                        </div>
                      </div>
                    ))}
                </div>
            );
        }

        if (!user) { return <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Not Logged In</AlertTitle><AlertDescription>Please log in to view your attendance records.</AlertDescription></Alert>; }
        if (userProfile && userProfile.role !== 'student') { return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Access Denied</AlertTitle><AlertDescription>This page is for students only.</AlertDescription></Alert>; }
        if (programs.length === 0) { return <div className="text-center py-10 border-2 border-dashed rounded-xl"><Ticket className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-medium">No programs found.</h3><p className="mt-1 text-sm text-muted-foreground">Check back later for upcoming programs.</p></div>; }

        return (
            <div className="space-y-8">
              <ProgramSection title="Ongoing Programs" programsToShow={ongoingPrograms} onSelectViewMore={() => handleViewMore("Ongoing Programs", ongoingPrograms)} />
              <ProgramSection title="Upcoming Programs" programsToShow={upcomingPrograms} onSelectViewMore={() => handleViewMore("Upcoming Programs", upcomingPrograms)} />
              <ProgramSection title="Completed Programs" programsToShow={completedPrograms} onSelectViewMore={() => handleViewMore("Completed Programs", completedPrograms)} />
            </div>
        );
    };

    const isProfileIncomplete = userProfile && (!userProfile.matricId || !userProfile.phoneNumber || !userProfile.course);

    return (
      <div className="space-y-8">
        {isProfileIncomplete && !isProfileLoading && (
            <Alert variant="destructive" className="flex items-center justify-between">
                <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-3" />
                    <div>
                        <AlertTitle>Action Required</AlertTitle>
                        <AlertDescription>
                            Please complete your profile information to unlock contribution submissions.
                        </AlertDescription>
                    </div>
                </div>
                <Button asChild>
                    <Link href="/profile/edit">Go to Profile</Link>
                </Button>
            </Alert>
        )}
        <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">Program Dashboard</h1>
            <p className="text-muted-foreground">Browse all available programs and track your participation.</p>
        </div>
        <div>{renderContent()}</div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{modalContent.title}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh] pr-4">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 py-4">
                        {modalContent.programs.map(p => <ProgramCard key={p.id} program={p} />)}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
      </div>
    );
}

