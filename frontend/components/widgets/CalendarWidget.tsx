import React from 'react';
import { Calendar, Briefcase } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../Card';
import { THEME } from '@/lib/theme';
import { CalendarEvent } from '@/lib/types';

interface CalendarWidgetProps {
  calendar: CalendarEvent[];
  isAuthenticated: boolean;
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({
  calendar,
  isAuthenticated,
}) => {
  // Group events by date
  const eventsByDate = calendar.reduce((acc, event) => {
    const date = event.date || new Date().toISOString().split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  // Get next 7 days starting from today (matching backend data)
  const today = new Date();
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    return date;
  });

  // Office days are Tuesday (2) and Thursday (4)
  const isOfficeDay = (date: Date) => {
    const day = date.getDay();
    return day === 2 || day === 4;
  };

  // Get current month name for header
  const currentMonth = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <Card>
      <CardHeader
        title="week overview"
        icon={Calendar}
        rightElement={
          <div className="flex items-center space-x-3">
            <span className={`text-sm ${THEME.text} font-medium`}>{currentMonth}</span>
            {!isAuthenticated && <span className={`text-xs ${THEME.sub}`}>[mock data]</span>}
          </div>
        }
      />
      <CardContent className="p-4">
        {/* Horizontal day cards with event previews */}
        <div className="flex gap-3">
          {next7Days.map((date, dayIndex) => {
            const dateStr = date.toISOString().split('T')[0];
            const todayStr = new Date().toISOString().split('T')[0];
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNumber = date.getDate();
            const eventsForDay = eventsByDate[dateStr] || [];
            const isOffice = isOfficeDay(date);
            const isToday = dateStr === todayStr;

            return (
              <div
                key={dateStr}
                className={`flex-1 p-3 rounded ${THEME.bg} border ${
                  isToday ? 'border-[#00ff9f]' : 'border-[#323437]'
                } hover:border-[#00ff9f]/50 transition-colors min-h-[180px] flex flex-col`}
              >
                {/* Day header */}
                <div className="text-center mb-3 border-b border-[#323437] pb-2">
                  <div className={`flex items-center justify-center space-x-2`}>
                    <span className={`text-lg font-medium ${isToday ? THEME.main : THEME.sub}`}>
                      {dayName.toUpperCase()}
                    </span>
                    <span className={`text-lg font-bold ${isToday ? THEME.main : THEME.text}`}>
                      {dayNumber}
                    </span>
                  </div>
                </div>

                {/* Office indicator */}
                {isOffice && (
                  <div className={`flex items-center justify-center space-x-1 mb-2 p-1.5 rounded ${THEME.mainBg}`}>
                    <Briefcase size={10} className={THEME.main} />
                    <span className={`text-xs ${THEME.main} font-medium`}>in office</span>
                  </div>
                )}

                {/* Events list */}
                <div className="flex-1 space-y-1.5 overflow-y-auto">
                  {eventsForDay.length > 0 ? (
                    eventsForDay.slice(0, 3).map((event, i) => (
                      <div
                        key={i}
                        className={`text-xs p-1.5 rounded ${
                          event.type === 'work' ? 'bg-[#00ff9f]/10' : 'bg-[#323437]'
                        }`}
                      >
                        <div className={`${THEME.text} truncate font-medium`}>
                          {event.title.toLowerCase()}
                        </div>
                        <div className={`${THEME.sub} text-xs`}>{event.time}</div>
                      </div>
                    ))
                  ) : (
                    <div className={`text-xs ${THEME.sub} text-center opacity-50 mt-4`}>
                      No events
                    </div>
                  )}
                  {eventsForDay.length > 3 && (
                    <div className={`text-xs ${THEME.sub} text-center pt-1`}>
                      +{eventsForDay.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
