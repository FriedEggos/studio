'use client';

import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useMemo } from 'react';

interface MinimalCalendarProps {
  year: number;
  month: number; // 0-11
  selectedDay?: number;
  secondaryDay?: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function MinimalCalendar({ year, month, selectedDay, secondaryDay }: MinimalCalendarProps) {
  const calendarGrid = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = firstDayOfMonth.getDay(); // 0=Sun, 1=Mon, ...

    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const grid = [];

    // Add days from previous month
    for (let i = 0; i < firstDayOfWeek; i++) {
      grid.push({
        day: daysInPrevMonth - firstDayOfWeek + i + 1,
        isCurrentMonth: false,
      });
    }

    // Add days of the current month
    for (let i = 1; i <= daysInMonth; i++) {
      grid.push({
        day: i,
        isCurrentMonth: true,
      });
    }

    // Add days from next month to fill the grid
    const remainingCells = 42 - grid.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingCells; i++) {
      grid.push({
        day: i,
        isCurrentMonth: false,
      });
    }

    return grid;
  }, [year, month]);

  return (
    <div className="bg-card text-card-foreground p-4 rounded-lg shadow-md w-full max-w-xs mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">{MONTH_NAMES[month]}, {year}</h2>
        <ChevronDown className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAY_NAMES.map(day => (
          <div key={day} className="py-2">{day}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 text-center">
        {calendarGrid.map((item, index) => (
          <div key={index} className="py-2 flex justify-center items-center">
            <span
              className={cn(
                'h-8 w-8 flex items-center justify-center rounded-full text-sm',
                !item.isCurrentMonth && 'text-muted-foreground/50',
                item.isCurrentMonth && 'text-foreground',
                item.isCurrentMonth && item.day === selectedDay && 'bg-primary text-primary-foreground font-bold',
                item.isCurrentMonth && item.day === secondaryDay && 'border-2 border-primary'
              )}
            >
              {item.day}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom Indicator */}
      <div className="flex justify-center mt-4">
        <div className="w-32 h-1 bg-muted rounded-full"></div>
      </div>
    </div>
  );
}
