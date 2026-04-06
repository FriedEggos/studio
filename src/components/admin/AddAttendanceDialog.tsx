
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { DateDropdownPicker } from '@/components/ui/date-dropdown-picker';

const formSchema = z.object({
  studentName: z.string().min(1, 'Student name is required.'),
  studentId: z.string().optional(),
  classGroup: z.string().optional(),
  email: z.string().email('Invalid email address.'),
  checkInDate: z.date().optional(),
  checkInTime: z.string().optional(),
  checkOutDate: z.date().optional(),
  checkOutTime: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddAttendanceDialogProps {
  programId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function AddAttendanceDialog({
  programId,
  isOpen,
  onOpenChange,
}: AddAttendanceDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      studentName: '',
      studentId: '',
      classGroup: '',
      email: '',
    },
  });
  
  const currentYear = new Date().getFullYear();

  const combineDateAndTime = (date?: Date, time?: string): Timestamp | null => {
      if (!date) return null;
      const d = new Date(date);
      if (time) {
          const [h, m] = time.split(':').map(Number);
          if (!isNaN(h) && !isNaN(m)) {
              d.setHours(h, m, 0, 0);
          }
      }
      return Timestamp.fromDate(d);
  };

  const onSubmit = async (values: FormValues) => {
    if (!firestore) return;
    setIsSubmitting(true);
    
    const studentEmail = values.email.toLowerCase().trim();
    const docRef = doc(firestore, 'programs', programId, 'attendances', studentEmail);

    const checkInTimestamp = combineDateAndTime(values.checkInDate, values.checkInTime);
    const checkOutTimestamp = combineDateAndTime(values.checkOutDate, values.checkOutTime);
    
    try {
      const dataToSet: any = {
        programId,
        studentName: values.studentName.toUpperCase(),
        studentId: values.studentId?.toUpperCase() || '',
        classGroup: values.classGroup?.toUpperCase() || '',
        email: studentEmail,
        createdAt: checkInTimestamp || serverTimestamp(),
        userAgent: 'manual-admin-add',
      };

      if (checkOutTimestamp) {
        dataToSet.checkOutAt = checkOutTimestamp;
        if(checkInTimestamp) {
            const duration = (checkOutTimestamp.seconds - checkInTimestamp.seconds) / 60;
            dataToSet.durationMinutes = Math.max(0, Math.floor(duration));
        }
        dataToSet.checkOutStatus = 'admin_override';
      }

      await setDoc(docRef, dataToSet, { merge: true });

      toast({
        title: 'Success!',
        description: 'Attendance record has been added.',
      });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding attendance:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add attendance record.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Manual Attendance</DialogTitle>
          <DialogDescription>
            Fill in the details below to add a new attendance record.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (used as ID)</FormLabel>
                  <FormControl>
                    <Input placeholder="student@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="studentName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Student Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Full Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="studentId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Student ID</FormLabel>
                    <FormControl>
                        <Input placeholder="Matric ID" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="classGroup"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Class</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., DIT2A" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
             <div className="space-y-2">
                <FormLabel>Check-in Time</FormLabel>
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="checkInDate" render={({ field }) => (
                        <FormItem><FormControl><DateDropdownPicker value={field.value} onChange={field.onChange} fromYear={currentYear - 5} toYear={currentYear + 1} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="checkInTime" render={({ field }) => (
                        <FormItem><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
            </div>
            <div className="space-y-2">
                <FormLabel>Check-out Time (Optional)</FormLabel>
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="checkOutDate" render={({ field }) => (
                        <FormItem><FormControl><DateDropdownPicker value={field.value} onChange={field.onChange} fromYear={currentYear - 5} toYear={currentYear + 1} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="checkOutTime" render={({ field }) => (
                        <FormItem><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Record
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
