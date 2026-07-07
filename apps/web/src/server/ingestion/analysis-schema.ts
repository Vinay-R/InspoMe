import { z } from "zod";

// Single source of truth for the Gemini analysis output shape.
// Spec reference: inspome_v3_inspo_page_mvp_spec_with_onboarding.md → "Gemini Output Schema".
//
// Used in two places:
//   1. The Gemini provider passes this shape (or its JSON-schema projection) as
//      `responseSchema` so Gemini constrains its output server-side.
//   2. The persistence path validates the parsed response with `AnalysisDataSchema`
//      before writing to `video_analysis` — never trust model output naively.

const FitLevel = z.enum(["low", "medium", "high"]);
const Pace = z.enum(["slow", "medium", "fast"]);
const Frequency = z.enum(["low", "medium", "high"]);
const VisualDensity = z.enum(["low", "medium", "high"]);

const HookModality = z.enum([
  "spoken",
  "text_overlay",
  "visual",
  "audio",
  "behavioral",
  "mixed",
]);

const WhyItWorkedSchema = z.object({
  primary_reason: z.string(),
  secondary_reasons: z.array(z.string()),
  platform_fit: FitLevel,
  audience_fit: FitLevel,
  creative_strengths: z.array(z.string()),
  performance_risks: z.array(z.string()),
});

const HookSchema = z.object({
  text: z.string(),
  type: z.string(),
  modality: HookModality,
  timestamp_start: z.number().min(0),
  timestamp_end: z.number().min(0),
  strength_score: z.number().int().min(1).max(10),
  notes: z.string(),
});

const StructureBeatSchema = z.object({
  timestamp_start: z.number().min(0),
  timestamp_end: z.number().min(0),
  label: z.string(),
  description: z.string(),
  purpose: z.string(),
});

const StructureSchema = z.object({
  type: z.string(),
  pacing: Pace,
  loopability: FitLevel,
  retention_arc: z.string(),
  beats: z.array(StructureBeatSchema),
});

const NotableFrameSchema = z.object({
  timestamp: z.number().min(0),
  description: z.string(),
  why_it_matters: z.string(),
});

const VisualsSchema = z.object({
  style: z.string(),
  camera_framing: z.string(),
  setting: z.string(),
  lighting: z.string(),
  motion: z.string(),
  text_overlay: z.string(),
  visual_density: VisualDensity,
  notable_frames: z.array(NotableFrameSchema),
});

const AudioSchema = z.object({
  transcript: z.string(),
  speaking_style: z.string(),
  speaking_pace: Pace,
  music_usage: z.string(),
  sound_effects: z.string(),
  caption_alignment: z.string(),
  key_phrases: z.array(z.string()),
});

const EditingSchema = z.object({
  pace: Pace,
  cut_frequency: Frequency,
  transitions: z.array(z.string()),
  caption_style: z.string(),
  retention_devices: z.array(z.string()),
  pattern_interrupts: z.array(z.string()),
});

const ReusablePatternSchema = z.object({
  name: z.string(),
  template: z.string(),
  when_to_use: z.string(),
  why_it_works: z.string(),
  adaptation_notes: z.string(),
});

const TagsSchema = z.object({
  topics: z.array(z.string()),
  format: z.array(z.string()),
  hook_type: z.array(z.string()),
  structure_type: z.array(z.string()),
  visual_style: z.array(z.string()),
  editing_style: z.array(z.string()),
  tone: z.array(z.string()),
  content_pillar: z.array(z.string()),
  audience_intent: z.array(z.string()),
  performance_driver: z.array(z.string()),
});

export const AnalysisDataSchema = z.object({
  summary: z.string(),
  content_category: z.string().nullable(),
  primary_topic: z.string().nullable(),
  target_audience: z.string().nullable(),
  why_it_worked: WhyItWorkedSchema,
  hook: HookSchema,
  structure: StructureSchema,
  visuals: VisualsSchema,
  audio: AudioSchema,
  editing: EditingSchema,
  reusable_pattern: ReusablePatternSchema,
  tags: TagsSchema,
  search_summary: z.string(),
});

export type AnalysisData = z.infer<typeof AnalysisDataSchema>;
export type AnalysisWhyItWorked = z.infer<typeof WhyItWorkedSchema>;
export type AnalysisHook = z.infer<typeof HookSchema>;
export type AnalysisStructure = z.infer<typeof StructureSchema>;
export type AnalysisStructureBeat = z.infer<typeof StructureBeatSchema>;
export type AnalysisVisuals = z.infer<typeof VisualsSchema>;
export type AnalysisNotableFrame = z.infer<typeof NotableFrameSchema>;
export type AnalysisAudio = z.infer<typeof AudioSchema>;
export type AnalysisEditing = z.infer<typeof EditingSchema>;
export type AnalysisReusablePattern = z.infer<typeof ReusablePatternSchema>;
export type AnalysisTags = z.infer<typeof TagsSchema>;

// Schema version is sent with each analysis row so we can migrate output
// shapes over time without breaking historical reads.
export const ANALYSIS_SCHEMA_VERSION = "v1";
