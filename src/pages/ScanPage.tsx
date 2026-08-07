import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useScanMutation } from '../hooks/useScanMutation';
import type { ScanResult } from '../hooks/useScanMutation';
import { StatusBadge } from '../components/StatusBadge';

type ScanPhase = 'scanning' | 'locating' | 'result';

export function ScanPage() {
  const [phase, setPhase] = useState<ScanPhase>('scanning');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scanMutation = useScanMutation();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = 'qr-scanner-viewport';

  // Start scanner on mount
  useEffect(() => {
    if (phase !== 'scanning') return;

    let isMounted = true;
    const element = document.getElementById(scannerDivId);
    if (element) {
      element.innerHTML = '';
    }

    const scanner = new Html5Qrcode(scannerDivId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.floor(minEdge * 0.7);
            return { width: edge, height: edge };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          if (isMounted) {
            handleQrDecode(decodedText);
          }
        },
        undefined,
      )
      .catch((err) => {
        if (isMounted) {
          setError(`Camera error: ${String(err)}`);
        }
      });

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().then(() => {
              scannerRef.current?.clear();
            }).catch(() => {});
          } else {
            scannerRef.current.clear();
          }
        } catch {
          // ignore cleanup error
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleQrDecode = (qrCode: string) => {
    if (phase !== 'scanning') return;
    // Stop scanner immediately
    scannerRef.current?.stop().catch(() => {});
    setPhase('locating');
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsAccuracy(accuracy);
        try {
          const res = await scanMutation.mutateAsync({
            qrCode,
            latitude,
            longitude,
            accuracy,
          });
          setResult(res);
          setPhase('result');
        } catch (err: any) {
          setError(err?.response?.data?.message ?? 'Scan failed. Please try again.');
          setPhase('scanning');
        }
      },
      (posErr) => {
        setError(`GPS error: ${posErr.message}`);
        setPhase('scanning');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const handleReset = () => {
    setPhase('scanning');
    setResult(null);
    setError(null);
    setGpsAccuracy(null);
  };

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Scan Checkpoint</h1>
        <p className="text-gray-500 mt-1">Point your camera at a checkpoint QR code.</p>
      </div>

      {phase === 'scanning' && (
        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
              {error}
            </div>
          )}
          <div className="card overflow-hidden">
            {/* Scanner viewport */}
            <div
              id={scannerDivId}
              className="w-full aspect-square bg-surface-900"
            />
          </div>
          <p className="text-center text-xs text-gray-600">
            Camera permission required. QR code must fill the guide box.
          </p>
        </div>
      )}

      {phase === 'locating' && (
        <div className="card p-12 flex flex-col items-center gap-5 animate-fade-in">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-brand-500/30 border-t-brand-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 bg-brand-500 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-white font-semibold">Acquiring GPS fix…</p>
            <p className="text-gray-500 text-sm mt-1">
              {gpsAccuracy ? `Accuracy: ±${Math.round(gpsAccuracy)}m` : 'Waiting for location…'}
            </p>
          </div>
        </div>
      )}

      {phase === 'result' && result && (
        <div className="space-y-4 animate-slide-up">
          {/* Result card */}
          <div
            className={`card p-8 border flex flex-col items-center gap-4 text-center ${
              result.status === 'SUCCESS'
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : result.status === 'FLAGGED'
                  ? 'border-purple-500/30 bg-purple-500/5'
                  : result.status === 'OUT_OF_RANGE'
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-red-500/30 bg-red-500/5'
            }`}
          >
            {/* Icon */}
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center ${
                result.status === 'SUCCESS'
                  ? 'bg-emerald-500/20'
                  : result.status === 'FLAGGED'
                    ? 'bg-purple-500/20'
                    : result.status === 'OUT_OF_RANGE'
                      ? 'bg-amber-500/20'
                      : 'bg-red-500/20'
              }`}
            >
              {result.status === 'SUCCESS' ? (
                <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : result.status === 'FLAGGED' ? (
                <svg className="w-10 h-10 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
                </svg>
              ) : result.status === 'OUT_OF_RANGE' ? (
                <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.96l-6.96-12.04a2 2 0 00-3.5 0L3.25 16.04A2 2 0 005.07 19z" />
                </svg>
              ) : (
                <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>

            <StatusBadge status={result.status} />

            <div>
              <p className="text-white font-semibold text-lg">{result.checkpointName ?? 'Unknown'}</p>
              <p className="text-gray-400 text-sm mt-1">{result.message}</p>
            </div>

            {/* Stats row */}
            <div className="flex gap-6 text-sm">
              {result.distanceMeters != null && (
                <div className="text-center">
                  <p className="text-white font-bold">{Math.round(result.distanceMeters)}m</p>
                  <p className="text-gray-500 text-xs">Distance</p>
                </div>
              )}
              {result.radiusMeters && (
                <div className="text-center">
                  <p className="text-white font-bold">{result.radiusMeters}m</p>
                  <p className="text-gray-500 text-xs">Radius</p>
                </div>
              )}
              {gpsAccuracy && (
                <div className="text-center">
                  <p className="text-white font-bold">±{Math.round(gpsAccuracy)}m</p>
                  <p className="text-gray-500 text-xs">GPS accuracy</p>
                </div>
              )}
            </div>

            {result.flagReason && (
              <div className="w-full p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs text-left">
                <span className="font-semibold">Flagged: </span>{result.flagReason.replace(/_/g, ' ')}
                {' — This scan has been logged for admin review.'}
              </div>
            )}
          </div>

          <button id="btn-scan-next" onClick={handleReset} className="btn-primary w-full py-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3m2 0h.01M5 8v.01M3 12h.01M5 16H3m2 0h.01M5 16v.01" />
            </svg>
            Scan Next Checkpoint
          </button>
        </div>
      )}
    </div>
  );
}
