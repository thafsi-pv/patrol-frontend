import { QRCodeCanvas } from 'qrcode.react';
import { useRef } from 'react';

interface QrCodeCardProps {
  value: string;
  label?: string;
  subLabel?: string;
  size?: number;
}

export function QrCodeCard({ value, label, subLabel, size = 220 }: QrCodeCardProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;

    // Draw with label underneath on a larger canvas
    const padding = 24;
    const labelHeight = label ? 60 : 0;
    const offscreen = document.createElement('canvas');
    offscreen.width = size + padding * 2;
    offscreen.height = size + padding * 2 + labelHeight;

    const ctx = offscreen.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    ctx.drawImage(canvas, padding, padding, size, size);

    if (label) {
      ctx.fillStyle = '#111827';
      ctx.font = `bold 14px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(label, offscreen.width / 2, size + padding + 24);
      if (subLabel) {
        ctx.font = `11px Inter, system-ui, sans-serif`;
        ctx.fillStyle = '#6b7280';
        ctx.fillText(subLabel, offscreen.width / 2, size + padding + 44);
      }
    }

    const link = document.createElement('a');
    link.download = `qr-${label?.replace(/\s+/g, '-').toLowerCase() ?? value}.png`;
    link.href = offscreen.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={canvasRef}
        className="p-4 bg-white rounded-2xl shadow-xl shadow-black/30"
      >
        <QRCodeCanvas
          value={value}
          size={size}
          level="H"
          includeMargin={false}
          fgColor="#111827"
          bgColor="#ffffff"
        />
      </div>

      {label && (
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-200">{label}</p>
          {subLabel && <p className="text-xs text-gray-500 mt-0.5">{subLabel}</p>}
        </div>
      )}

      <button onClick={handleDownload} className="btn-primary w-full">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download PNG
      </button>
    </div>
  );
}
