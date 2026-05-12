import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// --- INTERCEPTEURS (Sécurité & Auth) ---

// Ajouter le token automatiquement à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Gérer les erreurs globales (ex: 401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Éviter la boucle infinie sur la page admin
      if (window.location.pathname === '/admin') {
        return Promise.reject(error);
      }
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// --- SERVICES CRUDS (Communication Backend) ---

// 1. OBJECTIFS
export const objectiveService = {
  getAll: (projectId: string) => api.get(`/projects/${projectId}/objectives`),
  create: (projectId: string, data: { title: string; description?: string }) => 
    api.post(`/projects/${projectId}/objectives`, data),
  update: (projectId: string, id: string, data: { title: string; description?: string }) => 
    api.put(`/projects/${projectId}/objectives/${id}`, data),
  delete: (projectId: string, id: string) => 
    api.delete(`/projects/${projectId}/objectives/${id}`),
};

// 2. AXES
export const axisService = {
  getAll: (objectiveId: string) => api.get(`/objectives/${objectiveId}/axes`),
  create: (objectiveId: string, data: { title: string }) => 
    api.post(`/objectives/${objectiveId}/axes`, data),
  update: (objectiveId: string, id: string, data: { title: string }) => 
    api.put(`/objectives/${objectiveId}/axes/${id}`, data),
  delete: (objectiveId: string, id: string) => 
    api.delete(`/objectives/${objectiveId}/axes/${id}`),
};

// 3. HYPOTHÈSES
export const hypothesisService = {
  create: (axisId: string, data: { title: string; description?: string }) => 
    api.post(`/axes/${axisId}/hypotheses`, data),
  update: (axisId: string, id: string, data: { title: string; description?: string }) => 
    api.put(`/axes/${axisId}/hypotheses/${id}`, data),
  delete: (axisId: string, id: string) => 
    api.delete(`/axes/${axisId}/hypotheses/${id}`),
};

// 4. PÉRIMÈTRES (Point 7.1 - Validation URL)
export const perimeterService = {
  create: (projectId: string, data: { name: string; type: string; value: string; objective_id?: string; axis_id?: string }) => 
    api.post(`/projects/${projectId}/perimeters`, data),
  delete: (id: string) => 
    api.delete(`/perimeters/${id}`),
};

export default api;
