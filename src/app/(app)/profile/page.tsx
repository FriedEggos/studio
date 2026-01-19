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
import { Badge as UiBadge } from "@/components/ui/badge";
import { participationHistory, badges } from "@/lib/data";
import { Download, Award, Shield, Code, Lightbulb, Star } from "lucide-react";

const iconMap: { [key: string]: React.ElementType } = {
  Award,
  Shield,
  Code,
  Lightbulb,
  Star,
};

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
        Profil Saya
      </h1>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card>
            <CardHeader className="items-center text-center">
              <Avatar className="w-24 h-24 mb-4">
                <AvatarImage src="https://picsum.photos/seed/user1/200/200" />
                <AvatarFallback>S</AvatarFallback>
              </Avatar>
              <CardTitle className="font-headline">Pelajar JTMK</CardTitle>
              <CardDescription>student@example.com</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Kemaskini Profil</Button>
            </CardContent>
          </Card>
        </div>
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Lencana Saya</CardTitle>
              <CardDescription>
                Kumpul lencana dengan menyertai program dan aktiviti anjuran
                JTMK.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {badges.map((badge) => {
                const Icon = iconMap[badge.icon] || Award;
                return (
                  <div
                    key={badge.name}
                    className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50"
                  >
                    <Icon className="w-10 h-10 text-primary mb-2" />
                    <p className="font-semibold text-sm">{badge.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {badge.description}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Sejarah Penyertaan</CardTitle>
          <CardDescription>
            Rekod program dan aktiviti yang telah anda sertai.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program/Aktiviti</TableHead>
                <TableHead>Tarikh</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">E-Sijil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participationHistory.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    {item.programName}
                  </TableCell>
                  <TableCell>{item.date}</TableCell>
                  <TableCell>
                    <UiBadge
                      variant={
                        item.status === "Disahkan" ? "default" : "secondary"
                      }
                      className={
                        item.status === "Disahkan"
                          ? "bg-green-600 text-white"
                          : ""
                      }
                    >
                      {item.status}
                    </UiBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.certificateUrl ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={item.certificateUrl} download>
                          <Download className="mr-2 h-4 w-4" />
                          Muat Turun
                        </a>
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
