/**
 * Cleaner AI Assistant Settings API
 *
 * Allows cleaners to manage their AI Assistant settings, templates, and preferences
 */

import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db/client";
import { requireAuth, AuthedRequest, authedHandler } from "../middleware/authCanonical";

const router = Router();

router.use(requireAuth);

// ============================================
// VALIDATION SCHEMAS
// ============================================

const updateSettingSchema = z.object({
  value: z.any(),
  enabled: z.boolean().optional(),
});

const createTemplateSchema = z.object({
  templateType: z.string(),
  templateName: z.string().min(1).max(100),
  templateContent: z.string().min(1).max(1000),
  variables: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  templateName: z.string().min(1).max(100).optional(),
  templateContent: z.string().min(1).max(1000).optional(),
  isActive: z.boolean().optional(),
});

const createQuickResponseSchema = z.object({
  category: z.string(),
  triggerKeywords: z.array(z.string()),
  responseText: z.string().min(1).max(500),
});

const updateQuickResponseSchema = z.object({
  responseText: z.string().min(1).max(500).optional(),
  triggerKeywords: z.array(z.string()).optional(),
  isFavorite: z.boolean().optional(),
});

const updatePreferencesSchema = z.object({
  communicationTone: z
    .enum(["professional", "friendly", "professional_friendly", "casual"])
    .optional(),
  formalityLevel: z.number().int().min(1).max(5).optional(),
  emojiUsage: z.enum(["none", "minimal", "moderate", "frequent"]).optional(),
  responseSpeed: z.enum(["immediate", "balanced", "thoughtful"]).optional(),
  businessHoursOnly: z.boolean().optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
  fullAutomationEnabled: z.boolean().optional(),
  requireApprovalForBookings: z.boolean().optional(),
  autoAcceptInstantBook: z.boolean().optional(),
  autoDeclineOutsideHours: z.boolean().optional(),
  learnFromResponses: z.boolean().optional(),
  suggestBetterResponses: z.boolean().optional(),
  autoImproveTemplates: z.boolean().optional(),
  shareAnonymizedData: z.boolean().optional(),
  allowAiTraining: z.boolean().optional(),
  priorityGoal: z
    .enum(["maximize_bookings", "quality_clients", "balanced", "work_life_balance"])
    .optional(),
  targetWeeklyHours: z.number().int().min(0).max(168).optional(),
  preferredBookingSize: z.enum(["small", "medium", "large", "any"]).optional(),
});

// ============================================
// GET ALL AI SETTINGS
// ============================================

router.get(
  "/settings",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;

      const settings = await query(
        `SELECT 
        setting_category as category,
        setting_key as key,
        setting_value as value,
        description,
        is_enabled as enabled,
        last_updated_at as "lastUpdated"
      FROM cleaner_ai_settings
      WHERE cleaner_id = $1
      ORDER BY setting_category, setting_key`,
        [cleanerId]
      );

      // Group by category
      const grouped = settings.rows.reduce((acc: any, setting: any) => {
        if (!acc[setting.category]) {
          acc[setting.category] = [];
        }
        acc[setting.category].push({
          key: setting.key,
          value: setting.value,
          description: setting.description,
          enabled: setting.enabled,
          lastUpdated: setting.lastUpdated,
        });
        return acc;
      }, {});

      res.json({
        cleanerId,
        settings: grouped,
        totalSettings: settings.rows.length,
      });
    } catch (error: any) {
      console.error("Error fetching AI settings:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch settings" },
      });
    }
  })
);

// ============================================
// GET SETTINGS BY CATEGORY
// ============================================

router.get(
  "/settings/:category",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const { category } = req.params;

      const settings = await query(
        `SELECT 
        setting_key as key,
        setting_value as value,
        description,
        is_enabled as enabled,
        last_updated_at as "lastUpdated"
      FROM cleaner_ai_settings
      WHERE cleaner_id = $1 AND setting_category = $2
      ORDER BY setting_key`,
        [cleanerId, category]
      );

      res.json({
        category,
        settings: settings.rows,
        count: settings.rows.length,
      });
    } catch (error: any) {
      console.error("Error fetching category settings:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch settings" },
      });
    }
  })
);

