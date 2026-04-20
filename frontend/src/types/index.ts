export interface User {
  id: string;
  nom: string;
  email: string;
  type_utilisateur: 'INDIVIDUEL' | 'ORGANISATION';
  statut: 'ACTIF' | 'INACTIF' | 'SUSPENDU';
  created_at: string;
  memberships?: Membre[];
  individual_projects?: Project[];
}

export interface Organisation {
  id: string;
  nom: string;
  owner_id: string;
  members?: Membre[];
  projects?: Project[];
  created_at: string;
}

export interface Membre {
  id: string;
  user_id: string;
  organisation_id: string;
  role: 'PROPRIETAIRE' | 'MANAGER' | 'EQUIPE_VEILLE' | 'LECTEUR';
  statut: 'ACTIF' | 'EN_ATTENTE' | 'DESACTIVE';
  user?: { id: string; nom: string; email: string; statut: string };
  organisation?: Organisation;
}

export interface Project {
  id: string;
  nom: string;
  description?: string;
  keywords: string[];
  watchType?: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  isActive: boolean;
  organisation_id?: string;
  owner_user_id?: string;
  created_at: string;
  sources?: Source[];
}

export interface Source {
  id: string;
  name: string;
  url: string;
  projectId: string;
}

export interface WatchResult {
  id: string;
  title: string;
  summary?: string;
  sentiment?: string;
  trend?: string;
  keywords: string[];
  sourceUrl?: string;
  projectId: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  message: string;
  isRead: boolean;
  userId: string;
  projectId: string;
  createdAt: string;
  project?: { nom: string };
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}
