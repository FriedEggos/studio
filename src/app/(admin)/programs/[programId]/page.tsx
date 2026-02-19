
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Edit, Calendar, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { format, isFuture, isPast, parseISO } from 'date-fns';

interface Program {
  id: string;
  name: string;
  description: string;
  briefDescription: string;
  startDate: string;
  endDate: string;
  venue: string;
  organizerUnit: string;
  status: 'draft' | 'active' | 'closed';
  imageUrl: string;
}

export default function ProgramDetailsPage({ params }: { params: { programId: string } }) {
  const { programId } = params;
  const firestore = useFirestore();

  const programDocRef = useMemoFirebase(() => {
    if (!programId || !firestore) return null;
    return doc(firestore, 'programs', programId);
  }, [programId, firestore]);

  const { data: program, isLoading } = useDoc<Program>(programDocRef);
  
  const getProgramStatus = (startDateString: string, endDateString: string): { text: 'Upcoming' | 'Ongoing' | 'Completed'; variant: "secondary" | "default" | "outline" } => {
      try {
          const start = parseISO(startDateString);
          const end = parseISO(endDateString);
          end.setHours(23, 59, 59, 999);

          const now = new Date();

          if (isPast(end)) {
              return { text: 'Completed', variant: 'outline' };
          }
          if (isFuture(start)) {
              return { text: 'Upcoming', variant: 'secondary' };
          }
          return { text: 'Ongoing', variant: 'default' };
      } catch(e) {
          console.error("Invalid date format for program", e);
          return { text: 'Upcoming', variant: 'secondary'}; // default status
      }
  };


  if (isLoading || !program) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/2 mt-2" />
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-6 pt-6">
            <div className="md:col-span-2 space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
            <div className="space-y-6">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-16 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const status = getProgramStatus(program.startDate, program.endDate);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center">
            <Button variant="outline" asChild>
                <Link href="/admin/dashboard">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                </Link>
            </Button>
            <Button asChild>
                <Link href={`/admin/programs/${program.id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" /> Edit Program
                </Link>
            </Button>
        </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl">{program.name}</CardTitle>
          <CardDescription className="flex items-center gap-4 pt-2">
            <Badge variant={status.variant}>{status.text}</Badge>
            <span className="capitalize">Internal Status: <Badge variant="secondary">{program.status}</Badge></span>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-8 pt-6">
            <div className="md:col-span-2 space-y-6">
                {program.imageUrl && (
                    <div className="aspect-video relative rounded-lg overflow-hidden border">
                         <Image src={program.imageUrl} alt={program.name} fill className="object-cover"/>
                    </div>
                )}
                <div>
                    <h3 className="font-semibold text-lg mb-2">Program Description</h3>
                    <p className="text-muted-foreground">{program.description}</p>
                </div>
            </div>
            <div className="space-y-6">
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5" /> Dates</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p><strong>Start:</strong> {format(parseISO(program.startDate), 'PPP')}</p>
                        <p><strong>End:</strong> {format(parseISO(program.endDate), 'PPP')}</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-5 w-5" /> Location</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>{program.venue}</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" /> Organizer</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>{program.organizerUnit}</p>
                    </CardContent>
                </Card>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