// ============================================
// UPDATE SPECIFIC SETTING
// ============================================

router.patch(
  "/settings/:settingKey",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const { settingKey } = req.params;
      const validated = updateSettingSchema.parse(req.body);

      const updates: string[] = [];
      const values: any[] = [cleanerId, settingKey];
      let paramCounter = 3;

      if (validated.value !== undefined) {
        updates.push(`setting_value = $${paramCounter}::jsonb`);
        values.push(JSON.stringify(validated.value));
        paramCounter++;
      }

      if (validated.enabled !== undefined) {
        updates.push(`is_enabled = $${paramCounter}`);
        values.push(validated.enabled);
        paramCounter++;
      }

      updates.push(`last_updated_at = NOW()`);

      const result = await query(
        `UPDATE cleaner_ai_settings
       SET ${updates.join(", ")}
       WHERE cleaner_id = $1 AND setting_key = $2
       RETURNING 
         setting_key as key,
         setting_value as value,
         is_enabled as enabled,
         last_updated_at as "lastUpdated"`,
        values
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: { code: "NOT_FOUND", message: "Setting not found" },
        });
        return;
      }

      res.json({
        message: "Setting updated successfully",
        setting: result.rows[0],
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: { code: "VALIDATION_ERROR", details: error.errors },
        });
        return;
      }
      console.error("Error updating setting:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to update setting" },
      });
    }
  })
);

// ============================================
// BULK UPDATE SETTINGS
// ============================================

router.post(
  "/settings/bulk-update",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const { settings } = req.body;

      if (!Array.isArray(settings)) {
        res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Settings must be an array" },
        });
        return;
      }

      await withTransaction(async (client) => {
        const updated = [];
        for (const setting of settings) {
          const result = await client.query(
            `UPDATE cleaner_ai_settings
           SET setting_value = $1::jsonb,
               is_enabled = COALESCE($2, is_enabled),
               last_updated_at = NOW()
           WHERE cleaner_id = $3 AND setting_key = $4
           RETURNING setting_key, setting_value, is_enabled`,
            [JSON.stringify(setting.value), setting.enabled, cleanerId, setting.key]
          );

          if (result.rows.length > 0) {
            updated.push(result.rows[0]);
          }
        }

        res.json({
          message: "Settings updated successfully",
          updated: updated.length,
          settings: updated,
        });
      });
    } catch (error: any) {
      console.error("Error bulk updating settings:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to update settings" },
      });
    }
  })
);

// ============================================
// GET ALL TEMPLATES
// ============================================

router.get(
  "/templates",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const { type, active } = req.query;

      let sql = `
      SELECT 
        id,
        template_type as type,
        template_name as name,
        template_content as content,
        variables,
        is_default as "isDefault",
        is_active as active,
        usage_count as "usageCount",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM cleaner_ai_templates
      WHERE cleaner_id = $1
    `;

      const params: any[] = [cleanerId];

      if (type) {
        sql += ` AND template_type = $${params.length + 1}`;
        params.push(type);
      }

      if (active !== undefined) {
        sql += ` AND is_active = $${params.length + 1}`;
        params.push(active === "true");
      }

      sql += ` ORDER BY template_type, is_default DESC, template_name`;

      const result = await query(sql, params);

      res.json({
        templates: result.rows,
        count: result.rows.length,
      });
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch templates" },
      });
    }
  })
);

// ============================================
// CREATE TEMPLATE
// ============================================

