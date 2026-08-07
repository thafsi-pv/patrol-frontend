export const queryKeys = {
  // Auth
  me: ['auth', 'me'] as const,

  // Checkpoints
  checkpoints: {
    all: ['checkpoints'] as const,
    detail: (id: string) => ['checkpoints', id] as const,
    qrImage: (id: string) => ['checkpoints', id, 'qr-image'] as const,
  },

  // Patrol logs
  patrolLogs: {
    all: (filters?: object) => ['patrol-logs', filters] as const,
    detail: (id: string) => ['patrol-logs', id] as const,
  },

  // Users
  users: {
    all: ['users'] as const,
  },

  // Dashboard
  dashboardStats: ['dashboard-stats'] as const,
};
