"use client";

import React, { useState, useEffect, useRef, FormEvent } from 'react';
import dynamic from 'next/dynamic';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts';
import {
  Home,
  Bus,
  Lightbulb,
  Thermometer,
  Lock,
  Unlock,
  Music,
  Mail,
  Calendar,
  CreditCard,
  User,
  Settings,
  Send,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Terminal,
  LucideIcon,
  Link2,
  Unlink2,
  Activity
} from 'lucide-react';

import { THEME } from '@/lib/theme';
import { BusData, HomeState, Plant, CalendarEvent, Email, GoogleData, FinanceEntry, SpotifyState, ChatMessage, IdentityState} from '@/lib/types';
import { Card, CardHeader, CardContent } from '@/components/Card';

// Loading component for lazy-loaded widgets
const WidgetLoading = ({ title, icon: Icon }: { title: string; icon: LucideIcon }) => (
  <Card>
    <CardHeader title={title} icon={Icon} />
    <CardContent>
      <div className={`p-4 ${THEME.bg} rounded text-center min-h-[150px] flex items-center justify-center`}>
        <p className={`${THEME.sub} text-sm`}>loading...</p>
      </div>
    </CardContent>
  </Card>
);

// Lazy load widgets for better initial load performance
const PlantWidget = dynamic(() => import('@/components/widgets/PlantWidget').then(mod => ({ default: mod.PlantWidget })), {
  loading: () => <WidgetLoading title="plants" icon={Home} />,
  ssr: false
});

const BusWidget = dynamic(() => import('@/components/widgets/BusWidget').then(mod => ({ default: mod.BusWidget })), {
  loading: () => <WidgetLoading title="bus" icon={Bus} />,
  ssr: false
});

const SpotifyWidget = dynamic(() => import('@/components/widgets/SpotifyWidget').then(mod => ({ default: mod.SpotifyWidget })), {
  loading: () => <WidgetLoading title="spotify" icon={Music} />,
  ssr: false
});

const SmartHomeWidget = dynamic(() => import('@/components/widgets/SmartHomeWidget').then(mod => ({ default: mod.SmartHomeWidget })), {
  loading: () => <WidgetLoading title="smart home" icon={Home} />,
  ssr: false
});

const CalendarWidget = dynamic(() => import('@/components/widgets/CalendarWidget').then(mod => ({ default: mod.CalendarWidget })), {
  loading: () => <WidgetLoading title="calendar" icon={Calendar} />,
  ssr: false
});

const AgendaWidget = dynamic(() => import('@/components/widgets/AgendaWidget').then(mod => ({ default: mod.AgendaWidget })), {
  loading: () => <WidgetLoading title="agenda" icon={Calendar} />,
  ssr: false
});

const FinanceWidget = dynamic(() => import('@/components/widgets/FinanceWidget').then(mod => ({ default: mod.FinanceWidget })), {
  loading: () => <WidgetLoading title="finance" icon={CreditCard} />,
  ssr: false
});

const EmailWidget = dynamic(() => import('@/components/widgets/EmailWidget').then(mod => ({ default: mod.EmailWidget })), {
  loading: () => <WidgetLoading title="email" icon={Mail} />,
  ssr: false
});

const GarminWidget = dynamic(() => import('@/components/widgets/GarminWidget').then(mod => ({ default: mod.GarminWidget })), {
  loading: () => <WidgetLoading title="garmin" icon={Activity} />,
  ssr: false
});

const CarWidget = dynamic(() => import('@/components/widgets/CarWidget').then(mod => ({ default: mod.CarWidget })), {
  loading: () => <WidgetLoading title="car" icon={Home} />,
  ssr: false
});

const WeatherWidget = dynamic(() => import('@/components/widgets/WeatherWidget').then(mod => ({ default: mod.WeatherWidget })), {
  loading: () => <WidgetLoading title="weather" icon={Thermometer} />,
  ssr: false
});

const BusMapWidget = dynamic(() => import('@/components/widgets/BusMapWidget').then(mod => ({ default: mod.BusMapWidget })), {
  loading: () => <WidgetLoading title="bus map" icon={Bus} />,
  ssr: false
});

