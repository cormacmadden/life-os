import React from 'react';
import { Bus, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../Card';
import { THEME } from '@/lib/theme';
import { BusData } from '@/lib/types';

interface BusWidgetProps {
  busData: BusData;
  activeBusTab: 'workbound' | 'homebound';
  setActiveBusTab: (tab: 'workbound' | 'homebound') => void;
  isBusLoading: boolean;
  fetchBusData: (force?: boolean) => void;
  relevantRoutes: string[];
  lastRefresh: Date | null;
  onBusClick?: (route: string, destination: string) => void;
}

export const BusWidget: React.FC<BusWidgetProps> = ({
  busData,
  activeBusTab,
  setActiveBusTab,
  isBusLoading,
  fetchBusData,
  relevantRoutes,
  lastRefresh,
  onBusClick,
}) => {
  const formatLastRefresh = () => {
    if (!lastRefresh) return 'never';
    const now = new Date();
    const diffMs = now.getTime() - lastRefresh.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} mins ago`;
    
    const hours = lastRefresh.getHours().toString().padStart(2, '0');
    const mins = lastRefresh.getMinutes().toString().padStart(2, '0');
    return `at ${hours}:${mins}`;
  };
  return (
    <Card>
      <CardHeader
        title="stagecoach"
        icon={Bus}
        rightElement={
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className={`text-xs ${THEME.sub}`}>
                {formatLastRefresh()}
              </span>
              <button
                onClick={() => fetchBusData(true)}
                disabled={isBusLoading}
                className={`${THEME.sub} hover:${THEME.main} transition-colors disabled:opacity-50`}
              >
                <RefreshCw size={16} className={isBusLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className={`flex text-xs font-medium ${THEME.bg} rounded p-1`}>
              <button
                onClick={() => setActiveBusTab('workbound')}
                className={`px-3 py-1 rounded transition-colors ${
                  activeBusTab === 'workbound'
                    ? `${THEME.mainBg} ${THEME.bg}`
                    : `${THEME.sub} hover:${THEME.text}`
                }`}
              >
                workbound
              </button>
              <button
                onClick={() => setActiveBusTab('homebound')}
                className={`px-3 py-1 rounded transition-colors ${
                  activeBusTab === 'homebound'
                    ? `${THEME.mainBg} ${THEME.bg}`
                    : `${THEME.sub} hover:${THEME.text}`
                }`}
              >
                homebound
              </button>
            </div>
          </div>
        }
      />
      <CardContent className="space-y-2">
        {busData[activeBusTab] && busData[activeBusTab].length > 0 ? (
          busData[activeBusTab]
            .filter((bus) =>
              relevantRoutes.map((r) => r.toLowerCase()).includes(bus.route.toLowerCase())
            )
            .map((bus, idx) => (
              <div
                key={idx}
                onClick={() => onBusClick?.(bus.route, bus.destination)}
                className={`flex items-center justify-between p-3 ${THEME.bg} rounded transition-colors cursor-pointer hover:opacity-80 ${
                  isBusLoading ? 'opacity-50' : 'opacity-100'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`${THEME.main} font-bold text-xl w-8 flex justify-center`}>
                    {bus.route}
                  </div>
                  <div>
                    <p className={`${THEME.text} leading-tight`}>
                      {bus.destination.toLowerCase()}
                    </p>
                    <p
                      className={`text-xs ${
                        bus.status === 'Late' ? THEME.error : THEME.sub
                      }`}
                    >
                      {bus.status.toLowerCase()}
                    </p>
                  </div>
                </div>
                <div className={`${THEME.main} text-lg font-bold`}>{bus.due}</div>
              </div>
            ))
        ) : (
          <div className={`p-3 ${THEME.sub} text-sm ${isBusLoading ? 'opacity-50' : ''}`}>
            {isBusLoading ? 'fetching data...' : lastRefresh ? `no buses found...` : 'click refresh to load bus times'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
