// src/services/aiService.ts
// AI-powered services: checklists, dispute suggestions, cleaner ranking

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { enqueue, QUEUE_NAMES } from "../lib/queue";

// ============================================
// Configuration
// ============================================

const AI_CONFIG = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  MODEL: process.env.OPENAI_MODEL || "gpt-4o-mini",
  MAX_TOKENS: 1000,
  TEMPERATURE: 0.7,
};

// ============================================
// Types
// ============================================

export interface ChecklistInput {
  bedrooms: number;
  bathrooms: number;
  square_feet?: number;
  has_pets: boolean;
  has_kids: boolean;
  cleaning_type: "basic" | "deep" | "moveout";
  special_notes?: string;
}

export interface ChecklistResult {
  estimated_hours: number;
  steps: string[];
  tips: string[];
  supplies_needed: string[];
}

export interface DisputeInput {
  job_id: string;
  client_message: string;
  cleaner_message?: string;
  photos?: string[];
  job_metadata: {
    cleaning_type: string;
    scheduled_hours: number;
    actual_hours?: number;
    rating?: number;
    credit_amount: number;
    cleaner_reliability: number;
    client_history: {
      total_jobs: number;
      disputes: number;
    };
  };
}

export interface DisputeSuggestion {
  recommended_action: "full_refund" | "partial_refund" | "no_refund" | "reclean";
  refund_percentage?: number;
  confidence: "low" | "medium" | "high";
  summary: string;
  notes_for_admin: string;
  factors_considered: string[];
}

// ============================================
// Base AI Service
// ============================================

/**
 * Call OpenAI API with structured prompt
 */
async function invokeModel(
  systemPrompt: string,
  userMessage: string,
  jsonMode: boolean = true
): Promise<unknown> {
  if (!AI_CONFIG.OPENAI_API_KEY) {
    logger.warn("ai_api_key_missing", { fallback: "using_mock_response" });
    return null; // Caller should handle with fallback
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_CONFIG.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_CONFIG.MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: AI_CONFIG.MAX_TOKENS,
        temperature: AI_CONFIG.TEMPERATURE,
        response_format: jsonMode ? { type: "json_object" } : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (jsonMode && content) {
      return JSON.parse(content);
    }

    return content;
  } catch (err) {
    logger.error("ai_model_invocation_failed", { error: (err as Error).message });
    throw err;
  }
}

// ============================================
// AI Checklist Service
// ============================================

const CHECKLIST_SYSTEM_PROMPT = `You are an expert cleaning assistant for PureTask, a professional cleaning service.

Generate a detailed, practical cleaning checklist based on the property details provided.

Always respond with valid JSON in this exact format:
{
  "estimated_hours": <number>,
  "steps": [<string array of cleaning steps in order>],
  "tips": [<string array of pro tips>],
  "supplies_needed": [<string array of recommended supplies>]
}

Guidelines:
- For basic cleaning: focus on surface cleaning, vacuuming, mopping, bathrooms, kitchen
- For deep cleaning: add baseboards, inside appliances, windows, detailed dusting
- For move-out: add walls, inside cabinets, all appliances, garage if applicable
- Estimate hours based on: ~30 min per room for basic, ~45 min for deep, ~60 min for move-out
- Add +30 min for pets (extra vacuuming), +15 min for kids (extra sanitizing)
- Keep steps concise but specific
- Include 3-5 pro tips relevant to the cleaning type
- List only essential supplies`;

/**
 * Generate cleaning checklist using AI
 */
export async function generateChecklist(input: ChecklistInput): Promise<ChecklistResult> {
  const userMessage = `
Property Details:
- Bedrooms: ${input.bedrooms}
- Bathrooms: ${input.bathrooms}
${input.square_feet ? `- Square Feet: ${input.square_feet}` : ""}
- Has Pets: ${input.has_pets ? "Yes" : "No"}
- Has Kids: ${input.has_kids ? "Yes" : "No"}
- Cleaning Type: ${input.cleaning_type}
${input.special_notes ? `- Special Notes: ${input.special_notes}` : ""}

Generate a detailed cleaning checklist for this property.`;

  try {
    const result = await invokeModel(CHECKLIST_SYSTEM_PROMPT, userMessage, true);

    if (!result) {
      // Fallback to deterministic checklist
      return generateFallbackChecklist(input);
    }

    const aiResult = result as ChecklistResult;

    logger.info("ai_checklist_generated", {
      bedrooms: input.bedrooms,
      cleaningType: input.cleaning_type,
      estimatedHours: aiResult.estimated_hours,
      stepCount: aiResult.steps.length,
    });

    return aiResult;
  } catch (err) {
    logger.error("ai_checklist_failed", { error: (err as Error).message });
    return generateFallbackChecklist(input);
  }
}

