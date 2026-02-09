
'use client';

import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { QrCode, ArrowRight, Calendar, X } from "lucide-react";
import { programs as staticPrograms, myPrograms as staticMyPrograms } from "@/lib/data";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isFuture, isPast, isToday, parseISO } from 'date-fns';


interface Program {
    id: string;
    name: string;
    date: string;
    description: string;
    imageId: string;
}

export default function StudentDashboard() {
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isQrCodeModalOpen, setIsQrCodeModalOpen] = useState(false);
  
  const [programs, setPrograms] = useState<Program[]>(staticPrograms);
  const [myPrograms, setMyPrograms] = useState<Program[]>(staticMyPrograms);

  const handleOpenProgramModal = (program: Program) => {
    setSelectedProgram(program);
  };

  const handleCloseProgramModal = () => {
    setSelectedProgram(null);
  };

  const handleOpenImageModal = () => {
    if (selectedProgram) {
      setIsImageModalOpen(true);
    }
  };
  
  const handleCloseImageModal = () => {
    setIsImageModalOpen(false);
  };

  const handleOpenQrCodeModal = () => {
    handleCloseProgramModal(); // Close the details modal first
    setIsQrCodeModalOpen(true);
  };

  const handleCloseQrCodeModal = () => {
    setIsQrCodeModalOpen(false);
  };


  const selectedImage = PlaceHolderImages.find(
    (img) => img.id === selectedProgram?.imageId
  );

  const qrImage = PlaceHolderImages.find(
    (img) => img.id === "qr-code-placeholder"
  );
  
  const isEventUpcoming = selectedProgram ? isFuture(parseISO(selectedProgram.date)) : false;

  const getProgramStatus = (dateString: string): { text: string; variant: "default" | "outline" | "secondary" } => {
    const date = parseISO(dateString);
    if (isToday(date)) {
        return { text: 'Ongoing', variant: 'default' };
    }
    if (isFuture(date)) {
        return { text: 'Coming Soon', variant: 'secondary' };
    }
    if (isPast(date)) {
        return { text: 'Completed', variant: 'outline' };
    }
    return { text: 'Unknown', variant: 'outline' };
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
              Papan Pemuka Pelajar
            </h1>
            <p className="text-muted-foreground">
              Semak program akan datang dan sejarah penyertaan anda.
            </p>
          </div>
        </div>

        <section>
          <h2 className="text-xl font-semibold tracking-tight font-headline mb-4">
            Program Akan Datang
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => {
              const image = PlaceHolderImages.find(
                (img) => img.id === program.imageId
              );
              const status = getProgramStatus(program.date);
              return (
                <Card
                  key={program.id}
                  className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
                >
                  {image && (
                    <Image
                      src={image.imageUrl}
                      alt={image.description}
                      width={600}
                      height={400}
                      data-ai-hint={image.imageHint}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <CardHeader>
                    <CardTitle className="font-headline text-lg">
                      {program.name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 pt-1">
                      <Calendar className="h-4 w-4" />
                      <span>{program.date}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {program.description}
                    </p>
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-3 pt-4">
                     <Badge variant={status.variant}>{status.text}</Badge>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleOpenProgramModal(program)}
                    >
                      Lihat Maklumat Lanjut{" "}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight font-headline mb-4">
            Program Saya
          </h2>
           <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {myPrograms.map((program) => {
              const image = PlaceHolderImages.find(
                (img) => img.id === program.imageId
              );
              const status = getProgramStatus(program.date);
              return (
                <Card
                  key={program.id}
                  className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
                >
                  {image && (
                    <Image
                      src={image.imageUrl}
                      alt={image.description}
                      width={600}
                      height={400}
                      data-ai-hint={image.imageHint}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <CardHeader>
                    <CardTitle className="font-headline text-lg">
                      {program.name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 pt-1">
                      <Calendar className="h-4 w-4" />
                      <span>{program.date}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {program.description}
                    </p>
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-3 pt-4">
                     <Badge variant={status.variant}>{status.text}</Badge>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleOpenProgramModal(program)}
                    >
                      Lihat Maklumat Lanjut{" "}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </section>
      </div>

      <Dialog open={!!selectedProgram} onOpenChange={(isOpen) => !isOpen && handleCloseProgramModal()}>
        <DialogContent className="sm:max-w-[425px] md:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center font-headline">
              {selectedProgram?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 px-2 space-y-4">
            {selectedImage && (
              <div className="flex justify-center">
                 <Image
                    src={selectedImage.imageUrl}
                    alt={selectedImage.description}
                    width={500}
                    height={333}
                    data-ai-hint={selectedImage.imageHint}
                    className="rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={handleOpenImageModal}
                  />
              </div>
            )}
            <div className="text-left space-y-2">
                 <h3 className="font-semibold text-lg">Event Details</h3>
                 <p className="text-muted-foreground text-sm">{selectedProgram?.description}</p>
                 <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="mr-2 h-4 w-4"/>
                    <span>{selectedProgram?.date}</span>
                 </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-center">
             <Button 
                size="lg"
                disabled={isEventUpcoming}
                onClick={handleOpenQrCodeModal}
              >
                <QrCode className="mr-2 h-5 w-5" />
                Sahkan Kehadiran
              </Button>
          </DialogFooter>
           <DialogClose onClick={handleCloseProgramModal} className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
        </DialogContent>
      </Dialog>

      <Dialog open={isImageModalOpen} onOpenChange={(isOpen) => !isOpen && handleCloseImageModal()}>
        <DialogContent className="p-0 border-0 max-w-4xl bg-transparent shadow-none">
           {selectedImage && (
              <Image
                src={selectedImage.imageUrl}
                alt={selectedImage.description}
                width={1200}
                height={800}
                className="rounded-lg object-contain w-full h-full"
              />
            )}
            <DialogClose onClick={handleCloseImageModal} className="absolute -top-2 -right-2 bg-background rounded-full p-1 text-foreground opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </DialogClose>
        </DialogContent>
      </Dialog>

      <Dialog open={isQrCodeModalOpen} onOpenChange={(isOpen) => !isOpen && handleCloseQrCodeModal()}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="text-center font-headline">Kod QR Kehadiran</DialogTitle>
                <DialogDescription className="text-center">
                    Tunjukkan kod ini kepada penganjur untuk mengesahkan kehadiran anda.
                </DialogDescription>
            </DialogHeader>
            <div className="p-4 rounded-lg border bg-muted flex items-center justify-center">
              {qrImage && (
                <Image
                  src={qrImage.imageUrl}
                  alt={qrImage.description}
                  width={300}
                  height={300}
                  data-ai-hint={qrImage.imageHint}
                  className="aspect-square w-full max-w-xs rounded-lg object-cover"
                />
              )}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={handleCloseQrCodeModal} className="w-full">
                    Tutup
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
