'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Calendar as CalendarIcon, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useUser, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { doc, writeBatch, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateSlug } from "@/lib/slug-generator";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";

const programFormSchema = z.object({
  title: z.string().min(1, "Title is required."),
  description: z.string().min(1, "Description is required."),
  location: z.string().min(1, "Location is required."),
  startDate: z.date({ required_error: "Start date is required." }),
  startTime: z.string().min(1, "Start time is required."),
  endDate: z.date({ required_error: "End date is required." }),
  endTime: z.string().min(1, "End time is required."),
  status: z.enum(["upcoming", "ongoing", "completed"]),
  qrSlug: z.string().optional(),
  redirectUrl: z.string().optional(),
  
  // Config fields
  copywriting: z.string().optional(),
  requireStudentId: z.boolean().default(true),
  requirePhone: z.boolean().default(false),
  requireClass: z.boolean().default(false),
  customInput1Enabled: z.boolean().default(false),
  customInput1Label: z.string().optional(),
  customInput2Enabled: z.boolean().default(false),
  customInput2Label: z.string().optional(),
  
  // Validation fields
  checkOutOpenDate: z.date().optional(),
  checkOutOpenStartTime: z.string().optional(),
  checkOutCloseDate: z.date().optional(),
  checkOutCloseEndTime: z.string().optional(),

}).refine(data => data.endDate >= data.startDate, {
    message: "End date must be on or after start date.",
    path: ['endDate'],
}).refine(data => {
    if (data.startDate.toDateString() === data.endDate.toDateString()) {
        return data.endTime > data.startTime;
    }
    return true;
}, {
    message: "End time must be after start time on the same day.",
    path: ['endTime'],
}).refine(data => {
    const combine = (date?: Date, time?: string): Date | undefined => {
      if (!date || !time) return undefined;
      const [h, m] = time.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return undefined;
      const d = new Date(date);
      d.setHours(h, m, 0, 0);
      return d;
    };
    const open = combine(data.checkOutOpenDate, data.checkOutOpenStartTime);
    const close = combine(data.checkOutCloseDate, data.checkOutCloseEndTime);
    if (open && close) {
      return close >= open;
    }
    return true;
}, {
    message: "Check-out close time must be after open time.",
    path: ['checkOutCloseDate'],
});

type ProgramFormValues = z.infer<typeof programFormSchema>;

