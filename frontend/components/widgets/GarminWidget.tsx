import React, { useEffect, useState } from 'react';
import { Activity, Heart, Moon, TrendingUp, Footprints, Flame, Clock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts';
import { Card, CardHeader, CardContent } from '../Card';
import { THEME } from '@/lib/theme';

interface GarminWidgetProps {
  apiUrl?: string;
}

interface GarminStats {
  steps: number;
  calories: number;
  distance_km: number;
  active_minutes: number;
  floors: number;
  resting_hr: number | null;
  max_hr: number | null;
  min_hr: number | null;
}

interface GarminSleep {
  date: string;
  total_sleep_seconds: number;
  deep_sleep_seconds: number;
  light_sleep_seconds: number;
  rem_sleep_seconds: number;
  awake_seconds: number;
  sleep_score: number | null;
  sleep_start: string | null;
  sleep_end: string | null;
}

interface GarminActivity {
  id: number;
  name: string;
  type: string;
  start_time: string;
  duration_seconds: number;
  distance_km: number | null;
  calories: number;
  avg_hr: number | null;
  max_hr: number | null;
}

interface GarminBody {
  weight_kg: number | null;
  avg_stress: number | null;
  max_stress: number | null;
}

export const GarminWidget: React.FC<GarminWidgetProps> = ({ apiUrl }) => {
  const [stats, setStats] = useState<GarminStats | null>(null);
  const [sleepHistory, setSleepHistory] = useState<GarminSleep[]>([]);
  const [activities, setActivities] = useState<GarminActivity[]>([]);
  const [body, setBody] = useState<GarminBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGarminData = async () => {
    if (!apiUrl) return;
    // Check if we have cached data from less than 15 minutes ago
    const cachedData = localStorage.getItem('garminData');
    const cachedTimestamp = localStorage.getItem('garminDataTimestamp');
    
    if (cachedData && cachedTimestamp) {
      const now = Date.now();
      const lastFetch = parseInt(cachedTimestamp);
      const fifteenMinutes = 15 * 60 * 1000; // 15 minutes in milliseconds
      
      if (now - lastFetch < fifteenMinutes) {
        // Use cached data
        const parsed = JSON.parse(cachedData);
        setStats(parsed.stats);
        setSleepHistory(parsed.sleepHistory);
        setActivities(parsed.activities);
        setBody(parsed.body);
        setLoading(false);
        console.log('Using cached Garmin data');
        return;
      }
    }
    
    // Fetch fresh data
    try {
      const [statsRes, sleepRes, activitiesRes, bodyRes] = await Promise.all([
        fetch(`${apiUrl}/api/garmin/stats`),
        fetch(`${apiUrl}/api/garmin/sleep`),
        fetch(`${apiUrl}/api/garmin/activities?limit=10`),
        fetch(`${apiUrl}/api/garmin/body`)
      ]);

      // Check if any authentication errors
      if (statsRes.status === 401 || statsRes.status === 503) {
        const errorData = await statsRes.json();
        setError('Garmin authentication required');
        setLoading(false);
        return;
      }

      const statsData = statsRes.ok ? await statsRes.json() : null;
      const sleepData = sleepRes.ok ? await sleepRes.json() : [];
      const activitiesData = activitiesRes.ok ? await activitiesRes.json() : [];
      const bodyData = bodyRes.ok ? await bodyRes.json() : null;

      setStats(statsData);
      setSleepHistory(sleepData);
      setActivities(activitiesData);
      setBody(bodyData);
      
      // Cache the data
      localStorage.setItem('garminData', JSON.stringify({
        stats: statsData,
        sleepHistory: sleepData,
        activities: activitiesData,
        body: bodyData
      }));
      localStorage.setItem('garminDataTimestamp', Date.now().toString());
      
      setError(null);
    } catch (err) {
      console.error('Failed to fetch Garmin data:', err);
      setError('Garmin temporarily unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiUrl) {
      fetchGarminData();
    }
    // No interval - only fetches on page load/refresh
  }, [apiUrl]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatActivityType = (type: string): string => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <Card>
        <CardHeader title="garmin" icon={Activity} />
        <CardContent>
          <div className={`p-4 ${THEME.bg} rounded text-center`}>
            <p className={`${THEME.sub} text-sm`}>loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader title="garmin" icon={Activity} />
        <CardContent>
          <div className={`p-4 ${THEME.bg} rounded text-center space-y-2`}>
            <p className={`${THEME.sub} text-sm`}>{error}</p>
            <p className={`${THEME.sub} text-xs opacity-70`}>
              Widget disabled - authentication needed
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="garmin" icon={Activity} />
      <CardContent>
        <div className="space-y-4">
          {/* Daily Stats */}
          {stats && (
            <div className={`p-4 ${THEME.bg} rounded space-y-3`}>
              <h3 className={`${THEME.main} text-sm font-bold uppercase mb-3`}>today</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Footprints size={16} className={THEME.main} />
                  <div>
                    <p className={`${THEME.main} text-lg font-bold`}>{stats.steps.toLocaleString()}</p>
                    <p className={`${THEME.sub} text-xs`}>steps</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Flame size={16} className={THEME.main} />
                  <div>
                    <p className={`${THEME.main} text-lg font-bold`}>{stats.calories}</p>
                    <p className={`${THEME.sub} text-xs`}>calories</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <TrendingUp size={16} className={THEME.main} />
                  <div>
                    <p className={`${THEME.main} text-lg font-bold`}>{stats.distance_km} km</p>
                    <p className={`${THEME.sub} text-xs`}>distance</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Clock size={16} className={THEME.main} />
                  <div>
                    <p className={`${THEME.main} text-lg font-bold`}>{stats.active_minutes}</p>
                    <p className={`${THEME.sub} text-xs`}>active min</p>
                  </div>
                </div>
              </div>

              {stats.resting_hr && (
                <div className="pt-3 border-t border-[#646669]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Heart size={16} className={THEME.main} />
                      <span className={`${THEME.sub} text-xs`}>heart rate</span>
                    </div>
                    <div className="flex space-x-4">
                      <div className="text-right">
                        <p className={`${THEME.main} text-sm font-bold`}>{stats.resting_hr}</p>
                        <p className={`${THEME.sub} text-xs`}>resting</p>
                      </div>
                      {stats.max_hr && (
                        <div className="text-right">
                          <p className={`${THEME.main} text-sm font-bold`}>{stats.max_hr}</p>
                          <p className={`${THEME.sub} text-xs`}>max</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sleep Data */}
          {sleepHistory.length > 0 && sleepHistory.some(s => s.sleep_score) && (
            <div className={`p-4 ${THEME.bg} rounded space-y-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Moon size={16} className={THEME.main} />
                  <h3 className={`${THEME.main} text-sm font-bold uppercase`}>sleep score</h3>
                </div>
                <p className={`${THEME.main} text-lg font-bold`}>
                  {sleepHistory[0]?.sleep_score || '-'}
                </p>
              </div>

              <ResponsiveContainer width="100%" height={100}>
                <LineChart 
                  data={(() => {
                    // Create array of last 7 days
                    const last7Days = [];
                    for (let i = 6; i >= 0; i--) {
                      const date = new Date();
                      date.setDate(date.getDate() - i);
                      const dateStr = date.toISOString().split('T')[0];
                      
                      // Find matching sleep data
                      const sleepData = sleepHistory.find(s => s.date === dateStr);
                      
                      last7Days.push({
                        date: date.toLocaleDateString(undefined, { weekday: 'short' }),
                        score: sleepData?.sleep_score || null
                      });
                    }
                    return last7Days;
                  })()}
                >
                  <XAxis 
                    dataKey="date" 
                    stroke="#646669" 
                    tick={{ fill: '#646669', fontSize: 12 }}
                    axisLine={{ stroke: '#646669' }}
                  />
                  <YAxis 
                    stroke="#646669"
                    tick={{ fill: '#646669', fontSize: 12 }}
                    axisLine={{ stroke: '#646669' }}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1d21',
                      border: '1px solid #646669',
                      borderRadius: '4px',
                    }}
                    labelStyle={{ color: '#e2b714' }}
                    itemStyle={{ color: '#e2b714' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#e2b714" 
                    strokeWidth={2}
                    dot={{ fill: '#e2b714', r: 3 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>

              <div className="pt-2 border-t border-[#646669]">
                <p className={`${THEME.sub} text-xs text-center`}>
                  avg: {Math.round(sleepHistory.reduce((sum, s) => sum + (s.sleep_score || 0), 0) / sleepHistory.filter(s => s.sleep_score).length)}
                  {' · '}
                  last night: {formatTime(sleepHistory[0]?.total_sleep_seconds || 0)}
                </p>
              </div>
            </div>
          )}

          {/* Recent Activities */}
          {activities.length > 0 && (
            <div className={`p-4 ${THEME.bg} rounded space-y-3`}>
              <h3 className={`${THEME.main} text-sm font-bold uppercase`}>recent activities</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {activities.map((activity) => (
                  <div key={activity.id} className={`p-3 rounded border border-[#646669]`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className={`${THEME.main} text-sm font-bold`}>
                          {formatActivityType(activity.type)}
                        </p>
                        <p className={`${THEME.sub} text-xs`}>
                          {new Date(activity.start_time).toLocaleDateString(undefined, { 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      {activity.avg_hr && (
                        <div className="flex items-center space-x-1">
                          <Heart size={14} className={THEME.main} />
                          <span className={`${THEME.main} text-sm font-bold`}>{activity.avg_hr}</span>
                          {activity.max_hr && (
                            <span className={`${THEME.sub} text-xs`}>/{activity.max_hr}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className={`${THEME.main} text-sm font-bold`}>{formatTime(activity.duration_seconds)}</p>
                        <p className={`${THEME.sub} text-xs`}>duration</p>
                      </div>
                      {activity.distance_km && (
                        <div>
                          <p className={`${THEME.main} text-sm font-bold`}>{activity.distance_km} km</p>
                          <p className={`${THEME.sub} text-xs`}>distance</p>
                        </div>
                      )}
                      {activity.calories && (
                        <div>
                          <p className={`${THEME.main} text-sm font-bold`}>{activity.calories}</p>
                          <p className={`${THEME.sub} text-xs`}>calories</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Body Metrics */}
          {(body?.weight_kg || body?.avg_stress) && (
            <div className={`p-4 ${THEME.bg} rounded`}>
              <div className="grid grid-cols-2 gap-4">
                {body.weight_kg && (
                  <div className="text-center">
                    <p className={`${THEME.main} text-lg font-bold`}>{body.weight_kg.toFixed(1)} kg</p>
                    <p className={`${THEME.sub} text-xs`}>weight</p>
                  </div>
                )}
                {body.avg_stress && (
                  <div className="text-center">
                    <p className={`${THEME.main} text-lg font-bold`}>{body.avg_stress}</p>
                    <p className={`${THEME.sub} text-xs`}>avg stress</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
