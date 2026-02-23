
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';

const checkoutFormSchema = z.object({
  email: z.string().email({ message: 'Format emel tidak sah.' }).min(1, { message: 'Emel diperlukan.' }),
});

type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;

type PageStatus = 'form' | 'submitting' | 'success' | 'error';
type ErrorState = {
  title: string;
  message: string;
};

export default function CheckoutPage() {
  const params = useParams();
  const programId = params.programId as string;
  const firestore = useFirestore();

  const [status, setStatus] = useState<PageStatus>('form');
  const [error, setError] = useState<ErrorState | null>(null);

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: { email: '' },
  });

  const performCheckout = async (values: CheckoutFormValues, position: GeolocationPosition | null) => {
    if (!firestore || !programId) return;

    const studentEmail = values.email.toLowerCase().trim();
    const attendanceDocRef = doc(firestore, `programs/${programId}/attendances`, studentEmail);

    try {
      const docSnap = await getDoc(attendanceDocRef);
      if (!docSnap.exists()) {
        setError({
          title: 'Rekod Kehadiran Tidak Dijumpai',
          message: 'Pastikan anda menggunakan emel yang sama semasa check-in.',
        });
        setStatus('error');
        return;
      }

      const updateData: any = {
        checkOutAt: serverTimestamp(),
      };

      if (position) {
        updateData.checkOutLat = position.coords.latitude;
        updateData.checkOutLng = position.coords.longitude;
        updateData.checkOutStatus = 'ok';
      } else {
        updateData.checkOutStatus = 'geo_failed';
      }

      await updateDoc(attendanceDocRef, updateData);
      setStatus('success');

    } catch (err) {
      console.error("Error updating document: ", err);
      setError({
        title: 'Gagal Check-out',
        message: 'Berlaku ralat semasa cuba merekodkan check-out anda. Sila cuba lagi.',
      });
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
          // Still proceed with checkout, but mark GPS as failed
          performCheckout(values, null);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      // Geolocation not supported
      performCheckout(values, null);
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'success':
        return (
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <CardTitle className="mt-4">Check-out Berjaya!</CardTitle>
            <p className="text-muted-foreground mt-2">Terima kasih. Rekod check-out anda telah disimpan.</p>
          </div>
        );
      case 'error':
        return (
          <div className="text-center">
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
              <CardDescription>Sila masukkan emel anda untuk merekodkan waktu keluar program.</CardDescription>
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