export default function CreateProgramPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const currentYear = new Date().getFullYear();
    
    const form = useForm<ProgramFormValues>({
        resolver: zodResolver(programFormSchema),
        defaultValues: {
            title: "",
            description: "",
            location: "",
            startTime: "",
            endTime: "",
            status: "upcoming",
            redirectUrl: "",
            copywriting: "",
            requireStudentId: true,
            requirePhone: false,
            requireClass: false,
            customInput1Enabled: false,
            customInput1Label: "",
            customInput2Enabled: false,
            customInput2Label: "",
            checkOutOpenStartTime: "",
            checkOutCloseEndTime: "",
        },
    });

    const onSubmit = async (data: ProgramFormValues) => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Error', description: 'User not authenticated.' });
            return;
        }
        setIsSubmitting(true);
        
        const finalQrSlug = data.qrSlug || generateSlug();

        try {
            const programCollectionRef = collection(firestore, "programs");

            const combineDateAndTime = (date: Date, time: string): Date => {
                const [hours, minutes] = time.split(':').map(Number);
                const newDate = new Date(date);
                newDate.setHours(hours, minutes, 0, 0);
                return newDate;
            };

            const startDateTime = combineDateAndTime(data.startDate, data.startTime);
            const endDateTime = combineDateAndTime(data.endDate, data.endTime);
            const checkInOpenTime = new Date(startDateTime.getTime() - 30 * 60 * 1000);
            const checkInCloseTime = new Date(startDateTime.getTime() + 30 * 60 * 1000);

            const checkOutOpenDateTime = data.checkOutOpenDate && data.checkOutOpenStartTime
                ? combineDateAndTime(data.checkOutOpenDate, data.checkOutOpenStartTime)
                : null;
            const checkOutCloseDateTime = data.checkOutCloseDate && data.checkOutCloseEndTime
                ? combineDateAndTime(data.checkOutCloseDate, data.checkOutCloseEndTime)
                : null;

            const programData = {
                title: data.title,
                description: data.description,
                location: data.location,
                startDateTime: startDateTime,
                endDateTime: endDateTime,
                checkInOpenTime: checkInOpenTime,
                checkInCloseTime: checkInCloseTime,
                status: data.status,
                qrSlug: finalQrSlug,
                redirectUrl: data.redirectUrl || "",
                createdBy: user.uid,
                createdAt: serverTimestamp(),
                checkOutOpenTime: checkOutOpenDateTime,
                checkOutCloseTime: checkOutCloseDateTime,
            };
            const programDocRef = await addDoc(programCollectionRef, programData);
            const programId = programDocRef.id;

            const batch = writeBatch(firestore);

            const configDocRef = doc(firestore, "programConfigs", programId);
            const configData = {
                copywriting: data.copywriting || "",
                fields: {
                    requireStudentId: data.requireStudentId,
                    requirePhone: data.requirePhone,
                    requireEmail: true,
                    requireClass: data.requireClass,
                    customInput1Enabled: data.customInput1Enabled,
                    customInput1Label: data.customInput1Label || "",
                    customInput2Enabled: data.customInput2Enabled,
                    customInput2Label: data.customInput2Label || "",
                }
            };
            batch.set(configDocRef, configData);

            const slugDocRef = doc(firestore, "qrSlugs", finalQrSlug);
            batch.set(slugDocRef, { programId });
            
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
           <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                  <Link href="/admin/dashboard">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Dashboard
                  </Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Program
              </Button>
          </div>
        </div>
        
        <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 grid auto-rows-max gap-6">
                <Card>
                    <CardHeader><CardTitle>Program Info</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <FormField name="title" render={({ field }) => ( <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} placeholder="e.g., UI/UX Design Workshop" /></FormControl><FormMessage /></FormItem> )} />
                        <FormField name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} placeholder="A detailed description of the program." className="min-h-32" /></FormControl><FormMessage /></FormItem> )} />
                        <FormField name="location" render={({ field }) => ( <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} placeholder="e.g., Main Hall, JTMK" /></FormControl><FormMessage /></FormItem> )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField name="startDate" render={({ field }) => (<FormItem><FormLabel>Start Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus captionLayout="dropdown-buttons" fromYear={currentYear - 5} toYear={currentYear + 5} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                            <FormField name="endDate" render={({ field }) => (<FormItem><FormLabel>End Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < (form.getValues("startDate") || new Date())} initialFocus captionLayout="dropdown-buttons" fromYear={currentYear - 5} toYear={currentYear + 5} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField name="startTime" render={({ field }) => ( <FormItem><FormLabel>Start Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField name="endTime" render={({ field }) => ( <FormItem><FormLabel>End Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <FormField name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="upcoming">Upcoming</SelectItem><SelectItem value="ongoing">Ongoing</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Check-out & Validation</CardTitle>
                        <CardDescription>Configure check-out times.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <FormLabel>Check-out Opens</FormLabel>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField name="checkOutOpenDate" render={({ field }) => (<FormItem><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus captionLayout="dropdown-buttons" fromYear={currentYear - 5} toYear={currentYear + 5} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                                <FormField name="checkOutOpenStartTime" render={({ field }) => ( <FormItem><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <FormLabel>Check-out Closes</FormLabel>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField name="checkOutCloseDate" render={({ field }) => (<FormItem><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < (form.getValues("checkOutOpenDate") || new Date())} initialFocus captionLayout="dropdown-buttons" fromYear={currentYear - 5} toYear={currentYear + 5} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                                <FormField name="checkOutCloseEndTime" render={({ field }) => ( <FormItem><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                        </div>
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
                           <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-muted/50">
                               <div className="space-y-0.5">
                                   <FormLabel>Require Email</FormLabel>
                                   <FormDescription className="text-xs">
                                       Email is required for student attendance history.
                                   </FormDescription>
                               </div>
                               <FormControl><Switch checked={true} disabled /></FormControl>
                           </FormItem>
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
