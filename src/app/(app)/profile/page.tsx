
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge as UiBadge } from "@/components/ui/badge";
import { Download, Camera, MoreHorizontal, Eye, Edit, RefreshCw, Upload, Loader2, X } from "lucide-react";
import { useUser, useCollection, useFirestore, useDoc, useMemoFirebase, useStorage } from "@/firebase";
import { collection, query, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function ProfilePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const { toast } = useToast();

  // Modal State
  const [isViewEvidenceModalOpen, setIsViewEvidenceModalOpen] = useState(false);
  const [isEditEvidenceModalOpen, setIsEditEvidenceModalOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<any | null>(null);

  // Camera and Submission State
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

  const evidenceQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, `users/${user.uid}/activity_evidence`));
  }, [user, firestore]);

  const { data: activityEvidenceHistory, isLoading: isLoadingHistory } = useCollection(evidenceQuery);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, user, router]);

  useEffect(() => {
    if (!isEditEvidenceModalOpen) return;

    setCapturedImage(null);
    setHasCameraPermission(null);

    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({video: true});
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
      }
    };

    getCameraPermission();
    
    return () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    }
  }, [isEditEvidenceModalOpen]);

  const handleOpenViewModal = (evidence: any) => {
    setSelectedEvidence(evidence);
    setIsViewEvidenceModalOpen(true);
  };

  const handleOpenEditModal = (evidence: any) => {
    setSelectedEvidence(evidence);
    setIsEditEvidenceModalOpen(true);
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
      }
    }
  };

  const handleRetake = () => {
      setCapturedImage(null);
  };

  const handleUpdateEvidence = async () => {
    if (!capturedImage || !user || !firestore || !storage || !selectedEvidence) return;
    
    setIsSubmitting(true);
    
    try {
      // 1. Upload new image
      const newBlob = await (await fetch(capturedImage)).blob();
      const newStorageRef = ref(storage, `evidence/${user.uid}/${selectedEvidence.program_id}/${Date.now()}.jpg`);
      await uploadBytes(newStorageRef, newBlob);
      const newDownloadURL = await getDownloadURL(newStorageRef);
      
      // 2. Update Firestore document, also resetting status to 'pending'
      const evidenceDocRef = doc(firestore, `users/${user.uid}/activity_evidence/${selectedEvidence.id}`);
      await updateDoc(evidenceDocRef, {
        image_url: newDownloadURL,
        status: 'pending' 
      });
      
      // 3. Delete old image from storage
      if (selectedEvidence.image_url) {
        try {
          const oldImageRef = ref(storage, selectedEvidence.image_url);
          await deleteObject(oldImageRef);
        } catch (deleteError: any) {
          // Log error if old image deletion fails, but don't block the user.
          console.warn("Could not delete old evidence photo:", deleteError.code);
        }
      }
      
      toast({ title: "Evidence Updated", description: "Your new photo has been submitted for verification." });
      setIsEditEvidenceModalOpen(false);

    } catch (error) {
      console.error("Error updating evidence:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "An error occurred while updating your evidence.",
      });
    } finally {
      setIsSubmitting(false);
      setCapturedImage(null);
    }
  };

  if (isUserLoading || isProfileLoading || !user) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
          My Profile
        </h1>
        <Card>
          <CardHeader className="items-center text-center">
            <Skeleton className="w-24 h-24 rounded-full mb-4" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-1" />
            <Skeleton className="h-4 w-2/3 mt-1" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
          My Profile
        </h1>
        <Card>
          <CardHeader className="items-center text-center">
            <Link href="/profile/edit" className="relative group">
              <Avatar className="w-24 h-24 mb-4">
                <AvatarImage src={user.photoURL || `https://picsum.photos/seed/${user.uid}/200/200`} />
                <AvatarFallback>{userProfile?.fullName?.[0].toUpperCase() || user.email?.[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 mb-4 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Camera className="h-8 w-8 text-white" />
              </div>
            </Link>
            <CardTitle className="font-headline">{userProfile?.fullName || "JTMK Student"}</CardTitle>
            <CardDescription>{userProfile?.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 my-4 text-sm border-t pt-4">
              <div className="flex justify-between items-center">
                  <span className="font-semibold text-muted-foreground">Matric ID</span>
                  <span>{userProfile?.matricId || 'Not set'}</span>
              </div>
              <div className="flex justify-between items-center">
                  <span className="font-semibold text-muted-foreground">Phone Number</span>
                  <span>{userProfile?.phoneNumber || 'Not set'}</span>
              </div>
              <div className="flex justify-between items-center">
                  <span className="font-semibold text-muted-foreground">Department</span>
                  <span>{userProfile?.course || 'Not set'}</span>
              </div>
            </div>
            <Button className="w-full" asChild>
              <Link href="/profile/edit">Edit Profile</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Participation History</CardTitle>
            <CardDescription>
              Record of programs and activities you have participated in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Program</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingHistory ? (
                  <TableRow><TableCell colSpan={4} className="text-center">Loading history...</TableCell></TableRow>
                ) : activityEvidenceHistory && activityEvidenceHistory.length > 0 ? (
                  activityEvidenceHistory.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {item.programname || item.program_id}
                      </TableCell>
                      <TableCell>{item.submissionDate ? format(item.submissionDate.toDate(), 'd MMM yyyy') : 'N/A'}</TableCell>
                      <TableCell>
                        <UiBadge
                          variant={
                            item.status === "approved" ? "default" : item.status === 'rejected' ? 'destructive' : "secondary"
                          }
                          className={
                            item.status === "approved"
                              ? "bg-green-600 hover:bg-green-700 text-white"
                              : ""
                          }
                        >
                          {item.status}
                        </UiBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenViewModal(item)} disabled={!item.image_url}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Evidence
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenEditModal(item)} disabled={item.status === 'approved'}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Evidence
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled={!item.certificateIssued} asChild>
                               <a href={"#"} download className="w-full">
                                <Download className="mr-2 h-4 w-4" />
                                Download Certificate
                              </a>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={4} className="text-center">No participation history.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isViewEvidenceModalOpen} onOpenChange={setIsViewEvidenceModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submitted Evidence</DialogTitle>
            <DialogDescription>Program: {selectedEvidence?.programname}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 rounded-lg overflow-hidden">
            <Image
              src={selectedEvidence?.image_url || ''}
              alt="Submitted evidence"
              width={800}
              height={600}
              className="w-full object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isEditEvidenceModalOpen} onOpenChange={(isOpen) => !isOpen && setIsEditEvidenceModalOpen(false)}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle className="font-headline">Update Activity Evidence</DialogTitle>
                <DialogDescription>
                    Take a new photo as proof for &quot;{selectedEvidence?.programname}&quot;. This will replace the old one.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden border-2 border-dashed relative">
                <video ref={videoRef} className={`w-full h-full object-cover ${capturedImage || hasCameraPermission !== true ? 'hidden' : ''}`} autoPlay muted playsInline />

                {capturedImage && (
                    <Image src={capturedImage} alt="Captured proof" width={640} height={360} className="object-cover absolute inset-0 w-full h-full" />
                )}

                {hasCameraPermission === false && !capturedImage && (
                    <div className="absolute inset-0 flex items-center justify-center p-4 bg-background">
                        <Alert variant="destructive">
                            <AlertTitle>Camera Access Denied</AlertTitle>
                            <AlertDescription>
                                Enable camera permissions in your browser settings to continue.
                            </AlertDescription>
                        </Alert>
                    </div>
                )}

                 {hasCameraPermission === null && !capturedImage && (
                    <div className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground p-4 bg-background">
                        <div>
                            <Camera className="h-10 w-10 mx-auto" />
                            <p className="mt-2 font-medium">Requesting camera access...</p>
                        </div>
                    </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden"></canvas>
            </div>
            <DialogFooter className="grid grid-cols-2 gap-2">
                {capturedImage ? (
                    <>
                        <Button variant="outline" onClick={handleRetake} disabled={isSubmitting}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retake
                        </Button>
                        <Button onClick={handleUpdateEvidence} disabled={isSubmitting}>
                            {isSubmitting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Upload className="mr-2 h-4 w-4" />
                            )}
                            {isSubmitting ? 'Submitting...' : 'Submit New Photo'}
                        </Button>
                    </>
                ) : (
                    <Button onClick={handleCapture} disabled={!hasCameraPermission} className="col-span-2">
                        <Camera className="mr-2 h-4 w-4" />
                        Take Photo
                    </Button>
                )}
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
