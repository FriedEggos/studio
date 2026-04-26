
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, collectionGroup, query, where, orderBy } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Award, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getInitials, cn, getCheckoutStatusColor } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useEffect, useState } from "react";


// --- Existing User Profile Interface ---
interface UserProfile {
    id: string;
    displayName: string;
    email: string;
    role: 'student' | 'admin';
    matricId?: string;
    phoneNumber?: string;
    course?: string;
    photoURL?: string;
}

// --- New Interfaces for Histories ---
interface Position {
    id: string;
    programName: string;
    peringkat: string;
    positionName: string;
    customPositionDetail?: string;
    verificationStatus: 'pending' | 'approved' | 'rejected';
    createdAt: { toDate: () => Date };
}

interface Program {
    id: string;
    title: string;
}

interface AttendanceRecord {
    id: string;
    programId: string;
    createdAt: { toDate: () => Date };
    checkOutAt?: { toDate: () => Date };
    checkOutStatus?: 'ok' | 'too_early' | 'outside_window' | 'too_short' | 'admin_override';
}

interface ParticipationHistoryItem extends AttendanceRecord {
    programTitle: string;
}


export default function UserProfilePage() {
  const params = useParams();
  const userId = params.userId as string;
  const firestore = useFirestore();

  // --- Fetch User Profile ---
  const userDocRef = useMemoFirebase(() => {
    if (!userId || !firestore) return null;
    return doc(firestore, 'users', userId);
  }, [userId, firestore]);
  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<UserProfile>(userDocRef);

  // --- Fetch Contribution History ---
  const positionsQuery = useMemoFirebase(() => {
    if (!userId || !firestore) return null;
    return query(collection(firestore, 'users', userId, 'positions'), orderBy('createdAt', 'desc'));
  }, [userId, firestore]);
  const { data: positions, isLoading: isLoadingPositions } = useCollection<Position>(positionsQuery);

  // --- Fetch Participation History ---
  const [participationHistory, setParticipationHistory] = useState<ParticipationHistoryItem[]>([]);
  
  const allProgramsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'programs') : null, [firestore]);
  const { data: allPrograms, isLoading: isLoadingPrograms } = useCollection<Program>(allProgramsQuery);

  const userAttendancesQuery = useMemoFirebase(() => {
    if (!userProfile?.email || !firestore) return null;
    return query(collectionGroup(firestore, 'attendances'), where('email', '==', userProfile.email));
  }, [userProfile, firestore]);
  const { data: userAttendances, isLoading: isLoadingAttendances } = useCollection<AttendanceRecord>(userAttendancesQuery);

  // Combine attendances with program titles
  useEffect(() => {
    if (!allPrograms || !userAttendances) {
        setParticipationHistory([]);
        return;
    };
    const programsMap = new Map(allPrograms.map(p => [p.id, p.title]));
    const newHistory = userAttendances
        .map(att => ({
            ...att,
            programTitle: programsMap.get(att.programId) || 'Unknown Program',
        }))
        .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
    setParticipationHistory(newHistory);
  }, [allPrograms, userAttendances]);

  const isLoading = isLoadingProfile || isLoadingPositions || isLoadingPrograms || isLoadingAttendances;

  if (isLoading || !userProfile) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-40" />
        <Card>
          <CardHeader className="items-center text-center">
            <Skeleton className="w-24 h-24 rounded-full mb-4" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
        <Card><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
      </div>
    );
  }

  // Admin Profile View (doesn't need history tables)
  if (userProfile.role === 'admin') {
      return (
          <div className="space-y-6 max-w-2xl mx-auto">
              <Button variant="outline" asChild>
                  <Link href="/admin/users"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Users</Link>
              </Button>
              <Card>
                  <CardHeader className="items-center text-center">
                      <Avatar className="w-24 h-24 mb-4">
                          <AvatarImage src={userProfile.photoURL || `https://ui-avatars.com/api/?name=${getInitials(userProfile.displayName || '')}&background=random&color=fff`} />
                          <AvatarFallback>{getInitials(userProfile.displayName || userProfile.email || '')}</AvatarFallback>
                      </Avatar>
                      <CardTitle className="font-headline">{userProfile.displayName}</CardTitle>
                      <CardDescription>{userProfile.email}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-6 border-t">
                          <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground">Role</p>
                              <p className="capitalize font-semibold text-primary">{userProfile.role}</p>
                          </div>
                      </div>
                  </CardContent>
              </Card>
          </div>
      );
  }

  // Student Profile View with History Tables
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
        <Button variant="outline" asChild>
            <Link href="/admin/users">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Users
            </Link>
        </Button>

      <Card>
        <CardHeader className="items-center text-center">
          <Avatar className="w-24 h-24 mb-4">
            <AvatarImage src={userProfile.photoURL || `https://ui-avatars.com/api/?name=${getInitials(userProfile.displayName || '')}&background=random&color=fff`} />
            <AvatarFallback>{getInitials(userProfile.displayName || userProfile.email || '')}</AvatarFallback>
          </Avatar>
          <CardTitle className="font-headline">{userProfile.displayName}</CardTitle>
          <CardDescription>{userProfile.email}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Role</p>
                    <p className="capitalize">{userProfile.role}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Matric ID</p>
                    <p>{userProfile.matricId || 'Not set'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
                    <p>{userProfile.phoneNumber || 'Not set'}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Department</p>
                    <p>{userProfile.course || 'Not set'}</p>
                </div>
            </div>
        </CardContent>
      </Card>
      
      {/* Contribution History Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5" /> Contribution History</CardTitle>
          <CardDescription>A list of all positions this student has claimed.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date Claimed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingPositions ? (
                <TableRow><TableCell colSpan={5}><Skeleton className="h-20 w-full" /></TableCell></TableRow>
              ) : positions && positions.length > 0 ? (
                positions.map(pos => (
                  <TableRow key={pos.id}>
                    <TableCell>{pos.programName}</TableCell>
                    <TableCell>{pos.peringkat}</TableCell>
                    <TableCell>
                      {pos.positionName}
                      {pos.customPositionDetail && <span className="text-muted-foreground text-xs ml-2">({pos.customPositionDetail})</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                          pos.verificationStatus === 'approved' ? 'default' :
                          pos.verificationStatus === 'rejected' ? 'destructive' :
                          'secondary'
                        } className="capitalize">
                        {pos.verificationStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{pos.createdAt ? format(pos.createdAt.toDate(), 'dd/MM/yyyy') : ''}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">No contributions claimed.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Participation History Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Program Participation</CardTitle>
          <CardDescription>A record of all programs this student has attended.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program Name</TableHead>
                <TableHead>Date Joined</TableHead>
                <TableHead>Check-out Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingAttendances || isLoadingPrograms ? (
                 <TableRow><TableCell colSpan={3}><Skeleton className="h-20 w-full" /></TableCell></TableRow>
              ) : participationHistory.length > 0 ? (
                participationHistory.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.programTitle}</TableCell>
                    <TableCell>{item.createdAt ? format(item.createdAt.toDate(), 'Pp') : '-'}</TableCell>
                    <TableCell className={cn(item.checkOutAt ? getCheckoutStatusColor(item.checkOutStatus) : 'text-muted-foreground font-medium')}>
                        {item.checkOutAt ? format(item.checkOutAt.toDate(), 'Pp') : 'No Checkout'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24">No programs attended.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
