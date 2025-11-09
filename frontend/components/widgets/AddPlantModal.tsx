import React, { useState, FormEvent } from 'react';
import { X, Upload, Sprout } from 'lucide-react';
import { THEME } from '@/lib/theme';
import { API_BASE_URL } from '@/lib/config';

interface AddPlantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlantAdded: () => void;
}

export const AddPlantModal: React.FC<AddPlantModalProps> = ({ isOpen, onClose, onPlantAdded }) => {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [wateringDays, setWateringDays] = useState('7');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/plants/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          species,
          watering_frequency_days: parseInt(wateringDays),
          image_url: imageUrl || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add plant');
      }

      // Reset form
      setName('');
      setSpecies('');
      setWateringDays('7');
      setImageUrl('');
      
      // Notify parent and close
      onPlantAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add plant');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`${THEME.cardBg} rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${THEME.border}`}>
          <div className="flex items-center space-x-2">
            <Sprout className={THEME.main} size={20} />
            <h2 className={`${THEME.text} font-medium`}>add new plant</h2>
          </div>
          <button
            onClick={onClose}
            className={`${THEME.sub} hover:${THEME.text} transition-colors`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className={`${THEME.errorBg} text-[#323437] px-3 py-2 rounded text-sm`}>
              {error}
            </div>
          )}

          {/* Name Field */}
          <div>
            <label className={`block text-sm ${THEME.sub} mb-1`}>
              plant name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g., Monstera Deliciosa"
              className={`w-full px-3 py-2 ${THEME.bg} ${THEME.text} rounded border ${THEME.border} focus:outline-none focus:border-[#00ff00] transition-colors`}
            />
          </div>

          {/* Species/Type Field */}
          <div>
            <label className={`block text-sm ${THEME.sub} mb-1`}>
              species/type *
            </label>
            <input
              type="text"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              required
              placeholder="e.g., Swiss Cheese Plant"
              className={`w-full px-3 py-2 ${THEME.bg} ${THEME.text} rounded border ${THEME.border} focus:outline-none focus:border-[#00ff00] transition-colors`}
            />
          </div>

          {/* Watering Frequency */}
          <div>
            <label className={`block text-sm ${THEME.sub} mb-1`}>
              watering frequency (days) *
            </label>
            <input
              type="number"
              value={wateringDays}
              onChange={(e) => setWateringDays(e.target.value)}
              required
              min="1"
              max="365"
              className={`w-full px-3 py-2 ${THEME.bg} ${THEME.text} rounded border ${THEME.border} focus:outline-none focus:border-[#00ff00] transition-colors`}
            />
          </div>

          {/* Image URL */}
          <div>
            <label className={`block text-sm ${THEME.sub} mb-1`}>
              image url (optional)
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/plant.jpg"
              className={`w-full px-3 py-2 ${THEME.bg} ${THEME.text} rounded border ${THEME.border} focus:outline-none focus:border-[#00ff00] transition-colors`}
            />
            <p className={`text-xs ${THEME.sub} mt-1 opacity-70`}>
              paste a direct image link (coming soon: ai plant detection)
            </p>
          </div>

          {/* Image Preview */}
          {imageUrl && (
            <div className="mt-2">
              <p className={`text-xs ${THEME.sub} mb-2`}>preview:</p>
              <div className={`${THEME.bg} rounded p-2 flex items-center justify-center`}>
                <img
                  src={imageUrl}
                  alt="Plant preview"
                  className="max-h-32 rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 px-4 py-2 ${THEME.bg} ${THEME.sub} rounded hover:${THEME.text} transition-colors`}
            >
              cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 px-4 py-2 bg-[#00ff00] text-[#1a1d21] rounded font-medium hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? 'adding...' : 'add plant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
