import React, { useEffect, useState } from 'react';
import { Car as CarIcon, Wrench, AlertTriangle, Plus, X, Calendar, Gauge } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../Card';
import { THEME } from '@/lib/theme';

const LOCAL_API = "http://192.168.4.28:8000";
const REMOTE_API = "https://todd-browser-troubleshooting-helmet.trycloudflare.com";

interface Car {
  id?: number;
  name?: string;
  make?: string;
  model?: string;
  year?: number;
  current_mileage?: number;
  license_plate?: string;
  oil_change_interval_miles?: number;
  service_interval_miles?: number;
  last_oil_change_date?: string;
  last_oil_change_mileage?: number;
  last_service_date?: string;
  last_service_mileage?: number;
  mot_due_date?: string;
  tax_due_date?: string;
  
  // Calculated fields
  miles_until_oil_change?: number;
  oil_change_overdue?: boolean;
  miles_until_service?: number;
  service_overdue?: boolean;
  days_until_mot?: number;
  mot_due_soon?: boolean;
  mot_overdue?: boolean;
  days_until_tax?: number;
  tax_due_soon?: boolean;
  tax_overdue?: boolean;
}

interface MaintenanceRecord {
  id?: number;
  car_id: number;
  maintenance_date: string;
  mileage: number;
  type: string;
  description: string;
  cost?: number;
  notes?: string;
}

