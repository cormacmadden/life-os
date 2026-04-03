import React, { useEffect, useState } from 'react';
import { Cloud, CloudRain, Sun, CloudSnow, Wind, Droplets, Clock } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../Card';
import { THEME } from '@/lib/theme';

interface WeatherData {
  city_id: string;
  city_name: string;
  timezone: string;
  temperature: number;
  feels_like: number;
  humidity: number;
  description: string;
  icon: string;
  wind_speed: number;
  timestamp: string;
}

interface WeatherWidgetProps {
  apiUrl?: string;
}

const getWeatherIcon = (iconCode: string) => {
  // OpenWeather icon codes: 01d/01n (clear), 02d/02n (few clouds), 03d/03n (scattered clouds),
  // 04d/04n (broken clouds), 09d/09n (shower rain), 10d/10n (rain), 11d/11n (thunderstorm),
  // 13d/13n (snow), 50d/50n (mist)
  
  if (iconCode.startsWith('01')) return <Sun size={32} className="text-yellow-400" />;
  if (iconCode.startsWith('02') || iconCode.startsWith('03') || iconCode.startsWith('04')) 
    return <Cloud size={32} className={THEME.main} />;
  if (iconCode.startsWith('09') || iconCode.startsWith('10') || iconCode.startsWith('11')) 
    return <CloudRain size={32} className="text-blue-400" />;
  if (iconCode.startsWith('13')) return <CloudSnow size={32} className="text-blue-200" />;
  return <Cloud size={32} className={THEME.main} />;
};

const getCurrentTime = (timezone: string) => {
  try {
    return new Date().toLocaleTimeString('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }
};

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ apiUrl }) => {
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTimes, setCurrentTimes] = useState<Record<string, string>>({});

  // Fetch weather data
  const fetchWeather = async () => {
    if (!apiUrl) return;
    
    try {
      console.log('Fetching weather from:', `${apiUrl}/api/weather/current`);
      const response = await fetch(`${apiUrl}/api/weather/current`);
      console.log('Weather response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Weather data received:', data);
        setWeatherData(data.cities || []);
      } else {
        console.error('Weather request failed:', response.status, response.statusText);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching weather:', error);
      setLoading(false);
    }
  };

  // Update times every second
  useEffect(() => {
    const updateTimes = () => {
      const times: Record<string, string> = {};
      weatherData.forEach(city => {
        times[city.city_id] = getCurrentTime(city.timezone);
      });
      setCurrentTimes(times);
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, [weatherData]);

  useEffect(() => {
    if (apiUrl) {
      fetchWeather();
      // Refresh weather every 10 minutes
      const interval = setInterval(fetchWeather, 600000);
      return () => clearInterval(interval);
    }
  }, [apiUrl]);

  if (loading) {
    return (
      <Card>
        <CardHeader title="weather" icon={Cloud} />
        <CardContent className="p-6">
          <div className={`text-sm ${THEME.sub}`}>Loading weather...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="weather" icon={Cloud} />
      <CardContent className="p-6">
        <div className="space-y-4">
          {weatherData.map((city) => (
            <div
              key={city.city_id}
              className={`p-4 rounded ${THEME.bg} border border-[#2a2a2a] hover:border-[#e2b714] transition-colors`}
            >
              {/* City name and time */}
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-lg font-bold ${THEME.text}`}>{city.city_name}</h3>
                <div className="flex items-center space-x-2">
                  <Clock size={14} className={THEME.sub} />
                  <span className={`text-sm ${THEME.main} font-mono`}>
                    {currentTimes[city.city_id] || '--:--'}
                  </span>
                </div>
              </div>

              {/* Main weather info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {getWeatherIcon(city.icon)}
                  <div>
                    <div className={`text-4xl font-bold ${THEME.text}`}>
                      {city.temperature}°C
                    </div>
                    <div className={`text-sm ${THEME.sub} capitalize`}>
                      {city.description}
                    </div>
                  </div>
                </div>

                {/* Additional details */}
                <div className={`text-sm ${THEME.sub} space-y-1`}>
                  <div className="flex items-center space-x-2">
                    <span>Feels like:</span>
                    <span className={THEME.main}>{city.feels_like}°C</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Droplets size={12} />
                    <span>{city.humidity}%</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Wind size={12} />
                    <span>{city.wind_speed} km/h</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
