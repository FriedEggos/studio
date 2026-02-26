
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, updateDocumentNonBlocking, useMemoFirebase, useAuth, useStorage } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { Camera } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { compressAndResizeImage } from '@/lib/image-utils';

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
  const storage = useStorage();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.photoURL || null);

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
      if (!avatarPreview) {
        setAvatarPreview(user?.photoURL || null);
      }
    }
  }, [isUserLoading, user, userProfile, form, router, avatarPreview]);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const originalFile = e.target.files[0];
      try {
        const compressedFile = await compressAndResizeImage(originalFile);
        setAvatarFile(compressedFile);
        setAvatarPreview(URL.createObjectURL(compressedFile));
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Image Processing Failed',
          description: 'Could not process the selected image.',
        });
        console.error("Image processing error", error);
      }
    }
  };

  const onSubmit = async (data: ProfileFormValues) => {
    if (!userDocRef || !user || !auth.currentUser) return;
    setIsSubmitting(true);
    
    try {
      let newPhotoURL = user.photoURL;

      if (avatarFile) {
        const storageRef = ref(storage, `profile-pictures/${user.uid}`);
        await uploadBytes(storageRef, avatarFile);
        newPhotoURL = await getDownloadURL(storageRef);
      }

      if (newPhotoURL && newPhotoURL !== user.photoURL) {
        await updateProfile(auth.currentUser, { photoURL: newPhotoURL, displayName: data.displayName });
      } else {
        await updateProfile(auth.currentUser, { displayName: data.displayName });
      }
      
      const updatedData = {
        displayName: data.displayName,
        email: data.email,
        course: data.course,
        matricId: data.matricId,
        phoneNumber: data.phoneNumber,
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
              <div className="grid gap-3 items-center justify-center text-center">
                <Label htmlFor="avatar-upload">Profile Picture</Label>
                <div className="relative group w-28 h-28 mx-auto">
                  <Avatar className="w-28 h-28">
                    <AvatarImage src={avatarPreview || `https://picsum.photos/seed/${user.uid}/200/200`} alt="Profile Picture" />
                    <AvatarFallback>{userProfile?.displayName?.[0].toUpperCase() || user.email?.[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <label htmlFor="avatar-upload" className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera className="h-8 w-8 text-white" />
                  </label>
                  <Input 
                    id="avatar-upload" 
                    type="file" 
                    accept="image/png, image/jpeg, image/gif"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer sr-only"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
              
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
