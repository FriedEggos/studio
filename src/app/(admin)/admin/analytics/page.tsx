import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
        Program Analytics
      </h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline">
            <BarChart className="h-6 w-6" />
            Looker Studio Dashboard
          </CardTitle>
          <CardDescription>
            The real-time analytics dashboard from Looker Studio will be displayed here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
            <div className="text-center text-muted-foreground">
              <p className="font-semibold">Looker Studio Dashboard</p>
              <p className="text-sm">Embedded dashboard would appear here.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
