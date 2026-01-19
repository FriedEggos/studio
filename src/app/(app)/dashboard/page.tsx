import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QrCode, ArrowRight, Calendar } from "lucide-react";
import { programs } from "@/lib/data";
import { PlaceHolderImages } from "@/lib/placeholder-images";

export default function StudentDashboard() {
  return (
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
        <Button size="lg" className="w-full md:w-auto">
          <QrCode className="mr-2 h-5 w-5" />
          Imbas QR Program
        </Button>
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
            return (
              <Card
                key={program.id}
                className="overflow-hidden hover:shadow-lg transition-shadow"
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
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {program.description}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" asChild className="w-full">
                    <Link href="#">
                      Lihat Maklumat Lanjut{" "}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
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
        <Card>
          <CardContent className="p-0">
             <div className="p-6 text-center text-muted-foreground">
                Anda belum mendaftar untuk sebarang program lagi.
             </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
