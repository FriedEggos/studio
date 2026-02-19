
'use client';

import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, Upload, Loader2, QrCode as QrCodeIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useUser, useFirestore, useStorage, useDoc, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { collection, doc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes, uploadString } from "firebase/storage";

const programFormSchema = z.object({
  name: z.string().min(1, "Program name is required."),
  briefDescription: z.string().min(1, "Brief description is required."),
  description: z.string().min(1, "Full description is required."),
  startDate: z.string().min(1, "Start date is required."),
  endDate: z.string().min(1, "End date is required."),
  image: z.instanceof(File).optional(),
});

type ProgramFormValues = z.infer<typeof programFormSchema>;

export default function CreateProgramPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  const { data: userProfile } = useDoc(userDocRef);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProgramFormValues>({
    resolver: zodResolver(programFormSchema),
  });
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setValue('image', file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: ProgramFormValues) => {
    if (!user || !firestore || !storage || !userProfile) {
        toast({ variant: 'destructive', title: 'Error', description: 'User data not loaded. Please try again.' });
        return;
    }
    setIsSubmitting(true);
    setQrImageUrl(null);

    try {
        const newProgramRef = doc(collection(firestore, "programs"));
        const programId = newProgramRef.id;

        // Step 1: Upload poster image (if provided)
        let imageUrl = "";
        if (data.image) {
            const imageRef = ref(storage, `programs/${programId}/poster.jpg`);
            await uploadBytes(imageRef, data.image);
            imageUrl = await getDownloadURL(imageRef);
        }

        // Step 2: Send program and user info to our API proxy for Google Apps Script
        const scriptPayload = {
            userName: userProfile.fullName,
            userId: user.uid,
            programId: programId,
            programName: data.name,
            briefDescription: data.briefDescription,
            startDate: data.startDate,
            endDate: data.endDate,
        };

        const sheetResponse = await fetch('/api/add-program-to-sheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scriptPayload)
        });

        if (!sheetResponse.ok) {
            const errorData = await sheetResponse.json().catch(() => ({error: 'Failed to save to Google Sheet and could not parse error response.'}));
            throw new Error(errorData.error || 'Failed to save program to Google Sheet.');
        }
        
        const sheetResult = await sheetResponse.json();
        if (sheetResult.result === 'error' || sheetResult.status === 'error' || sheetResult.success === false) {
            throw new Error(sheetResult.error || sheetResult.message || 'The Google Sheet integration reported an error.');
        }


        // Step 3: Generate QR code from programId and upload it
        const qrCodeDataUrl = await QRCode.toDataURL(programId, { width: 300 });
        const qrCodeRef = ref(storage, `qrcodes/${programId}.png`);
        await uploadString(qrCodeRef, qrCodeDataUrl, 'data_url');
        const qrCodeUrl = await getDownloadURL(qrCodeRef);

        // Step 4: Save all data to Firestore
        const programData = {
            id: programId,
            name: data.name,
            briefDescription: data.briefDescription,
            description: data.description,
            startDate: data.startDate,
            endDate: data.endDate,
            adminId: user.uid,
            imageUrl: imageUrl,
            qrCodeUrl: qrCodeUrl,
        };
        await setDoc(newProgramRef, programData);
        
        // Step 5: Update UI
        setQrImageUrl(qrCodeUrl); 
        
        toast({
            title: 'Program Created Successfully!',
            description: 'Data saved and QR code generated. You can now download the QR code.',
        });

    } catch (error) {
        console.error("Error creating program: ", error);
        toast({
            variant: 'destructive',
            title: 'Failed to create program',
            description: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.',
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid flex-1 items-start gap-4 md:gap-8 md:grid-cols-3">
      <div className="grid auto-rows-max items-start gap-4 md:gap-8 md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Program Details</CardTitle>
            <CardDescription>
              Fill in the information below for a new program or activity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <div className="grid gap-3">
                <Label htmlFor="name">Program Name</Label>
                <Input
                  id="name"
                  type="text"
                  className="w-full"
                  placeholder="e.g., UI/UX Design Workshop"
                  {...register("name")}
                />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>
              <div className="grid gap-3">
                <Label htmlFor="briefDescription">Brief Description</Label>
                <Textarea
                  id="briefDescription"
                  placeholder="A short summary for the program card preview."
                  className="min-h-24"
                  {...register("briefDescription")}
                />
                {errors.briefDescription && <p className="text-sm text-destructive mt-1">{errors.briefDescription.message}</p>}
              </div>
              <div className="grid gap-3">
                <Label htmlFor="description">Full Description</Label>
                <Textarea
                  id="description"
                  placeholder="Provide a detailed description of the program here."
                  className="min-h-40"
                  {...register("description")}
                />
                {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-3">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" className="w-full" {...register("startDate")} />
                  {errors.startDate && <p className="text-sm text-destructive mt-1">{errors.startDate.message}</p>}
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" type="date" className="w-full" {...register("endDate")} />
                  {errors.endDate && <p className="text-sm text-destructive mt-1">{errors.endDate.message}</p>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" type="button" onClick={() => router.push('/admin/dashboard')}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Saving...' : 'Save & Generate QR'}
          </Button>
        </div>
      </div>
      <div className="grid auto-rows-max items-start gap-4 md:gap-8">
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Program Image</CardTitle>
                <CardDescription>
                    Upload a poster or image for your program.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4">
                    <div className="aspect-video w-full rounded-md border-2 border-dashed border-muted-foreground/40 flex items-center justify-center overflow-hidden">
                        {imagePreview ? (
                        <Image
                            src={imagePreview}
                            alt="Program image preview"
                            width={300}
                            height={168}
                            className="object-cover w-full h-full"
                        />
                        ) : (
                        <div className="text-center p-4">
                            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground mt-2">Image Preview</p>
                        </div>
                        )}
                    </div>
                    <div>
                        <Label htmlFor="program-image-upload" className="sr-only">Upload Program Image</Label>
                        <Input id="program-image-upload" type="file" accept="image/*" onChange={handleImageChange} className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"/>
                    </div>
                </div>
            </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Program QR Code</CardTitle>
            <CardDescription>
              This QR code will be generated automatically after the program is saved.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-4">
            <div className="aspect-square w-full max-w-[200px] rounded-lg bg-muted flex items-center justify-center">
              {isSubmitting && !qrImageUrl && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
              {qrImageUrl ? (
                <Image
                  src={qrImageUrl}
                  alt="Generated QR Code"
                  width={200}
                  height={200}
                  className="rounded-lg object-cover"
                />
              ) : !isSubmitting && (
                 <QrCodeIcon className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            <Button variant="outline" className="w-full" disabled={!qrImageUrl} asChild>
              <a href={qrImageUrl || '#'} download={`program-qr.png`}>
                <Download className="mr-2 h-4 w-4" />
                Download QR
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
