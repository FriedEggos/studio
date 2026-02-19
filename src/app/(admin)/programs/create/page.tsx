
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
import { Upload, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useUser, useFirestore, useStorage } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { collection, doc, setDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const programFormSchema = z.object({
  name: z.string().min(1, "Program name is required."),
  briefDescription: z.string().min(1, "Brief description is required.").max(150, "Brief description cannot exceed 150 characters."),
  description: z.string().min(1, "Full description is required."),
  venue: z.string().min(1, "Venue is required."),
  organizerUnit: z.string().min(1, "Organizer unit is required."),
  status: z.enum(["draft", "active", "closed"]),
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<ProgramFormValues>({
    resolver: zodResolver(programFormSchema),
    defaultValues: {
        name: "",
        briefDescription: "",
        description: "",
        venue: "",
        organizerUnit: "",
        status: "draft",
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
        toast({ variant: 'destructive', title: 'Error', description: 'User not authenticated or services unavailable.' });
        return;
    }
    setIsSubmitting(true);

    const newProgramRef = doc(collection(firestore, "programs"));
    const programId = newProgramRef.id;

    try {
        // Step 1 (Fast Save): Save lightweight data first
        const programData = {
            id: programId,
            name: data.name,
            briefDescription: data.briefDescription,
            description: data.description,
            startDate: data.startDate.toISOString(),
            endDate: data.endDate.toISOString(),
            venue: data.venue,
            organizerUnit: data.organizerUnit,
            status: data.status,
            adminId: user.uid,
            imageUrl: "", // Initially empty
            createdAt: new Date().toISOString(),
        };

        await setDoc(newProgramRef, programData);

        toast({
            title: 'Program Saved!',
            description: 'Your program has been created. Uploading image in background...',
        });

        // Step 2 (Async Image Upload): Upload image in the background without awaiting
        if (data.image) {
            const imageRef = ref(storage, `programs/${programId}/poster.jpg`);
            uploadBytes(imageRef, data.image).then(async () => {
                const downloadURL = await getDownloadURL(imageRef);
                await updateDoc(newProgramRef, { imageUrl: downloadURL });
                toast({ title: 'Image successfully uploaded!'})
            }).catch(error => {
                console.error("Image upload failed:", error);
                toast({ variant: 'destructive', title: 'Image upload failed', description: 'Your program was saved, but the image upload failed. You can add it by editing the program.'})
            });
        }
        
        // Redirect immediately after fast save
        router.push(`/admin/programs/${programId}/edit`);

    } catch (error: any) {
        console.error("Error creating program: ", error);
        
        let description = 'An unexpected error occurred. Please try again.';
        if (error.code === 'permission-denied') {
            description = 'You do not have permission to create programs. Please contact an administrator.';
        } else if (error instanceof Error) {
            description = error.message;
        }

        toast({
            variant: 'destructive',
            title: 'Failed to Create Program',
            description: description,
        });
        setIsSubmitting(false); // Only set to false on error, as we redirect on success
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
                            name="venue"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Venue</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Main Hall, JTMK" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="organizerUnit"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Organizer Unit</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., MPJTMK" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
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
                 <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select program status" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                </div>
            </CardContent>
            </Card>
            <div className="flex items-center justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => router.push('/admin/dashboard')}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Saving...' : 'Save Program'}
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
        </div>
        </form>
    </Form>
  );
}
