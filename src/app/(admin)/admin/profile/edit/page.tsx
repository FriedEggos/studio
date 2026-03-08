
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
import { useUser, useFirestore, useDoc, updateDocumentNonBlocking, useMemoFirebase, useAuth, useStorage } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { Camera } from 'lucide-react';
import { compressAndResizeImage } from '@/lib/image-utils';
import { Progress } from '@/components/ui/progress';

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
  const storage = useStorage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.photoURL || null);

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
      if (!avatarPreview) {
        setAvatarPreview(user?.photoURL || null);
      }
    }
  }, [isUserLoading, user, userProfile, reset, router, avatarPreview]);
  
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
    setUploadProgress(null);
    
    try {
      let newPhotoURL = user.photoURL;

      if (avatarFile && storage) {
        setUploadProgress(0);
        const storageRef = ref(storage, `profile-pictures/${user.uid}`);
        const uploadTask = uploadBytesResumable(storageRef, avatarFile);

        newPhotoURL = await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => {
              console.error("Upload failed:", error);
              reject(error);
            },
            () => {
              getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                resolve(downloadURL);
              });
            }
          );
        });
      }
      
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
        description: error.code === 'storage/unauthorized'
          ? "Permission denied. Check your storage rules."
          : "An error occurred while updating your profile.",
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
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
                    <div className="grid gap-3 items-center justify-center text-center">
                        <Skeleton className="h-4 w-24 mx-auto" />
                        <Skeleton className="h-28 w-28 rounded-full mx-auto" />
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
             {uploadProgress !== null && (
                <div className="grid gap-2">
                    <Label>Upload Progress</Label>
                    <Progress value={uploadProgress} />
                </div>
            )}
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
             {isSubmitting ? (uploadProgress !== null ? `Uploading ${Math.round(uploadProgress)}%...` : 'Saving...') : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
