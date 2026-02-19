
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
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2, Calendar as CalendarIcon, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useUser, useFirestore, useStorage, useDoc, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { format, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { compressAndResizeImage } from "@/lib/image-utils";


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
type Program = {
  id: string;
  name: string;
  briefDescription: string;
  description: string;
  startDate: string;
  endDate: string;
  venue: string;
  organizerUnit: string;
  status: 'draft' | 'active' | 'closed';
  imageUrl: string;
}

export default function EditProgramPage() {
  const params = useParams();
  const programId = params.programId as string;
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();

  const programDocRef = useMemoFirebase(() => {
    if (!programId || !firestore) return null;
    return doc(firestore, 'programs', programId);
  }, [programId, firestore]);
  const { data: program, isLoading: isLoadingProgram } = useDoc<Program>(programDocRef);

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

  useEffect(() => {
    if (program) {
        form.reset({
            name: program.name,
            briefDescription: program.briefDescription,
            description: program.description,
            venue: program.venue,
            organizerUnit: program.organizerUnit,
            status: program.status,
            startDate: parseISO(program.startDate),
            endDate: parseISO(program.endDate),
        });
        setImagePreview(program.imageUrl);
    }
  }, [program, form]);
  
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const originalFile = e.target.files[0];
      try {
        const compressedFile = await compressAndResizeImage(originalFile);
        form.setValue('image', compressedFile, { shouldValidate: true });
        setImagePreview(URL.createObjectURL(compressedFile));
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

  const onSubmit = async (data: ProgramFormValues) => {
    if (!user || !programDocRef || !storage || !program) {
        toast({ variant: 'destructive', title: 'Error', description: 'User not authenticated or program not found.' });
        return;
    }
    setIsSubmitting(true);

    try {
        let imageUrl = program.imageUrl;
        if (data.image) {
            const imageRef = ref(storage, `programs/${programId}/poster.jpg`);
            await uploadBytes(imageRef, data.image);
            imageUrl = await getDownloadURL(imageRef);
        }

        const programData = {
            name: data.name,
            briefDescription: data.briefDescription,
            description: data.description,
            startDate: data.startDate.toISOString(),
            endDate: data.endDate.toISOString(),
            venue: data.venue,
            organizerUnit: data.organizerUnit,
            status: data.status,
            imageUrl: imageUrl,
        };

        await updateDoc(programDocRef, programData);

        toast({
            title: 'Program Updated Successfully!',
            description: 'The program has been saved.',
        });
        router.push(`/admin/programs/${programId}`);

    } catch (error: any) {
        console.error("Error updating program: ", error);
        
        let description = 'An unexpected error occurred. Please try again.';
        if (error.code === 'storage/unauthorized') {
            description = 'Image upload failed. You may not have permission. Please check your Firebase Storage security rules.';
        } else if (error.code === 'permission-denied') {
            description = 'You do not have permission to update programs. Please check your Firestore security rules.';
        } else if (error instanceof Error) {
            description = error.message;
        }

        toast({
            variant: 'destructive',
            title: 'Failed to Update Program',
            description: description,
        });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  if (isLoadingProgram) {
      return (
          <div className="space-y-4">
              <Skeleton className="h-10 w-40" />
              <div className="grid gap-4 md:gap-8 md:grid-cols-3">
                  <div className="md:col-span-2 space-y-4">
                      <Skeleton className="h-96 w-full" />
                  </div>
                  <div className="space-y-4">
                    <Skeleton className="h-64 w-full" />
                  </div>
              </div>
          </div>
      )
  }

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid flex-1 items-start gap-4 md:gap-8 md:grid-cols-3">
        <div className="grid auto-rows-max items-start gap-4 md:gap-8 md:col-span-2">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href={`/admin/dashboard`}>
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Back</span>
                    </Link>
                </Button>
                <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
                    Edit Program
                </h1>
            </div>
            <Card>
            <CardHeader>
                <CardTitle className="font-headline">Program Details</CardTitle>
                <CardDescription>
                Update the information for this program.
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
            <Button variant="outline" type="button" onClick={() => router.push(`/admin/dashboard`)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Saving...' : 'Save Changes'}
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
