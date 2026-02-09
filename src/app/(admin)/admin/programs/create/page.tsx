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
            <CardTitle className="font-headline">Program Details</CardTitle>
            <CardDescription>
              Fill in the information below for a new program or activity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <div className="grid gap-3">
                <Label htmlFor="name">Program Name</Label>
                <Input
                  id="name"
                  type="text"
                  className="w-full"
                  placeholder="e.g., UI/UX Design Workshop"
                />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Briefly describe this program."
                  className="min-h-32"
                />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="date">Program Date</Label>
                <Input id="date" type="date" className="w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline">Cancel</Button>
          <Button>Save & Generate QR</Button>
        </div>
      </div>
      <div className="grid auto-rows-max items-start gap-4 md:gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Program QR Code</CardTitle>
            <CardDescription>
              This QR code will be generated automatically after the program is saved.
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
              Download QR
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
