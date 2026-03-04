"use client";

import * as React from "react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DateDropdownPickerProps {
  value?: Date;
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
  // Use passed value or a new Date as a fallback. If no value, we still need a valid date for calculations.
  const date = value ? new Date(value) : new Date();

  const handlePartChange = (part: "year" | "month" | "day", valueStr: string) => {
    const newDate = new Date(date);
    const numValue = parseInt(valueStr, 10);

    if (part === "year") {
      newDate.setFullYear(numValue);
    } else if (part === "month") {
      // When changing month, check if the current day is valid for the new month
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
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      <Select
        onValueChange={(val) => handlePartChange("day", val)}
        value={date.getDate().toString()}
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
        value={date.getMonth().toString()}
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
        value={date.getFullYear().toString()}
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