router.post(
  "/templates",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const validated = createTemplateSchema.parse(req.body);

      const result = await query(
        `INSERT INTO cleaner_ai_templates 
        (cleaner_id, template_type, template_name, template_content, variables, is_default)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING 
         id,
         template_type as type,
         template_name as name,
         template_content as content,
         variables,
         is_default as "isDefault",
         is_active as active,
         created_at as "createdAt"`,
        [
          cleanerId,
          validated.templateType,
          validated.templateName,
          validated.templateContent,
          JSON.stringify(validated.variables || []),
          validated.isDefault || false,
        ]
      );

      res.status(201).json({
        message: "Template created successfully",
        template: result.rows[0],
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: { code: "VALIDATION_ERROR", details: error.errors },
        });
        return;
      }
      console.error("Error creating template:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to create template" },
      });
    }
  })
);

// ============================================
// UPDATE TEMPLATE
// ============================================

router.patch(
  "/templates/:templateId",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const { templateId } = req.params;
      const validated = updateTemplateSchema.parse(req.body);

      const updates: string[] = [];
      const values: any[] = [templateId, cleanerId];
      let paramCounter = 3;

      if (validated.templateName) {
        updates.push(`template_name = $${paramCounter}`);
        values.push(validated.templateName);
        paramCounter++;
      }

      if (validated.templateContent) {
        updates.push(`template_content = $${paramCounter}`);
        values.push(validated.templateContent);
        paramCounter++;
      }

      if (validated.isActive !== undefined) {
        updates.push(`is_active = $${paramCounter}`);
        values.push(validated.isActive);
        paramCounter++;
      }

      updates.push(`updated_at = NOW()`);

      const result = await query(
        `UPDATE cleaner_ai_templates
       SET ${updates.join(", ")}
       WHERE id = $1 AND cleaner_id = $2
       RETURNING 
         id,
         template_name as name,
         template_content as content,
         is_active as active,
         updated_at as "updatedAt"`,
        values
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: { code: "NOT_FOUND", message: "Template not found" },
        });
        return;
      }

      res.json({
        message: "Template updated successfully",
        template: result.rows[0],
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: { code: "VALIDATION_ERROR", details: error.errors },
        });
      }
      console.error("Error updating template:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to update template" },
      });
    }
  })
);

// ============================================
// DELETE TEMPLATE
// ============================================

router.delete(
  "/templates/:templateId",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const { templateId } = req.params;

      const result = await query(
        `DELETE FROM cleaner_ai_templates
       WHERE id = $1 AND cleaner_id = $2
       RETURNING id`,
        [templateId, cleanerId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: { code: "NOT_FOUND", message: "Template not found" },
        });
      }

      res.json({ message: "Template deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting template:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to delete template" },
      });
    }
  })
);

// ============================================
// GET QUICK RESPONSES
// ============================================

router.get(
  "/quick-responses",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const { category } = req.query;

      let sql = `
      SELECT 
        id,
        response_category as category,
        trigger_keywords as "triggerKeywords",
        response_text as text,
        is_favorite as favorite,
        usage_count as "usageCount",
        created_at as "createdAt"
      FROM cleaner_quick_responses
      WHERE cleaner_id = $1
    `;

      const params: any[] = [cleanerId];

      if (category) {
        sql += ` AND response_category = $2`;
        params.push(category);
      }

      sql += ` ORDER BY is_favorite DESC, usage_count DESC, created_at DESC`;

      const result = await query(sql, params);

      res.json({
        responses: result.rows,
        count: result.rows.length,
      });
    } catch (error: any) {
      console.error("Error fetching quick responses:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch responses" },
      });
    }
  })
);

// ============================================
// CREATE QUICK RESPONSE
// ============================================

