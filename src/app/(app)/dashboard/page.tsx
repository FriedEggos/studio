"use client"; // Required for handling button clicks

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
  
  // --- GOOGLE SHEETS LOGIC ---
  const handleRegister = async (programName: string) => {
    // 1. Paste your 'clasp deploy' URL here
   const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyHguc7-YLslhq647gBXXkiuoQlQN7ipHRgGGCgPNwJUHZKUGr6y2LgqFZoaVx5qouZ/exec";
    const formData = new URLSearchParams();
    // Ensure these keys (Name, Program) match your Google Sheet header text
    formData.append("Name", "Student User"); 
    formData.append("Program", programName);
    formData.append("Date", new Date().toLocaleDateString());

    try {
      // 'no-cors' allows the request to fire even if Google doesn't send back a standard header
      await fetch(SCRIPT_URL, {
        method: "POST",
        body: formData,
        mode: "no-cors",
      });
      alert(`Successfully registered for: ${programName}`);
    } catch (error) {
      console.error("Registration error:", error);
      alert("Registration failed. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">
            Student Dashboard
          </h1>
          <p className="text-muted-foreground">
            Check upcoming programs and your participation history.
          </p>
        </div>
        <Button size="lg" className="w-full md:w-auto">
          <QrCode className="mr-2 h-5 w-5" />
          Scan Program QR
        </Button>
      </div>

      <section>
        <h2 className="text-xl font-semibold tracking-tight font-headline mb-4">
          Upcoming Programs
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