// --- Types & Interfaces ---
type TabId = 'dashboard' | 'ai' | 'settings';

// --- Mock Data ---
const MOCK_BUS_DATA: BusData = {
  workbound: [
    { route: '10', destination: 'City Centre', due: '2 mins', status: 'On time' },
    { route: '11', destination: 'Leamington Spa', due: '15 mins', status: 'Late' },
    { route: 'U1', destination: 'University', due: '22 mins', status: 'On time' },
  ],
  homebound: [
    { route: 'U2', destination: 'Home Estate', due: '5 mins', status: 'On time' },
    { route: '11', destination: 'Home Estate', due: '25 mins', status: 'Cancelled' },
  ]
};

const MOCK_CALENDAR: CalendarEvent[] = [
  { id: 1, title: 'Team Standup', time: '09:00', type: 'work' },
  { id: 2, title: 'Project Review', time: '11:00', type: 'work' },
  { id: 3, title: 'Dentist', time: '15:30', type: 'personal' },
];

const MOCK_EMAILS: Email[] = [
  { id: 1, from: 'Amazon', subject: 'Your order has been delivered', time: 'recent', important: false },
  { id: 2, from: 'Boss', subject: 'URGENT: Q3 Report needed', time: 'recent', important: true },
];

const MOCK_FINANCE_DATA: FinanceEntry[] = [
  { name: 'Mon', spend: 12.50 },
  { name: 'Tue', spend: 45.00 },
  { name: 'Wed', spend: 5.99 },
  { name: 'Thu', spend: 65.20 },
  { name: 'Fri', spend: 120.50 },
  { name: 'Sat', spend: 85.00 },
  { name: 'Sun', spend: 30.00 },
];

// --- Main App ---

