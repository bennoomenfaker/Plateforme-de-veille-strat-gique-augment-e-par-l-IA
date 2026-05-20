// /srv/veille/frontend/src/types/index.ts
export interface User {
  id: string;
  nom: string;
  email: string;
  photo_url?: string | null;
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
  my_role?: 'PROPRIETAIRE' | 'MANAGER' | 'EQUIPE_VEILLE' | 'LECTEUR';
  join_codes?: { equipe_veille?: string; lecteur?: string };
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
  monitoring_type?: string;
  frequency: 'ON_DEMAND' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  isActive: boolean;
  organisation_id?: string;
  owner_user_id?: string;
  created_at: string;
  sources?: Source[];
  objectives?: ProjectObjective[];
  perimeters?: ProjectPerimeter[];
}

export interface ProjectObjective {
  id: string;
  content: string;
  priority: number;
  project_id: string;
  axes?: ProjectAxis[];
  created_at: string;
}

export interface ProjectAxis {
  id: string;
  name: string;
  description?: string;
  priority: number;
  objective_id: string;
  hypotheses?: ProjectHypothesis[];
  created_at: string;
}

export interface ProjectHypothesis {
  id: string;
  content: string;
  priority: number;
  statut: string;
  axis_id: string;
  collection_plans?: CollectionPlan[];
  created_at: string;
}

export interface ProjectPerimeter {
  id: string;
  name?: string;
  type: 'GEOGRAPHIC' | 'SECTORAL';
  value?: string;
  project_id: string;
  created_at: string;
}

// Sprint 3 Types
export interface CollectionPlan {
  id: string;
  question: string;
  frequency: 'ON_DEMAND' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  collection_start_date?: string;
  collection_end_date?: string;
  is_active: boolean;
  last_run_at?: string;
  next_run_at?: string;
  hypothesis_id: string;
  sources: CollectionPlanSource[];
  keywords: CollectionPlanKeyword[];
  created_at: string;
}

export interface CollectionPlanSource {
  id: string;
  source_type: string;
  source_label: string;
  metadata?: Record<string, unknown> | null;
  source_url: string;
  collection_plan_id: string;
  created_at: string;
}

export interface CollectionPlanKeyword {
  id: string;
  keyword: string;
  keyword_type: string;
  collection_plan_id: string;
  created_at: string;
}

export interface CollectionJob {
  id: string;
  collection_plan_id: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
  trigger_type: 'MANUAL' | 'SCHEDULED';
  started_at?: string;
  finished_at?: string;
  logs?: any;
  created_at: string;
}

export interface RawItem {
  id: string;
  project_id: string;
  collection_plan_id: string;
  source_type: string;
  source_name?: string;
  source_url?: string;
  article_url?: string;
  file_path?: string;
  title?: string;
  content_raw?: string;
  published_at?: string;
  fetched_at: string;
  hash: string;
  metadata?: any;
  created_at: string;
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

// ─── Sprint 4 — Processing ────────────────────────────────────────────────────

export interface ProcessedItem {
  id: string;
  raw_item_id: string;
  project_id: string;
  collection_plan_id?: string;

  title?: string;
  content_clean?: string;
  content_excerpt?: string;
  language?: string;
  word_count?: number;
  char_count?: number;

  source_type?: string;
  source_name?: string;
  source_url?: string;
  article_url?: string;

  published_at?: string;
  processed_at: string;
  processing_status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'SKIPPED';
  error_message?: string;
  metadata?: any;

  raw_item?: Partial<RawItem>;
}

export interface ProcessingJob {
  id: string;
  project_id?: string;
  plan_id?: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'SKIPPED';
  trigger_type: string;
  total: number;
  processed: number;
  skipped: number;
  failed: number;
  started_at?: string;
  finished_at?: string;
  error?: string;
  logs?: any;
  created_at: string;
}

export interface ProcessingStats {
  total_raw: number;
  total_processed: number;
  pending: number;
  completion_rate: number;
  by_language: { language: string; count: number }[];
  by_source_type: { source_type: string; count: number }[];
}

// ─── Sprint 5 — AI Enrichment ─────────────────────────────────────────────────

export type HypothesisImpact =
  | 'OPEN'
  | 'PARTIALLY_SUPPORTED'
  | 'SUPPORTED'
  | 'CONTRADICTED'
  | 'NEEDS_MORE_RESEARCH';

export interface EnrichedItem {
  id: string;
  processed_item_id: string;
  project_id: string;
  collection_plan_id?: string;
  hypothesis_id?: string;

  answer?: string;
  summary?: string;
  entities?: any;
  topics?: any;
  sentiment?: string;
  relevance_score?: number;
  hypothesis_impact: HypothesisImpact;
  confidence_score?: number;
  raw_response?: any;

  model_used?: string;
  prompt_version?: string;
  enriched_at: string;

  processed_item?: Partial<ProcessedItem>;
}

export interface AiEnrichmentJob {
  id: string;
  project_id?: string;
  plan_id?: string;
  hypothesis_id?: string;

  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'SKIPPED';
  trigger_type: string;

  total: number;
  processed: number;
  skipped: number;
  failed: number;

  model_used?: string;
  started_at?: string;
  finished_at?: string;
  error?: string;
  logs?: any;
  created_at: string;
}

export interface HypothesisEvaluation {
  id: string;
  hypothesis_id: string;
  project_id: string;

  status: HypothesisImpact;
  confidence?: number;
  summary?: string;
  evidence_count: number;
  support_count: number;
  against_count: number;
  neutral_count: number;

  last_evaluated: string;
  created_at: string;
  updated_at: string;
}

export interface AiEnrichmentStats {
  total_enriched: number;
  avg_relevance: number;
  avg_confidence: number;
  hypotheses_evaluated: number;
  model_used?: string;
  by_impact: Record<HypothesisImpact, number>;
  hypothesis_evaluations?: HypothesisEvaluation[];
}

// ─── Sprint 6 — Dashboard ─────────────────────────────────────────────────────

export interface PipelineStats {
  total_raw: number;
  total_processed: number;
  total_enriched: number;
  completion_rate: number;
  enrichment_rate: number;
}
