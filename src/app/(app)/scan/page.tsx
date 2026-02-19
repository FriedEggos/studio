'use client';

import { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useUser, useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ScanPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();
    
    const [scanState, setScanState] = useState<'scanning' | 'processing' | 'success' | 'error' | 'already_checked_in'>('scanning');
    const [errorMessage, setErrorMessage] = useState('');

    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    useEffect(() => {
        if (!firestore || scanState !== 'scanning') return;

        const scanner = new Html5QrcodeScanner(
            'qr-reader-container',
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
        );
        scannerRef.current = scanner;

        const onScanSuccess = async (decodedText: string) => {
            if (scannerRef.current) {
                scannerRef.current.pause(true);
            }
            setScanState('processing');

            if (!user) {
                toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to check in.' });
                router.push('/login');
                return;
            }

            const programId = decodedText;

            try {
                // 1. Validate Program ID
                const programRef = doc(firestore, 'programs', programId);
                const programSnap = await getDoc(programRef);
                if (!programSnap.exists()) {
                    setErrorMessage('This QR code is not for a valid program.');
                    setScanState('error');
                    return;
                }

                // 2. Check if already checked in
                const attendanceCol = collection(firestore, `programs/${programId}/attendance`);
                const q = query(attendanceCol, where("userId", "==", user.uid));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    setScanState('already_checked_in');
                    return;
                }

                // 3. Add new attendance record
                await addDoc(attendanceCol, {
                    programId: programId,
                    userId: user.uid,
                    checkInTime: serverTimestamp(),
                    method: 'QR'
                });
                
                setScanState('success');

            } catch (error) {
                console.error("Error recording attendance: ", error);
                setErrorMessage("An error occurred during check-in. Please try again.");
                setScanState('error');
            }
        };

        const onScanFailure = (error: any) => {
            // ignore
        };

        scanner.render(onScanSuccess, onScanFailure);

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(err => console.error("Failed to clear scanner on unmount.", err));
            }
        };
    }, [user, firestore, router, scanState]);

    useEffect(() => {
        if (scanState === 'success') {
            toast({
                title: 'Check-in Successful!',
                description: 'Your attendance has been recorded.',
            });
            setTimeout(() => router.push('/dashboard'), 2000);
        } else if (scanState === 'already_checked_in') {
             toast({
                variant: "destructive",
                title: "Already Checked In",
                description: "You have already marked your attendance for this program.",
            });
            setTimeout(() => router.push('/dashboard'), 2000);
        } else if (scanState === 'error') {
             toast({
                variant: "destructive",
                title: "Check-in Failed",
                description: errorMessage,
            });
        }
    }, [scanState, errorMessage, toast, router]);

    const tryAgain = () => {
        if (scannerRef.current) {
            scannerRef.current.resume();
        }
        setScanState('scanning');
        setErrorMessage('');
    }

    return (
        <div className="flex flex-col items-center justify-start h-full pt-10 space-y-6">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="font-headline text-center">Scan Program QR Code</CardTitle>
                    <CardDescription className="text-center">
                        Point your camera at the QR code to mark your attendance.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center min-h-[300px]">
                    <div id="qr-reader-container" className={scanState !== 'scanning' ? 'hidden' : 'w-full'}></div>
                    
                    {scanState === 'processing' && (
                        <div className="text-center p-4">
                            <Loader2 className="h-16 w-16 text-primary mx-auto animate-spin" />
                            <p className="mt-4 font-semibold">Processing Scan...</p>
                            <p className="text-muted-foreground">Verifying program and your status.</p>
                        </div>
                    )}
                    {scanState === 'success' && (
                         <div className="text-center p-4">
                            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                            <p className="mt-4 font-semibold">Check-in Successful!</p>
                            <p className="text-muted-foreground">Redirecting to dashboard...</p>
                        </div>
                    )}
                     {scanState === 'already_checked_in' && (
                         <div className="text-center p-4">
                            <XCircle className="h-16 w-16 text-yellow-500 mx-auto" />
                            <p className="mt-4 font-semibold">Already Checked In</p>
                            <p className="text-muted-foreground">Redirecting to dashboard...</p>
                        </div>
                    )}
                    {scanState === 'error' && (
                        <div className="text-center p-4">
                            <XCircle className="h-16 w-16 text-destructive mx-auto" />
                            <p className="mt-4 font-semibold">Check-in Failed</p>
                            <p className="text-muted-foreground">{errorMessage || 'An unknown error occurred.'}</p>
                            <Button onClick={tryAgain} className="mt-4">Try Again</Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}