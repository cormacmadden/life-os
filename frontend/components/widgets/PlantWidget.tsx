import React, { useEffect, useState } from 'react';
import { Sprout, Droplets, Plus, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../Card';
import { THEME } from '@/lib/theme';
import { Plant } from '@/lib/types';
import { API_BASE_URL } from '@/lib/config';
import { AddPlantModal } from './AddPlantModal';

export const PlantWidget = () => {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchPlants = () => {
    // Guard against server-side rendering
    if (typeof window === 'undefined') return;

    setLoading(true);
    fetch(`${API_BASE_URL}/api/plants`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPlants(data);
        } else {
          setPlants([]);
        }
      })
      .catch(err => console.error("Failed to fetch plants:", err))
      .finally(() => setLoading(false));
  };

  // Fetch on mount
  useEffect(() => {
    fetchPlants();
  }, []);

  const handlePlantAdded = () => {
    fetchPlants();
  };

  const handleDeletePlant = async (plantId: number) => {
    setDeletingId(plantId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/plants/${plantId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete plant');
      }
      
      fetchPlants();
    } catch (err) {
      console.error('Failed to delete plant:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // Simple helper to check if today > last_watered + frequency
  const needsWater = (plant: Plant) => {
    const last = new Date(plant.last_watered);
    const next = new Date(last);
    next.setDate(last.getDate() + plant.watering_frequency_days);
    return new Date() > next;
  };

  return (
    <>
      <Card>
        <CardHeader 
          title="flora" 
          icon={Sprout} 
          rightElement={
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setIsModalOpen(true)} 
                className={`${THEME.main} hover:opacity-80 transition-opacity text-xs flex items-center space-x-1`}
              >
                <Plus size={14} />
                <span>add</span>
              </button>
              <button 
                onClick={fetchPlants} 
                className={`${THEME.sub} hover:${THEME.main} transition-colors text-xs`}
              >
                refresh
              </button>
            </div>
          }
        />
        <CardContent className="space-y-2">
          {loading ? (
            <div className={`text-sm ${THEME.sub} p-2`}>scanning bio-data...</div>
          ) : plants.length === 0 ? (
             <div className={`text-sm ${THEME.sub} p-2`}>
               no flora detected. <button onClick={() => setIsModalOpen(true)} className={`${THEME.main} underline`}>add your first plant?</button>
             </div>
          ) : (
            plants.map(plant => {
              const thirsty = needsWater(plant);
              const isDeleting = deletingId === plant.id;
              return (
                <div key={plant.id} className={`flex items-center justify-between p-3 ${THEME.bg} rounded ${isDeleting ? 'opacity-50' : ''}`}>
                  <div className="flex items-center space-x-3">
                    {plant.image_url && (
                      <img 
                        src={plant.image_url} 
                        alt={plant.name}
                        className="w-10 h-10 rounded object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div>
                      <p className={`${THEME.text} font-medium leading-none`}>{plant.name.toLowerCase()}</p>
                      <p className={`text-xs ${THEME.sub} mt-1`}>{plant.species.toLowerCase()}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {thirsty ? (
                      <button className={`${THEME.errorBg} text-[#323437] px-2 py-1 rounded text-xs font-bold flex items-center space-x-1 hover:opacity-80 transition-opacity`}>
                        <Droplets size={12} /><span>WATER</span>
                      </button>
                    ) : (
                      <span className={`text-xs ${THEME.main} opacity-50`}>happy</span>
                    )}
                    <button
                      onClick={() => handleDeletePlant(plant.id)}
                      disabled={isDeleting}
                      className={`${THEME.sub} hover:${THEME.error} transition-colors p-1 disabled:opacity-50`}
                      title="Remove plant"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <AddPlantModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPlantAdded={handlePlantAdded}
      />
    </>
  );
};