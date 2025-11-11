import React from 'react';
import { Mail, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../Card';
import { THEME } from '@/lib/theme';
import { Email } from '@/lib/types';

interface EmailWidgetProps {
  emails: Email[];
  isAuthenticated: boolean;
}

export const EmailWidget: React.FC<EmailWidgetProps> = ({ emails, isAuthenticated }) => {
  return (
    <Card>
      <CardHeader
        title="mail"
        icon={Mail}
        rightElement={
          !isAuthenticated ? (
            <span className={`text-xs ${THEME.sub}`}>[mock data]</span>
          ) : (
            <span className={`${THEME.mainBg} text-xs px-2 py-1 rounded`} style={{ color: '#2c2e31' }}>
              {emails.length} recent
            </span>
          )
        }
      />
      <CardContent className="p-0">
        <div className={`divide-y divide-[#323437]`}>
          {emails.map((email, i) => (
            <div
              key={i}
              className={`p-4 flex justify-between items-start hover:${THEME.bg} cursor-pointer`}
            >
              <div className="truncate pr-4">
                <div className="flex items-center space-x-2">
                  {email.important && <AlertCircle size={14} className={THEME.error} />}
                  <p className={`${THEME.text} text-sm truncate`}>{email.from.toLowerCase()}</p>
                </div>
                <p className={`${THEME.sub} text-xs mt-1 truncate`}>
                  {email.subject.toLowerCase()}
                </p>
              </div>
              <span className={`${THEME.sub} text-xs whitespace-nowrap`}>{email.time}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
