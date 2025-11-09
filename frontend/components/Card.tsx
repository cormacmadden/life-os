// src/components/Card.tsx
import React from 'react';
import { LucideIcon } from 'lucide-react';
import { THEME } from '@/lib/theme'; // uses the new file!

interface CardProps { children: React.ReactNode; className?: string; }

export const Card = ({ children, className = "" }: CardProps) => (
  <div className={`${THEME.bgDarker} rounded-lg overflow-hidden ${className}`}>
    {children}
  </div>
);

interface CardHeaderProps { title: string; icon?: LucideIcon; rightElement?: React.ReactNode; }

export const CardHeader = ({ title, icon: Icon, rightElement }: CardHeaderProps) => (
  <div className={`px-4 py-3 flex items-center justify-between`}>
    <div className={`flex items-center space-x-2 ${THEME.main} font-medium`}>
      {Icon && <Icon size={18} />}
      <span>{title}</span>
    </div>
    {rightElement}
  </div>
);

export const CardContent = ({ children, className = "" }: CardProps) => (
  <div className={`p-4 pt-0 ${className}`}>
    {children}
  </div>
);