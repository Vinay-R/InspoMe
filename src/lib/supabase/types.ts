export type Platform = "tiktok" | "instagram" | "unknown";

export type AnalysisStatus =
  | "not_started"
  | "queued"
  | "processing"
  | "complete"
  | "partial"
  | "failed";

export type MediaStatus = "not_started" | "queued" | "downloaded" | "failed";

export type MetricsStatus =
  | "not_started"
  | "available"
  | "partial"
  | "unavailable"
  | "failed";

export type IngestionJobStatus =
  | "queued"
  | "downloading"
  | "downloaded"
  | "uploading_to_gemini"
  | "analyzing"
  | "complete"
  | "partial"
  | "failed";

export type AccessStatus = "unknown" | "accessible" | "limited" | "unavailable";

export type CreatorCategory =
  | "business_brand"
  | "creator_personal_brand"
  | "artist_musician"
  | "other";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type UserRow = {
  id: string;
  email: string | null;
  creator_category: CreatorCategory | null;
  creator_category_custom: string | null;
  niche: string[];
  content_goals: string[];
  preferred_content: string[];
  pillars: string[];
  tone: string[];
  experience_level: ExperienceLevel | null;
  onboarding_completed: boolean;
  onboarding_completed_at: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
};

export type InspoRow = {
  id: string;
  user_id: string;
  url_original: string;
  url_canonical: string | null;
  platform: Platform;
  platform_content_id: string | null;
  creator_handle: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  deep_link_url: string;
  media_storage_url: string | null;
  duration_seconds: number | null;
  save_reasons: string[];
  note: string | null;
  access_status: AccessStatus;
  media_status: MediaStatus;
  analysis_status: AnalysisStatus;
  metrics_status: MetricsStatus;
  user_hidden: boolean;
  created_at: string;
  updated_at: string;
  last_analyzed_at: string | null;
  last_metrics_fetched_at: string | null;
};

export type WhyItWorked = {
  primary_reason: string;
  secondary_reasons: string[];
  platform_fit: "low" | "medium" | "high";
  audience_fit: "low" | "medium" | "high";
  creative_strengths: string[];
  performance_risks: string[];
};

export type Hook = {
  text: string;
  type: string;
  modality: "spoken" | "text_overlay" | "visual" | "audio" | "behavioral" | "mixed";
  timestamp_start: number;
  timestamp_end: number;
  strength_score: number;
  notes: string;
};

export type StructureBeat = {
  timestamp_start: number;
  timestamp_end: number;
  label: string;
  description: string;
  purpose: string;
};

export type Structure = {
  type: string;
  pacing: "slow" | "medium" | "fast";
  loopability: "low" | "medium" | "high";
  retention_arc: string;
  beats: StructureBeat[];
};

export type NotableFrame = {
  timestamp: number;
  description: string;
  why_it_matters: string;
};

export type Visuals = {
  style: string;
  camera_framing: string;
  setting: string;
  lighting: string;
  motion: string;
  text_overlay: string;
  visual_density: "low" | "medium" | "high";
  notable_frames: NotableFrame[];
};

export type AudioAnalysis = {
  transcript: string;
  speaking_style: string;
  speaking_pace: "slow" | "medium" | "fast";
  music_usage: string;
  sound_effects: string;
  caption_alignment: string;
  key_phrases: string[];
};

export type Editing = {
  pace: "slow" | "medium" | "fast";
  cut_frequency: "low" | "medium" | "high";
  transitions: string[];
  caption_style: string;
  retention_devices: string[];
  pattern_interrupts: string[];
};

export type ReusablePattern = {
  name: string;
  template: string;
  when_to_use: string;
  why_it_works: string;
  adaptation_notes: string;
};

export type AnalysisTags = {
  topics: string[];
  format: string[];
  hook_type: string[];
  structure_type: string[];
  visual_style: string[];
  editing_style: string[];
  tone: string[];
  content_pillar: string[];
  audience_intent: string[];
  performance_driver: string[];
};

export type VideoAnalysisRow = {
  id: string;
  user_id: string;
  inspo_id: string;
  summary: string;
  content_category: string | null;
  primary_topic: string | null;
  target_audience: string | null;
  why_it_worked: WhyItWorked;
  hook: Hook;
  structure: Structure;
  visuals: Visuals;
  audio: AudioAnalysis;
  editing: Editing;
  reusable_pattern: ReusablePattern;
  tags: AnalysisTags;
  search_summary: string;
  model_provider: string;
  model_name: string;
  prompt_version: string;
  schema_version: string;
  created_at: string;
  updated_at: string;
};

export type PlatformMetricsRow = {
  id: string;
  user_id: string;
  inspo_id: string;
  platform: "tiktok" | "instagram";
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  favorites: number | null;
  reposts: number | null;
  creator_follower_count: number | null;
  posted_at: string | null;
  engagement_rate: number | null;
  like_rate: number | null;
  comment_rate: number | null;
  share_rate: number | null;
  save_rate: number | null;
  source:
    | "official_api"
    | "permissioned_user_connection"
    | "research_api"
    | "embed_metadata"
    | "manual"
    | "unavailable";
  confidence: "high" | "medium" | "low" | "unknown";
  fetched_at: string;
  created_at: string;
};

export type IngestionJobRow = {
  id: string;
  user_id: string;
  inspo_id: string;
  provider: string;
  status: IngestionJobStatus;
  attempts: number;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};
