import React, { useState, useEffect } from 'react';
import { Home, Lightbulb, Lock, Unlock, Power, Wind, Thermometer, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../Card';
import { THEME } from '@/lib/theme';

interface Device {
  entity_id: string;
  friendly_name: string;
  domain: string;
  state: string;
}

interface SmartHomeWidgetProps {
  apiUrl: string;
  homeState?: any; // Keep for backward compatibility but won't use
  handleSmartHomeToggle?: any; // Keep for backward compatibility but won't use
}

export const SmartHomeWidget: React.FC<SmartHomeWidgetProps> = ({ apiUrl }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (apiUrl) {
      fetchDevices();
    }
  }, [apiUrl]);

  const fetchDevices = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/smarthome/devices`);
      
      if (!response.ok) {
        // Silently handle errors - Home Assistant might not be configured
        if (response.status === 500 || response.status === 404) {
          setDevices([]);
          setLoading(false);
          return;
        }
        throw new Error('Failed to fetch devices');
      }
      
      const data = await response.json();
      setDevices(data.devices || []);
      setLoading(false);
    } catch (err) {
      // Silently fail if Home Assistant isn't configured
      setDevices([]);
      setLoading(false);
    }
  };

  const toggleDevice = async (entity_id: string, currentState: string) => {
    const isOn = currentState === 'on' || currentState === 'unlocked' || currentState === 'open';
    const targetState = !isOn;

    // Optimistic update
    setDevices(prev => prev.map(d => 
      d.entity_id === entity_id ? { ...d, state: targetState ? 'on' : 'off' } : d
    ));

    try {
      const response = await fetch(`${apiUrl}/api/smarthome/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          device_id: entity_id,  // Pass entity_id directly
          target_state: targetState 
        })
      });

      if (!response.ok) throw new Error('Toggle failed');
      
      // Refresh devices to get actual state
      setTimeout(fetchDevices, 500);
    } catch (err) {
      console.error('Error toggling device:', err);
      // Revert on error
      setDevices(prev => prev.map(d => 
        d.entity_id === entity_id ? { ...d, state: currentState } : d
      ));
    }
  };

  const getDeviceIcon = (domain: string, state: string) => {
    switch (domain) {
      case 'light':
        return <Lightbulb size={24} fill={state === 'on' ? 'currentColor' : 'none'} />;
      case 'lock':
        return state === 'locked' ? <Lock size={24} /> : <Unlock size={24} />;
      case 'switch':
        return <Power size={24} />;
      case 'cover':
        return <Home size={24} />;
      case 'fan':
        return <Wind size={24} />;
      case 'climate':
        return <Thermometer size={24} />;
      default:
        return <Home size={24} />;
    }
  };

  const getDeviceStyle = (domain: string, state: string) => {
    const isActive = state === 'on' || state === 'unlocked' || state === 'open';
    
    if (domain === 'lock') {
      return isActive
        ? `border-[#ca4754] ${THEME.error}`
        : `border-[#6b9080] ${THEME.main}`;
    }
    
    if (domain === 'light' && isActive) {
      return `border-[#e2b714] ${THEME.main}`;
    }
    
    return isActive
      ? `border-[#6b9080] ${THEME.main}`
      : `border-[#323437] ${THEME.bg} ${THEME.sub}`;
  };

  const getDisplayName = (friendly_name: string, entity_id: string) => {
    // Shorten long names to fit the card
    const name = friendly_name || entity_id.split('.')[1].replace(/_/g, ' ');
    return name.length > 20 ? name.substring(0, 18) + '...' : name;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader title="control" icon={Home} />
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <span className={THEME.sub}>Loading devices...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader title="control" icon={Home} />
        <CardContent>
          <div className="flex items-center justify-center h-32 gap-2">
            <AlertCircle size={20} className={THEME.error} />
            <span className={THEME.error}>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (devices.length === 0) {
    return (
      <Card>
        <CardHeader title="control" icon={Home} />
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <span className={THEME.sub}>No devices found</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="control"
        icon={Home}
        rightElement={
          <span className={`text-xs ${THEME.sub}`}>
            {devices.length} device{devices.length !== 1 ? 's' : ''}
          </span>
        }
      />
      <CardContent className="grid grid-cols-2 gap-4">
        {devices.map((device) => (
          <button
            key={device.entity_id}
            onClick={() => toggleDevice(device.entity_id, device.state)}
            className={`p-4 rounded flex flex-col items-center justify-center space-y-2 transition-all border-2 ${getDeviceStyle(device.domain, device.state)}`}
          >
            {getDeviceIcon(device.domain, device.state)}
            <span className="text-sm text-center">{getDisplayName(device.friendly_name, device.entity_id)}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
};