/**
 * Fallback checklist when AI is unavailable
 */
function generateFallbackChecklist(input: ChecklistInput): ChecklistResult {
  const baseHours = {
    basic: 0.5,
    deep: 0.75,
    moveout: 1.0,
  };

  const roomCount = input.bedrooms + input.bathrooms + 2; // +2 for kitchen/living
  let estimatedHours = roomCount * baseHours[input.cleaning_type];

  if (input.has_pets) estimatedHours += 0.5;
  if (input.has_kids) estimatedHours += 0.25;

  const basicSteps = [
    "Declutter and organize all rooms",
    "Dust all surfaces including shelves and furniture",
    "Vacuum all carpets and rugs",
    "Mop hard floors",
    "Clean and sanitize all bathrooms",
    "Clean kitchen counters and sink",
    "Take out trash and replace bags",
    "Make beds and arrange pillows",
  ];

  const deepSteps = [
    ...basicSteps,
    "Clean inside microwave and oven",
    "Wipe down refrigerator inside and out",
    "Clean baseboards throughout",
    "Wash windows interior",
    "Deep clean shower/tub grout",
    "Clean light fixtures and ceiling fans",
  ];

  const moveoutSteps = [
    ...deepSteps,
    "Clean inside all cabinets and drawers",
    "Clean walls and remove marks",
    "Clean inside closets",
    "Detail clean all appliances",
    "Clean garage floor (if applicable)",
    "Final walk-through inspection",
  ];

  const stepsMap = {
    basic: basicSteps,
    deep: deepSteps,
    moveout: moveoutSteps,
  };

  return {
    estimated_hours: Math.round(estimatedHours * 2) / 2, // Round to nearest 0.5
    steps: stepsMap[input.cleaning_type],
    tips: [
      "Work from top to bottom to avoid re-cleaning",
      "Use microfiber cloths for streak-free surfaces",
      "Open windows for ventilation while cleaning",
    ],
    supplies_needed: [
      "All-purpose cleaner",
      "Glass cleaner",
      "Bathroom cleaner",
      "Microfiber cloths",
      "Mop and bucket",
      "Vacuum cleaner",
    ],
  };
}

// ============================================
// AI Dispute Suggestion Service
// ============================================

const DISPUTE_SYSTEM_PROMPT = `You are an expert dispute resolution advisor for PureTask, a professional cleaning marketplace.

Analyze the dispute details and provide a fair, balanced recommendation.

Always respond with valid JSON in this exact format:
{
  "recommended_action": "full_refund" | "partial_refund" | "no_refund" | "reclean",
  "refund_percentage": <number 0-100, only if partial_refund>,
  "confidence": "low" | "medium" | "high",
  "summary": "<brief summary of your analysis>",
  "notes_for_admin": "<detailed notes with reasoning>",
  "factors_considered": [<string array of key factors>]
}

Guidelines:
- Consider both client and cleaner perspectives fairly
- Photo evidence is important - lack of photos weakens cleaner's position
- Time spent vs booked time matters
- Client's dispute history affects credibility (frequent disputors may be abusing system)
- Cleaner's reliability score indicates track record
- For minor issues, partial refunds (20-40%) often appropriate
- Full refunds only for significant service failures
- Reclean offered when cleaner is willing and issue is correctable
- No refund when claim seems unfounded or client is repeat abuser`;

/**
 * Generate dispute resolution suggestion using AI
 */
