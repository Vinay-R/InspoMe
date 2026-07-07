import type { Platform } from "@/lib/supabase/types";
import type { AnalysisData } from "./analysis-schema";

export type MediaDownloadResult = {
  success: boolean;
  platform: Platform;
  sourceUrl: string;
  mediaFileUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  fileSizeBytes?: number;
  mimeType?: string;
  creatorHandle?: string;
  caption?: string;
  errorCode?: string;
  errorMessage?: string;
};

export interface MediaDownloadProvider {
  readonly name: string;
  canHandle(url: string): boolean;
  download(url: string): Promise<MediaDownloadResult>;
}

export type AnalysisInput = {
  inspoId: string;
  userId: string;
  sourceUrl: string;
  platform: Platform;
  mediaFileUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
  creatorHandle?: string;
  saveReasons: string[];
  // User identity context for prompt personalization (not user input).
  userContext: {
    creator_category: string | null;
    creator_category_custom: string | null;
    niche: string[];
    content_goals: string[];
    preferred_content: string[];
    pillars: string[];
    experience_level: string | null;
    tone: string[];
  };
};

export type AnalysisResult = {
  modelProvider: string;
  modelName: string;
  promptVersion: string;
  schemaVersion: string;
  data: AnalysisData;
};

export interface VideoAnalysisProvider {
  readonly name: string;
  analyze(input: AnalysisInput): Promise<AnalysisResult>;
}

export type IngestionInput = {
  inspoId: string;
  userId: string;
  url: string;
  platform: Platform;
  /** 1-based attempt counter. Defaults to 1; retries pass previous + 1. */
  attempt?: number;
};

export interface ContentIngestionService {
  enqueue(input: IngestionInput): Promise<{ jobId: string; status: "queued" }>;
}
