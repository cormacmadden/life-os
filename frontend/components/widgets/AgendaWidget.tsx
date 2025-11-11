import React from 'react';
import { Calendar } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../Card';
import { THEME } from '@/lib/theme';
import { CalendarEvent } from '@/lib/types';

interface AgendaWidgetProps {
  calendar: CalendarEvent[];
  isAuthenticated: boolean;
}

export const AgendaWidget: React.FC<AgendaWidgetProps> = ({
  calendar,
  isAuthenticated,
}) => {
  // Filter to show only today's events
  const today = new Date().toISOString().split('T')[0];
  const todayEvents = calendar.filter(event => event.date === today);

  return (
    <Card>
      <CardHeader
        title="today's agenda"
        icon={Calendar}
        rightElement={
          !isAuthenticated && <span className={`text-xs ${THEME.sub}`}>[mock data]</span>
        }
      />
      <CardContent className="p-0">
        <div className={`divide-y divide-[#323437]`}>
          {todayEvents.length > 0 ? (
            todayEvents.map((event, i) => (
              <div
                key={i}
                className={`flex items-start space-x-4 p-4 hover:${THEME.bg} transition-colors`}
              >
                <div
                  className={`w-1 h-full min-h-[2rem] ${
                    event.type === 'work' ? THEME.mainBg : THEME.subBg
                  }`}
                ></div>
                <div className="min-w-0 flex-1">
                  <h4 className={`${THEME.text} text-sm leading-tight truncate`}>
                    {event.title.toLowerCase()}
                  </h4>
                  <p className={`${THEME.sub} text-xs mt-2`}>{event.time}</p>
                </div>
              </div>
            ))
          ) : (
            <div className={`p-4 ${THEME.sub} text-sm text-center`}>
              No events today
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