export async function generateDisputeSuggestion(
  input: DisputeInput
): Promise<DisputeSuggestion> {
  const userMessage = `
Dispute Details:
- Job ID: ${input.job_id}
- Cleaning Type: ${input.job_metadata.cleaning_type}
- Scheduled Hours: ${input.job_metadata.scheduled_hours}
${input.job_metadata.actual_hours ? `- Actual Hours: ${input.job_metadata.actual_hours}` : ""}
- Credit Amount: ${input.job_metadata.credit_amount}
- Cleaner Reliability Score: ${input.job_metadata.cleaner_reliability}/100
- Client History: ${input.job_metadata.client_history.total_jobs} total jobs, ${input.job_metadata.client_history.disputes} disputes

Client's Complaint:
"${input.client_message}"

${input.cleaner_message ? `Cleaner's Response:\n"${input.cleaner_message}"` : "No cleaner response provided."}

${input.photos?.length ? `Photos provided: ${input.photos.length} photos` : "No photos provided"}

Analyze this dispute and provide a recommendation.`;

  try {
    const result = await invokeModel(DISPUTE_SYSTEM_PROMPT, userMessage, true);

    if (!result) {
      // Fallback to deterministic suggestion
      return generateFallbackDisputeSuggestion(input);
    }

    const aiResult = result as DisputeSuggestion;

    logger.info("ai_dispute_suggestion_generated", {
      jobId: input.job_id,
      recommendedAction: aiResult.recommended_action,
      confidence: aiResult.confidence,
    });

    return aiResult;
  } catch (err) {
    logger.error("ai_dispute_suggestion_failed", { error: (err as Error).message });
    return generateFallbackDisputeSuggestion(input);
  }
}

/**
 * Fallback dispute suggestion when AI is unavailable
 */
function generateFallbackDisputeSuggestion(input: DisputeInput): DisputeSuggestion {
  const factors: string[] = [];
  let score = 50; // Start neutral

  // Client history factor
  const disputeRate = input.job_metadata.client_history.disputes / 
    Math.max(input.job_metadata.client_history.total_jobs, 1);
  
  if (disputeRate > 0.3) {
    score -= 20;
    factors.push("High dispute rate from client (>30%)");
  } else if (disputeRate < 0.1) {
    score += 10;
    factors.push("Low dispute rate from client (<10%)");
  }

  // Cleaner reliability factor
  if (input.job_metadata.cleaner_reliability >= 90) {
    score -= 10;
    factors.push("High cleaner reliability score");
  } else if (input.job_metadata.cleaner_reliability < 70) {
    score += 15;
    factors.push("Below-average cleaner reliability");
  }

  // Photo evidence
  if (!input.photos || input.photos.length === 0) {
    score += 10;
    factors.push("No photo evidence provided");
  } else {
    factors.push("Photo evidence available for review");
  }

  // Cleaner response
  if (!input.cleaner_message) {
    score += 10;
    factors.push("No cleaner response to complaint");
  } else {
    factors.push("Cleaner provided response");
  }

  // Determine recommendation based on score
  let recommended_action: DisputeSuggestion["recommended_action"];
  let refund_percentage: number | undefined;
  let confidence: DisputeSuggestion["confidence"];

  if (score >= 70) {
    recommended_action = "full_refund";
    confidence = score >= 80 ? "high" : "medium";
  } else if (score >= 50) {
    recommended_action = "partial_refund";
    refund_percentage = Math.round(score - 20);
    confidence = "medium";
  } else if (score >= 30) {
    recommended_action = "partial_refund";
    refund_percentage = 25;
    confidence = "low";
  } else {
    recommended_action = "no_refund";
    confidence = score < 20 ? "high" : "medium";
  }

  return {
    recommended_action,
    refund_percentage,
    confidence,
    summary: "Automated analysis based on available factors. Human review recommended.",
    notes_for_admin: `Score: ${score}/100. Factors: ${factors.join("; ")}. This is a fallback analysis - AI was unavailable.`,
    factors_considered: factors,
  };
}

// ============================================
// Queue Wrappers
// ============================================

/**
 * Queue checklist generation (non-blocking)
 */
export async function queueChecklistGeneration(
  jobId: string,
  input: ChecklistInput
): Promise<void> {
  await enqueue(QUEUE_NAMES.AI_CHECKLIST, { jobId, input });
  logger.debug("checklist_generation_queued", { jobId });
}

/**
 * Queue dispute suggestion (non-blocking)
 */
export async function queueDisputeSuggestion(
  disputeId: string,
  input: DisputeInput
): Promise<void> {
  await enqueue(QUEUE_NAMES.AI_DISPUTE, { disputeId, input });
  logger.debug("dispute_suggestion_queued", { disputeId });
}

