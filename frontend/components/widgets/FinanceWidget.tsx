import React, { useState, useEffect } from 'react';
import { CreditCard, Link2, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardContent } from '../Card';
import { THEME } from '@/lib/theme';
import { FinanceEntry } from '@/lib/types';

interface FinanceWidgetProps {
  isClient: boolean;
}

export const FinanceWidget: React.FC<FinanceWidgetProps> = ({
  isClient,
}) => {
  const LOCAL_API = "http://192.168.4.28:8000";
  const REMOTE_API = "https://todd-browser-troubleshooting-helmet.trycloudflare.com";
  const [apiUrl, setApiUrl] = useState<string>(LOCAL_API);
  const [connected, setConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [balance, setBalance] = useState<string>("£0.00");
  const [financeData, setFinanceData] = useState<FinanceEntry[]>([]);

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

  // Check Monzo connection status
  useEffect(() => {
    if (apiUrl) {
      checkMonzoStatus();
    }
  }, [apiUrl]);

  const checkMonzoStatus = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/monzo/status`);
      const data = await response.json();
      setConnected(data.connected);
      if (data.connected) {
        fetchMonzoData();
      }
    } catch (err) {
      console.error('Failed to check Monzo status:', err);
    }
  };

  const fetchMonzoData = async () => {
    setLoading(true);
    try {
      // Fetch balance chart (includes current balance)
      const chartResponse = await fetch(`${apiUrl}/api/monzo/balance-chart`);
      const chartData = await chartResponse.json();
      setBalance(`£${chartData.current_balance.toFixed(2)}`);
      setFinanceData(chartData.chart_data);
    } catch (err) {
      console.error('Failed to fetch Monzo data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    window.open(`${apiUrl}/api/monzo/auth`, '_blank');
    // Poll for connection status
    const pollInterval = setInterval(async () => {
      const response = await fetch(`${apiUrl}/api/monzo/status`);
      const data = await response.json();
      if (data.connected) {
        setConnected(true);
        fetchMonzoData();
        clearInterval(pollInterval);
      }
    }, 2000);
    // Stop polling after 2 minutes
    setTimeout(() => clearInterval(pollInterval), 120000);
  };

  if (!connected) {
    return (
      <Card>
        <CardHeader
          title="monzo"
          icon={CreditCard}
        />
        <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
          <Link2 className={`w-12 h-12 ${THEME.sub}`} />
          <p className={`${THEME.sub} text-sm text-center`}>
            Connect your Monzo account to view your balance and spending
          </p>
          <button
            onClick={handleConnect}
            className={`px-4 py-2 rounded font-semibold ${THEME.mainBg} ${THEME.bg} hover:opacity-80 transition-opacity`}
          >
            connect monzo
          </button>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader
        title="monzo"
        icon={CreditCard}
        rightElement={
          <div className="flex items-center gap-2">
            <span className={`${THEME.text} font-bold`}>{balance}</span>
            <button
              onClick={fetchMonzoData}
              disabled={loading}
              className={`${THEME.sub} hover:${THEME.main} transition-colors disabled:opacity-50`}
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        }
      />
      <CardContent>
        <div className="h-40">
          {isClient && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={financeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#323437" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#646669', fontFamily: 'monospace' }}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#2c2e31',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#d1d0c5',
                    fontFamily: 'monospace',
                  }}
                  itemStyle={{ color: '#e2b714' }}
                  formatter={(value: number) => [`£${value.toFixed(2)}`, 'balance']}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="#e2b714"
                  strokeWidth={2}
                  dot={{ fill: '#e2b714', r: 3 }}
                  activeDot={{ r: 5, fill: '#d1d0c5' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className={`mt-4 flex justify-between text-sm ${THEME.sub}`}>
          <span>balance over time</span>
          <span className={THEME.main}>7 days</span>
        </div>
      </CardContent>
    </Card>
  );
};