router.post(
  "/quick-responses",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const validated = createQuickResponseSchema.parse(req.body);

      const result = await query(
        `INSERT INTO cleaner_quick_responses 
        (cleaner_id, response_category, trigger_keywords, response_text)
       VALUES ($1, $2, $3, $4)
       RETURNING 
         id,
         response_category as category,
         trigger_keywords as "triggerKeywords",
         response_text as text,
         created_at as "createdAt"`,
        [cleanerId, validated.category, validated.triggerKeywords, validated.responseText]
      );

      res.status(201).json({
        message: "Quick response created successfully",
        response: result.rows[0],
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: { code: "VALIDATION_ERROR", details: error.errors },
        });
      }
      console.error("Error creating quick response:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to create response" },
      });
    }
  })
);

// ============================================
// UPDATE QUICK RESPONSE
// ============================================

router.patch(
  "/quick-responses/:responseId",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const { responseId } = req.params;
      const validated = updateQuickResponseSchema.parse(req.body);

      const updates: string[] = [];
      const values: any[] = [responseId, cleanerId];
      let paramCounter = 3;

      if (validated.responseText) {
        updates.push(`response_text = $${paramCounter}`);
        values.push(validated.responseText);
        paramCounter++;
      }

      if (validated.triggerKeywords) {
        updates.push(`trigger_keywords = $${paramCounter}`);
        values.push(validated.triggerKeywords);
        paramCounter++;
      }

      if (validated.isFavorite !== undefined) {
        updates.push(`is_favorite = $${paramCounter}`);
        values.push(validated.isFavorite);
        paramCounter++;
      }

      updates.push(`updated_at = NOW()`);

      const result = await query(
        `UPDATE cleaner_quick_responses
       SET ${updates.join(", ")}
       WHERE id = $1 AND cleaner_id = $2
       RETURNING 
         id,
         response_text as text,
         trigger_keywords as "triggerKeywords",
         is_favorite as favorite`,
        values
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: { code: "NOT_FOUND", message: "Response not found" },
        });
        return;
      }

      res.json({
        message: "Quick response updated successfully",
        response: result.rows[0],
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: { code: "VALIDATION_ERROR", details: error.errors },
        });
      }
      console.error("Error updating quick response:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to update response" },
      });
    }
  })
);

// ============================================
// DELETE QUICK RESPONSE
// ============================================

router.delete(
  "/quick-responses/:responseId",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const { responseId } = req.params;

      const result = await query(
        `DELETE FROM cleaner_quick_responses
       WHERE id = $1 AND cleaner_id = $2
       RETURNING id`,
        [responseId, cleanerId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: { code: "NOT_FOUND", message: "Response not found" },
        });
      }

      res.json({ message: "Quick response deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting quick response:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to delete response" },
      });
    }
  })
);

// ============================================
// GET AI PREFERENCES
// ============================================

router.get(
  "/preferences",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;

      const result = await query(
        `SELECT 
        communication_tone as "communicationTone",
        formality_level as "formalityLevel",
        emoji_usage as "emojiUsage",
        response_speed as "responseSpeed",
        business_hours_only as "businessHoursOnly",
        quiet_hours_start as "quietHoursStart",
        quiet_hours_end as "quietHoursEnd",
        full_automation_enabled as "fullAutomationEnabled",
        require_approval_for_bookings as "requireApprovalForBookings",
        auto_accept_instant_book as "autoAcceptInstantBook",
        auto_decline_outside_hours as "autoDeclineOutsideHours",
        learn_from_responses as "learnFromResponses",
        suggest_better_responses as "suggestBetterResponses",
        auto_improve_templates as "autoImproveTemplates",
        share_anonymized_data as "shareAnonymizedData",
        allow_ai_training as "allowAiTraining",
        priority_goal as "priorityGoal",
        target_weekly_hours as "targetWeeklyHours",
        preferred_booking_size as "preferredBookingSize",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM cleaner_ai_preferences
      WHERE cleaner_id = $1`,
        [cleanerId]
      );

      if (result.rows.length === 0) {
        // Create default preferences
        const newPrefs = await query(
          `INSERT INTO cleaner_ai_preferences (cleaner_id)
         VALUES ($1)
         RETURNING *`,
          [cleanerId]
        );
        res.json({ preferences: newPrefs.rows[0] });
        return;
      }

      res.json({ preferences: result.rows[0] });
    } catch (error: any) {
      console.error("Error fetching preferences:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch preferences" },
      });
    }
  })
);

