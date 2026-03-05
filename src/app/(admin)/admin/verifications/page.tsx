'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collectionGroup, doc, query, updateDoc, where, orderBy } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Check, X } from "lucide-react";

interface Position {
  id: string;
  userId: string;
  userName: string;
  positionName: string;
  customPositionDetail?: string;
  programName: string;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  createdAt: { toDate: () => Date };
}

export default function VerificationsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const pendingQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collectionGroup(firestore, 'positions'),
      where('verificationStatus', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore]);

  const { data: pendingPositions, isLoading, error } = useCollection<Position>(pendingQuery);

  const handleVerification = async (position: Position, newStatus: 'approved' | 'rejected') => {
    if (!firestore) return;
    // The path to the document is /users/{userId}/positions/{positionId}
    const positionDocRef = doc(firestore, `users/${position.userId}/positions`, position.id);
    
    try {
      await updateDoc(positionDocRef, { verificationStatus: newStatus });
      toast({
        title: `Position ${newStatus === 'approved' ? 'Approved' : 'Rejected'}`,
        description: `The position for ${position.userName} has been ${newStatus === 'approved' ? 'approved' : 'rejected'}.`,
      });
    } catch (err) {
      console.error('Verification update failed:', err);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not update the position status.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
        Pending Verifications
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Position Applications</CardTitle>
          <CardDescription>
            Review and approve or reject position claims submitted by students.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Program Name</TableHead>
                <TableHead>Position Claimed</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right space-x-2"><Skeleton className="h-8 w-8 inline-block" /><Skeleton className="h-8 w-8 inline-block" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-destructive">
                    Error loading verifications. Please try again.
                  </TableCell>
                </TableRow>
              ) : pendingPositions && pendingPositions.length > 0 ? (
                pendingPositions.map((pos) => (
                  <TableRow key={pos.id}>
                    <TableCell className="font-medium">{pos.userName}</TableCell>
                    <TableCell>{pos.programName}</TableCell>
                    <TableCell>
                      {pos.positionName}
                      {pos.positionName === "AJK Lain-Lain" && pos.customPositionDetail && (
                        <span className="text-muted-foreground ml-2">({pos.customPositionDetail})</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {pos.createdAt ? formatDistanceToNow(pos.createdAt.toDate(), { addSuffix: true }) : ''}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                        onClick={() => handleVerification(pos, 'approved')}
                      >
                        <Check className="h-4 w-4" />
                        <span className="sr-only">Approve</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        onClick={() => handleVerification(pos, 'rejected')}
                      >
                        <X className="h-4 w-4" />
                         <span className="sr-only">Reject</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No pending verifications found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
