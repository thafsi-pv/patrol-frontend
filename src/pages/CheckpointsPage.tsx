import { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  useCheckpoints,
  useCreateCheckpoint,
  useUpdateCheckpoint,
  useDeleteCheckpoint,
  type Checkpoint,
} from '../hooks/useCheckpoints';
import { QrCodeCard } from '../components/QrCodeCard';

interface CheckpointForm {
  name: string;
  description: string;
  latitude: string;
  longitude: string;
  radiusMeters: string;
}

const emptyForm: CheckpointForm = {
  name: '',
  description: '',
  latitude: '',
  longitude: '',
  radiusMeters: '2',
};

export function CheckpointsPage() {
  const { data: checkpoints, isLoading } = useCheckpoints();
  const createMutation = useCreateCheckpoint();
  const updateMutation = useUpdateCheckpoint();
  const deleteMutation = useDeleteCheckpoint();

  const [showModal, setShowModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [qrTarget, setQrTarget] = useState<Checkpoint | null>(null);
  const [editTarget, setEditTarget] = useState<Checkpoint | null>(null);
  const [form, setForm] = useState<CheckpointForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (cp: Checkpoint) => {
    setEditTarget(cp);
    setForm({
      name: cp.name,
      description: cp.description ?? '',
      latitude: String(cp.latitude),
      longitude: String(cp.longitude),
      radiusMeters: String(cp.radiusMeters),
    });
    setFormError(null);
    setShowModal(true);
  };

  const useCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(7),
          longitude: pos.coords.longitude.toFixed(7),
        }));
      },
      (err) => setFormError(`GPS: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    const radius = parseFloat(form.radiusMeters);

    if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
      setFormError('Please enter valid numbers for coordinates and radius.');
      return;
    }

    try {
      if (editTarget) {
        await updateMutation.mutateAsync({
          id: editTarget.id,
          name: form.name,
          description: form.description || undefined,
          latitude: lat,
          longitude: lng,
          radiusMeters: radius,
        });
      } else {
        await createMutation.mutateAsync({
          name: form.name,
          description: form.description || undefined,
          latitude: lat,
          longitude: lng,
          radiusMeters: radius,
        });
      }
      setShowModal(false);
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'Operation failed');
    }
  };

  const handleToggleActive = async (cp: Checkpoint) => {
    await updateMutation.mutateAsync({ id: cp.id, active: !cp.active });
  };

  const handleDelete = async (cp: Checkpoint) => {
    if (!confirm(`Delete checkpoint "${cp.name}"? This cannot be undone.`)) return;
    await deleteMutation.mutateAsync(cp.id);
  };

  // Selection handlers
  const handleSelectAll = () => {
    if (!checkpoints) return;
    if (selectedIds.size === checkpoints.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(checkpoints.map((cp) => cp.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedCheckpoints = checkpoints?.filter((cp) => selectedIds.has(cp.id)) ?? [];

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Checkpoints</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Manage patrol checkpoints and print QR codes.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowPrintModal(true)}
              className="btn-secondary text-brand-300 border-brand-500/30 bg-brand-500/10 hover:bg-brand-500/20 text-xs py-2.5"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print Selected ({selectedIds.size}) — A4</span>
            </button>
          )}
          <button id="btn-new-checkpoint" onClick={openCreate} className="btn-primary w-full sm:w-auto">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>New Checkpoint</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-600">
            <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
            Loading…
          </div>
        ) : !checkpoints || checkpoints.length === 0 ? (
          <div className="p-16 text-center text-gray-600">
            <svg className="w-12 h-12 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <p className="font-medium text-gray-500">No checkpoints yet</p>
            <p className="text-sm text-gray-600 mt-1">Create one to generate its QR code.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3.5 text-left w-10">
                    <input
                      type="checkbox"
                      checked={checkpoints.length > 0 && selectedIds.size === checkpoints.length}
                      onChange={handleSelectAll}
                      className="rounded bg-surface-700 border-white/20 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Coordinates</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Radius</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Scans</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {checkpoints.map((cp) => {
                  const isSelected = selectedIds.has(cp.id);
                  return (
                    <tr key={cp.id} className={`table-row-hover ${isSelected ? 'bg-brand-500/10' : ''}`}>
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(cp.id)}
                          className="rounded bg-surface-700 border-white/20 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-200">{cp.name}</p>
                        {cp.description && <p className="text-xs text-gray-600 mt-0.5 truncate max-w-[180px]">{cp.description}</p>}
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell text-gray-400 font-mono text-xs">
                        {cp.latitude.toFixed(5)}, {cp.longitude.toFixed(5)}
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell text-gray-400">{cp.radiusMeters}m</td>
                      <td className="px-5 py-4 hidden lg:table-cell text-gray-400">{cp._count?.patrolLogs ?? 0}</td>
                      <td className="px-5 py-4">
                        <span className={`badge ${cp.active ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-gray-500/15 text-gray-500 border border-gray-500/30'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cp.active ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                          {cp.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            title="View QR"
                            onClick={() => setQrTarget(cp)}
                            className="p-2 rounded-lg text-gray-500 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="5" height="5" rx="0.5" /><rect x="16" y="3" width="5" height="5" rx="0.5" /><rect x="3" y="16" width="5" height="5" rx="0.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 16h-3v5M16 16v3m5-3v.01" /></svg>
                          </button>
                          <button
                            title="Edit"
                            onClick={() => openEdit(cp)}
                            className="p-2 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button
                            title={cp.active ? 'Deactivate' : 'Activate'}
                            onClick={() => handleToggleActive(cp)}
                            className="p-2 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
                          </button>
                          <button
                            title="Delete"
                            onClick={() => handleDelete(cp)}
                            className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR Modal */}
      {qrTarget && (
        <Modal title="Checkpoint QR Code" onClose={() => setQrTarget(null)}>
          <QrCodeCard
            value={qrTarget.qrCode}
            label={qrTarget.name}
            subLabel={qrTarget.description ?? undefined}
            size={240}
          />
        </Modal>
      )}

      {/* Bulk A4 Print Modal */}
      {showPrintModal && (
        <A4PrintModal
          checkpoints={selectedCheckpoints}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <Modal
          title={editTarget ? 'Edit Checkpoint' : 'New Checkpoint'}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {formError}
              </div>
            )}

            <div>
              <label className="label">Name *</label>
              <input className="input" required value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Building A — Main Entrance" />
            </div>

            <div>
              <label className="label">Description</label>
              <input className="input" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional notes for this checkpoint" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Latitude *</label>
                <input className="input" required type="number" step="any" value={form.latitude}
                  onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                  placeholder="12.9716" />
              </div>
              <div>
                <label className="label">Longitude *</label>
                <input className="input" required type="number" step="any" value={form.longitude}
                  onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                  placeholder="77.5946" />
              </div>
            </div>

            <button type="button" onClick={useCurrentLocation}
              className="btn-secondary w-full text-xs">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Use My Current Location
            </button>

            <div>
              <label className="label">Radius (meters)</label>
              <input className="input" type="number" min="1" step="0.5" value={form.radiusMeters}
                onChange={(e) => setForm((f) => ({ ...f, radiusMeters: e.target.value }))}
                placeholder="2" />
              <p className="text-xs text-gray-600 mt-1">Guards must be within this radius to verify.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={isPending} className="btn-primary flex-1">
                {isPending ? 'Saving…' : (editTarget ? 'Save Changes' : 'Create Checkpoint')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function A4PrintModal({ checkpoints, onClose }: { checkpoints: Checkpoint[]; onClose: () => void }) {
  const handlePrint = () => {
    const printSheet = document.getElementById('printable-a4-sheet');
    if (!printSheet) return;

    // Clone printSheet node so we don't mutate live DOM
    const clone = printSheet.cloneNode(true) as HTMLElement;

    // Convert live canvas elements to PNG data URL img tags in clone
    const originalCanvases = printSheet.querySelectorAll('canvas');
    const clonedCanvases = clone.querySelectorAll('canvas');

    originalCanvases.forEach((origCanvas, index) => {
      try {
        const dataUrl = origCanvas.toDataURL('image/png');
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.width = '155px';
        img.style.height = '155px';
        img.style.display = 'block';

        const clonedCanvas = clonedCanvases[index];
        if (clonedCanvas && clonedCanvas.parentNode) {
          clonedCanvas.parentNode.replaceChild(img, clonedCanvas);
        }
      } catch {
        // ignore canvas export error
      }
    });

    // Create a temporary hidden iframe for isolated A4 printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    // Collect all application styles
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Patrol Checkpoints A4 Print</title>
          ${styles}
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            html, body {
              background: #ffffff !important;
              color: #000000 !important;
              margin: 0 !important;
              padding: 0 !important;
              height: auto !important;
            }
            .print-container {
              background: #ffffff !important;
              padding: 0 !important;
            }
            .print-placard {
              border: 2px dashed #9ca3af !important;
              background: #f9fafb !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              padding: 1rem !important;
              border-radius: 1rem !important;
            }
          </style>
        </head>
        <body class="bg-white">
          <div class="print-container">
            ${clone.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative card w-full max-w-4xl p-6 space-y-6 max-h-[95vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Print QR Placards (A4 Page)</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {checkpoints.length} checkpoint placard(s) selected. Ready to print on A4 paper.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handlePrint} className="btn-primary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Page (A4)
            </button>
            <button onClick={onClose} className="btn-secondary">Close</button>
          </div>
        </div>

        {/* Printable A4 Sheet View */}
        <div id="printable-a4-sheet" className="bg-white text-gray-900 p-4 rounded-xl shadow-2xl border border-gray-200">
          <div className="grid grid-cols-2 gap-4">
            {checkpoints.map((cp) => (
              <div
                key={cp.id}
                className="print-placard flex flex-col items-center justify-between p-4 border-2 border-dashed border-gray-400 rounded-2xl text-center bg-gray-50 min-h-[260px]"
              >
                <div className="w-full text-left text-[9px] font-bold tracking-wider text-gray-400 uppercase font-mono">
                  PATROL CHECKPOINT
                </div>

                <div className="my-2 p-3 bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center">
                  <QRCodeCanvas value={cp.qrCode} size={155} level="H" fgColor="#111827" bgColor="#ffffff" />
                </div>

                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-gray-900 leading-tight">{cp.name}</h3>
                  {cp.description && (
                    <p className="text-[11px] text-gray-600 max-w-xs">{cp.description}</p>
                  )}
                </div>

                <div className="mt-2 pt-1.5 border-t border-gray-300 w-full text-[9px] text-gray-400 font-mono text-center">
                  SCAN WITH PATROL SYSTEM APP
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
