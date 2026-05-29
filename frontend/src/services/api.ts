import axios from 'axios';

/** Message d'erreur lisible (réseau, validation Nest, etc.) */
export function formatApiError(err: unknown, fallback: string): string {
  if (!axios.isAxiosError(err)) {
    return fallback;
  }
  if (!err.response) {
    if (err.code === 'ERR_NETWORK' || err.message?.includes('Network')) {
      return "Impossible de joindre l'API. Démarrez le backend (port 3000) puis relancez le frontend.";
    }
    return err.message || fallback;
  }
  const data = err.response.data as { message?: string | string[] } | undefined;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (err.response.status >= 500) {
    return 'Erreur serveur. Vérifiez les logs du backend et que la base de données est migrée.';
  }
  return fallback;
}

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post('/api/auth/refresh', { refresh_token: refreshToken });
        const { access_token } = response.data;
        localStorage.setItem('access_token', access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// --- 1. AUTH ---
export const authService = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, mot_de_passe: password }),
  register: (data: any) => api.post('/auth/register', data),
  registerOrg: (data: any) => api.post('/auth/register/organisation', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateProfile: (data: any) => api.patch('/auth/profile', data),
  changePassword: (data: any) => api.patch('/auth/change-password', data),
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/auth/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// --- 2. PROJECTS ---
export const projectsService = {
  getAll: () => api.get('/projects'),
  getById: (id: string) => api.get(`/projects/${id}`),
  create: (data: any) => api.post('/projects', data),
  update: (id: string, data: any) => api.patch(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  archive: (id: string) => api.patch(`/projects/${id}/archive`),
};

// --- 3. ORGANISATIONS ---
export const orgService = {
  getMyOrg: () => api.get('/organisations/me'),
  getMembers: (orgId: string) => api.get(`/organisations/${orgId}/membres`),
  inviteMember: (orgId: string, data: any) =>
    api.post(`/organisations/${orgId}/invite`, data),
  removeMember: (orgId: string, memberId: string) =>
    api.delete(`/organisations/${orgId}/membres/${memberId}`),
  updateMemberRole: (orgId: string, memberId: string, role: string) =>
    api.patch(`/organisations/${orgId}/membres/${memberId}/role`, { role }),
  regenerateJoinCodes: (orgId: string) =>
    api.post(`/organisations/${orgId}/regenerate-codes`),
};

// --- 4. SOURCES ---
export const sourcesService = {
  getByProject: (projectId: string) => api.get(`/sources?projectId=${projectId}`),
  create: (data: any) => api.post('/sources', data),
  delete: (id: string) => api.delete(`/sources/${id}`),
};

// --- 5. COLLECTION PLANS ---
export const collectionPlansService = {
  getByProject: (projectId: string) =>
    api.get(`/collection-plans?projectId=${projectId}`),
  getById: (id: string) => api.get(`/collection-plans/${id}`),
  create: (data: any) => api.post('/collection-plans', data),
  update: (id: string, data: any) => api.patch(`/collection-plans/${id}`, data),
  delete: (id: string) => api.delete(`/collection-plans/${id}`),
  triggerCollection: (id: string) =>
    api.post(`/collection-plans/${id}/collect`),
};

export const collectionPlanService = {
  ...collectionPlansService,
  getJobs: (planId: string) => api.get(`/collection/jobs/${planId}`),
  getRawItems: (planId: string, page = 1, limit = 15) =>
    api.get(`/collection-plans/${planId}/raw-items`, { params: { page, limit } }),
  addSource: (planId: string, data: any) =>
    api.post(`/collection-plans/${planId}/sources`, data),
  removeSource: (sourceId: string) =>
    api.delete(`/collection-plan-sources/${sourceId}`),
  addKeyword: (planId: string, data: any) =>
    api.post(`/collection-plans/${planId}/keywords`, data),
  removeKeyword: (keywordId: string) =>
    api.delete(`/collection-plan-keywords/${keywordId}`),
  run: (planId: string) => api.post(`/collection-plans/${planId}/run`),
};

// --- 6. COLLECTION ENGINE ---
export const collectionService = {
  triggerManual: (planId: string) =>
    api.post(`/collection-plans/${planId}/run`),
  getJobsByPlan: (planId: string) =>
    api.get(`/collection/jobs/${planId}`),
};

// --- 7. RAW ITEMS ---
export const rawItemsService = {
  getByProject: (projectId: string, page = 1, limit = 20) =>
    api.get(`/projects/${projectId}/raw-items`, { params: { page, limit } }),
  getByPlan: (planId: string) =>
    api.get(`/collection-plans/${planId}/raw-items`),
};

// --- 8. PROCESSING (Sprint 4) ---
// Routes backend réelles : /projects/:id/process | /projects/:id/processed-items | /projects/:id/processing-stats
export const processingService = {
  getStats: (projectId: string) =>
    api.get(`/projects/${projectId}/processing-stats`),

  getByProject: (
    projectId: string,
    page = 1,
    limit = 20,
    lang?: string,
    sourceType?: string,
  ) =>
    api.get(`/projects/${projectId}/processed-items`, {
      params: { page, limit, language: lang, source_type: sourceType },
    }),

  processProject: (projectId: string) =>
    api.post(`/projects/${projectId}/process`),

  processByPlan: (planId: string) =>
    api.post(`/collection-plans/${planId}/process`),

  getByPlan: (planId: string, page = 1, limit = 20) =>
    api.get(`/collection-plans/${planId}/processed-items`, {
      params: { page, limit },
    }),

  getById: (id: string) =>
    api.get(`/processed-items/${id}`),
};

// --- 9. UPLOAD ---
export const uploadService = {
  getByPlan: (planId: string) => api.get(`/uploads/plan/${planId}`),
  deletePdf: (rawItemId: string) => api.delete(`/uploads/raw-item/${rawItemId}`),
  uploadPdf: (...args: [projectId: string, planId: string, file: File] | [planId: string, file: File]) => {
    const hasProjectId = args.length === 3;
    const projectId = hasProjectId ? args[0] : undefined;
    const planId = hasProjectId ? args[1] : args[0];
    const file = hasProjectId ? args[2] : args[1];

    const formData = new FormData();
    formData.append('file', file);
    formData.append('plan_id', planId);
    if (projectId) {
      formData.append('project_id', projectId);
    }

    return api.post('/uploads/pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// --- 10. OBJECTIVES / AXES / HYPOTHESES ---
export const objectiveService = {
  getByProject: (projectId: string) =>
    api.get(`/objectives?project_id=${projectId}`),
  create: (projectId: string, data: any) =>
    api.post('/objectives', { ...data, project_id: projectId }),
  update: (_projectId: string, id: string, data: any) =>
    api.patch(`/objectives/${id}`, data),
  delete: (_projectId: string, id: string) =>
    api.delete(`/objectives/${id}`),
};

export const axisService = {
  create: (objectiveId: string, data: any) =>
    api.post('/axes', { ...data, objective_id: objectiveId }),
  update: (_objectiveId: string, id: string, data: any) =>
    api.patch(`/axes/${id}`, data),
  delete: (_objectiveId: string, id: string) =>
    api.delete(`/axes/${id}`),
};

export const hypothesisService = {
  create: (axisId: string, data: any) =>
    api.post('/hypotheses', { ...data, axis_id: axisId }),
  update: (_axisId: string, id: string, data: any) =>
    api.patch(`/hypotheses/${id}`, data),
  delete: (_axisId: string, id: string) =>
    api.delete(`/hypotheses/${id}`),
};

// Aliases pour compatibilité avec les imports existants
export const objectivesService = objectiveService;
export const axesService = axisService;
export const hypothesesService = hypothesisService;

// --- 11. AI ENRICHMENT (Sprint 5) ---
// Routes backend réelles : /projects/:projectId/enrich | /projects/:projectId/enriched-items | etc.
export const aiEnrichmentService = {
  enrichProject: (projectId: string, hypothesisId?: string) =>
    api.post(`/projects/${projectId}/enrich`, {
      hypothesis_id: hypothesisId,
    }),

  enrichByPlan: (planId: string) =>
    api.post(`/collection-plans/${planId}/enrich`),

  getByProject: (
    projectId: string,
    page = 1,
    limit = 20,
    hypothesisId?: string,
    impact?: string,
    minScore?: number,
  ) =>
    api.get(`/projects/${projectId}/enriched-items`, {
      params: {
        page,
        limit,
        hypothesis_id: hypothesisId || undefined,
        impact: impact || undefined,
        min_score: minScore,
      },
    }),

  getStats: (projectId: string) =>
    api.get(`/projects/${projectId}/enrichment-stats`),

  getJobs: (projectId: string, limit = 10) =>
    api.get(`/projects/${projectId}/enrichment-jobs`, {
      params: { limit },
    }),

  getHypothesisEvaluations: (projectId: string) =>
    api.get(`/projects/${projectId}/hypothesis-evaluations`),

  getHypothesisEvaluation: (hypothesisId: string) =>
    api.get(`/hypothesis-evaluations/${hypothesisId}`),

  getByProcessedItem: (processedItemId: string) =>
    api.get(`/processed-items/${processedItemId}/enriched`),
};

// --- 12. ALERTS ---
export const alertsService = {
  getMyAlerts: () => api.get('/alertes'),
  markAsRead: (id: string) => api.patch(`/alertes/${id}/read`),
};

// --- 12b. ANALYSE (Sprint 7) ---
export const analyseService = {
  getDashboard: (projectId: string) => api.get(`/analyse/dashboard/${projectId}`),
  getResults: (projectId: string, page = 1, limit = 20, sentiment?: string) =>
    api.get(`/analyse/results/${projectId}`, {
      params: { page, limit, sentiment: sentiment && sentiment !== 'TOUS' ? sentiment : undefined },
    }),
  getStats: (projectId: string) => api.get(`/analyse/stats/${projectId}`),
};

// --- 13. ADMIN ---
export const adminService = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: (page = 1, limit = 20) =>
    api.get('/admin/users', { params: { page, limit } }),
  updateUser: (id: string, data: any) => api.patch(`/admin/users/${id}`, data),
  suspendUser: (id: string) => api.patch(`/admin/users/${id}/suspend`),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  getOrganisations: (page = 1, limit = 20) =>
    api.get('/admin/organisations', { params: { page, limit } }),
  getOrganisation: (id: string) => api.get(`/admin/organisations/${id}`),
  updateOrganisation: (id: string, data: any) =>
    api.patch(`/admin/organisations/${id}`, data),
  deleteOrganisation: (id: string) => api.delete(`/admin/organisations/${id}`),
  updateOrgMemberRole: (orgId: string, memberId: string, role: string) =>
    api.patch(`/admin/organisations/${orgId}/members/${memberId}/role`, { role }),
  removeOrgMember: (orgId: string, memberId: string) =>
    api.delete(`/admin/organisations/${orgId}/members/${memberId}`),
  getLogs: () => api.get('/admin/logs'),
  getPipeline: () => api.get('/admin/pipeline'),
};

// --- 14. REPORTS ---
export const reportsService = {
  openReportHtml: async (projectId: string) => {
    const res = await api.get(`/reports/project/${projectId}/html`, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  },
  downloadReport: async (projectId: string) => {
    const res = await api.get(`/reports/project/${projectId}/download`, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-veille-${projectId}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

// --- 15. FOLDERS ---
export const foldersService = {
  getAll: () => api.get('/folders'),
  create: (data: any) => api.post('/folders', data),
  delete: (id: string) => api.delete(`/folders/${id}`),
};
