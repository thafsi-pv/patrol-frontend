import { useState } from 'react';
import { useRoutes, useCreateRoute, useUpdateRoute, useDeactivateRoute } from '../hooks/usePatrolSessions';
import { useCheckpoints } from '../hooks/useCheckpoints';

export function RoutesPage() {
  const { data: routes, isLoading } = useRoutes();
  const { data: checkpoints } = useCheckpoints();
  const createRoute = useCreateRoute();
  const updateRoute = useUpdateRoute();
  const deactivateRoute = useDeactivateRoute();

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditId(null); setName(''); setDescription(''); setSelectedIds([]); setError(null); setShowModal(true);
  };

  const openEdit = (r: any) => {
    setEditId(r.id);
    setName(r.name);
    setDescription(r.description ?? '');
    setSelectedIds(r.checkpoints.map((rc: any) => rc.checkpointId));
    setError(null);
    setShowModal(true);
  };

  const toggleCheckpoint = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Route name is required'); return; }
    if (selectedIds.length === 0) { setError('Select at least one checkpoint'); return; }
    try {
      if (editId) {
        await updateRoute.mutateAsync({ id: editId, name, checkpointIds: selectedIds });
      } else {
        await createRoute.mutateAsync({ name, description: description || undefined, checkpointIds: selectedIds });
      }
      setShowModal(false);
    } catch {
      setError('Failed to save route');
    }
  };



  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Patrol Routes</h1>
          <p className="text-gray-500 mt-1">Configure routes and checkpoint sequences for guard patrols.</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          New Route
        </button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-gray-500">
          <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
          Loading routes…
        </div>
      ) : !routes?.length ? (
        <div className="card p-16 text-center text-gray-500 text-sm">No routes configured yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {routes.map(route => (
            <div key={route.id} className="card p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-white">{route.name}</h3>
                  {route.description && <p className="text-gray-500 text-xs mt-0.5">{route.description}</p>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${route.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-500/15 text-gray-400'}`}>
                  {route.active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">Checkpoints ({route.checkpoints.length})</p>
                <div className="space-y-1">
                  {route.checkpoints.map((rc, idx) => (
                    <div key={rc.id} className="flex items-center gap-2 text-xs text-gray-300">
                      <span className="w-5 h-5 rounded-full bg-brand-600/30 text-brand-300 flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</span>
                      {rc.checkpoint.name}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-white/5">
                <button onClick={() => openEdit(route)} className="btn-secondary text-xs flex-1">Edit</button>
                <button
                  onClick={() => { if (confirm('Deactivate this route?')) deactivateRoute.mutate(route.id); }}
                  className="btn-secondary text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 flex-1"
                >
                  Deactivate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{editId ? 'Edit Route' : 'New Patrol Route'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-300">✕</button>
            </div>
            {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Route Name *</label>
                <input type="text" required className="input text-sm" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Hospital Master Route" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Description</label>
                <textarea rows={2} className="input text-sm" value={description} onChange={e => setDescription(e.target.value)} placeholder="Route description..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">Checkpoints * (tap to add/reorder)</label>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {checkpoints?.map(cp => {
                    const idx = selectedIds.indexOf(cp.id);
                    const selected = idx >= 0;
                    return (
                      <button key={cp.id} type="button" onClick={() => toggleCheckpoint(cp.id)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${selected ? 'bg-brand-500/15 border-brand-500/40 text-brand-200' : 'border-white/5 bg-surface-900/50 text-gray-400 hover:border-white/10'}`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${selected ? 'bg-brand-600 text-white' : 'bg-surface-700 text-gray-500'}`}>
                          {selected ? idx + 1 : '–'}
                        </span>
                        <div>
                          <p className="text-xs font-medium">{cp.name}</p>
                          {cp.description && <p className="text-[10px] text-gray-600">{cp.description}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" disabled={createRoute.isPending || updateRoute.isPending} className="btn-primary text-xs px-5">
                  {(createRoute.isPending || updateRoute.isPending) ? 'Saving…' : 'Save Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
