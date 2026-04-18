import React, { useEffect, useState } from 'react';
import { Dumbbell, Calendar, TrendingUp, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts';
import { Card, CardHeader, CardContent } from '../Card';
import { THEME } from '@/lib/theme';

interface WorkoutWidgetProps {
  apiUrl?: string;
}

interface WorkoutExerciseSummary {
  name: string;
  sets: number;
  max_weight: number;
  total_reps: number;
}

interface RecentWorkout {
  id: number;
  name: string;
  date: string;
  exercise_count: number;
  set_count: number;
  total_volume: number;
  exercises: WorkoutExerciseSummary[];
}

interface HabitDay {
  id: number;
  name: string;
  type: string;
  exercises: number;
  sets: number;
  volume: number;
}

interface HabitTracker {
  days: Record<string, HabitDay[]>;
  total_workouts: number;
  active_days: number;
  period_days: number;
}

interface ExerciseStats {
  total_volume: number;
  max_weight: number;
  total_reps: number;
  set_count: number;
  last_date: string;
}

const WorkoutWidget: React.FC<WorkoutWidgetProps> = ({ apiUrl = '' }) => {
  const [recent, setRecent] = useState<RecentWorkout[]>([]);
  const [habit, setHabit] = useState<HabitTracker | null>(null);
  const [stats, setStats] = useState<Record<string, ExerciseStats>>({});
  const [expandedWorkout, setExpandedWorkout] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [recentRes, habitRes, statsRes] = await Promise.all([
          fetch(`${apiUrl}/api/workouts/recent?limit=5`, { credentials: 'include' }),
          fetch(`${apiUrl}/api/workouts/habit-tracker?days=90`, { credentials: 'include' }),
          fetch(`${apiUrl}/api/workouts/stats?days=30`, { credentials: 'include' })
        ]);
        
        if (recentRes.ok) setRecent(await recentRes.json());
        if (habitRes.ok) setHabit(await habitRes.json());
        if (statsRes.ok) setStats(await statsRes.json());
      } catch (err) {
        console.error('Failed to fetch workout data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [apiUrl]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatVolume = (vol: number) => {
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
    return vol.toString();
  };

  // Build habit calendar for current month
  const buildCalendar = () => {
    if (!habit) return [];
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // Get 5 weeks of data ending this week
    const today = new Date(year, month, now.getDate());
    const dayOfWeek = today.getDay() || 7; // Monday = 1
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (7 - dayOfWeek));
    
    const startDate = new Date(endOfWeek);
    startDate.setDate(endOfWeek.getDate() - 34); // 5 weeks back
    
    const weeks: { date: Date; key: string; hasWorkout: boolean; volume: number }[][] = [];
    let currentWeek: { date: Date; key: string; hasWorkout: boolean; volume: number }[] = [];
    
    for (let i = 0; i < 35; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const key = d.toISOString().split('T')[0];
      const dayData = habit.days[key];
      
      currentWeek.push({
        date: d,
        key,
        hasWorkout: !!dayData && dayData.length > 0,
        volume: dayData ? dayData.reduce((sum, w) => sum + w.volume, 0) : 0
      });
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);
    
    return weeks;
  };

  // Volume chart data from recent workouts
  const volumeChartData = [...recent].reverse().map(w => ({
    date: formatDate(w.date),
    volume: Math.round(w.total_volume),
    exercises: w.exercise_count,
    sets: w.set_count
  }));

  // Top exercises by volume
  const topExercises = Object.entries(stats)
    .sort((a, b) => b[1].total_volume - a[1].total_volume)
    .slice(0, 5);

  if (loading) {
    return (
      <Card>
        <CardHeader title="Workouts" icon={Dumbbell} />
        <CardContent>
          <div className={`p-4 ${THEME.bg} rounded text-center min-h-[150px] flex items-center justify-center`}>
            <p className={`${THEME.sub} text-sm`}>loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const calendar = buildCalendar();
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const todayKey = new Date().toISOString().split('T')[0];

  return (
    <Card>
      <CardHeader title="Workouts" icon={Dumbbell} />
      <CardContent>
        <div className="space-y-4">

          {/* Habit Tracker Calendar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={`${THEME.sub} text-xs uppercase tracking-wider`}>Activity</span>
              {habit && (
                <span className={`${THEME.sub} text-xs`}>
                  {habit.active_days} days active · {habit.total_workouts} workouts
                </span>
              )}
            </div>
            
            <div className={`${THEME.bg} rounded p-3`}>
              {/* Day labels */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {dayLabels.map((label, i) => (
                  <div key={i} className={`${THEME.sub} text-[10px] text-center`}>{label}</div>
                ))}
              </div>
              
              {/* Calendar grid */}
              {calendar.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
                  {week.map((day) => {
                    const isToday = day.key === todayKey;
                    const isFuture = day.date > new Date();
                    
                    let bgColor = 'bg-[#3a3d41]'; // empty day
                    if (isFuture) {
                      bgColor = 'bg-[#2a2d31]'; // future - dimmer
                    } else if (day.hasWorkout) {
                      if (day.volume > 4000) bgColor = 'bg-[#e2b714]'; // high volume - gold
                      else if (day.volume > 2000) bgColor = 'bg-[#b8960f]'; // medium
                      else bgColor = 'bg-[#8a700b]'; // low
                    }
                    
                    return (
                      <div
                        key={day.key}
                        className={`${bgColor} rounded-sm aspect-square flex items-center justify-center relative`}
                        title={day.hasWorkout ? `${day.key}: ${formatVolume(day.volume)} kg volume` : day.key}
                      >
                        {isToday && (
                          <div className="absolute inset-0 rounded-sm border border-[#e2b714] opacity-60" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Volume Chart */}
          {volumeChartData.length > 1 && (
            <div>
              <span className={`${THEME.sub} text-xs uppercase tracking-wider`}>Volume Trend</span>
              <div className="h-32 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeChartData}>
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: '#646669', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1a1d21',
                        border: '1px solid #646669',
                        borderRadius: '8px',
                        color: '#d1d0c5',
                        fontSize: '12px'
                      }}
                      formatter={(value: number) => [`${value.toLocaleString()} kg`, 'Volume']}
                    />
                    <Bar dataKey="volume" fill="#e2b714" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top Exercises */}
          {topExercises.length > 0 && (
            <div>
              <span className={`${THEME.sub} text-xs uppercase tracking-wider`}>Top Exercises (30d)</span>
              <div className={`${THEME.bg} rounded mt-2 divide-y divide-[#3a3d41]`}>
                {topExercises.map(([name, data]) => (
                  <div key={name} className="px-3 py-2 flex items-center justify-between">
                    <span className={`${THEME.text} text-sm truncate flex-1 mr-2`}>{name}</span>
                    <div className="flex items-center space-x-3 text-xs">
                      {data.max_weight > 0 && (
                        <span className={`${THEME.main}`}>
                          <Trophy size={10} className="inline mr-1" />
                          {data.max_weight}kg
                        </span>
                      )}
                      <span className={`${THEME.sub}`}>{data.total_reps} reps</span>
                      <span className={`${THEME.sub}`}>{formatVolume(data.total_volume)} vol</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Workouts */}
          <div>
            <span className={`${THEME.sub} text-xs uppercase tracking-wider`}>Recent</span>
            <div className={`${THEME.bg} rounded mt-2 divide-y divide-[#3a3d41]`}>
              {recent.map((w) => (
                <div key={w.id}>
                  <div 
                    className="px-3 py-2 cursor-pointer hover:bg-[#3a3d41] transition-colors"
                    onClick={() => setExpandedWorkout(expandedWorkout === w.id ? null : w.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`${THEME.text} text-sm`}>{w.name}</span>
                        {expandedWorkout === w.id ? (
                          <ChevronUp size={14} className={THEME.sub} />
                        ) : (
                          <ChevronDown size={14} className={THEME.sub} />
                        )}
                      </div>
                      <span className={`${THEME.sub} text-xs`}>{formatDate(w.date)}</span>
                    </div>
                    <div className={`${THEME.sub} text-xs mt-1`}>
                      {w.exercise_count} exercises · {w.set_count} sets · {formatVolume(w.total_volume)} kg vol
                    </div>
                  </div>
                  
                  {expandedWorkout === w.id && (
                    <div className="px-3 pb-2">
                      {w.exercises.map((e, i) => (
                        <div key={i} className="flex items-center justify-between py-1 text-xs">
                          <span className={`${THEME.text} opacity-80`}>{e.name}</span>
                          <span className={`${THEME.sub}`}>
                            {e.sets}×{Math.round(e.total_reps / e.sets)} 
                            {e.max_weight > 0 && ` @ ${e.max_weight}kg`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
};

export default WorkoutWidget;