export default function App() {
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Widget visibility settings - always initialize with defaults to avoid hydration mismatch
  const [widgetVisibility, setWidgetVisibility] = useState({
    bus: true,
    busMap: true,
    spotify: true,
    garmin: true,
    calendar: true,
    smarthome: true,
    plants: true,
    car: true,
    finance: true,
    email: true,
    weather: true,
  });

  // Load from localStorage after mount (client-side only)
  useEffect(() => {
    const saved = localStorage.getItem('widgetVisibility');
    if (saved) {
      setWidgetVisibility(JSON.parse(saved));
    }
  }, []);

  // Save widget visibility to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('widgetVisibility', JSON.stringify(widgetVisibility));
    }
  }, [widgetVisibility]);

  // API URL with fallback to Cloudflare
  const LOCAL_API = "http://192.168.4.28:8000";
  const REMOTE_API = process.env.NEXT_PUBLIC_CLOUDFLARE_URL || "https://life-os-dashboard.com";
  const [API_BASE_URL, setApiBaseUrl] = useState<string>(LOCAL_API);

  // DATA STATES
  const [busData, setBusData] = useState<BusData>(MOCK_BUS_DATA);
  const [isBusLoading, setIsBusLoading] = useState<boolean>(false);
  const [activeBusTab, setActiveBusTab] = useState<'workbound' | 'homebound'>('workbound');
  const [lastBusRefresh, setLastBusRefresh] = useState<Date | null>(null);
  const busMapRef = useRef<{ refresh: () => void; showRoute: (routeName: string) => void; showBusLocation: (routeName: string, destination?: string) => void }>(null);
  const [googleData, setGoogleData] = useState<GoogleData>({ authenticated: false });
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [spotifyAuthenticated, setSpotifyAuthenticated] = useState<boolean>(false);
  const [monzoAuthenticated, setMonzoAuthenticated] = useState<boolean>(false);

  // SMART HOME STATE
  const [homeState, setHomeState] = useState<HomeState>({
    livingRoomLights: true, kitchenLights: false, porchLights: false, frontDoorLocked: true, garageDoorLocked: true, temperature: 21.5, motionDetected: false,
  });

  const [spotifyState, setSpotifyState] = useState<SpotifyState>({
    playing: true, track: "cruel summer", artist: "taylor swift", progress: 35,
  });
  const [identity, setIdentity] = useState<IdentityState>({
    name: "alex", occupation: "software engineer", homeLocation: "coventry", workLocation: "birmingham", preferences: "likes concise answers. interested in tech, hiking, and cooking.", relevantRoutes: ["U1", "U2", "11"]
  });
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'assistant', content: `hello ${identity.name}. i'm ready to help.` }
  ]);
  const [chatInput, setChatInput] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [saveButtonState, setSaveButtonState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [geocodeStatus, setGeocodeStatus] = useState<{
    home: { lat: number | null; lng: number | null } | null;
    work: { lat: number | null; lng: number | null } | null;
  }>({ home: null, work: null });
  const [configLoading, setConfigLoading] = useState<boolean>(true);

  // --- EFFECTS & FETCHING ---

  useEffect(() => {
    setIsClient(true);
    
    // Set local API immediately and check in background
    console.log('🔍 Trying local API first:', LOCAL_API);
    setApiBaseUrl(LOCAL_API);
    
    // Quick background check - if local fails, switch to remote
    const verifyApiUrl = async () => {
      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 200); // 10 seconds
        
        console.log('⏱️ Starting API health check...');
        const response = await fetch(`${LOCAL_API}/health`, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
        });
        
        clearTimeout(timeoutId);
        const elapsed = Date.now() - startTime;
        
        if (response.ok) {
          console.log(`✅ Local API confirmed working (${elapsed}ms)`);
        } else {
          console.log(`⚠️ Local API returned ${response.status}, switching to remote`);
          setApiBaseUrl(REMOTE_API);
        }
      } catch (error) {
        const elapsed = Date.now() - startTime;
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`🌐 Local API failed after ${elapsed}ms:`, errorMsg);
        console.log('Switching to remote:', REMOTE_API);
        setApiBaseUrl(REMOTE_API);
      }
    };
    
    verifyApiUrl();
  }, []);

  // Fetch integration statuses once API URL is detected
  useEffect(() => {
    if (API_BASE_URL && isClient) {
      console.log("Fetching integration statuses with API_BASE_URL:", API_BASE_URL);
      fetchGoogleData();
      fetchSpotifyStatus();
      fetchMonzoStatus();
    }
  }, [API_BASE_URL, isClient]);

  const fetchBusData = (forceRefresh = false) => {
    if (!isClient) return;
    setIsBusLoading(true);
    
    fetch(`${API_BASE_URL}/api/bus${forceRefresh ? '?force=true' : ''}`)
      .then(res => res.json())
      .then(data => { 
        setBusData(data); 
        setIsBusLoading(false); 
        setLastBusRefresh(new Date());
        // Also refresh the bus map
        if (busMapRef.current) {
          busMapRef.current.refresh();
        }
      })
      .catch(e => { 
        console.error(e); 
        setIsBusLoading(false); 
      });
  };

  const fetchGoogleData = () => {
    fetch(`${API_BASE_URL}/api/google/data`)
      .then(res => res.json())
      .then(data => setGoogleData(data))
      .catch(e => console.error("Google fetch failed:", e));
  };

  const fetchSpotifyStatus = () => {
    fetch(`${API_BASE_URL}/api/spotify/status`)
      .then(res => res.json())
      .then(data => {
        console.log("Spotify status:", data);
        setSpotifyAuthenticated(data.authenticated || false);
      })
      .catch(e => {
        console.error("Spotify status fetch failed:", e);
        setSpotifyAuthenticated(false);
      });
  };

  const fetchMonzoStatus = () => {
    fetch(`${API_BASE_URL}/api/monzo/status`)
      .then(res => res.json())
      .then(data => {
        console.log("Monzo status:", data);
        setMonzoAuthenticated(data.connected || false);
      })
      .catch(e => {
        console.error("Monzo status fetch failed:", e);
        setMonzoAuthenticated(false);
      });
  };

  const handleGoogleLogin = () => {
    fetch(`${API_BASE_URL}/api/google/login`)
        .then(res => res.json())
        .then(data => { if (data.auth_url) window.location.href = data.auth_url; });
    alert("Uncomment handleGoogleLogin locally to test!");
  };

  const handleSpotifyLogin = () => {
    fetch(`${API_BASE_URL}/api/spotify/auth`)
      .then(res => res.json())
      .then(data => { 
        if (data.auth_url) {
          window.location.href = data.auth_url;
        }
      })
      .catch(e => console.error("Spotify auth failed:", e));
  };

  const handleMonzoLogin = () => {
    // Monzo endpoint redirects directly
    window.location.href = `${API_BASE_URL}/api/monzo/auth`;
  };

  // --- SMART HOME HANDLER ---
  const handleSmartHomeToggle = (device: keyof HomeState, currentState: boolean) => {
      console.log(`FRONTEND DEBUG: Toggling ${device}...`); // <-- DEBUG LOG ADDED
      // 1. OPTIMISTIC UPDATE (Make it feel instant)
      setHomeState(prev => ({ ...prev, [device]: !currentState }));

      // 2. SEND TO BACKEND (NOW LIVE!)
      // Only run this if we are in the browser
      if (typeof window !== 'undefined') {
          fetch(`${API_BASE_URL}/api/smarthome/toggle`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ device_id: device, target_state: !currentState })
          }).then(res => {
              if (!res.ok) throw new Error(`Backend responded with ${res.status}`);
              console.log("FRONTEND DEBUG: Backend confirmed toggle.");
          }).catch(err => {
              console.error("FRONTEND ERROR: Smart home toggle failed:", err);
              // Revert state if it failed so UI matches reality
              setHomeState(prev => ({ ...prev, [device]: currentState }));
          });
      }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory]);

  // Load user config on mount
  useEffect(() => {
    const loadUserConfig = async () => {
      if (!API_BASE_URL) return;
      
      console.log('⏳ Loading user config from:', API_BASE_URL);
      setConfigLoading(true);
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/user/config`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ User config loaded:', data);
          
          // Map backend fields to frontend identity fields
          setIdentity(prev => ({
            ...prev,
            homeLocation: data.home_address || prev.homeLocation,
            workLocation: data.work_address || prev.workLocation,
            relevantRoutes: data.relevant_routes ? data.relevant_routes.split(',').map((s: string) => s.trim()).filter(Boolean) : prev.relevantRoutes
          }));
          
          // Store geocode status
          setGeocodeStatus({
            home: data.home_latitude && data.home_longitude 
              ? { lat: data.home_latitude, lng: data.home_longitude }
              : null,
            work: data.work_latitude && data.work_longitude
              ? { lat: data.work_latitude, lng: data.work_longitude }
              : null
          });
        } else {
          console.error('❌ Failed to load config, status:', response.status);
        }
      } catch (error) {
        console.error('❌ Error loading user config:', error);
      } finally {
        setConfigLoading(false);
      }
    };
    
    loadUserConfig();
  }, [API_BASE_URL]);

  const saveUserConfig = async () => {
    setSaveButtonState('saving');
    try {
      const configData = {
        home_address: identity.homeLocation,
        work_address: identity.workLocation,
        relevant_routes: identity.relevantRoutes.join(', '),
        morning_bus_stops: '', // Add these if you have them in identity
        evening_bus_stops: ''
      };
      
      const response = await fetch(`${API_BASE_URL}/api/user/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      });
      
      if (response.ok) {
        const result = await response.json();
        // Update geocode status from response
        if (result.config) {
          setGeocodeStatus({
            home: result.config.home_latitude && result.config.home_longitude
              ? { lat: result.config.home_latitude, lng: result.config.home_longitude }
              : null,
            work: result.config.work_latitude && result.config.work_longitude
              ? { lat: result.config.work_latitude, lng: result.config.work_longitude }
              : null
          });
        }
        setSaveButtonState('success');
        setTimeout(() => setSaveButtonState('idle'), 2000);
      } else {
        setSaveButtonState('error');
        setTimeout(() => setSaveButtonState('idle'), 2000);
      }
    } catch (error) {
      console.error('Error saving user config:', error);
      setSaveButtonState('error');
      setTimeout(() => setSaveButtonState('idle'), 2000);
    }
  };

  const handleChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatHistory(prev => [...prev, { role: 'user', content: chatInput.toLowerCase() }]);
    setChatInput('');
    setTimeout(() => {
      let response = "i can help with that.";
      const lowerInput = chatInput.toLowerCase();
      if (lowerInput.includes('bus')) {
         const nb = busData[activeBusTab]?.[0];
         response = nb ? `next bus (${nb.route}) is due in ${nb.due}.` : `no buses found.`;
      } else if (lowerInput.includes('email') && googleData.authenticated) {
          response = `you have ${googleData.emails?.length || 0} recent emails.`;
      } else if (lowerInput.includes('calendar') && googleData.authenticated) {
          const nextEvent = googleData.calendar?.[0];
          response = nextEvent ? `next event is "${nextEvent.title.toLowerCase()}" at ${nextEvent.time}.` : `calendar is clear.`;
      } else if (lowerInput.includes('light')) {
         handleSmartHomeToggle('livingRoomLights', homeState.livingRoomLights);
         response = `toggling living room lights...`;
      }
      setChatHistory(prev => [...prev, { role: 'assistant', content: response }]);
    }, 800);
  };

  const NavItem = ({ id, icon: Icon, label }: { id: TabId; icon: LucideIcon; label: string }) => (
    <button onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }} className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors w-full text-left font-medium ${activeTab === id ? `${THEME.main} ${THEME.bgDarker}` : `${THEME.sub} hover:${THEME.text} hover:${THEME.bgDarker}`}`}>
      <Icon size={20} /><span>{label}</span>
    </button>
  );

  const currentEmails = googleData.authenticated && googleData.emails ? googleData.emails : MOCK_EMAILS;
  const currentCalendar = googleData.authenticated && googleData.calendar ? googleData.calendar : MOCK_CALENDAR;

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Full-width Calendar at top */}
      <div className="w-full">
        <CalendarWidget calendar={currentCalendar} isAuthenticated={googleData.authenticated} />
      </div>

      {/* Three column grid below */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* COL 1 */}
        <div className="col-span-1 md:col-span-2 xl:col-span-1 space-y-6">
          {widgetVisibility.bus && (
            <BusWidget
              busData={busData}
              activeBusTab={activeBusTab}
              setActiveBusTab={setActiveBusTab}
              isBusLoading={isBusLoading}
              fetchBusData={fetchBusData}
              relevantRoutes={identity.relevantRoutes}
              lastRefresh={lastBusRefresh}
              onBusClick={(route, destination) => {
                console.log(`Showing bus ${route} to ${destination} on map`);
                busMapRef.current?.showBusLocation(route, destination);
              }}
            />
          )}
          {widgetVisibility.busMap && API_BASE_URL && (
            <BusMapWidget 
              ref={busMapRef}
              apiUrl={API_BASE_URL}
            />
          )}
          {widgetVisibility.spotify && <SpotifyWidget apiUrl={API_BASE_URL} />}
        </div>

        {/* COL 2 */}
        <div className="col-span-1 space-y-6">
          {widgetVisibility.weather && <WeatherWidget apiUrl={API_BASE_URL} />}
          {widgetVisibility.garmin && <GarminWidget apiUrl={API_BASE_URL} />}
          {widgetVisibility.smarthome && (
            <SmartHomeWidget apiUrl={API_BASE_URL} homeState={homeState} handleSmartHomeToggle={handleSmartHomeToggle} />
          )}
          {widgetVisibility.calendar && (
            <AgendaWidget calendar={currentCalendar} isAuthenticated={googleData.authenticated} />
          )}
          {widgetVisibility.plants && <PlantWidget apiUrl={API_BASE_URL} />}
        </div>

        {/* COL 3 */}
        <div className="col-span-1 space-y-6">
          {widgetVisibility.car && <CarWidget apiUrl={API_BASE_URL} />}
          {widgetVisibility.finance && <FinanceWidget isClient={isClient} apiUrl={API_BASE_URL} />}
          {widgetVisibility.email && (
            <EmailWidget emails={currentEmails} isAuthenticated={googleData.authenticated} />
          )}
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Widget Visibility */}
      <Card>
        <CardHeader title="widget visibility" icon={Settings} />
        <CardContent className="space-y-2">
          {Object.entries(widgetVisibility).map(([widget, visible]) => (
            <div key={widget} className={`flex items-center justify-between p-3 ${THEME.bg} rounded`}>
              <span className={`font-medium text-sm ${THEME.text}`}>{widget}</span>
              <button
                onClick={() => setWidgetVisibility({ ...widgetVisibility, [widget]: !visible })}
                className={`w-12 h-6 rounded-full transition-colors ${visible ? THEME.mainBg : 'bg-[#646669]'} relative`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-[#1a1d21] transition-transform ${visible ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Integrations */}
       <Card>
        <CardHeader title="integrations" icon={Terminal} />
        <CardContent className="space-y-2">
           <div className={`flex items-center justify-between p-3 ${THEME.bg} rounded`}>
               <div className={`flex items-center space-x-3 ${THEME.text}`}><Bus size={18} className={THEME.sub} /><span className="font-medium text-sm">stagecoach_api</span></div>
               <span className={`text-xs ${THEME.main}`}>[connected]</span>
           </div>
           <div className={`flex items-center justify-between p-3 ${THEME.bg} rounded`}>
               <div className={`flex items-center space-x-3 ${THEME.text}`}><Mail size={18} className={THEME.sub} /><span className="font-medium text-sm">google_workspace</span></div>
               {googleData.authenticated ? (
                   <div className={`flex items-center space-x-2 text-xs ${THEME.main}`}><Link2 size={14}/><span >[connected]</span></div>
               ) : (
                   <button onClick={handleGoogleLogin} className={`${THEME.mainBg} ${THEME.bgDarker} text-xs px-3 py-1 rounded font-bold hover:opacity-80 transition-opacity flex items-center space-x-1`}>
                       <Unlink2 size={14}/><span>CONNECT GOOGLE</span>
                   </button>
               )}
           </div>
           <div className={`flex items-center justify-between p-3 ${THEME.bg} rounded`}>
               <div className={`flex items-center space-x-3 ${THEME.text}`}><Music size={18} className={THEME.sub} /><span className="font-medium text-sm">spotify_connect</span></div>
               {spotifyAuthenticated ? (
                   <div className={`flex items-center space-x-2 text-xs ${THEME.main}`}><Link2 size={14}/><span>[connected]</span></div>
               ) : (
                   <button onClick={handleSpotifyLogin} className={`${THEME.mainBg} ${THEME.bgDarker} text-xs px-3 py-1 rounded font-bold hover:opacity-80 transition-opacity flex items-center space-x-1`}>
                       <Unlink2 size={14}/><span>CONNECT SPOTIFY</span>
                   </button>
               )}
           </div>
           <div className={`flex items-center justify-between p-3 ${THEME.bg} rounded`}>
               <div className={`flex items-center space-x-3 ${THEME.text}`}><CreditCard size={18} className={THEME.sub} /><span className="font-medium text-sm">monzo_open_banking</span></div>
               {monzoAuthenticated ? (
                   <div className={`flex items-center space-x-2 text-xs ${THEME.main}`}><Link2 size={14}/><span>[connected]</span></div>
               ) : (
                   <button onClick={handleMonzoLogin} className={`${THEME.mainBg} ${THEME.bgDarker} text-xs px-3 py-1 rounded font-bold hover:opacity-80 transition-opacity flex items-center space-x-1`}>
                       <Unlink2 size={14}/><span>CONNECT MONZO</span>
                   </button>
               )}
           </div>
           <div className={`flex items-center justify-between p-3 ${THEME.bg} rounded`}>
               <div className={`flex items-center space-x-3 ${THEME.text}`}><Home size={18} className={THEME.sub} /><span className="font-medium text-sm">home_assistant</span></div>
               <span className={`text-xs ${THEME.main}`}>[connected]</span>
           </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="user_config" icon={User} />
        <CardContent className="space-y-6 p-6">
          <div className={`text-sm ${THEME.sub} ${THEME.bg} p-3 rounded border-l-2 border-[#e2b714]`}>// this config loads into the terminal assistant</div>
          {configLoading && (
            <div className={`text-xs ${THEME.main} ${THEME.bg} p-2 rounded flex items-center gap-2`}>
              <RefreshCw size={14} className="animate-spin" />
              <span>Loading configuration...</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {['name', 'occupation'].map((field) => (
               <div key={field}><label className={`block text-xs ${THEME.main} mb-2`}>{field}</label><input type="text" value={identity[field] as string} onChange={e => setIdentity({...identity, [field]: e.target.value})} className={`w-full p-2 rounded ${THEME.bg} ${THEME.text} outline-none focus:ring-1 focus:ring-[#e2b714]`} /></div>
            ))}
            <div>
              <label className={`block text-xs ${THEME.main} mb-2 flex items-center justify-between`}>
                <span>home_address</span>
                {geocodeStatus.home && geocodeStatus.home.lat !== null && geocodeStatus.home.lng !== null && (
                  <span className="text-green-500 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    <span className="text-[10px]">({geocodeStatus.home.lat.toFixed(4)}, {geocodeStatus.home.lng.toFixed(4)})</span>
                  </span>
                )}
                {identity.homeLocation && !geocodeStatus.home && saveButtonState === 'idle' && (
                  <span className="text-amber-500 flex items-center gap-1">
                    <AlertCircle size={12} />
                    <span className="text-[10px]">not geocoded</span>
                  </span>
                )}
              </label>
              <input type="text" value={identity.homeLocation} onChange={e => setIdentity({...identity, homeLocation: e.target.value})} placeholder="e.g., Leamington Spa, UK" className={`w-full p-2 rounded ${THEME.bg} ${THEME.text} outline-none focus:ring-1 focus:ring-[#e2b714]`} />
            </div>
            <div>
              <label className={`block text-xs ${THEME.main} mb-2 flex items-center justify-between`}>
                <span>work_address</span>
                {geocodeStatus.work && geocodeStatus.work.lat !== null && geocodeStatus.work.lng !== null && (
                  <span className="text-green-500 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    <span className="text-[10px]">({geocodeStatus.work.lat.toFixed(4)}, {geocodeStatus.work.lng.toFixed(4)})</span>
                  </span>
                )}
                {identity.workLocation && !geocodeStatus.work && saveButtonState === 'idle' && (
                  <span className="text-amber-500 flex items-center gap-1">
                    <AlertCircle size={12} />
                    <span className="text-[10px]">not geocoded</span>
                  </span>
                )}
              </label>
              <input type="text" value={identity.workLocation} onChange={e => setIdentity({...identity, workLocation: e.target.value})} placeholder="e.g., University of Warwick, UK" className={`w-full p-2 rounded ${THEME.bg} ${THEME.text} outline-none focus:ring-1 focus:ring-[#e2b714]`} />
            </div>
            <div className="md:col-span-2"><label className={`block text-xs ${THEME.main} mb-2`}>relevant_routes</label><input type="text" value={identity.relevantRoutes.join(", ")} onChange={e => setIdentity({...identity, relevantRoutes: e.target.value.split(",").map(s => s.trim())})} className={`w-full p-2 rounded ${THEME.bg} ${THEME.text} outline-none focus:ring-1 focus:ring-[#e2b714]`} /></div>
             <div className="md:col-span-2"><label className={`block text-xs ${THEME.main} mb-2`}>preferences</label><textarea rows={4} value={identity.preferences} onChange={e => setIdentity({...identity, preferences: e.target.value})} className={`w-full p-2 rounded ${THEME.bg} ${THEME.text} outline-none focus:ring-1 focus:ring-[#e2b714] resize-none`} /></div>
          </div>
          <div className={`text-xs ${THEME.sub} ${THEME.bg} p-2 rounded`}>💡 Addresses will be automatically geocoded to map coordinates when saved</div>
          <button 
            onClick={saveUserConfig}
            disabled={saveButtonState === 'saving'}
            className={`w-full py-3 rounded font-medium transition-all border ${
              saveButtonState === 'success' 
                ? 'bg-green-600 text-white border-green-600' 
                : saveButtonState === 'error'
                ? 'bg-red-600 text-white border-red-600'
                : saveButtonState === 'saving'
                ? `${THEME.bg} ${THEME.sub} border-[#646669] cursor-not-allowed`
                : `${THEME.bg} ${THEME.main} border-[#e2b714] hover:bg-[#e2b714] hover:text-black`
            }`}
          >
            {saveButtonState === 'saving' && 'Saving...'}
            {saveButtonState === 'success' && '✓ Saved Successfully'}
            {saveButtonState === 'error' && '✗ Save Failed'}
            {saveButtonState === 'idle' && 'Save Settings'}
          </button>
        </CardContent>
      </Card>
    </div>
  );

  const renderAI = () => (
    <div className={`h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)] flex flex-col ${THEME.bgDarker} rounded-lg overflow-hidden`}>
       <div className={`px-6 py-4 ${THEME.bg} flex items-center justify-between`}>
         <div className="flex items-center space-x-3"><Terminal size={20} className={THEME.main} /><div><h2 className={`${THEME.main} font-bold`}>terminal_assistant</h2><p className={`text-xs ${THEME.sub} flex items-center`}><CheckCircle2 size={12} className="text-[#e2b714] mr-1" />{identity.name} context active</p></div></div>
         <button onClick={() => setChatHistory([{ role: 'assistant', content: `hello ${identity.name}. ready.` }])} className={`${THEME.sub} hover:${THEME.main} transition-colors`}><RefreshCw size={18} /></button>
       </div>
       <div className={`flex-1 overflow-y-auto p-6 space-y-4 ${THEME.bgDarker}`}>
         {chatHistory.map((msg, idx) => (
           <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] md:max-w-[70%] px-4 py-2 rounded ${msg.role === 'user' ? `${THEME.mainBg} text-[#323437]` : `${THEME.bg} ${THEME.text}`}`}><p className="text-sm leading-relaxed">{msg.content}</p></div></div>
         ))}
         <div ref={chatEndRef} />
       </div>
       <div className={`p-4 ${THEME.bg}`}>
         <form onSubmit={handleChatSubmit} className={`flex items-center space-x-2 ${THEME.bgDarker} rounded p-1 pl-4`}><span className={THEME.main}>{'>'}</span><input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder={`command...`} className={`flex-1 bg-transparent border-none outline-none ${THEME.text} placeholder-[#646669] py-2 font-mono`} /><button type="submit" disabled={!chatInput.trim()} className={`${THEME.main} p-2 hover:opacity-80 transition-opacity disabled:opacity-50`}><Send size={18} /></button></form>
       </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${THEME.bg} ${THEME.text} font-mono selection:bg-[#e2b714] selection:text-[#323437]`}>
      <div className={`lg:hidden flex items-center justify-between p-4 ${THEME.bgDarker} sticky top-0 z-20`}><h1 className={`${THEME.main} font-bold text-xl`}>life_os</h1><button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className={`p-2 rounded ${THEME.bg}`}>{isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}</button></div>
      <div className="flex h-[calc(100vh-64px)] lg:h-screen overflow-hidden">
        <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 ${THEME.bgDarker} transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="h-full flex flex-col p-4"><div className="p-4 hidden lg:block mb-6"><h1 className={`${THEME.main} font-bold text-2xl`}>life_os</h1><p className={`text-xs ${THEME.sub} mt-1`}>v1.0.0 // stable</p></div><nav className="flex-1 space-y-2"><NavItem id="dashboard" icon={Home} label="dashboard" /><NavItem id="ai" icon={Terminal} label="terminal" /><NavItem id="settings" icon={Settings} label="config" /></nav></div>
        </aside>
        <main className="flex-1 overflow-y-auto w-full p-4 md:p-6 lg:p-8" onClick={() => isMobileMenuOpen && setIsMobileMenuOpen(false)}><div className="max-w-7xl mx-auto h-full">{activeTab === 'dashboard' && renderDashboard()}{activeTab === 'ai' && renderAI()}{activeTab === 'settings' && renderSettings()}</div></main>
      </div>
    </div>
  );
}