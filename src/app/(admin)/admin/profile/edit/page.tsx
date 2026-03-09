
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
import { useUser, useFirestore, useDoc, updateDocumentNonBlocking, useMemoFirebase, useAuth } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { updateProfile } from 'firebase/auth';
import { getInitials } from '@/lib/utils';

const profileFormSchema = z.object({
  displayName: z.string().min(1, 'Display name is required.'),
  email: z.string().email('Invalid email format.'),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function AdminEditProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
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
      displayName: '',
      email: '',
    }
  });

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
    if (userProfile) {
      reset({
        displayName: userProfile.displayName || '',
        email: userProfile.email || '',
      });
    }
  }, [isUserLoading, user, userProfile, reset, router]);
  
  const onSubmit = async (data: ProfileFormValues) => {
    if (!userDocRef || !user || !auth.currentUser) return;
    setIsSubmitting(true);
    
    try {
      const initials = getInitials(data.displayName);
      const newPhotoURL = `https://ui-avatars.com/api/?name=${initials}&background=random&color=fff`;
      
      await updateProfile(auth.currentUser, { displayName: data.displayName, photoURL: newPhotoURL });

      const updatedData = {
        displayName: data.displayName,
        email: data.email,
        photoURL: newPhotoURL,
      };

      updateDocumentNonBlocking(userDocRef, updatedData);
      
      toast({
        title: 'Profile Updated',
        description: 'Your information has been successfully saved.',
      });
      router.push('/admin/profile');
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        variant: "destructive",
        title: "Profile Update Failed",
        description: "An error occurred while updating your profile.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading || isProfileLoading || !userProfile || !user) {
    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
                Edit Profile
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
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
        Edit Profile
      </h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Personal Details</CardTitle>
            <CardDescription>
              Update your personal information here. Click save when done.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-3">
              <Label htmlFor="role">Role</Label>
              <Input id="role" type="text" value={userProfile.role} disabled />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" type="text" {...register('displayName')} />
              {errors.displayName && <p className="text-sm text-destructive mt-1">{errors.displayName.message}</p>}
            </div>
            <div className="grid gap-3">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} disabled />
              {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
            </div>
          </CardContent>
        </Card>
        <div className="flex items-center justify-end gap-2 mt-6">
          <Button variant="outline" type="button" onClick={() => router.push('/admin/profile')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
             {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
