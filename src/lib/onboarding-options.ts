// Single source of truth for onboarding option lists.
// Values are stored verbatim in text[] columns (niche, content_goals, pillars, tone, preferred_content).
// "Other" reveals a custom text input — the typed string is appended to the array.

export const PREFERRED_CONTENT_OPTIONS = [
  "Talking to Camera",
  "Voiceover with Clips",
  "Clips with Text Overlays",
  "Filming IRL Moments / Conversations",
  "Aesthetic / Cinematic Visuals",
  "Skits / Acting / Characters",
  "Carousels",
] as const;

export const NICHE_OPTIONS = [
  "Art",
  "Beauty",
  "Health & Wellness",
  "Business",
  "Comedy",
  "Education",
  "Events",
  "Fashion",
  "Finance & Investing",
  "Fitness",
  "Food",
  "Gaming",
  "Lifestyle",
  "Music",
  "News & Commentary",
  "Photography",
  "Sports",
  "Technology",
  "Travel",
] as const;

export const CREATOR_CATEGORY_OPTIONS = [
  { value: "business_brand", label: "Business Owner / Brand" },
  { value: "creator_personal_brand", label: "Content Creator / Personal Brand" },
  { value: "artist_musician", label: "Artist / Musician" },
  { value: "other", label: "Other" },
] as const;

export const CONTENT_GOALS_OPTIONS = [
  "Grow Followers",
  "Promote my Brand / Art",
  "Drive Sales",
  "Go Viral",
  "Just Stay Consistent",
] as const;

export const PILLARS_OPTIONS = [
  "Community / Engagement",
  "Content About Content",
  "Curation / Aggregation",
  "Educational / Value",
  "Entertainment",
  "Experimentation / Challenges",
  "Inspiration / Motivation",
  "Opinion / Hot Takes",
  "Process / Behind-the-Scenes",
  "Personal / Story",
  "Promotional",
] as const;

export const EXPERIENCE_LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner — I struggle to post" },
  { value: "intermediate", label: "Intermediate — I post sometimes" },
  { value: "advanced", label: "Advanced — I post consistently" },
] as const;

export const TONE_OPTIONS = [
  "Casual",
  "Educational",
  "Funny",
  "Luxury",
  "Polished",
  "Raw",
] as const;
