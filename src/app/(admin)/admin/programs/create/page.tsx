
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
import { Download, Upload, Loader2, QrCode as QrCodeIcon, Calendar as CalendarIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useUser, useFirestore, useStorage } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { collection, doc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes, uploadString } from "firebase/storage";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";


const programFormSchema = z.object({
  name: z.string().min(1, "Program name is required."),
  briefDescription: z.string().min(1, "Brief description is required.").max(150, "Brief description cannot exceed 150 characters."),
  description: z.string().min(1, "Full description is required."),
  startDate: z.date({ required_error: "A start date is required." }),
  endDate: z.date({ required_error: "An end date is required." }),
  image: z.instanceof(File).optional().refine(file => !file || file.size <= 5000000, `Max image size is 5MB.`),
}).refine(data => data.endDate >= data.startDate, {
    message: "End date must be on or after the start date.",
    path: ['endDate'],
});

type ProgramFormValues = z.infer<typeof programFormSchema>;

export default function CreateProgramPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<ProgramFormValues>({
    resolver: zodResolver(programFormSchema),
    defaultValues: {
        name: "",
        briefDescription: "",
        description: "",
    }
  });
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      form.setValue('image', file, { shouldValidate: true });
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: ProgramFormValues) => {
    if (!user || !firestore || !storage) {
        toast({ variant: 'destructive', title: 'Error', description: 'User data not loaded. Please try again.' });
        return;
    }
    setIsSubmitting(true);
    setQrImageUrl(null);

    try {
        const newProgramRef = doc(collection(firestore, "programs"));
        const programId = newProgramRef.id;

        let imageUrl = "";
        if (data.image) {
            const imageRef = ref(storage, `programs/${programId}/poster.jpg`);
            await uploadBytes(imageRef, data.image);
            imageUrl = await getDownloadURL(imageRef);
        }

        const qrCodeDataUrl = await QRCode.toDataURL(programId, { width: 300 });
        const qrCodeRef = ref(storage, `qrcodes/${programId}.png`);
        await uploadString(qrCodeRef, qrCodeDataUrl, 'data_url');
        const qrCodeUrl = await getDownloadURL(qrCodeRef);

        const programData = {
            id: programId,
            name: data.name,
            briefDescription: data.briefDescription,
            description: data.description,
            startDate: data.startDate.toISOString(),
            endDate: data.endDate.toISOString(),
            adminId: user.uid,
            imageUrl: imageUrl,
            qrCodeUrl: qrCodeUrl,
        };
        await setDoc(newProgramRef, programData);
        
        setQrImageUrl(qrCodeUrl); 
        
        toast({
            title: 'Program Created Successfully!',
            description: 'Data saved to Firestore and QR code generated. You can now download the QR code.',
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
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid flex-1 items-start gap-4 md:gap-8 md:grid-cols-3">
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
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Program Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., UI/UX Design Workshop" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="briefDescription"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Brief Description</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="A short summary for the program card preview." className="min-h-24" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Full Description</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Provide a detailed description of the program here." className="min-h-40" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Start Date</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                    )}
                                >
                                    {field.value ? (
                                    format(field.value, "PPP")
                                    ) : (
                                    <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                                />
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>End Date</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                    )}
                                >
                                    {field.value ? (
                                    format(field.value, "PPP")
                                    ) : (
                                    <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                    date < (form.getValues("startDate") || new Date(new Date().setHours(0,0,0,0)))
                                }
                                initialFocus
                                />
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
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
                        Upload a poster or image for your program. (Max 5MB)
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
                           <FormField
                                control={form.control}
                                name="image"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel htmlFor="program-image-upload" className="sr-only">Upload Program Image</FormLabel>
                                        <FormControl>
                                            <Input 
                                                id="program-image-upload" 
                                                type="file" 
                                                accept="image/*" 
                                                onChange={handleImageChange}
                                                className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
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
    </Form>
  );
}
