// src/lib/types.ts
export interface BusArrival {
  route: string;
  destination: string;
  due: string;
  status: string;
}

// frontend/src/lib/types.ts
export interface Plant {
  id: number;
  name: string;
  species: string;
  image_url?: string;
  last_watered: string; // ISO date string
  watering_frequency_days: number;
}

export interface BusData {
  workbound: BusArrival[];
  homebound: BusArrival[];
}

export interface CalendarEvent {
  id: string | number;
  title: string;
  time: string;
  type: 'work' | 'personal';
}

export interface Email {
  id: string | number;
  from: string;
  subject: string;
  time: string;
  important: boolean;
}

export interface GoogleData {
  authenticated: boolean;
  emails?: Email[];
  calendar?: CalendarEvent[];
  auth_url?: string;
}

export interface FinanceEntry {
  name: string;
  spend: number;
}

export interface HomeState {
  livingRoomLights: boolean;
  kitchenLights: boolean;
  porchLights: boolean;
  frontDoorLocked: boolean;
  garageDoorLocked: boolean;
  temperature: number;
  motionDetected: boolean;
}

export interface SpotifyState {
  playing: boolean;
  track: string;
  artist: string;
  progress: number;
}

export interface IdentityState {
  name: string;
  occupation: string;
  homeLocation: string;
  workLocation: string;
  preferences: string;
  relevantRoutes: string[];
  [key: string]: string | string[];
}

export interface ChatMessage {
  role: 'assistant' | 'user' | 'system';
  content: string;
}

// ... copy ALL other interfaces here ...