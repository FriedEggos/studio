
'use client';

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
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, CheckCircle, Clock, Users, List, Eye, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { pendingVerifications, allProgramsAdmin as initialAllProgramsAdmin } from "@/lib/data";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ProgramStatus = "Upcoming" | "Ongoing" | "Completed";

type Program = {
    id: string;
    name: string;
    participants: number;
    status: ProgramStatus;
};


export default function AdminDashboard() {
  const [allProgramsAdmin, setAllProgramsAdmin] = useState<Program[]>(
    initialAllProgramsAdmin.map(p => ({...p, status: p.status as ProgramStatus}))
  );

  const handleStatusChange = (programId: string, newStatus: ProgramStatus) => {
      setAllProgramsAdmin(currentPrograms => 
          currentPrograms.map(p => 
              p.id === programId ? { ...p, status: newStatus } : p
          )
      );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
          Admin Dashboard
        </h1>
        <Button asChild>
          <Link href="/admin/programs/create">Create New Program</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Programs</CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">+2 since last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Participants
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+2,350</div>
            <p className="text-xs text-muted-foreground">
              +180.1% since last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Verifications
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              Needs immediate review
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Certificates Generated
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+573</div>
            <p className="text-xs text-muted-foreground">
              +201 since last week
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="font-headline">Pending Verifications</CardTitle>
            <CardDescription>
              Verify the proof of participation uploaded by students.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Submission Date</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingVerifications.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.studentName}
                    </TableCell>
                    <TableCell>{item.programName}</TableCell>
                    <TableCell>{item.submissionDate}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">
                        <Eye className="mr-2 h-4 w-4" /> Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="col-span-4 lg:col-span-3">
          <CardHeader>
            <CardTitle className="font-headline">Program List</CardTitle>
            <CardDescription>
              Summary of all past and future programs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allProgramsAdmin.map((program) => (
                <div key={program.id} className="flex items-center">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {program.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {program.participants} participants
                    </p>
                  </div>
                  <div className="ml-auto font-medium flex items-center gap-2">
                    <Badge
                      variant={
                        program.status === "Completed"
                          ? "default"
                          : program.status === "Ongoing"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {program.status}
                    </Badge>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleStatusChange(program.id, 'Upcoming')}>Upcoming</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(program.id, 'Ongoing')}>Ongoing</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(program.id, 'Completed')}>Completed</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
