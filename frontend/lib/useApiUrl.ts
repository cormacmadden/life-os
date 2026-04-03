import { useState, useEffect } from 'react';
import { getApiUrl, resetApiUrlDetection } from './config';

/**
 * React hook that provides the detected API URL
 * Automatically detects local vs remote on mount
 */
export function useApiUrl() {
  const [apiUrl, setApiUrl] = useState<string>('');
  const [isDetecting, setIsDetecting] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function detect() {
      const url = await getApiUrl();
      if (mounted) {
        setApiUrl(url);
        setIsDetecting(false);
      }
    }

    detect();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    apiUrl,
    isDetecting,
    resetDetection: () => {
      resetApiUrlDetection();
      setIsDetecting(true);
      getApiUrl().then(url => {
        setApiUrl(url);
        setIsDetecting(false);
      });
    },
  };
}
