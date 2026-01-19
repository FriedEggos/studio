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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Download } from "lucide-react";

export default function CreateProgramPage() {
  const qrImage = PlaceHolderImages.find(
    (img) => img.id === "qr-code-placeholder"
  );

  return (
    <div className="grid flex-1 items-start gap-4 md:gap-8 md:grid-cols-3">
      <div className="grid auto-rows-max items-start gap-4 md:gap-8 md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Butiran Program</CardTitle>
            <CardDescription>
              Isikan maklumat di bawah untuk program atau aktiviti baharu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <div className="grid gap-3">
                <Label htmlFor="name">Nama Program</Label>
                <Input
                  id="name"
                  type="text"
                  className="w-full"
                  placeholder="Cth: Bengkel Reka Bentuk UI/UX"
                />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="description">Penerangan</Label>
                <Textarea
                  id="description"
                  placeholder="Terangkan secara ringkas mengenai program ini."
                  className="min-h-32"
                />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="date">Tarikh Program</Label>
                <Input id="date" type="date" className="w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline">Batal</Button>
          <Button>Simpan & Jana QR</Button>
        </div>
      </div>
      <div className="grid auto-rows-max items-start gap-4 md:gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Kod QR Program</CardTitle>
            <CardDescription>
              Kod QR ini akan dijana secara automatik selepas program disimpan.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-4">
            {qrImage && (
              <Image
                src={qrImage.imageUrl}
                alt={qrImage.description}
                width={300}
                height={300}
                data-ai-hint={qrImage.imageHint}
                className="aspect-square w-full max-w-[200px] rounded-lg object-cover"
              />
            )}
            <Button variant="outline" className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Muat Turun QR
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
