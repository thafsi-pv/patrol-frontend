import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export function WhatsAppConfigPage() {
  const [status, setStatus] = useState<{ connected: boolean; registered: boolean } | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const { data } = await apiClient.get('/whatsapp/status');
      setStatus(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to fetch WhatsApp status');
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3500);
    return () => clearInterval(interval);
  }, []);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setPairingCode(null);
    try {
      const cleanNum = phoneNumber.replace(/\D/g, '');
      if (!cleanNum) {
        setError('Please enter a valid phone number containing digits.');
        setLoading(false);
        return;
      }
      const { data } = await apiClient.post('/whatsapp/pair', { phoneNumber: cleanNum });
      setPairingCode(data.code);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to get pairing code');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to disconnect current WhatsApp device?')) return;
    setError(null);
    setLoading(true);
    try {
      await apiClient.post('/whatsapp/logout');
      setPairingCode(null);
      setPhoneNumber('');
      await fetchStatus();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to logout WhatsApp session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">WhatsApp Integration</h1>
        <p className="text-gray-500 mt-1">
          Link a WhatsApp account to automatically broadcast incident reports directly to admin mobile numbers.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {status && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-400">Connection Status</span>
            {status.connected ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Connected ✓
              </span>
            ) : status.registered ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                Connecting...
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                Disconnected
              </span>
            )}
          </div>

          {status.connected ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-300">
                WhatsApp bot is online. All incident logs of status <strong>Issue Found</strong> or <strong>Emergency</strong> will be instantly messaged to configured admins.
              </p>
              <button
                onClick={handleLogout}
                disabled={loading}
                className="btn-danger w-full py-3"
              >
                {loading ? 'Disconnecting...' : 'Disconnect WhatsApp Device'}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {!pairingCode ? (
                <form onSubmit={handlePair} className="space-y-4">
                  <div>
                    <label className="label">WhatsApp Number *</label>
                    <input
                      type="tel"
                      className="input"
                      required
                      placeholder="e.g. 919876543210 (digits only with country code)"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      Do not include "+", "()", "-" or spaces. Example: Indian country code (91) + number.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full py-3"
                  >
                    {loading ? 'Requesting Code...' : 'Get Pairing Code'}
                  </button>
                </form>
              ) : (
                <div className="space-y-5 bg-surface-900/40 p-5 rounded-2xl border border-white/5 text-center">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Pairing Code</p>
                    <p className="text-3xl font-mono font-bold text-brand-400 tracking-widest">{pairingCode}</p>
                  </div>
                  
                  <div className="text-left text-xs text-gray-300 space-y-2 border-t border-white/5 pt-4">
                    <p className="font-bold text-white mb-1">How to Link on WhatsApp:</p>
                    <p>1. Open WhatsApp on your phone.</p>
                    <p>2. Tap <strong>Settings</strong> or <strong>Menu</strong> (⋮) &gt; <strong>Linked Devices</strong>.</p>
                    <p>3. Tap <strong>Link a Device</strong>.</p>
                    <p>4. Select <strong>Link with phone number instead</strong> at the bottom.</p>
                    <p>5. Enter the 8-digit code shown above.</p>
                  </div>

                  <button
                    onClick={() => setPairingCode(null)}
                    className="btn-secondary w-full py-2.5 text-xs mt-2"
                  >
                    Cancel / Use Different Number
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
