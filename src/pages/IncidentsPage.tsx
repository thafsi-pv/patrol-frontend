import { useState, useRef } from 'react';
import { useCheckpoints } from '../hooks/useCheckpoints';
import { useCreateIncident, uploadImageToR2, useIncidents } from '../hooks/useIncidents';

export function IncidentsPage() {
  const { data: incidents, isLoading } = useIncidents();
  const { data: checkpoints } = useCheckpoints();
  const createIncidentMutation = useCreateIncident();

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [checkpointId, setCheckpointId] = useState('');

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setSelectedFiles((prev) => [...prev, ...files]);

    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls((prev) => [...prev, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide an issue title.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a description of the issue.');
      return;
    }
    if (selectedFiles.length === 0) {
      setError('Please upload at least one image of the issue.');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const uploadedImages: { imageUrl: string; r2Key: string }[] = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        setUploadProgress(`Uploading image ${i + 1} of ${selectedFiles.length} to R2…`);
        const result = await uploadImageToR2(selectedFiles[i]);
        uploadedImages.push(result);
      }

      setUploadProgress('Saving report…');
      await createIncidentMutation.mutateAsync({
        title,
        description: description.trim(),
        checkpointId: checkpointId || undefined,
        images: uploadedImages,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setCheckpointId('');
      setSelectedFiles([]);
      setPreviewUrls([]);
      setShowModal(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to report issue. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reported Issues & Incidents</h1>
          <p className="text-gray-500 mt-1">
            Guards can upload multi-photo evidence directly.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Report New Issue
        </button>
      </div>

      {/* Grid of Incidents */}
      {isLoading ? (
        <div className="p-12 text-center text-gray-600">
          <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
          Loading reports…
        </div>
      ) : !incidents?.length ? (
        <div className="card p-16 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No issues reported yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {incidents.map((incident) => (
            <div key={incident.id} className="card p-5 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-white text-base leading-snug">{incident.title}</h3>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold shrink-0">
                    {incident.checkpoint?.name || 'General'}
                  </span>
                </div>
                {incident.description && (
                  <p className="text-gray-300 text-xs leading-relaxed bg-surface-900/60 p-2.5 rounded-lg border border-white/5">
                    {incident.description}
                  </p>
                )}
              </div>

              {/* Photo gallery */}
              {incident.images && incident.images.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-gray-500 font-medium">Evidence Photos ({incident.images.length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {incident.images.map((img) => (
                      <a
                        key={img.id}
                        href={img.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative aspect-square rounded-lg overflow-hidden bg-surface-900 border border-white/5"
                      >
                        <img
                          src={img.imageUrl}
                          alt="Issue evidence"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Guard info footer */}
              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
                <span>By {incident.guard.name}</span>
                <span>{new Date(incident.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-lg p-6 space-y-4 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Report Issue / Hazard</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Issue Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Broken Lock at Gate 2, Water Leak"
                  className="input text-sm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Checkpoint (Optional)</label>
                <select
                  className="input text-sm"
                  value={checkpointId}
                  onChange={(e) => setCheckpointId(e.target.value)}
                >
                  <option value="">Select Checkpoint</option>
                  {checkpoints?.map((cp) => (
                    <option key={cp.id} value={cp.id}>{cp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Issue Description *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the issue in detail (location, severity, what happened)..."
                  className="input text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Photo Upload Area: Camera vs Gallery */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Evidence Photos * (Camera or Gallery)
                </label>

                {/* Hidden File Inputs */}
                {/* 1. Camera Input (capture="environment") */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {/* 2. Gallery Input (multiple selection) */}
                <input
                  id="gallery-file-input"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Dual Action Buttons */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 p-3 rounded-xl bg-brand-600/20 border border-brand-500/30 text-brand-300 hover:bg-brand-500/30 transition-all text-xs font-semibold"
                  >
                    <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Take Photo (Camera)
                  </button>

                  <button
                    type="button"
                    onClick={() => document.getElementById('gallery-file-input')?.click()}
                    className="flex items-center justify-center gap-2 p-3 rounded-xl bg-surface-700/50 border border-white/10 text-gray-200 hover:bg-surface-700 transition-all text-xs font-semibold"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Choose from Gallery
                  </button>
                </div>

                {/* Selected Image Previews */}
                {previewUrls.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {previewUrls.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-surface-900 group">
                        <img src={url} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs opacity-90 hover:opacity-100"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {uploadProgress && (
                <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-brand-400/30 border-t-brand-400 rounded-full animate-spin" />
                  {uploadProgress}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={uploading}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="btn-primary text-xs px-5"
                >
                  {uploading ? 'Uploading to R2…' : 'Submit Issue Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