export const CarWidget: React.FC = () => {
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiUrl, setApiUrl] = useState<string>(LOCAL_API);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [showAddCar, setShowAddCar] = useState(false);
  const [lookupPlate, setLookupPlate] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [newCar, setNewCar] = useState<Partial<Car>>({
    year: new Date().getFullYear(),
    current_mileage: 0,
    oil_change_interval_miles: 5000,
    service_interval_miles: 10000,
  });
  const [newRecord, setNewRecord] = useState<Partial<MaintenanceRecord>>({
    type: 'oil_change',
    maintenance_date: new Date().toISOString().split('T')[0],
  });

  // Detect API URL
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

  const fetchCars = async () => {
    if (!apiUrl) return;
    
    try {
      const response = await fetch(`${apiUrl}/api/car/cars`);
      const data = await response.json();
      setCars(data);
      if (data.length > 0 && !selectedCar) {
        setSelectedCar(data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch cars:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiUrl) {
      fetchCars();
    }
  }, [apiUrl]);

  const handleLookupPlate = async () => {
    if (!lookupPlate.trim()) {
      alert('Please enter a license plate');
      return;
    }

    setLookingUp(true);
    try {
      const response = await fetch(`${apiUrl}/api/car/lookup/${lookupPlate}`);
      const data = await response.json();

      if (data.found) {
        setNewCar({
          ...newCar,
          make: data.make,
          model: data.model,
          year: data.year,
          license_plate: data.license_plate,
          mot_due_date: data.mot_expiry,
          tax_due_date: data.tax_due,
        });
        alert(`Found: ${data.year} ${data.make} ${data.model}`);
      } else {
        alert(data.message || 'Vehicle not found');
      }
    } catch (err) {
      console.error('Lookup failed:', err);
      alert('Failed to lookup vehicle');
    } finally {
      setLookingUp(false);
    }
  };

  const handleAddCar = async () => {
    if (!newCar.make || !newCar.model || !newCar.year || newCar.current_mileage === undefined) {
      alert('Please fill in required fields: make, model, year, mileage');
      return;
    }

    try {
      await fetch(`${apiUrl}/api/car/cars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCar),
      });

      setShowAddCar(false);
      setNewCar({
        year: new Date().getFullYear(),
        current_mileage: 0,
        oil_change_interval_miles: 5000,
        service_interval_miles: 10000,
      });
      setLookupPlate('');
      fetchCars();
    } catch (err) {
      console.error('Failed to add car:', err);
      alert('Failed to add car');
    }
  };

  const handleAddRecord = async () => {
    if (!selectedCar || !newRecord.mileage || !newRecord.description) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await fetch(`${apiUrl}/api/car/cars/${selectedCar.id}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newRecord,
          car_id: selectedCar.id,
        }),
      });

      setShowAddRecord(false);
      setNewRecord({
        type: 'oil_change',
        maintenance_date: new Date().toISOString().split('T')[0],
      });
      fetchCars(); // Refresh data
    } catch (err) {
      console.error('Failed to add record:', err);
      alert('Failed to add maintenance record');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader title="car maintenance" icon={CarIcon} />
        <CardContent>
          <div className={`${THEME.sub} text-sm`}>loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (cars.length === 0) {
    return (
      <Card>
        <CardHeader title="car maintenance" icon={CarIcon} />
        <CardContent>
          <div className={`${THEME.sub} text-sm`}>no cars added yet</div>
        </CardContent>
      </Card>
    );
  }

  const car = selectedCar || cars[0];

  return (
    <Card>
      <CardHeader 
        title="car maintenance" 
        icon={CarIcon}
        rightElement={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowAddCar(!showAddCar);
                setShowAddRecord(false);
              }}
              className={`${THEME.sub} hover:${THEME.main} transition-colors`}
              title="Add car"
            >
              <CarIcon size={16} />
            </button>
            <button
              onClick={() => {
                setShowAddRecord(!showAddRecord);
                setShowAddCar(false);
              }}
              className={`${THEME.sub} hover:${THEME.main} transition-colors`}
              title="Add maintenance"
            >
              {showAddRecord ? <X size={16} /> : <Plus size={16} />}
            </button>
          </div>
        }
      />
      <CardContent className="space-y-3">
        {/* Car Info */}
        <div className={`${THEME.bg} p-3 rounded`}>
          <div className={`${THEME.text} font-semibold`}>
            {car.name || `${car.year} ${car.make} ${car.model}`}
          </div>
          <div className={`${THEME.sub} text-xs flex items-center gap-2 mt-1`}>
            <Gauge size={12} />
            {(car.current_mileage || 0).toLocaleString()} miles
            {car.license_plate && <span>• {car.license_plate}</span>}
          </div>
        </div>

        {/* Add car form */}
        {showAddCar && (
          <div className={`${THEME.bg} p-3 rounded space-y-2`}>
            <div className={`${THEME.text} text-sm font-semibold mb-2`}>add car</div>
            
            {/* License plate lookup */}
            <div className={`space-y-2 mb-3 pb-3 border-b ${THEME.border}`}>
              <input
                type="text"
                placeholder="License plate (e.g., AB12CDE)"
                value={lookupPlate}
                onChange={(e) => setLookupPlate(e.target.value.toUpperCase())}
                className={`w-full px-2 py-1 rounded text-sm ${THEME.bg} ${THEME.text} border ${THEME.border}`}
              />
              <button
                onClick={handleLookupPlate}
                disabled={lookingUp || !lookupPlate.trim()}
                className={`w-full px-3 py-2 rounded text-sm font-semibold ${THEME.mainBg} ${THEME.bg} hover:opacity-80 transition-opacity disabled:opacity-50`}
              >
                {lookingUp ? 'looking up...' : 'look up vehicle'}
              </button>
            </div>

            {/* Car details form */}
            <input
              type="text"
              placeholder="Name (e.g., My Car)"
              value={newCar.name || ''}
              onChange={(e) => setNewCar({ ...newCar, name: e.target.value })}
              className={`w-full px-2 py-1 rounded text-sm ${THEME.bg} ${THEME.text} border ${THEME.border}`}
            />

            <input
              type="text"
              placeholder="Make *"
              value={newCar.make || ''}
              onChange={(e) => setNewCar({ ...newCar, make: e.target.value })}
              className={`w-full px-2 py-1 rounded text-sm ${THEME.bg} ${THEME.text} border ${THEME.border}`}
            />

            <input
              type="text"
              placeholder="Model *"
              value={newCar.model || ''}
              onChange={(e) => setNewCar({ ...newCar, model: e.target.value })}
              className={`w-full px-2 py-1 rounded text-sm ${THEME.bg} ${THEME.text} border ${THEME.border}`}
            />

            <input
              type="number"
              placeholder="Year *"
              value={newCar.year || ''}
              onChange={(e) => setNewCar({ ...newCar, year: parseInt(e.target.value) })}
              className={`w-full px-2 py-1 rounded text-sm ${THEME.bg} ${THEME.text} border ${THEME.border}`}
            />

            <input
              type="number"
              placeholder="Current mileage *"
              value={newCar.current_mileage || ''}
              onChange={(e) => setNewCar({ ...newCar, current_mileage: parseInt(e.target.value) })}
              className={`w-full px-2 py-1 rounded text-sm ${THEME.bg} ${THEME.text} border ${THEME.border}`}
            />

            <input
              type="text"
              placeholder="License plate"
              value={newCar.license_plate || ''}
              onChange={(e) => setNewCar({ ...newCar, license_plate: e.target.value.toUpperCase() })}
              className={`w-full px-2 py-1 rounded text-sm ${THEME.bg} ${THEME.text} border ${THEME.border}`}
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Oil change interval (miles)"
                value={newCar.oil_change_interval_miles || 5000}
                onChange={(e) => setNewCar({ ...newCar, oil_change_interval_miles: parseInt(e.target.value) })}
                className={`w-full px-2 py-1 rounded text-sm ${THEME.bg} ${THEME.text} border ${THEME.border}`}
              />
              <input
                type="number"
                placeholder="Service interval (miles)"
                value={newCar.service_interval_miles || 10000}
                onChange={(e) => setNewCar({ ...newCar, service_interval_miles: parseInt(e.target.value) })}
                className={`w-full px-2 py-1 rounded text-sm ${THEME.bg} ${THEME.text} border ${THEME.border}`}
              />
            </div>

            <button
              onClick={handleAddCar}
              className={`w-full px-3 py-2 rounded text-sm font-semibold ${THEME.mainBg} ${THEME.bg} hover:opacity-80 transition-opacity`}
            >
              add car
            </button>
          </div>
        )}

        {/* Add maintenance record form */}
        {showAddRecord && (
          <div className={`${THEME.bg} p-3 rounded space-y-2`}>
            <div className={`${THEME.text} text-sm font-semibold mb-2`}>add maintenance</div>
            
            <select
              value={newRecord.type}
              onChange={(e) => setNewRecord({ ...newRecord, type: e.target.value })}
              className={`w-full px-2 py-1 rounded text-sm ${THEME.bg} ${THEME.text} border ${THEME.border}`}
            >
              <option value="oil_change">Oil Change</option>
              <option value="service">Full Service</option>
              <option value="mot">MOT</option>
              <option value="tires">Tires</option>
              <option value="repair">Repair</option>
              <option value="other">Other</option>
            </select>

            <input
              type="date"
              value={newRecord.maintenance_date}
              onChange={(e) => setNewRecord({ ...newRecord, maintenance_date: e.target.value })}
              className={`w-full px-2 py-1 rounded text-sm ${THEME.bg} ${THEME.text} border ${THEME.border}`}
            />

            <input
              type="number"
              placeholder="Mileage"
              value={newRecord.mileage || ''}
              onChange={(e) => setNewRecord({ ...newRecord, mileage: parseInt(e.target.value) })}
              className={`w-full px-2 py-1 rounded text-sm ${THEME.bg} ${THEME.text} border ${THEME.border}`}
            />

            <input
              type="text"
              placeholder="Description"
              value={newRecord.description || ''}
              onChange={(e) => setNewRecord({ ...newRecord, description: e.target.value })}
              className={`w-full px-2 py-1 rounded text-sm ${THEME.bg} ${THEME.text} border ${THEME.border}`}
            />

            <input
              type="number"
              step="0.01"
              placeholder="Cost (£, optional)"
              value={newRecord.cost || ''}
              onChange={(e) => setNewRecord({ ...newRecord, cost: parseFloat(e.target.value) })}
              className={`w-full px-2 py-1 rounded text-sm ${THEME.bg} ${THEME.text} border ${THEME.border}`}
            />

            <button
              onClick={handleAddRecord}
              className={`w-full px-3 py-2 rounded text-sm font-semibold ${THEME.mainBg} ${THEME.bg} hover:opacity-80 transition-opacity`}
            >
              add record
            </button>
          </div>
        )}

        {/* Alerts */}
        <div className="space-y-2">
          {/* Oil Change Alert */}
          {car.miles_until_oil_change !== null && car.miles_until_oil_change !== undefined && (
            <div className={`flex items-center gap-2 p-2 rounded ${
              car.oil_change_overdue ? 'bg-red-900/20' : 
              car.miles_until_oil_change < 500 ? 'bg-yellow-900/20' : THEME.bg
            }`}>
              <Wrench size={14} className={
                car.oil_change_overdue ? 'text-red-400' :
                car.miles_until_oil_change < 500 ? 'text-yellow-400' : THEME.sub
              } />
              <div className="flex-1">
                <div className={`text-xs ${THEME.text}`}>
                  {car.oil_change_overdue ? 'oil change overdue!' : 'oil change'}
                </div>
                <div className={`text-xs ${THEME.sub}`}>
                  {car.oil_change_overdue ? 
                    `${Math.abs(car.miles_until_oil_change)} miles overdue` :
                    `${car.miles_until_oil_change} miles remaining`
                  }
                </div>
              </div>
            </div>
          )}

          {/* Service Alert */}
          {car.miles_until_service !== null && car.miles_until_service !== undefined && (
            <div className={`flex items-center gap-2 p-2 rounded ${
              car.service_overdue ? 'bg-red-900/20' : 
              car.miles_until_service < 1000 ? 'bg-yellow-900/20' : THEME.bg
            }`}>
              <Wrench size={14} className={
                car.service_overdue ? 'text-red-400' :
                car.miles_until_service < 1000 ? 'text-yellow-400' : THEME.sub
              } />
              <div className="flex-1">
                <div className={`text-xs ${THEME.text}`}>
                  {car.service_overdue ? 'service overdue!' : 'full service'}
                </div>
                <div className={`text-xs ${THEME.sub}`}>
                  {car.service_overdue ? 
                    `${Math.abs(car.miles_until_service)} miles overdue` :
                    `${car.miles_until_service} miles remaining`
                  }
                </div>
              </div>
            </div>
          )}

          {/* MOT Alert */}
          {car.days_until_mot !== null && car.days_until_mot !== undefined && (
            <div className={`flex items-center gap-2 p-2 rounded ${
              car.mot_overdue ? 'bg-red-900/20' : 
              car.mot_due_soon ? 'bg-yellow-900/20' : THEME.bg
            }`}>
              <Calendar size={14} className={
                car.mot_overdue ? 'text-red-400' :
                car.mot_due_soon ? 'text-yellow-400' : THEME.sub
              } />
              <div className="flex-1">
                <div className={`text-xs ${THEME.text}`}>
                  {car.mot_overdue ? 'MOT expired!' : 'MOT'}
                </div>
                <div className={`text-xs ${THEME.sub}`}>
                  {car.mot_overdue ? 
                    `expired ${Math.abs(car.days_until_mot)} days ago` :
                    `${car.days_until_mot} days remaining`
                  }
                </div>
              </div>
            </div>
          )}

          {/* Tax Alert */}
          {car.days_until_tax !== null && car.days_until_tax !== undefined && (
            <div className={`flex items-center gap-2 p-2 rounded ${
              car.tax_overdue ? 'bg-red-900/20' : 
              car.tax_due_soon ? 'bg-yellow-900/20' : THEME.bg
            }`}>
              <AlertTriangle size={14} className={
                car.tax_overdue ? 'text-red-400' :
                car.tax_due_soon ? 'text-yellow-400' : THEME.sub
              } />
              <div className="flex-1">
                <div className={`text-xs ${THEME.text}`}>
                  {car.tax_overdue ? 'tax expired!' : 'road tax'}
                </div>
                <div className={`text-xs ${THEME.sub}`}>
                  {car.tax_overdue ? 
                    `expired ${Math.abs(car.days_until_tax)} days ago` :
                    `${car.days_until_tax} days remaining`
                  }
                </div>
              </div>
            </div>
          )}
        </div>

        {/* All Good Message */}
        {!car.oil_change_overdue && !car.service_overdue && !car.mot_overdue && 
         !car.tax_overdue && (car.miles_until_oil_change || 0) > 500 && 
         (car.miles_until_service || 0) > 1000 && !car.mot_due_soon && !car.tax_due_soon && (
          <div className={`${THEME.bg} p-2 rounded text-center`}>
            <div className={`text-xs ${THEME.sub}`}>✓ all maintenance up to date</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
