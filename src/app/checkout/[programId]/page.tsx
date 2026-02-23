
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { differenceInMinutes, parseISO } from 'date-fns';

const checkoutFormSchema = z.object({
  email: z.string().email({ message: 'Format emel tidak sah.' }).min(1, { message: 'Emel diperlukan.' }),
});

type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;
type PageStatus = 'loading' | 'form' | 'submitting' | 'success' | 'error' | 'not_found';
type ErrorState = {
  title: string;
  message: string;
};

// Haversine formula to calculate distance between two lat/lng points
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const programId = params.programId as string;
  const firestore = useFirestore();

  const [status, setStatus] = useState<PageStatus>('loading');
  const [error, setError] = useState<ErrorState | null>(null);
  const [programTitle, setProgramTitle] = useState('');

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: { email: '' },
  });
  
  useEffect(() => {
    async function fetchProgramTitle() {
        if (!firestore || !programId) {
            setStatus('not_found');
            return;
        }
        const programDocRef = doc(firestore, 'programs', programId);
        const programSnap = await getDoc(programDocRef);
        if (programSnap.exists()) {
            setProgramTitle(programSnap.data().title);
            setStatus('form');
        } else {
            setStatus('not_found');
        }
    }
    fetchProgramTitle();
  }, [firestore, programId]);

  const performCheckout = async (values: CheckoutFormValues, position: GeolocationPosition | null) => {
    if (!firestore || !programId) return;

    const studentEmail = values.email.toLowerCase().trim();
    const attendanceDocRef = doc(firestore, `programs/${programId}/attendances`, studentEmail);
    const programDocRef = doc(firestore, 'programs', programId);

    try {
      const [attendanceSnap, programSnap] = await Promise.all([
          getDoc(attendanceDocRef),
          getDoc(programDocRef),
      ]);

      if (!attendanceSnap.exists()) {
        setError({ title: 'Rekod Kehadiran Tidak Dijumpai', message: 'Pastikan anda menggunakan emel yang sama semasa check-in.' });
        setStatus('error');
        return;
      }
      
      const attendanceData = attendanceSnap.data();
      const programData = programSnap.data();
      const now = new Date();
      
      if (attendanceData.checkOutAt) {
          setError({ title: 'Telah Check-out', message: 'Anda telah merekodkan check-out untuk program ini sebelum ini.' });
          setStatus('error');
          return;
      }
      
      const checkInAt = (attendanceData.createdAt as Timestamp).toDate();
      const checkOutOpenTime = programData?.checkOutOpenTime ? parseISO(programData.checkOutOpenTime) : null;
      const checkOutCloseTime = programData?.checkOutCloseTime ? parseISO(programData.checkOutCloseTime) : null;
      const durationMinutes = differenceInMinutes(now, checkInAt);
      
      let checkOutStatus: string = "ok";

      // Rule A: Must be after check-in
      if (now <= checkInAt) {
          checkOutStatus = "too_early";
      }
      // Rule B: Must be inside check-out window
      else if (checkOutOpenTime && now < checkOutOpenTime) {
          checkOutStatus = "outside_window";
      }
      else if (checkOutCloseTime && now > checkOutCloseTime) {
          checkOutStatus = "outside_window";
      }
      // Rule C: Minimum duration
      else if (durationMinutes < 60) {
          checkOutStatus = "too_short";
      }
      // Rule D: GPS validation
      else if (!position) {
          checkOutStatus = "geo_failed";
      } else if (programData?.venueLat && programData?.venueLng && programData?.allowedRadiusMeters) {
          const distance = getDistance(position.coords.latitude, position.coords.longitude, programData.venueLat, programData.venueLng);
          if (distance > programData.allowedRadiusMeters) {
              checkOutStatus = "geo_failed";
          }
      }

      const updateData: any = {
        checkOutAt: serverTimestamp(),
        checkOutLat: position?.coords.latitude || null,
        checkOutLng: position?.coords.longitude || null,
        checkOutStatus: checkOutStatus,
        durationMinutes: durationMinutes
      };

      await updateDoc(attendanceDocRef, updateData);
      setStatus('success');

    } catch (err) {
      console.error("Error updating document: ", err);
      setError({ title: 'Gagal Check-out', message: 'Berlaku ralat semasa cuba merekodkan check-out anda. Sila cuba lagi.' });
      setStatus('error');
    }
  };

  const onSubmit = (values: CheckoutFormValues) => {
    setStatus('submitting');
    setError(null);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          performCheckout(values, position);
        },
        (geoError) => {
          console.warn(`Geolocation error: ${geoError.message}`);
          performCheckout(values, null);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      performCheckout(values, null);
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
          return (
             <div className="text-center p-6">
                <Loader2 className="h-16 w-16 text-primary mx-auto animate-spin" />
                <CardTitle className="mt-4">Loading...</CardTitle>
             </div>
          );
      case 'not_found':
        return (
             <div className="text-center p-6">
                <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
                <CardTitle className="mt-4">Program Not Found</CardTitle>
                <p className="text-muted-foreground mt-2">The checkout link is invalid or the program does not exist.</p>
                <Button onClick={() => router.push('/')} className="mt-6">Go to Homepage</Button>
            </div>
        )
      case 'success':
        return (
          <div className="text-center p-6">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <CardTitle className="mt-4">Check-out Berjaya!</CardTitle>
            <p className="text-muted-foreground mt-2">Terima kasih. Rekod check-out anda telah disimpan.</p>
          </div>
        );
      case 'error':
        return (
          <div className="text-center p-6">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
            <CardTitle className="mt-4">{error?.title}</CardTitle>
            <p className="text-muted-foreground mt-2">{error?.message}</p>
            <Button onClick={() => setStatus('form')} className="mt-6">Cuba Lagi</Button>
          </div>
        );
      default:
        return (
          <>
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Check-out Kehadiran</CardTitle>
              <CardDescription>Sila masukkan emel anda untuk merekodkan waktu keluar untuk program <strong>{programTitle}</strong>.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Emel Pelajar</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="alamat@emel.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={status === 'submitting'}>
                    {status === 'submitting' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sila tunggu...
                      </>
                    ) : (
                      'Hantar Check-out'
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </>
        );
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
      <Card className="w-full max-w-md">{renderContent()}</Card>
    </div>
  );
}
