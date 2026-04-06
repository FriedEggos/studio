"use client";

import * as React from "react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DateDropdownPickerProps {
  value?: Date | null;
  onChange: (date?: Date) => void;
  fromYear?: number;
  toYear?: number;
  className?: string;
}

export function DateDropdownPicker({
  value,
  onChange,
  fromYear,
  toYear,
  className,
}: DateDropdownPickerProps) {
  // If value is null/undefined, use a placeholder state. Otherwise, create a Date object.
  const date = value ? new Date(value) : null;

  const handlePartChange = (part: "year" | "month" | "day", valueStr: string) => {
    // Start with the current date if it exists, otherwise start with today.
    const newDate = date ? new Date(date) : new Date();
    // If we're starting fresh, reset day to 1 to avoid month-end issues.
    if (!date) {
        newDate.setDate(1);
    }
    const numValue = parseInt(valueStr, 10);

    if (part === "year") {
      newDate.setFullYear(numValue);
    } else if (part === "month") {
      const currentDay = newDate.getDate();
      const daysInNewMonth = new Date(newDate.getFullYear(), numValue + 1, 0).getDate();
      if (currentDay > daysInNewMonth) {
        newDate.setDate(daysInNewMonth);
      }
      newDate.setMonth(numValue);
    } else if (part === "day") {
      newDate.setDate(numValue);
    }
    
    onChange(newDate);
  };

  const finalFromYear = fromYear || new Date().getFullYear() - 10;
  const finalToYear = toYear || new Date().getFullYear() + 10;

  const years = Array.from(
    { length: finalToYear - finalFromYear + 1 },
    (_, i) => finalFromYear + i
  );
  const months = Array.from({ length: 12 }, (_, i) => i);
  // If we have a date, calculate days in month. Otherwise, default to 31.
  const daysInMonth = date ? new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      <Select
        onValueChange={(val) => handlePartChange("day", val)}
        value={date ? date.getDate().toString() : ""}
      >
        <SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger>
        <SelectContent>
          {days.map((d) => (
            <SelectItem key={d} value={d.toString()}>{d}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        onValueChange={(val) => handlePartChange("month", val)}
        value={date ? date.getMonth().toString() : ""}
      >
        <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m} value={m.toString()}>
              {format(new Date(0, m), "MMMM")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        onValueChange={(val) => handlePartChange("year", val)}
        value={date ? date.getFullYear().toString() : ""}
      >
        <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
