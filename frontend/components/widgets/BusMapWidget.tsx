"use client";

import React, { useEffect, useState, useRef } from 'react';
import { MapPin, Navigation, Bus as BusIcon, Home, RefreshCw } from 'lucide-react';
import { THEME } from '@/lib/theme';

interface BusStop {
  atco_code: string;
  name: string;
  latitude: number;
  longitude: number;
  indicator: string;
  locality: string;
  type: 'morning' | 'evening';
}

interface BusLocation {
  service_id: string;
  route: string;
  latitude: number;
  longitude: number;
  bearing?: number;
  destination: string;
  last_updated: string;
}

interface BusMapWidgetProps {
  apiUrl: string;
}

interface BusMapWidgetHandle {
  refresh: () => void;
  showRoute: (routeName: string) => void;
  showBusLocation: (routeName: string, destination?: string) => void;
}

interface BusRoute {
  route: string;
  operator: string;
  geometries: any[];
  description: string;
}

export const BusMapWidget = React.forwardRef<BusMapWidgetHandle, BusMapWidgetProps>(({ apiUrl }, ref) => {
  const [stops, setStops] = useState<BusStop[]>([]);
  const [busLocations, setBusLocations] = useState<BusLocation[]>([]);
  const [busRoutes, setBusRoutes] = useState<{ [key: string]: [number, number][] }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [homeLocation, setHomeLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [workLocation, setWorkLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeLinesRef = useRef<any[]>([]);

  // Load Leaflet dynamically (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Load Leaflet CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      // Load Leaflet JS
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setMapLoaded(true);
      document.head.appendChild(script);

      return () => {
        document.head.removeChild(link);
        document.head.removeChild(script);
      };
    }
  }, []);

  // Fetch user config for locations
  const fetchUserConfig = async () => {
    if (!apiUrl) return;
    
    try {
      const response = await fetch(`${apiUrl}/api/user/config`);
      if (response.ok) {
        const config = await response.json();
        if (config.home_latitude && config.home_longitude) {
          setHomeLocation({ lat: config.home_latitude, lng: config.home_longitude });
        }
        if (config.work_latitude && config.work_longitude) {
          setWorkLocation({ lat: config.work_latitude, lng: config.work_longitude });
        }
      }
    } catch (error) {
      console.error('Error fetching user config:', error);
      // Silently fail - map will just not show home/work markers
    }
  };

  // Fetch bus routes geometry from TransportAPI
  const fetchBusRoutes = async () => {
    if (!apiUrl) return;
    
    try {
      const response = await fetch(`${apiUrl}/api/bus/routes`);
      if (response.ok) {
        const data = await response.json();
        const routesMap: { [key: string]: [number, number][] } = {};
        
        data.routes?.forEach((route: any) => {
          // Handle both formats: GeoJSON geometries (from API) and simple coordinates (fallback)
          if (route.geometries) {
            // Real TransportAPI data with GeoJSON
            const allCoords: [number, number][] = [];
            route.geometries.forEach((geom: any) => {
              if (geom.type === 'LineString' && geom.coordinates) {
                // GeoJSON uses [lon, lat] but Leaflet uses [lat, lon]
                geom.coordinates.forEach((coord: [number, number]) => {
                  allCoords.push([coord[1], coord[0]]);
                });
              }
            });
            if (allCoords.length > 0) {
              routesMap[route.route] = allCoords;
            }
          } else if (route.coordinates) {
            // Fallback approximate route (already in [lat, lon] format)
            routesMap[route.route] = route.coordinates as [number, number][];
          }
        });
        
        setBusRoutes(routesMap);
        console.log(`Loaded ${Object.keys(routesMap).length} bus routes (source: ${data.source || 'unknown'})`);
      }
    } catch (error) {
      console.error('Error fetching bus routes:', error);
    }
  };

  // Fetch bus stops and locations
  const fetchData = async (force: boolean = false) => {
    setIsLoading(true);
    try {
      const [stopsRes, locationsRes] = await Promise.all([
        fetch(`${apiUrl}/api/bus/stops`),
        fetch(`${apiUrl}/api/bus/locations${force ? '?force=true' : ''}`)
      ]);

      if (stopsRes.ok) {
        const stopsData = await stopsRes.json();
        if (stopsData.stops.length === 0) {
          
          // Handle case when no stops are returned
        }
        setStops(stopsData.stops || []);
      }

      if (locationsRes.ok) {
        const locationsData = await locationsRes.json();
        setBusLocations(locationsData.locations || []);
      }
    } catch (error) {
      console.error('Error fetching bus data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Expose refresh, showRoute, and showBusLocation functions to parent via ref
  React.useImperativeHandle(ref, () => ({
    refresh: async () => {
      await fetchData(true); // Force fresh data on manual refresh
      await fetchBusRoutes(); // Also refresh routes when user explicitly refreshes
    },
    showRoute: (routeName: string) => {
      const map = mapInstanceRef.current;
      const L = (window as any).L;
      
      if (!map || !L) {
        console.log(`Map not loaded yet`);
        return;
      }
      
      const routeUpper = routeName.toUpperCase();
      const routeCoords = busRoutes[routeUpper];
      
      if (!routeCoords || routeCoords.length === 0) {
        console.log(`Route ${routeName} not found in busRoutes:`, Object.keys(busRoutes));
        return;
      }
      
      // Clear any existing route lines
      routeLinesRef.current.forEach(line => line.remove());
      routeLinesRef.current = [];
      
      // Show the specific route
      const routeColor = routeUpper === 'U1' ? '#3b82f6' : routeUpper === 'U2' ? '#8b5cf6' : '#ef4444';
      
      const routeLine = L.polyline(routeCoords, {
        color: routeColor,
        weight: 5,
        opacity: 0.8,
        smoothFactor: 1
      }).addTo(map);
      
      routeLinesRef.current.push(routeLine);
      
      // Fit map to show the route
      map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
      
      console.log(`Showing route ${routeName} with ${routeCoords.length} points`);
    },
    showBusLocation: (routeName: string, destination?: string) => {
      const map = mapInstanceRef.current;
      const L = (window as any).L;
      
      if (!map || !L) {
        console.log(`Map not loaded yet, will retry...`);
        // Retry with exponential backoff up to 5 times (500ms, 1s, 2s, 4s, 8s)
        let attempts = 0;
        const maxAttempts = 5;
        
        const attemptShow = () => {
          attempts++;
          const delay = Math.min(500 * Math.pow(2, attempts - 1), 8000);
          
          setTimeout(() => {
            if (mapInstanceRef.current && (window as any).L) {
              // Map is now ready, call this function again
              console.log(`Map ready after ${attempts} attempts, showing bus`);
              const handle = ref as any;
              if (handle?.current?.showBusLocation) {
                handle.current.showBusLocation(routeName, destination);
              }
            } else if (attempts < maxAttempts) {
              console.log(`Map not ready, attempt ${attempts}/${maxAttempts}, retrying in ${delay}ms...`);
              attemptShow();
            } else {
              console.log(`Map still not ready after ${maxAttempts} attempts, giving up`);
            }
          }, delay);
        };
        
        attemptShow();
        return;
      }
      
      const routeUpper = routeName.toUpperCase();
      
      // Find bus(es) matching this route and optionally destination
      const matchingBuses = busLocations.filter(bus => {
        const routeMatch = bus.route.toUpperCase() === routeUpper;
        if (destination) {
          return routeMatch && bus.destination.toLowerCase().includes(destination.toLowerCase());
        }
        return routeMatch;
      });
      
      if (matchingBuses.length === 0) {
        console.log(`No live bus location found for route ${routeName}`);
        console.log(`Available routes in busRoutes:`, Object.keys(busRoutes));
        console.log(`Looking for route: ${routeUpper}`);
        
        // Fall back to showing just the route if no live location
        const routeCoords = busRoutes[routeUpper];
        if (routeCoords && routeCoords.length > 0) {
          console.log(`Found ${routeCoords.length} coordinates for route ${routeUpper}, showing on map`);
          routeLinesRef.current.forEach(line => line.remove());
          routeLinesRef.current = [];
          
          const routeColor = routeUpper === 'U1' ? '#3b82f6' : routeUpper === 'U2' ? '#8b5cf6' : '#ef4444';
          const routeLine = L.polyline(routeCoords, {
            color: routeColor,
            weight: 5,
            opacity: 0.8,
            smoothFactor: 1
          }).addTo(map);
          routeLinesRef.current.push(routeLine);
          map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
        } else {
          console.log(`No route coordinates found for ${routeUpper}`);
        }
        return;
      }
      
      // Use the first matching bus
      const bus = matchingBuses[0];
      
      // Show the route first
      const routeCoords = busRoutes[routeUpper];
      if (routeCoords && routeCoords.length > 0) {
        routeLinesRef.current.forEach(line => line.remove());
        routeLinesRef.current = [];
        
        const routeColor = routeUpper === 'U1' ? '#3b82f6' : routeUpper === 'U2' ? '#8b5cf6' : '#ef4444';
        const routeLine = L.polyline(routeCoords, {
          color: routeColor,
          weight: 5,
          opacity: 0.8,
          smoothFactor: 1
        }).addTo(map);
        routeLinesRef.current.push(routeLine);
      }
      
      // Zoom to the bus location with animation
      map.setView([bus.latitude, bus.longitude], 15, {
        animate: true,
        duration: 0.5
      });
      
      // Find and pulse the bus marker
      map.eachLayer((layer: any) => {
        if (layer.options && layer.options.busMarker && 
            layer.options.route === routeUpper) {
          // Open popup to highlight it
          if (layer.getPopup()) {
            layer.openPopup();
          }
        }
      });
      
      console.log(`Showing bus ${routeName} at [${bus.latitude}, ${bus.longitude}]`);
    }
  }));

  useEffect(() => {
    if (apiUrl) {
      // Load config and stops on mount - these are just metadata and don't hit TransportAPI
      const initializeMap = async () => {
        await fetchUserConfig(); // Get home/work locations
        
        // Fetch stops (just metadata, doesn't call TransportAPI)
        try {
          const stopsRes = await fetch(`${apiUrl}/api/bus/stops`);
          if (stopsRes.ok) {
            const stopsData = await stopsRes.json();
            setStops(stopsData.stops || []);
          }
        } catch (error) {
          console.error('Error fetching bus stops:', error);
        }
        
        // Fetch routes with fake/cached data (no TransportAPI call)
        await fetchBusRoutes();
        
        setIsLoading(false);
      };
      
      initializeMap();
      // Note: fetchData() is NOT called here - real bus locations only load on manual refresh
    }
  }, [apiUrl]);

  // Initialize map when Leaflet is loaded
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapInstanceRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Define key points: Leamington Spa and Warwick University
    const leamingtonSpa = { lat: 52.2892, lng: -1.5373 }; // Leamington Rail Station
    const warwickUni = { lat: 52.3809, lng: -1.5617 }; // University of Warwick

    // Create bounds from these two points
    const bounds = L.latLngBounds(
      [leamingtonSpa.lat, leamingtonSpa.lng],
      [warwickUni.lat, warwickUni.lng]
    );

    // Initialize map and fit to bounds with padding
    const map = L.map(mapRef.current, {
      attributionControl: false,  // Remove attribution
      zoomControl: false  // Remove zoom controls (+/- buttons)
    }).fitBounds(bounds, { padding: [30, 30] });

    // Add OpenStreetMap tiles with dark theme
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapLoaded]);

  // Update markers when data changes
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;

    const L = (window as any).L;
    if (!L) return;

    // Clear existing markers and route lines
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    routeLinesRef.current.forEach(line => line.remove());
    routeLinesRef.current = [];

    // Add home location marker if provided
    if (homeLocation) {
      const homeIcon = L.divIcon({
        html: `<div style="display: flex; align-items: center; justify-content: center;">
          <div style="font-size: 28px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">🏠</div>
        </div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 28]
      });

      const homeMarker = L.marker([homeLocation.lat, homeLocation.lng], { icon: homeIcon })
        .bindPopup('<b style="color: #e2b714;">🏠 Home</b>')
        .addTo(mapInstanceRef.current);
      markersRef.current.push(homeMarker);
    }

    // Add work location marker if provided
    if (workLocation) {
      const officeIcon = L.divIcon({
        html: `<div style="display: flex; align-items: center; justify-content: center;">
          <div style="font-size: 28px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">🏢</div>
        </div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 28]
      });

      const officeMarker = L.marker([workLocation.lat, workLocation.lng], { icon: officeIcon })
        .bindPopup('<b style="color: #3b82f6;">🏢 Work</b>')
        .addTo(mapInstanceRef.current);
      markersRef.current.push(officeMarker);
    }

    // Add bus stop markers with flag icons
    stops.forEach(stop => {
      const stopIcon = L.divIcon({
        html: `<div style="font-size: 24px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));">🚩</div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [4, 24]
      });

      const marker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon })
        .bindPopup(`
          <div style="color: #e5e7eb;">
            <b style="color: #f87171;">🚩 ${stop.name}</b><br/>
            <small>${stop.locality}</small><br/>
            <small style="color: #4ade80; margin-top: 4px; display: block;">Click to show bus routes</small>
          </div>
        `)
        .addTo(mapInstanceRef.current);
      
      // Add click handler to show all bus routes passing through this stop
      marker.on('click', () => {
        // Clear any existing route lines
        routeLinesRef.current.forEach(line => line.remove());
        routeLinesRef.current = [];

        // Show all configured bus routes (U1, U2, 11)
        Object.entries(busRoutes).forEach(([route, coords]) => {
          const routeColor = route === 'U1' ? '#3b82f6' : route === 'U2' ? '#8b5cf6' : '#ef4444';
          
          const routeLine = L.polyline(coords, {
            color: routeColor,
            weight: 4,
            opacity: 0.7,
            smoothFactor: 1
          }).addTo(mapInstanceRef.current);

          routeLinesRef.current.push(routeLine);
        });
      });
      
      markersRef.current.push(marker);
    });

    // Add bus location markers
    busLocations.forEach(bus => {
      const busIcon = L.divIcon({
        html: `<div style="background: #e2b714; border-radius: 6px; padding: 6px 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px solid #323437; font-weight: bold; color: #323437; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
          <div style="font-size: 11px; line-height: 1; margin-bottom: 2px;">🚌</div>
          <div style="font-size: 10px; line-height: 1; font-weight: 900;">${bus.route}</div>
        </div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([bus.latitude, bus.longitude], { 
        icon: busIcon,
        busMarker: true,  // Custom flag to identify bus markers
        route: bus.route.toUpperCase()  // Store route for filtering
      })
        .bindPopup(`
          <div style="color: #e5e7eb;">
            <b style="color: #e2b714;">Bus ${bus.route}</b><br/>
            <small>To: ${bus.destination}</small><br/>
            <small style="color: #9ca3af;">Updated: ${new Date(bus.last_updated).toLocaleTimeString()}</small><br/>
            <small style="color: #4ade80; margin-top: 4px; display: block;">Click bus to show route</small>
          </div>
        `)
        .addTo(mapInstanceRef.current);

      // Add click handler to show/hide route
      marker.on('click', () => {
        // Clear any existing route lines
        routeLinesRef.current.forEach(line => line.remove());
        routeLinesRef.current = [];

        // Check if this bus route exists in our definitions
        if (busRoutes[bus.route]) {
          const routeColor = bus.route === 'U1' ? '#3b82f6' : bus.route === 'U2' ? '#8b5cf6' : '#ef4444';
          
          // Draw the route line
          const routeLine = L.polyline(busRoutes[bus.route], {
            color: routeColor,
            weight: 4,
            opacity: 0.7,
            smoothFactor: 1
          }).addTo(mapInstanceRef.current);

          routeLinesRef.current.push(routeLine);

          // Optional: Fit map to show the full route
          // mapInstanceRef.current.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
        }
      });

      markersRef.current.push(marker);
    });
  }, [stops, busLocations, homeLocation, workLocation, mapLoaded]);

  return (
    <div className={`${THEME.bg} rounded-lg p-4 h-[600px] relative`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <MapPin size={18} className={THEME.main} />
          <h3 className={`${THEME.text} font-medium text-sm`}>Bus Tracker</h3>
          <span className={`text-xs ${THEME.sub}`}>
            ({stops.length} stops, {busLocations.length} buses)
          </span>
        </div>
        <button
          onClick={() => fetchData()}
          disabled={isLoading}
          className={`p-1 rounded ${THEME.bgDarker} ${THEME.sub} hover:${THEME.main} transition-colors ${isLoading ? 'animate-spin' : ''}`}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {!mapLoaded ? (
        <div className={`h-[calc(100%-40px)] flex items-center justify-center ${THEME.bgDarker} rounded`}>
          <p className={`${THEME.sub} text-sm`}>Loading map...</p>
        </div>
      ) : (
        <div ref={mapRef} className="h-[calc(100%-40px)] rounded overflow-hidden" style={{ zIndex: 1 }} />
      )}



      {stops.length > 0 && (
        <div className={`absolute bottom-6 right-6 ${THEME.bgDarker} rounded px-2 py-1 text-xs flex items-center space-x-3`}>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <span className={THEME.sub}>Morning</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <span className={THEME.sub}>Evening</span>
          </div>
        </div>
      )}
    </div>
  );
});

BusMapWidget.displayName = 'BusMapWidget';

export type { BusMapWidgetHandle };
