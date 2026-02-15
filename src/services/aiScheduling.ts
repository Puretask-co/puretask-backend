// src/services/aiScheduling.ts
// AI-Powered Scheduling Service

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

interface BookingSlotSuggestion {
  date: string;
  start_time: string;
  end_time: string;
  reasoning: string;
  fills_gap: boolean;
  match_score?: number;
}

interface SuggestSlotsParams {
  client_id: string;
  cleaner_id: string;
  cleaning_type: string;
  estimated_hours: number;
  preferred_dates?: string[];
  address: string;
  entry_instructions?: string;
  client_preferences?: Record<string, any>;
}

export class AISchedulingService {
  /**
   * Generate AI-powered booking slot suggestions
   */
  static async suggestBookingSlots(params: SuggestSlotsParams): Promise<{
    suggested_slots: BookingSlotSuggestion[];
    alternative_message?: string;
  }> {
    try {
      const { cleaner_id, cleaning_type, estimated_hours, preferred_dates, address } = params;

      // 1. Fetch cleaner profile and settings
      const cleanerResult = await query(
        `SELECT 
          user_id,
          first_name || ' ' || last_name as full_name,
          communication_settings,
          custom_availability_slots,
          specialty_tags,
          tier,
          reliability_score
         FROM cleaner_profiles
         WHERE user_id = $1`,
        [cleaner_id]
      );

      if (cleanerResult.rows.length === 0) {
        throw new Error("Cleaner not found");
      }

      const cleaner = cleanerResult.rows[0];
      const commSettings = cleaner.communication_settings || {};

      if (!commSettings.ai_scheduling_enabled) {
        return {
          suggested_slots: [],
          alternative_message: "AI scheduling is not enabled for this cleaner",
        };
      }

      const suggestDaysAhead = commSettings.suggest_days_in_advance || 14;
      const prioritizeGapFilling = commSettings.prioritize_gap_filling !== false;

      // 2. Fetch existing bookings to identify gaps
      const existingBookingsResult = await query(
        `SELECT 
          id, date, start_time, end_time, hours, address, status
         FROM jobs
         WHERE cleaner_id = $1
         AND date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${suggestDaysAhead} days'
         AND status IN ('scheduled', 'accepted', 'on_my_way', 'in_progress')
         ORDER BY date, start_time`,
        [cleaner_id]
      );

      const existingBookings = existingBookingsResult.rows;

      // 3. Get cleaner's availability slots
      const availabilitySlots = cleaner.custom_availability_slots || this.getDefaultAvailability();

      // 4. Build AI prompt
      const prompt = this.buildSchedulingPrompt({
        cleaner,
        existingBookings,
        availabilitySlots,
        cleaningType: cleaning_type,
        estimatedHours: estimated_hours,
        preferredDates: preferred_dates || [],
        address,
        prioritizeGapFilling,
        suggestDaysAhead,
      });

      // 5. Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an expert scheduling assistant for a cleaning service. Analyze availability and suggest optimal booking times.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1500,
      });

      const responseText = completion.choices[0].message.content || "{}";
      const aiResponse = JSON.parse(responseText);

      // 6. Validate and return suggestions
      const suggestedSlots = aiResponse.suggested_slots || [];

      // Log suggestion
      await this.logAISuggestion(cleaner_id, "booking_slot", {
        params,
        suggested_slots: suggestedSlots,
      });

