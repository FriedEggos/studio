
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { getInitials } from '@/lib/utils';

const profileFormSchema = z.object({
  displayName: z.string().min(1, 'Full name is required.'),
  email: z.string().email('Invalid email format.'),
  course: z.string().optional(),
  matricId: z.string().optional(),
  phoneNumber: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const courses = [
  "Jabatan Kejuruteraan Awam",
  "Jabatan Kejuruteraan Mekanikal",
  "Jabatan Kejuruteraan Petrokimia",
  "Jabatan Kejuruteraan Elektrik",
  "Jabatan Teknologi Maklumat & Komunikasi",
  "Jabatan Perdagangan",
  "Jabatan Pengajian Am",
];

export default function EditProfilePage() {
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

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: '',
      email: '',
      course: '',
      matricId: '',
      phoneNumber: '',
    }
  });

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
    if (userProfile) {
      form.reset({
        displayName: userProfile.displayName || '',
        email: userProfile.email || '',
        course: userProfile.course || '',
        matricId: userProfile.matricId || '',
        phoneNumber: userProfile.phoneNumber || '',
      });
    }
  }, [isUserLoading, user, userProfile, form, router]);
  
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
        course: data.course,
        matricId: data.matricId,
        phoneNumber: data.phoneNumber,
        photoURL: newPhotoURL,
      };

      updateDocumentNonBlocking(userDocRef, updatedData);
      
      toast({
        title: 'Profile Updated',
        description: 'Your information has been successfully saved.',
      });
      router.push('/profile');
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
        <div className="space-y-6">
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
        Edit Profile
      </h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Details</CardTitle>
              <CardDescription>
                Update your personal information here. Click save when done.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <FormField
                control={form.control}
                name="matricId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student ID (Matric No.)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. 2021XXXXXX" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-3">
                <Label htmlFor="role">Role</Label>
                <Input id="role" type="text" value={userProfile.role} disabled />
              </div>
              
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input type="tel" {...field} placeholder="e.g. 012-3456789" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="course"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {courses.map(course => (
                          <SelectItem key={course} value={course}>{course}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => router.push('/profile')}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