// ============================================
// UPDATE AI PREFERENCES
// ============================================

router.patch(
  "/preferences",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const validated = updatePreferencesSchema.parse(req.body);

      const updates: string[] = [];
      const values: any[] = [cleanerId];
      let paramCounter = 2;

      // Map frontend fields to database columns
      const fieldMap: Record<string, string> = {
        communicationTone: "communication_tone",
        formalityLevel: "formality_level",
        emojiUsage: "emoji_usage",
        responseSpeed: "response_speed",
        businessHoursOnly: "business_hours_only",
        quietHoursStart: "quiet_hours_start",
        quietHoursEnd: "quiet_hours_end",
        fullAutomationEnabled: "full_automation_enabled",
        requireApprovalForBookings: "require_approval_for_bookings",
        autoAcceptInstantBook: "auto_accept_instant_book",
        autoDeclineOutsideHours: "auto_decline_outside_hours",
        learnFromResponses: "learn_from_responses",
        suggestBetterResponses: "suggest_better_responses",
        autoImproveTemplates: "auto_improve_templates",
        shareAnonymizedData: "share_anonymized_data",
        allowAiTraining: "allow_ai_training",
        priorityGoal: "priority_goal",
        targetWeeklyHours: "target_weekly_hours",
        preferredBookingSize: "preferred_booking_size",
      };

      Object.keys(validated).forEach((key) => {
        const dbColumn = fieldMap[key];
        if (dbColumn && (validated as any)[key] !== undefined) {
          updates.push(`${dbColumn} = $${paramCounter}`);
          values.push((validated as any)[key]);
          paramCounter++;
        }
      });

      if (updates.length === 0) {
        res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "No valid fields to update" },
        });
        return;
      }

      updates.push(`updated_at = NOW()`);

      const result = await query(
        `UPDATE cleaner_ai_preferences
       SET ${updates.join(", ")}
       WHERE cleaner_id = $1
       RETURNING *`,
        values
      );

      res.json({
        message: "Preferences updated successfully",
        preferences: result.rows[0],
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: { code: "VALIDATION_ERROR", details: error.errors },
        });
        return;
      }
      console.error("Error updating preferences:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to update preferences" },
      });
    }
  })
);

// ============================================
// GET AI STATS & INSIGHTS
// ============================================

router.get(
  "/insights",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;

      // Get template usage stats
      const templateStats = await query(
        `SELECT 
        template_type,
        COUNT(*) as count,
        SUM(usage_count) as total_usage
       FROM cleaner_ai_templates
       WHERE cleaner_id = $1
       GROUP BY template_type`,
        [cleanerId]
      );

      // Get quick response stats
      const responseStats = await query(
        `SELECT 
        response_category,
        COUNT(*) as count,
        SUM(usage_count) as total_usage,
        COUNT(*) FILTER (WHERE is_favorite = true) as favorites
       FROM cleaner_quick_responses
       WHERE cleaner_id = $1
       GROUP BY response_category`,
        [cleanerId]
      );

      // Get total settings enabled/disabled
      const settingsStats = await query(
        `SELECT 
        COUNT(*) FILTER (WHERE is_enabled = true) as enabled,
        COUNT(*) FILTER (WHERE is_enabled = false) as disabled
       FROM cleaner_ai_settings
       WHERE cleaner_id = $1`,
        [cleanerId]
      );

      res.json({
        templates: templateStats.rows,
        quickResponses: responseStats.rows,
        settings: settingsStats.rows[0] || { enabled: 0, disabled: 0 },
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Error fetching insights:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch insights" },
      });
    }
  })
);

export default router;
