import React, { useEffect, useState } from 'react';
import { Music, Play, Pause, SkipForward, SkipBack, Link2, Volume2, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../Card';
import { THEME } from '@/lib/theme';

const LOCAL_API = "http://192.168.4.28:8000";
const REMOTE_API = "https://todd-browser-troubleshooting-helmet.trycloudflare.com";

interface SpotifyTrackData {
  authenticated: boolean;
  playing: boolean;
  track?: string;
  artist?: string;
  album?: string;
  album_art?: string;
  progress?: number;
  progress_ms?: number;
  duration_ms?: number;
  volume_percent?: number;
  context_type?: string;
  context_uri?: string;
  error?: string;
}

interface QueueItem {
  name: string;
  artist: string;
  album?: string;
  album_art?: string;
  duration_ms?: number;
}

export const SpotifyWidget: React.FC = () => {
  const [spotifyData, setSpotifyData] = useState<SpotifyTrackData>({
    authenticated: false,
    playing: false,
  });
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiUrl, setApiUrl] = useState<string>(LOCAL_API);
  const [volume, setVolume] = useState<number>(50);
  const [queueExpanded, setQueueExpanded] = useState<boolean>(false);

  // Detect API URL on mount
  useEffect(() => {
    const detectApi = async () => {
      try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 500);
        await fetch(`${LOCAL_API}/docs`, { method: 'HEAD', signal: controller.signal });
        setApiUrl(LOCAL_API);
      } catch {
        setApiUrl(REMOTE_API);
      }
    };
    detectApi();
  }, []);

  const fetchCurrentTrack = async () => {
    if (typeof window === 'undefined') return;
    
    try {
      const response = await fetch(`${apiUrl}/api/spotify/current-track`);
      const data = await response.json();
      setSpotifyData(data);
      if (data.volume_percent !== undefined) {
        setVolume(data.volume_percent);
      }
    } catch (err) {
      console.error('Failed to fetch Spotify data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueue = async () => {
    if (typeof window === 'undefined') return;
    
    try {
      const response = await fetch(`${apiUrl}/api/spotify/queue`);
      const data = await response.json();
      setQueue(data.queue || []);
    } catch (err) {
      console.error('Failed to fetch Spotify queue:', err);
    }
  };

  const handleVolumeChange = async (newVolume: number) => {
    setVolume(newVolume);
    try {
      await fetch(`${apiUrl}/api/spotify/volume?volume_percent=${newVolume}`, { 
        method: 'POST' 
      });
    } catch (err) {
      console.error('Failed to set volume:', err);
    }
  };

  const handleProgressBarClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!spotifyData.duration_ms) return;
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const positionMs = Math.floor(percentage * spotifyData.duration_ms);
    
    try {
      await fetch(`${apiUrl}/api/spotify/seek?position_ms=${positionMs}`, { 
        method: 'POST' 
      });
      // Refresh track info immediately
      setTimeout(fetchCurrentTrack, 300);
    } catch (err) {
      console.error('Failed to seek:', err);
    }
  };

  useEffect(() => {
    if (apiUrl) {
      fetchCurrentTrack();
      fetchQueue();
      // Poll every 5 seconds for updates
      const interval = setInterval(() => {
        fetchCurrentTrack();
        fetchQueue();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [apiUrl]);

  const handlePlayPause = async () => {
    try {
      const endpoint = spotifyData.playing ? 'pause' : 'play';
      await fetch(`${apiUrl}/api/spotify/${endpoint}`, { method: 'POST' });
      // Refresh immediately
      setTimeout(fetchCurrentTrack, 500);
    } catch (err) {
      console.error('Failed to toggle playback:', err);
    }
  };

  const handleNext = async () => {
    try {
      await fetch(`${apiUrl}/api/spotify/next`, { method: 'POST' });
      setTimeout(fetchCurrentTrack, 500);
    } catch (err) {
      console.error('Failed to skip track:', err);
    }
  };

  const handlePrevious = async () => {
    try {
      await fetch(`${apiUrl}/api/spotify/previous`, { method: 'POST' });
      setTimeout(fetchCurrentTrack, 500);
    } catch (err) {
      console.error('Failed to go to previous track:', err);
    }
  };

  const initiateAuth = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/spotify/auth`);
      const data = await response.json();
      if (data.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (err) {
      console.error('Failed to initiate Spotify auth:', err);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader title="spotify" icon={Music} />
        <CardContent>
          <div className={`flex items-center space-x-4 p-4 ${THEME.bg} rounded`}>
            <div className="w-16 h-16 bg-[#2a2d31] rounded flex items-center justify-center">
              <Music size={32} className={THEME.sub} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`${THEME.sub} text-lg animate-pulse`}>loading...</h3>
              <p className={`${THEME.sub} text-sm`}>connecting to spotify</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <div className={`w-full ${THEME.bg} h-2 rounded-full`}></div>
            <div className={`flex items-center justify-center space-x-6 ${THEME.sub} opacity-50`}>
              <SkipBack size={20} />
              <Play size={32} />
              <SkipForward size={20} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!spotifyData.authenticated) {
    return (
      <Card>
        <CardHeader title="spotify" icon={Music} />
        <CardContent>
          <div className={`flex items-center space-x-4 p-4 ${THEME.bg} rounded`}>
            <div className="w-16 h-16 bg-[#2a2d31] rounded flex items-center justify-center">
              <Music size={32} className={THEME.sub} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`${THEME.text} text-lg font-bold`}>not connected</h3>
              <p className={`${THEME.sub} text-sm`}>connect to see what's playing</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <button
              onClick={initiateAuth}
              className={`w-full bg-[#00ff00] text-[#1a1d21] px-4 py-2 rounded font-medium hover:opacity-80 transition-opacity flex items-center justify-center space-x-2`}
            >
              <Link2 size={16} />
              <span>connect spotify</span>
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!spotifyData.playing && !spotifyData.track) {
    return (
      <Card>
        <CardHeader title="spotify" icon={Music} />
        <CardContent>
          <div className={`flex items-center space-x-4 p-4 ${THEME.bg} rounded`}>
            <div className="w-16 h-16 bg-[#2a2d31] rounded flex items-center justify-center">
              <Music size={32} className={THEME.sub} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`${THEME.text} text-lg font-bold`}>no track playing</h3>
              <p className={`${THEME.sub} text-sm`}>start playback on your device</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <div className={`w-full ${THEME.bg} h-2 rounded-full`}></div>
            <div className={`flex items-center justify-center space-x-6 ${THEME.sub} opacity-50`}>
              <SkipBack size={20} />
              <Play size={32} />
              <SkipForward size={20} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="spotify" icon={Music} />
      <CardContent>
        <div className={`flex items-center space-x-4 p-4 ${THEME.bg} rounded`}>
          <img
            src={spotifyData.album_art || 'https://placehold.co/60x60/e2b714/323437?text=SP'}
            alt="Album Art"
            className="w-16 h-16 rounded"
          />
          <div className="flex-1 min-w-0">
            <h3 className={`${THEME.main} text-lg font-bold truncate`}>
              {(spotifyData.track || 'unknown track').toLowerCase()}
            </h3>
            <p className={`${THEME.sub} text-sm truncate`}>
              {(spotifyData.artist || 'unknown artist').toLowerCase()}
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div 
            className={`w-full ${THEME.bg} h-2 rounded-full overflow-hidden cursor-pointer hover:h-3 transition-all`}
            onClick={handleProgressBarClick}
            title="Click to seek"
          >
            <div
              className={`${THEME.mainBg} h-full transition-all pointer-events-none`}
              style={{ width: `${spotifyData.progress || 0}%` }}
            ></div>
          </div>
          <div className={`flex items-center justify-center space-x-6 ${THEME.text}`}>
            <SkipBack
              size={20}
              className={`cursor-pointer hover:${THEME.main} transition-colors`}
              onClick={handlePrevious}
            />
            <button
              onClick={handlePlayPause}
              className={`${THEME.main} hover:scale-110 transition-transform`}
            >
              {spotifyData.playing ? (
                <Pause size={32} fill="currentColor" />
              ) : (
                <Play size={32} fill="currentColor" />
              )}
            </button>
            <SkipForward
              size={20}
              className={`cursor-pointer hover:${THEME.main} transition-colors`}
              onClick={handleNext}
            />
          </div>

          {/* Volume Control */}
          <div className={`flex items-center space-x-3 p-3 ${THEME.bg} rounded`}>
            <Volume2 size={18} className={THEME.sub} />
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
              className="flex-1 h-1 bg-[#2a2d31] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#e2b714] [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#e2b714] [&::-moz-range-thumb]:border-0"
            />
            <span className={`${THEME.sub} text-xs w-8 text-right`}>{volume}%</span>
          </div>

          {/* Queue Dropdown */}
          {queue.length > 0 && (
            <div className={`${THEME.bg} rounded`}>
              <button
                onClick={() => setQueueExpanded(!queueExpanded)}
                className={`w-full flex items-center justify-between p-3 hover:opacity-80 transition-opacity`}
              >
                <h4 className={`${THEME.main} text-xs font-bold uppercase`}>
                  up next ({queue.length} songs)
                </h4>
                {queueExpanded ? (
                  <ChevronUp size={16} className={THEME.sub} />
                ) : (
                  <ChevronDown size={16} className={THEME.sub} />
                )}
              </button>
              
              {queueExpanded && (
                <div className="px-3 pb-3 space-y-2 max-h-64 overflow-y-auto">
                  {queue.map((item, idx) => (
                    <div key={idx} className={`flex items-center space-x-3 p-2 ${THEME.bgDarker} rounded hover:opacity-80 transition-opacity`}>
                      <span className={`${THEME.sub} text-xs w-4`}>{idx + 1}</span>
                      <img
                        src={item.album_art || 'https://placehold.co/40x40/2a2d31/646669?text=♪'}
                        alt={item.album || 'Album'}
                        className="w-10 h-10 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs ${THEME.text} font-medium truncate`}>
                          {item.name.toLowerCase()}
                        </p>
                        <p className={`text-xs ${THEME.sub} truncate`}>
                          {item.artist.toLowerCase()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
