
'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from "next/navigation";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isWithinInterval, parseISO } from "date-fns";
import { CheckCircle, XCircle, Clock, Loader2, AlertCircle, Calendar, MapPin } from "lucide-react";
import Link from "next/link";

function ScanConfirmation() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const programId = searchParams.get('programId');
    
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const [status, setStatus] = useState<'loading' | 'requires_action' | 'already_checked_in' | 'success' | 'attendance_closed' | 'invalid_program' | 'error'>('loading');
    const [checkedInTime, setCheckedInTime] = useState<Date | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const programDocRef = useMemoFirebase(() => {
        if (!programId || !firestore) return null;
        return doc(firestore, 'programs', programId);
    }, [programId, firestore]);
    const { data: program, isLoading: isLoadingProgram, error: programError } = useDoc(programDocRef);
    
    // Redirect if not logged in
    useEffect(() => {
        if (!isUserLoading && !user) {
            const redirectPath = programId ? `/login?redirect=/scan?programId=${programId}` : '/login';
            router.push(redirectPath);
        }
    }, [isUserLoading, user, programId, router]);

    // Validate program and set initial status
    useEffect(() => {
        if (isLoadingProgram || isUserLoading) return;
        if (!programId || programError || !program) {
            setStatus('invalid_program');
            return;
        }

        const now = new Date();
        const isLive = isWithinInterval(now, { start: parseISO(program.startDate), end: parseISO(program.endDate) });
        
        if (!program.attendanceOpen || !isLive) {
            setStatus('attendance_closed');
            return;
        }

        setStatus('requires_action');

    }, [program, isLoadingProgram, programError, isUserLoading, programId]);


    const handleCheckIn = async () => {
        if (!firestore || !user || !programId || !program) return;
        setIsSubmitting(true);

        const attendanceDocRef = doc(firestore, `programs/${programId}/attendance/${user.uid}`);
        
        try {
            await runTransaction(firestore, async (transaction) => {
                const attendanceDoc = await transaction.get(attendanceDocRef);
                if (attendanceDoc.exists()) {
                    throw new Error("ALREADY_CHECKED_IN");
                }

                transaction.set(attendanceDocRef, {
                    userId: user.uid,
                    programId: programId,
                    checkedInAt: serverTimestamp(),
                    method: 'self_scan',
                    displayName: user.displayName,
                    email: user.email,
                });
            });
            setCheckedInTime(new Date());
            setStatus('success');
        } catch (error: any) {
            if (error.message === 'ALREADY_CHECKED_IN') {
                setStatus('already_checked_in');
            } else {
                console.error("Check-in transaction failed: ", error);
                setStatus('error');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isUserLoading || isLoadingProgram || status === 'loading') {
        return (
            <div className="flex justify-center items-center h-full">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <Skeleton className="h-8 w-3/4 mx-auto" />
                        <Skeleton className="h-4 w-1/2 mx-auto mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-5 w-5/6" />
                    </CardContent>
                    <CardFooter>
                        <Skeleton className="h-10 w-full" />
                    </CardFooter>
                </Card>
            </div>
        );
    }
    
    return (
        <div className="flex justify-center items-center h-full">
            <Card className="w-full max-w-md text-center">
                {status === 'requires_action' && program && (
                    <>
                        <CardHeader>
                            <CardTitle className="font-headline text-2xl">{program.name}</CardTitle>
                            <CardDescription>Confirm your attendance for this program.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 text-left text-sm">
                             <div className="flex items-start gap-3">
                                <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">Date</p>
                                    <p className="text-muted-foreground">{format(parseISO(program.startDate), 'd MMM yyyy')} - {format(parseISO(program.endDate), 'd MMM yyyy')}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">Venue</p>
                                    <p className="text-muted-foreground">{program.venue}</p>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" onClick={handleCheckIn} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirm Check-in
                            </Button>
                        </CardFooter>
                    </>
                )}

                {status === 'success' && (
                     <CardContent className="pt-6">
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-semibold">Check-in Successful!</h2>
                        <p className="text-muted-foreground mt-2">
                           Your attendance for "{program?.name}" has been recorded at {checkedInTime && format(checkedInTime, 'p')}.
                        </p>
                        <Button asChild className="mt-6 w-full">
                            <Link href="/dashboard">Back to Dashboard</Link>
                        </Button>
                    </CardContent>
                )}
                
                 {status === 'already_checked_in' && (
                     <CardContent className="pt-6">
                        <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-semibold">Already Checked In</h2>
                        <p className="text-muted-foreground mt-2">
                           You have already recorded your attendance for "{program?.name}".
                        </p>
                        <Button asChild className="mt-6 w-full">
                            <Link href="/dashboard">Back to Dashboard</Link>
                        </Button>
                    </CardContent>
                )}

                {(status === 'attendance_closed' || status === 'invalid_program' || status === 'error') && (
                     <CardContent className="pt-6">
                        <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                        <h2 className="text-2xl font-semibold">Check-in Failed</h2>
                        {status === 'attendance_closed' && <p className="text-muted-foreground mt-2">Attendance for "{program?.name}" is not currently open.</p>}
                        {status === 'invalid_program' && <p className="text-muted-foreground mt-2">This QR code is invalid or the program does not exist.</p>}
                        {status === 'error' && <p className="text-muted-foreground mt-2">An unexpected error occurred. Please try again.</p>}
                        <Button asChild className="mt-6 w-full">
                            <Link href="/dashboard">Back to Dashboard</Link>
                        </Button>
                    </CardContent>
                )}
            </Card>
        </div>
    );
}


export default function ScanPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ScanConfirmation />
        </Suspense>
    )
}

    