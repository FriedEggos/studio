'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MonthCalendarMobileProps {
  year: number;
  month: number; // 0-11
  selectedDay?: number;
  events?: Record<number, number>; // day -> number of event dots (1-3)
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function MonthCalendarMobile({ year, month, selectedDay, events = {} }: MonthCalendarMobileProps) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // 0=Mon, 1=Tue, ...

  const prevMonthName = MONTH_NAMES[(month - 1 + 12) % 12].substring(0, 3);
  const currentMonthName = MONTH_NAMES[month];
  const nextMonthName = MONTH_NAMES[(month + 1) % 12].substring(0, 3);

  const blanks = Array(firstDayIndex).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const renderEventDots = (day: number) => {
    const eventCount = events[day] || 0;
    if (eventCount === 0) {
      return <div className="h-1.5"></div>; // Placeholder for alignment
    }
    const dots = Math.min(eventCount, 3); // Max 3 dots
    return (
      <div className="flex justify-center items-center gap-0.5 mt-1 h-1.5">
        {Array(dots).fill(null).map((_, i) => (
          <div key={i} className="h-1.5 w-1.5 rounded-full bg-violet-500"></div>
        ))}
      </div>
    );
  };

  return (
    <Card className="w-full max-w-sm mx-auto shadow-lg rounded-xl overflow-hidden bg-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-card-foreground">Calendar</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {/* Month Navigation */}
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-medium text-muted-foreground">{prevMonthName}</span>
          <span className="text-xl font-bold text-primary">{currentMonthName} {year}</span>
          <span className="text-lg font-medium text-muted-foreground">{nextMonthName}</span>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium text-muted-foreground mb-2">
          {WEEKDAY_NAMES.map(day => <div key={day}>{day}</div>)}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-2 text-center">
          {blanks.map((_, i) => <div key={`blank-${i}`}></div>)}
          {days.map(day => (
            <div key={day} className="flex flex-col items-center">
              <button
                className={cn(
                  'h-9 w-9 flex items-center justify-center rounded-full text-foreground transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  day === selectedDay && 'bg-primary text-primary-foreground font-bold shadow-sm hover:bg-primary/90'
                )}
              >
                {day}
              </button>
              {renderEventDots(day)}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
