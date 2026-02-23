
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { submitCheckout } from '@/lib/attendance';

const checkoutFormSchema = z.object({
  email: z.string().email({ message: 'Format emel tidak sah.' }).min(1, { message: 'Emel diperlukan.' }),
});

type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;
type PageStatus = 'loading' | 'form' | 'submitting' | 'success' | 'error' | 'not_found';
type ErrorState = {
  title: string;
  message: string;
};

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

  const onSubmit = async (values: CheckoutFormValues) => {
    setStatus('submitting');
    setError(null);
    if (!firestore || !programId) return;

    try {
        const studentEmail = values.email.toLowerCase().trim();
        const result = await submitCheckout(firestore, programId, studentEmail);

        if (result.status === 'success') {
            setStatus('success');
        } else {
            let title = 'Check-out Gagal';
            if (result.status === 'not_found') title = 'Rekod Kehadiran Tidak Dijumpai';
            if (result.status === 'already_checked_out') title = 'Telah Check-out';
            
            setError({ title, message: result.message });
            setStatus('error');
        }
    } catch (err: any) {
        console.error("Error during checkout process: ", err);
        const message = 'An unexpected error occurred. Please try again.';
        setError({ title: 'Gagal Check-out', message });
        setStatus('error');
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
