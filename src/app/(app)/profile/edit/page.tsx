
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, updateDocumentNonBlocking, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

const profileFormSchema = z.object({
  fullName: z.string().min(1, 'Nama penuh diperlukan.'),
  email: z.string().email('Format emel tidak sah.'),
  course: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function EditProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: '',
      email: '',
      course: '',
    }
  });

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
    if (userProfile) {
      reset({
        fullName: userProfile.fullName || '',
        email: userProfile.email || '',
        course: userProfile.course || '',
      });
    }
  }, [isUserLoading, user, userProfile, reset, router]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (!userDocRef) return;
    setIsSubmitting(true);
    
    // Note: Updating email in Firebase Auth is a protected operation and not included here.
    // This only updates the Firestore document.
    const updatedData = {
        fullName: data.fullName,
        email: data.email,
        course: data.course,
    };

    updateDocumentNonBlocking(userDocRef, updatedData);
    
    toast({
      title: 'Profil Dikemaskini',
      description: 'Maklumat anda telah berjaya disimpan.',
    });
    setIsSubmitting(false);
    router.push('/profile');
  };

  if (isUserLoading || isProfileLoading || !userProfile) {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
                Kemaskini Profil
            </h1>
            <Card>
                <CardHeader>
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-4 w-72 mt-2" />
                </CardHeader>
                <CardContent className="grid gap-6">
                   <div className="grid gap-3">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="grid gap-3">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                     <div className="grid gap-3">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                     <div className="grid gap-3">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
        Kemaskini Profil
      </h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Butiran Peribadi</CardTitle>
            <CardDescription>
              Kemaskini maklumat peribadi anda di sini. Klik simpan setelah selesai.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-3">
              <Label htmlFor="userId">ID Pelajar (No. Matrik)</Label>
              <Input id="userId" type="text" value={userProfile.id} disabled />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="role">Peranan</Label>
              <Input id="role" type="text" value={userProfile.role} disabled />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="fullName">Nama Penuh</Label>
              <Input id="fullName" type="text" {...register('fullName')} />
              {errors.fullName && <p className="text-sm text-destructive mt-1">{errors.fullName.message}</p>}
            </div>
            <div className="grid gap-3">
              <Label htmlFor="email">E-mel</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
            </div>
            <div className="grid gap-3">
              <Label htmlFor="course">Kursus</Label>
              <Input id="course" type="text" placeholder="Cth: Diploma Teknologi Digital" {...register('course')} />
               {errors.course && <p className="text-sm text-destructive mt-1">{errors.course.message}</p>}
            </div>
          </CardContent>
        </Card>
        <div className="flex items-center justify-end gap-2 mt-6">
          <Button variant="outline" type="button" onClick={() => router.push('/profile')}>
            Batal
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Menyimpan...' : 'Simpan Kemaskini'}
          </Button>
        </div>
      </form>
    </div>
  );
}
