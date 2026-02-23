
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useUser, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateSlug } from "@/lib/slug-generator";
import { Switch } from "@/components/ui/switch";

const programFormSchema = z.object({
  title: z.string().min(1, "Title is required."),
  description: z.string().min(1, "Description is required."),
  location: z.string().min(1, "Location is required."),
  startDate: z.date({ required_error: "Start date is required." }),
  endDate: z.date({ required_error: "End date is required." }),
  status: z.enum(["upcoming", "ongoing", "completed"]),
  qrSlug: z.string().optional(),
  redirectUrl: z.string().optional(),
  
  // Config fields
  copywriting: z.string().optional(),
  requireStudentId: z.boolean().default(true),
  requirePhone: z.boolean().default(false),
  requireEmail: z.boolean().default(false),
  requireClass: z.boolean().default(false),
  customInput1Enabled: z.boolean().default(false),
  customInput1Label: z.string().optional(),
  customInput2Enabled: z.boolean().default(false),
  customInput2Label: z.string().optional(),
}).refine(data => data.endDate >= data.startDate, {
    message: "End date must be on or after start date.",
    path: ['endDate'],
});

type ProgramFormValues = z.infer<typeof programFormSchema>;

export default function CreateProgramPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();

    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const form = useForm<ProgramFormValues>({
        resolver: zodResolver(programFormSchema),
        defaultValues: {
            title: "",
            description: "",
            location: "",
            status: "upcoming",
            redirectUrl: "",
            copywriting: "",
            requireStudentId: true,
            requireEmail: false,
            requirePhone: false,
            requireClass: false,
            customInput1Enabled: false,
            customInput1Label: "",
            customInput2Enabled: false,
            customInput2Label: "",
        },
    });

    const onSubmit = async (data: ProgramFormValues) => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Error', description: 'User not authenticated.' });
            return;
        }
        setIsSubmitting(true);
        
        const programId = doc(firestore, 'programs', 'temp-id').id;
        const finalQrSlug = data.qrSlug || generateSlug();

        try {
            const batch = writeBatch(firestore);
            
            // 1. Program Document
            const programDocRef = doc(firestore, "programs", programId);
            const programData = {
                title: data.title,
                description: data.description,
                location: data.location,
                startDate: data.startDate.toISOString(),
                endDate: data.endDate.toISOString(),
                status: data.status,
                qrSlug: finalQrSlug,
                redirectUrl: data.redirectUrl || "",
                createdBy: user.uid,
                createdAt: serverTimestamp(),
            };
            batch.set(programDocRef, programData);

            // 2. Program Config Document
            const configDocRef = doc(firestore, "programConfigs", programId);
            const configData = {
                copywriting: data.copywriting || "",
                fields: {
                    requireStudentId: data.requireStudentId,
                    requirePhone: data.requirePhone,
                    requireEmail: data.requireEmail,
                    requireClass: data.requireClass,
                    customInput1Enabled: data.customInput1Enabled,
                    customInput1Label: data.customInput1Label || "",
                    customInput2Enabled: data.customInput2Enabled,
                    customInput2Label: data.customInput2Label || "",
                }
            };
            batch.set(configDocRef, configData);

            // 3. QR Slug Mapping Document
            const slugDocRef = doc(firestore, "qrSlugs", finalQrSlug);
            batch.set(slugDocRef, { programId: programId });
            
            await batch.commit();

            toast({ title: 'Program Created!', description: 'The new program has been saved.' });
            router.push(`/admin/programs/${programId}`);
        } catch (error) {
            console.error("Error creating program: ", error);
            toast({ variant: 'destructive', title: 'Creation Failed', description: 'Could not save the program.' });
        } finally {
            setIsSubmitting(false);
        }
    };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">Create New Program</h1>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Program
          </Button>
        </div>
        
        <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Program Info</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <FormField name="title" render={({ field }) => ( <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} placeholder="e.g., UI/UX Design Workshop" /></FormControl><FormMessage /></FormItem> )} />
                        <FormField name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} placeholder="A detailed description of the program." className="min-h-32" /></FormControl><FormMessage /></FormItem> )} />
                        <FormField name="location" render={({ field }) => ( <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} placeholder="e.g., Main Hall, JTMK" /></FormControl><FormMessage /></FormItem> )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField name="startDate" render={({ field }) => (<FormItem><FormLabel>Start Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                            <FormField name="endDate" render={({ field }) => (<FormItem><FormLabel>End Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < (form.getValues("startDate") || new Date())} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                        </div>
                        <FormField name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="upcoming">Upcoming</SelectItem><SelectItem value="ongoing">Ongoing</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    </CardContent>
                </Card>
            </div>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>QR Form Configuration</CardTitle>
                        <CardDescription>Customize the public attendance form.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField name="qrSlug" render={({ field }) => ( <FormItem><FormLabel>QR Code Slug (Optional)</FormLabel><FormControl><Input {...field} placeholder="Auto-generated if left blank" /></FormControl><FormMessage /></FormItem> )} />
                        <FormField name="redirectUrl" render={({ field }) => ( <FormItem><FormLabel>Redirect URL (Optional)</FormLabel><FormControl><Input {...field} placeholder="https://example.com" /></FormControl><FormMessage /></FormItem> )} />
                        <FormField name="copywriting" render={({ field }) => ( <FormItem><FormLabel>Form Instructions</FormLabel><FormControl><Textarea {...field} placeholder="Welcome! Please fill in your details." /></FormControl><FormMessage /></FormItem> )} />
                        
                        <CardTitle className="text-base pt-4">Form Fields</CardTitle>
                        <div className="space-y-2">
                           <FormField name="requireStudentId" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3"><div className="space-y-0.5"><FormLabel>Require Student ID</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                           <FormField name="requireEmail" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3"><div className="space-y-0.5"><FormLabel>Require Email</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                           <FormField name="requirePhone" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3"><div className="space-y-0.5"><FormLabel>Require Phone Number</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                           <FormField name="requireClass" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3"><div className="space-y-0.5"><FormLabel>Require Class</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                        </div>
                        
                        <CardTitle className="text-base pt-4">Custom Fields</CardTitle>
                        <div className="space-y-4">
                            <FormField name="customInput1Enabled" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3"><div className="space-y-0.5"><FormLabel>Enable Custom Field 1</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                            {form.watch('customInput1Enabled') && <FormField name="customInput1Label" render={({ field }) => (<FormItem><FormLabel>Custom Field 1 Label</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />}
                            
                            <FormField name="customInput2Enabled" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3"><div className="space-y-0.5"><FormLabel>Enable Custom Field 2</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                            {form.watch('customInput2Enabled') && <FormField name="customInput2Label" render={({ field }) => (<FormItem><FormLabel>Custom Field 2 Label</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      </form>
    </Form>
  );
}
