import "server-only";

import type {
  AnalysisInput,
  AnalysisResult,
  VideoAnalysisProvider,
} from "../types";

/**
 * Phase 1 stub. Returns a structurally-valid analysis the UI can render.
 * Replaced in Phase 2 by a real Gemini call (multimodal video understanding).
 *
 * The output deliberately incorporates user context so designers can verify
 * personalization wires through correctly before the real model is connected.
 */
export class StubGeminiProvider implements VideoAnalysisProvider {
  readonly name = "stub-gemini";

  async analyze(input: AnalysisInput): Promise<AnalysisResult> {
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2000));

    const niche = input.userContext.niche[0] ?? "general";
    const goal = input.userContext.content_goals[0] ?? "Grow Followers";
    const fmt = input.userContext.preferred_content[0] ?? "Talking to Camera";

    return {
      modelProvider: "stub-gemini",
      modelName: "stub-gemini-1.0",
      promptVersion: "v0",
      schemaVersion: "v1",
      data: {
        summary: `A short-form ${input.platform} video that opens with a strong hook and uses pacing tuned for vertical viewing. Likely speaks to a ${niche} audience.`,
        content_category: niche,
        primary_topic: niche,
        target_audience: `${niche} viewers interested in ${goal.toLowerCase()}`,
        why_it_worked: {
          primary_reason:
            "Front-loaded payoff in the first 1.5s creates a curiosity loop the viewer wants to resolve.",
          secondary_reasons: [
            "Tight cuts maintain attention through the first retention dip.",
            "On-screen text reinforces the spoken message for sound-off viewers.",
          ],
          platform_fit: "high",
          audience_fit: "medium",
          creative_strengths: [
            "Confident delivery",
            "Clear visual hierarchy",
            "Specificity over generality",
          ],
          performance_risks: [
            "Hook depends on viewer being already curious about the topic.",
          ],
        },
        hook: {
          text: "You've been doing this wrong the whole time.",
          type: "Pattern interrupt",
          modality: "spoken",
          timestamp_start: 0,
          timestamp_end: 2,
          strength_score: 8,
          notes:
            "Pairs spoken claim with a quick zoom-in for visual reinforcement.",
        },
        structure: {
          type: fmt.includes("Talking") ? "Hot take" : "Listicle",
          pacing: "fast",
          loopability: "medium",
          retention_arc:
            "Hook → context → 3 quick beats → callback → CTA loops to hook.",
          beats: [
            {
              timestamp_start: 0,
              timestamp_end: 2,
              label: "Hook",
              description: "Contrarian claim with zoom-in.",
              purpose: "Earn attention.",
            },
            {
              timestamp_start: 2,
              timestamp_end: 6,
              label: "Context",
              description: "Frames who this is for.",
              purpose: "Filter audience and signal relevance.",
            },
            {
              timestamp_start: 6,
              timestamp_end: 18,
              label: "Body",
              description: "Three short proof points with text overlays.",
              purpose: "Deliver promised payoff.",
            },
            {
              timestamp_start: 18,
              timestamp_end: 24,
              label: "Callback",
              description: "Returns to the hook claim and resolves it.",
              purpose: "Close the curiosity loop.",
            },
          ],
        },
        visuals: {
          style: "Talking head with text overlays",
          camera_framing: "Medium close-up, eye-level",
          setting: "Bright indoor space with soft background blur",
          lighting: "Soft key from camera-left, flat fill",
          motion: "Static frame with occasional punch-in zooms",
          text_overlay:
            "Bold sans-serif phrases mirroring spoken keywords",
          visual_density: "medium",
          notable_frames: [
            {
              timestamp: 1.2,
              description: "Quick punch-in zoom on creator's face.",
              why_it_matters:
                "Punctuates the hook's emotional beat.",
            },
          ],
        },
        audio: {
          transcript:
            "Most people think the algorithm decides — but actually, it's the first second.",
          speaking_style: "Direct, conversational",
          speaking_pace: "fast",
          music_usage: "Subtle ambient bed under voice",
          sound_effects: "Whoosh on cuts, soft pop on text reveals",
          caption_alignment: "Caption matches spoken phrasing word-for-word",
          key_phrases: ["first second", "most people think", "actually"],
        },
        editing: {
          pace: "fast",
          cut_frequency: "high",
          transitions: ["jump cut", "match cut", "whip pan"],
          caption_style: "Bold center-screen with keyword highlights",
          retention_devices: [
            "Open loop in hook",
            "Text-driven pattern interrupts",
            "Callback to opener",
          ],
          pattern_interrupts: [
            "Sudden zoom at 1.2s",
            "Background change at 8s",
          ],
        },
        reusable_pattern: {
          name: "Contrarian Expert Breakdown",
          template:
            "Most people think [common belief], but actually [counterintuitive truth]. Here's why...",
          when_to_use:
            "When challenging a common assumption in your niche.",
          why_it_works:
            "Creates tension, signals expertise, and gives viewers a reason to keep watching.",
          adaptation_notes: `For your niche (${niche}) and goal (${goal.toLowerCase()}), front-load the specific claim within the first 1.5 seconds.`,
        },
        tags: {
          topics: [niche.toLowerCase().replace(/\W+/g, "_")],
          format: ["talking_head"],
          hook_type: ["pattern_interrupt", "contrarian_take"],
          structure_type: ["hot_take"],
          visual_style: ["bright_indoor", "punch_in_zoom"],
          editing_style: ["fast_cuts", "text_reveals"],
          tone: input.userContext.tone.length
            ? input.userContext.tone.map((t) => t.toLowerCase())
            : ["confident"],
          content_pillar: input.userContext.pillars.map((p) =>
            p.toLowerCase().replace(/\W+/g, "_"),
          ),
          audience_intent: ["learning", "validation"],
          performance_driver: ["hook_strength", "retention_loops"],
        },
        search_summary: `${niche} ${input.platform} hot take with contrarian hook, fast cuts, and bold text overlays — strong example of a curiosity-loop opener.`,
      },
    };
  }
}
