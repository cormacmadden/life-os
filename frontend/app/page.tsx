"use client";

import React, { useState, useEffect, useRef, FormEvent } from 'react';
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
  Unlink2
} from 'lucide-react';

import { THEME } from '@/lib/theme';
import { BusData, HomeState, Plant, CalendarEvent, Email, GoogleData, FinanceEntry, SpotifyState, ChatMessage, IdentityState} from '@/lib/types';
import { Card, CardHeader, CardContent } from '@/components/Card';
import { PlantWidget } from '@/components/widgets/PlantWidget';
import { BusWidget } from '@/components/widgets/BusWidget';
import { SpotifyWidget } from '@/components/widgets/SpotifyWidget';
import { SmartHomeWidget } from '@/components/widgets/SmartHomeWidget';
import { CalendarWidget } from '@/components/widgets/CalendarWidget';
import { FinanceWidget } from '@/components/widgets/FinanceWidget';
import { EmailWidget } from '@/components/widgets/EmailWidget';
import { GarminWidget } from '@/components/widgets/GarminWidget';
import { CarWidget } from '@/components/widgets/CarWidget';

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

  // Widget visibility settings
  const [widgetVisibility, setWidgetVisibility] = useState({
    bus: true,
    spotify: true,
    garmin: true,
    calendar: true,
    smarthome: true,
    plants: true,
    car: true,
    finance: true,
    email: true,
  });

  // API URL with fallback to Cloudflare
  const LOCAL_API = "http://192.168.4.28:8000";
  const REMOTE_API = "https://todd-browser-troubleshooting-helmet.trycloudflare.com";
  const [API_BASE_URL, setApiBaseUrl] = useState<string>(LOCAL_API);

  // DATA STATES
  const [busData, setBusData] = useState<BusData>(MOCK_BUS_DATA);
  const [isBusLoading, setIsBusLoading] = useState<boolean>(false);
  const [activeBusTab, setActiveBusTab] = useState<'workbound' | 'homebound'>('workbound');
  const [lastBusRefresh, setLastBusRefresh] = useState<Date | null>(null);
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

  // --- EFFECTS & FETCHING ---

  useEffect(() => {
    setIsClient(true);
    
    // Detect if local API is available, fallback to Cloudflare
    const detectApiUrl = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 500);
        
        await fetch(`${LOCAL_API}/docs`, {
          method: 'HEAD',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        console.log('✅ Using local API:', LOCAL_API);
        setApiBaseUrl(LOCAL_API);
      } catch {
        console.log('🌐 Using remote API:', REMOTE_API);
        setApiBaseUrl(REMOTE_API);
      }
    };
    
    detectApiUrl();
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
     // UNCOMMENT LOCALLY:
     
     if (!isClient) return;
     setIsBusLoading(true);
     fetch(`${API_BASE_URL}/api/bus${forceRefresh ? '?force=true' : ''}`)
       .then(res => res.json())
       .then(data => { 
         setBusData(data); 
         setIsBusLoading(false); 
         setLastBusRefresh(new Date());
       })
       .catch(e => { 
         console.error(e); 
         setIsBusLoading(false); 
       });
     
     if (!isClient) return;
     setIsBusLoading(true); setTimeout(() => setIsBusLoading(false), 800);
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
          />
        )}
        {widgetVisibility.spotify && <SpotifyWidget />}
      </div>

      {/* COL 2 */}
      <div className="col-span-1 space-y-6">
        {widgetVisibility.garmin && <GarminWidget />}
        {widgetVisibility.smarthome && (
          <SmartHomeWidget homeState={homeState} handleSmartHomeToggle={handleSmartHomeToggle} />
        )}
        {widgetVisibility.calendar && (
          <CalendarWidget calendar={currentCalendar} isAuthenticated={googleData.authenticated} />
        )}
        {widgetVisibility.plants && <PlantWidget />}
      </div>

      {/* COL 3 */}
      <div className="col-span-1 space-y-6">
        {widgetVisibility.car && <CarWidget />}
        {widgetVisibility.finance && <FinanceWidget isClient={isClient} />}
        {widgetVisibility.email && (
          <EmailWidget emails={currentEmails} isAuthenticated={googleData.authenticated} />
        )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {['name', 'occupation', 'homeLocation', 'workLocation'].map((field) => (
               <div key={field}><label className={`block text-xs ${THEME.main} mb-2`}>{field}</label><input type="text" value={identity[field] as string} onChange={e => setIdentity({...identity, [field]: e.target.value})} className={`w-full p-2 rounded ${THEME.bg} ${THEME.text} outline-none focus:ring-1 focus:ring-[#e2b714]`} /></div>
            ))}
            <div className="md:col-span-2"><label className={`block text-xs ${THEME.main} mb-2`}>relevant_routes</label><input type="text" value={identity.relevantRoutes.join(", ")} onChange={e => setIdentity({...identity, relevantRoutes: e.target.value.split(",").map(s => s.trim())})} className={`w-full p-2 rounded ${THEME.bg} ${THEME.text} outline-none focus:ring-1 focus:ring-[#e2b714]`} /></div>
             <div className="md:col-span-2"><label className={`block text-xs ${THEME.main} mb-2`}>preferences</label><textarea rows={4} value={identity.preferences} onChange={e => setIdentity({...identity, preferences: e.target.value})} className={`w-full p-2 rounded ${THEME.bg} ${THEME.text} outline-none focus:ring-1 focus:ring-[#e2b714] resize-none`} /></div>
          </div>
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