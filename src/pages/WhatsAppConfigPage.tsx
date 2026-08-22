import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient } from '../api/client';

type LinkMode = 'qr' | 'code';

export function WhatsAppConfigPage() {
  const [status, setStatus] = useState<{
    connected: boolean;
    registered: boolean;
    failedPermanently: boolean;
    phoneNumber: string | null;
    accountName: string | null;
  } | null>(null);
  const [linkMode, setLinkMode] = useState<LinkMode>('qr');
  const [qrData, setQrData] = useState<string | null>(null);
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

  const fetchQr = async () => {
    try {
      const { data } = await apiClient.get('/whatsapp/qr');
      setQrData(data.qr || null);
    } catch {
      // silently ignore
    }
  };

  // Poll status every 3.5s
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3500);
    return () => clearInterval(interval);
  }, []);

  // Poll QR every 2s when in QR mode and not connected
  useEffect(() => {
    if (linkMode !== 'qr' || status?.connected) return;
    fetchQr();
    const interval = setInterval(fetchQr, 2000);
    return () => clearInterval(interval);
  }, [linkMode, status?.connected]);

  // Clear QR data when switching away from QR mode
  useEffect(() => {
    if (linkMode !== 'qr') setQrData(null);
  }, [linkMode]);

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
      setQrData(null);
      await fetchStatus();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to logout WhatsApp session');
    } finally {
      setLoading(false);
    }
  };

  const handleReconnect = async () => {
    setError(null);
    setLoading(true);
    try {
      await apiClient.post('/whatsapp/connect');
      setPairingCode(null);
      setQrData(null);
      await fetchStatus();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to reconnect WhatsApp');
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
          {/* Status badge */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-400">Connection Status</span>
            {status.connected ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Connected ✓
              </span>
            ) : status.failedPermanently ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                Failed — Reconnect Required
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

          {/* Permanent failure */}
          {status.failedPermanently ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-sm font-semibold text-red-400 mb-1">⚠️ Connection Failed Permanently</p>
                <p className="text-xs text-gray-400">
                  WhatsApp could not connect after <strong>3 automatic retries</strong>. The session has been cleared.
                  Use the button below to start a fresh connection.
                </p>
              </div>
              <button onClick={handleReconnect} disabled={loading} className="btn-primary w-full py-3">
                {loading ? 'Reconnecting...' : '🔄 Reconnect WhatsApp'}
              </button>
            </div>

          /* Connected */
          ) : status.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M11.966 0C5.349 0 0 5.349 0 11.966c0 2.09.546 4.049 1.499 5.748L.055 23.945l6.394-1.677A11.919 11.919 0 0011.966 24c6.617 0 11.966-5.349 11.966-11.966C23.932 5.349 18.583 0 11.966 0z"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-emerald-400">{status.accountName || 'WhatsApp Account'}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    {status.phoneNumber ? `+${status.phoneNumber}` : 'Number not available'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-300">
                WhatsApp bot is online. All incident logs of status <strong>Issue Found</strong> or <strong>Emergency</strong> will be instantly messaged to configured admins.
              </p>
              <button onClick={handleLogout} disabled={loading} className="btn-danger w-full py-3">
                {loading ? 'Disconnecting...' : 'Disconnect WhatsApp Device'}
              </button>
            </div>

          /* Not connected — show link options */
          ) : (
            <div className="space-y-5">
              {/* Mode toggle */}
              <div className="flex rounded-xl overflow-hidden border border-white/10 bg-surface-900/40 p-1 gap-1">
                <button
                  id="tab-qr-code"
                  onClick={() => { setLinkMode('qr'); setPairingCode(null); setError(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    linkMode === 'qr'
                      ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5V15M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6z" />
                  </svg>
                  QR Code
                </button>
                <button
                  id="tab-phone-number"
                  onClick={() => { setLinkMode('code'); setQrData(null); setError(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    linkMode === 'code'
                      ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Phone Number
                </button>
              </div>

              {/* QR Code panel */}
              {linkMode === 'qr' && (
                <div className="flex flex-col items-center space-y-4">
                  {qrData ? (
                    <div className="p-4 bg-white rounded-2xl shadow-lg">
                      <QRCodeSVG value={qrData} size={220} level="M" />
                    </div>
                  ) : (
                    <div className="w-[252px] h-[252px] rounded-2xl bg-surface-900/60 border border-white/10 flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-gray-500">Generating QR code…</p>
                    </div>
                  )}
                  <div className="text-left text-xs text-gray-300 space-y-1.5 w-full border-t border-white/5 pt-4">
                    <p className="font-bold text-white mb-1">How to scan:</p>
                    <p>1. Open WhatsApp on your phone.</p>
                    <p>2. Tap <strong>Settings</strong> or <strong>Menu</strong> (⋮) &gt; <strong>Linked Devices</strong>.</p>
                    <p>3. Tap <strong>Link a Device</strong> and point your camera at the code above.</p>
                  </div>
                </div>
              )}

              {/* Pairing code panel */}
              {linkMode === 'code' && (
                <div className="space-y-4">
                  {!pairingCode ? (
                    <form onSubmit={handlePair} className="space-y-4">
                      <div>
                        <label className="label">WhatsApp Number *</label>
                        <input
                          id="whatsapp-phone-input"
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
                      <button type="submit" id="get-pairing-code-btn" disabled={loading} className="btn-primary w-full py-3">
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
                      <button onClick={() => setPairingCode(null)} className="btn-secondary w-full py-2.5 text-xs mt-2">
                        Cancel / Use Different Number
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