      return {
        suggested_slots: suggestedSlots,
        alternative_message: aiResponse.alternative_message,
      };
    } catch (error) {
      logger.error("ai_scheduling_error", { error, params });
      throw error;
    }
  }

  /**
   * Build AI prompt for scheduling
   */
  private static buildSchedulingPrompt(data: {
    cleaner: any;
    existingBookings: any[];
    availabilitySlots: any;
    cleaningType: string;
    estimatedHours: number;
    preferredDates: string[];
    address: string;
    prioritizeGapFilling: boolean;
    suggestDaysAhead: number;
  }): string {
    const {
      cleaner,
      existingBookings,
      availabilitySlots,
      cleaningType,
      estimatedHours,
      preferredDates,
      address,
      prioritizeGapFilling,
      suggestDaysAhead,
    } = data;

    return `
TASK: Suggest 3-5 optimal booking time slots for a cleaning job.

CLEANER INFO:
- Name: ${cleaner.full_name}
- Tier: ${cleaner.tier}
- Reliability Score: ${cleaner.reliability_score}
- Specialties: ${cleaner.specialty_tags?.join(", ") || "General cleaning"}

CLIENT REQUEST:
- Cleaning Type: ${cleaningType}
- Estimated Hours: ${estimatedHours}
- Location: ${address}
- Preferred Dates: ${preferredDates.length > 0 ? preferredDates.join(", ") : "Flexible"}

CLEANER'S AVAILABILITY:
${JSON.stringify(availabilitySlots, null, 2)}

EXISTING BOOKINGS (Next ${suggestDaysAhead} days):
${
  existingBookings.length > 0
    ? existingBookings
        .map(
          (b) =>
            `${b.date} ${b.start_time}-${b.end_time} (${b.hours}h) at ${b.address.split(",")[0]}`
        )
        .join("\n")
    : "No existing bookings"
}

INSTRUCTIONS:
${prioritizeGapFilling ? "- PRIORITY: Fill gaps between existing bookings to maximize daily earnings" : "- Spread bookings evenly throughout the week"}
- Consider travel time between locations
- Respect cleaner's availability windows
- Match client's preferred dates when possible
- Suggest realistic time slots (not too early/late)
- Include buffer time between bookings (30 min minimum)

RESPONSE FORMAT (JSON):
{
  "suggested_slots": [
    {
      "date": "2026-01-15",
      "start_time": "10:00",
      "end_time": "13:00",
      "reasoning": "Fills gap between morning and afternoon bookings, same neighborhood as existing job",
      "fills_gap": true,
      "match_score": 95
    }
  ],
  "alternative_message": "If no good slots, suggest contacting cleaner directly"
}

Return ONLY valid JSON.
`;
  }

  /**
   * Get default availability (9 AM - 5 PM weekdays)
   */
  private static getDefaultAvailability() {
    return {
      monday: { available: true, slots: [{ start: "09:00", end: "17:00" }] },
      tuesday: { available: true, slots: [{ start: "09:00", end: "17:00" }] },
      wednesday: { available: true, slots: [{ start: "09:00", end: "17:00" }] },
      thursday: { available: true, slots: [{ start: "09:00", end: "17:00" }] },
      friday: { available: true, slots: [{ start: "09:00", end: "17:00" }] },
      saturday: { available: false, slots: [] },
      sunday: { available: false, slots: [] },
    };
  }

  /**
   * Log AI suggestion for analytics
   */
  private static async logAISuggestion(
    cleaner_id: string,
    suggestion_type: string,
    suggestion_data: any
  ) {
    try {
      await query(
        `INSERT INTO ai_suggestions (
          cleaner_id, suggestion_type, suggestion_data, expires_at
        ) VALUES ($1, $2, $3, NOW() + INTERVAL '48 hours')`,
        [cleaner_id, suggestion_type, JSON.stringify(suggestion_data)]
      );
    } catch (error) {
      logger.error("failed_to_log_ai_suggestion", { error });
    }
  }

  /**
   * Process client response to booking suggestions
   */
  static async processClientResponse(params: {
    booking_id: string;
    client_id: string;
    cleaner_id: string;
    response_type: "selected_slot" | "suggest_other" | "not_interested";
    selected_slot?: BookingSlotSuggestion;
  }) {
    const { booking_id, client_id, cleaner_id, response_type, selected_slot } = params;

    if (response_type === "selected_slot" && selected_slot) {
      // Create provisional booking
      await query(
        `UPDATE jobs
         SET status = 'awaiting_cleaner_approval',
             scheduled_start_at = $1,
             provisional_slot_expires_at = NOW() + INTERVAL '48 hours'
         WHERE id = $2`,
        [`${selected_slot.date}T${selected_slot.start_time}`, booking_id]
      );

      // Notify cleaner
      await query(
        `INSERT INTO notifications (
          recipient_id, type, title, message, link, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          cleaner_id,
          "booking_requires_approval",
          "New Booking Request",
          "A client has selected a time slot. Please review and approve.",
          `/jobs/${booking_id}`,
        ]
      );

      return { success: true, message: "Booking pending cleaner approval" };
    }

    if (response_type === "not_interested") {
      await query(
        `UPDATE jobs SET status = 'client_declined', request_status = 'declined' WHERE id = $1`,
        [booking_id]
      );

      return { success: true, message: "Booking declined" };
    }

    if (response_type === "suggest_other") {
      // Re-trigger suggestions with different parameters
      return { success: true, message: "Generating new suggestions..." };
    }

    return { success: false, message: "Invalid response type" };
  }
}
