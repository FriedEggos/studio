
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

// Re-using schemas and options from the main page
const positionSchema = z.object({
  programName: z.string().min(1, "Nama program diperlukan."),
  peringkat: z.string().min(1, "Peringkat diperlukan."),
  positionName: z.string().min(1, "Jawatan diperlukan."),
  customPositionDetail: z.string().optional(),
  semester: z.string().min(1, "Semester diperlukan."),
  className: z.string().min(1, "Kelas diperlukan."),
}).refine(data => {
    if (data.positionName === "AJK Lain-Lain") {
        return !!data.customPositionDetail && data.customPositionDetail.length > 0;
    }
    return true;
}, {
    message: "Details are required for 'AJK Lain-Lain'.",
    path: ['customPositionDetail'],
});

const positionOptions = [
  "Pengerusi",
  "Naib Pengerusi",
  "Pengarah Program",
  "Timbalan Pengarah Program",
  "Setiausaha",
  "Bendahari",
  "Penolong Setiausaha",
  "Penolong Bendahari",
  "AJK Lain-Lain",
  "Peserta",
];

const peringkatOptions = [
    "Peringkat Kelab",
    "Peringkat Program",
    "Peringkat Jabatan",
    "Peringkat Politeknik",
    "Peringkat Zon / Negeri",
    "Peringkat Kebangsaan",
    "Peringkat Antarabangsa",
    "Peringkat Komuniti",
    "Tiada"
];

const semesterOptions = Array.from({ length: 9 }, (_, i) => (i + 1).toString());
const classOptions = [
    "DIT1A", "DIT1B", "DIT1C",
    "DIT2A", "DIT2B", "DIT2C", "DIT2D",
    "DIT3A", "DIT3B", "DIT3C", "DIT3D",
    "DIT4A", "DIT4B", "DIT4C", "DIT4D",
    "DIT5A", "DIT5B", "DIT5C", "DIT5D",
    "Lain-lain"
];

interface Position {
    id: string;
    programName: string;
    peringkat: string;
    positionName: string;
    customPositionDetail?: string;
    semester: number;
    className: string;
    verificationStatus: 'pending' | 'approved' | 'rejected';
}


export default function EditContributionPage() {
  const router = useRouter();
  const params = useParams();
  const positionId = params.positionId as string;
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const positionDocRef = useMemoFirebase(() => {
    if (!user || !firestore || !positionId) return null;
    return doc(firestore, 'users', user.uid, 'positions', positionId);
  }, [user, firestore, positionId]);

  const { data: positionData, isLoading: isPositionLoading } = useDoc<Position>(positionDocRef);

  const form = useForm<z.infer<typeof positionSchema>>({
    resolver: zodResolver(positionSchema),
    defaultValues: {
      programName: '',
      peringkat: '',
      positionName: '',
      customPositionDetail: '',
      semester: '',
      className: '',
    },
  });
  const watchPositionName = form.watch('positionName');

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
    if (positionData) {
      if (positionData.verificationStatus !== 'pending') {
        toast({ variant: 'destructive', title: 'Cannot Edit', description: 'This contribution cannot be edited anymore.' });
        router.push('/my-contributions');
        return;
      }
      form.reset({
        programName: positionData.programName,
        peringkat: positionData.peringkat,
        positionName: positionData.positionName,
        customPositionDetail: positionData.customPositionDetail || '',
        semester: positionData.semester.toString(),
        className: positionData.className,
      });
    }
  }, [isUserLoading, user, positionData, form, router, toast]);

  const onSubmit = async (values: z.infer<typeof positionSchema>) => {
    if (!positionDocRef) return;
    setIsSubmitting(true);
    try {
      await updateDoc(positionDocRef, {
        ...values,
        semester: parseInt(values.semester),
      });
      toast({
        title: 'Contribution Updated',
        description: 'Your changes have been saved and are pending verification.',
      });
      router.push('/my-contributions');
    } catch (error) {
      console.error("Error updating position:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "An error occurred while saving your changes.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isUserLoading || isPositionLoading;
  if (isLoading || !positionData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9"/>
          <Skeleton className="h-8 w-48"/>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-10 w-full"/>
            <Skeleton className="h-10 w-full"/>
            <Skeleton className="h-10 w-full"/>
            <div className="flex justify-end gap-2 pt-4">
              <Skeleton className="h-10 w-24"/>
              <Skeleton className="h-10 w-24"/>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">Edit Contribution</h1>
           <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                  <Link href="/my-contributions">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                  </Link>
              </Button>
          </div>
        </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>Update Your Submitted Position</CardTitle>
              <CardDescription>
                Make corrections to your submission below. Changes will be saved upon submission.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="programName" render={({ field }) => (
                        <FormItem><FormLabel>Nama Program</FormLabel><FormControl><Input placeholder="Nama penuh program" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="peringkat" render={({ field }) => (
                        <FormItem><FormLabel>Peringkat</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Pilih peringkat" /></SelectTrigger></FormControl><SelectContent>{peringkatOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="positionName" render={({ field }) => (
                        <FormItem><FormLabel>Jawatan</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Pilih jawatan" /></SelectTrigger></FormControl><SelectContent>{positionOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )} />
                    {watchPositionName === 'AJK Lain-Lain' && (
                        <FormField control={form.control} name="customPositionDetail" render={({ field }) => (
                            <FormItem><FormLabel>Butiran Jawatan</FormLabel><FormControl><Input placeholder="e.g., Ketua Multimedia" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    )}
                    <FormField control={form.control} name="semester" render={({ field }) => (
                        <FormItem><FormLabel>Semester</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Pilih semester" /></SelectTrigger></FormControl><SelectContent>{semesterOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="className" render={({ field }) => (
                        <FormItem><FormLabel>Kelas</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger></FormControl><SelectContent>{classOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )} />
                </div>
            </CardContent>
          </Card>
          <div className="flex items-center justify-end gap-2 mt-4">
            <Button variant="outline" type="button" onClick={() => router.push('/my-contributions')}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
