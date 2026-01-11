/**
 * Advanced Cleaner AI Assistant API Endpoints
 * 
 * Additional features: export/import, preview, share, duplicate, reset
 */

import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db/client";
import { jwtAuthMiddleware } from "../middleware/jwtAuth";
import { AuthedRequest } from "../types/express";

const router = Router();
router.use(jwtAuthMiddleware);

// ============================================
// EXPORT ALL SETTINGS
// ============================================

router.get("/export", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;

    // Get all data
    const [settings, templates, responses, preferences] = await Promise.all([
      db.query(
        `SELECT setting_category, setting_key, setting_value, is_enabled, description
         FROM cleaner_ai_settings WHERE cleaner_id = $1`,
        [cleanerId]
      ),
      db.query(
        `SELECT template_type, template_name, template_content, variables, is_default, is_active
         FROM cleaner_ai_templates WHERE cleaner_id = $1`,
        [cleanerId]
      ),
      db.query(
        `SELECT response_category, trigger_keywords, response_text, is_favorite
         FROM cleaner_quick_responses WHERE cleaner_id = $1`,
        [cleanerId]
      ),
      db.query(
        `SELECT * FROM cleaner_ai_preferences WHERE cleaner_id = $1`,
        [cleanerId]
      )
    ]);

    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      cleanerId: cleanerId,
      settings: settings.rows,
      templates: templates.rows,
      quickResponses: responses.rows,
      preferences: preferences.rows[0] || null,
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ai-settings-${cleanerId}-${Date.now()}.json"`);
    
    res.json(exportData);
  } catch (error: any) {
    console.error("Error exporting settings:", error);
    res.status(500).json({
      error: { code: "EXPORT_ERROR", message: "Failed to export settings" },
    });
  }
});

// ============================================
// IMPORT SETTINGS
// ============================================

const importSchema = z.object({
  settings: z.array(z.any()).optional(),
  templates: z.array(z.any()).optional(),
  quickResponses: z.array(z.any()).optional(),
  preferences: z.any().optional(),
  replaceExisting: z.boolean().default(false),
});

router.post("/import", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const validated = importSchema.parse(req.body);

    const client = await db.connect();
    let imported = { settings: 0, templates: 0, responses: 0, preferences: 0 };

    try {
      await client.query("BEGIN");

      // Import settings
      if (validated.settings && validated.settings.length > 0) {
        for (const setting of validated.settings) {
          const query = validated.replaceExisting
            ? `INSERT INTO cleaner_ai_settings (cleaner_id, setting_category, setting_key, setting_value, is_enabled, description)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (cleaner_id, setting_key) 
               DO UPDATE SET setting_value = EXCLUDED.setting_value, is_enabled = EXCLUDED.is_enabled`
            : `INSERT INTO cleaner_ai_settings (cleaner_id, setting_category, setting_key, setting_value, is_enabled, description)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (cleaner_id, setting_key) DO NOTHING`;

          await client.query(query, [
            cleanerId,
            setting.setting_category,
            setting.setting_key,
            setting.setting_value,
            setting.is_enabled,
            setting.description
          ]);
          imported.settings++;
        }
      }

      // Import templates
      if (validated.templates && validated.templates.length > 0) {
        for (const template of validated.templates) {
          await client.query(
            `INSERT INTO cleaner_ai_templates (cleaner_id, template_type, template_name, template_content, variables, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              cleanerId,
              template.template_type,
              template.template_name,
              template.template_content,
              template.variables,
              template.is_active ?? true
            ]
          );
          imported.templates++;
        }
      }

      // Import quick responses
      if (validated.quickResponses && validated.quickResponses.length > 0) {
        for (const response of validated.quickResponses) {
          await client.query(
            `INSERT INTO cleaner_quick_responses (cleaner_id, response_category, trigger_keywords, response_text, is_favorite)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              cleanerId,
              response.response_category,
              response.trigger_keywords,
              response.response_text,
              response.is_favorite ?? false
            ]
          );
          imported.responses++;
        }
      }

      // Import preferences
      if (validated.preferences && validated.replaceExisting) {
        await client.query(
          `INSERT INTO cleaner_ai_preferences (cleaner_id, communication_tone, formality_level, emoji_usage)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (cleaner_id) 
           DO UPDATE SET 
             communication_tone = EXCLUDED.communication_tone,
             formality_level = EXCLUDED.formality_level,
             emoji_usage = EXCLUDED.emoji_usage`,
          [
            cleanerId,
            validated.preferences.communication_tone,
            validated.preferences.formality_level,
            validated.preferences.emoji_usage
          ]
        );
        imported.preferences = 1;
      }

      await client.query("COMMIT");

      res.json({
        message: "Settings imported successfully",
        imported,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", details: error.errors },
      });
    }
    console.error("Error importing settings:", error);
    res.status(500).json({
      error: { code: "IMPORT_ERROR", message: "Failed to import settings" },
    });
  }
});

// ============================================
// PREVIEW TEMPLATE WITH SAMPLE DATA
// ============================================

const previewSchema = z.object({
  templateContent: z.string(),
  sampleData: z.record(z.string()),
});

router.post("/preview-template", async (req: AuthedRequest, res) => {
  try {
    const validated = previewSchema.parse(req.body);
    
    let preview = validated.templateContent;
    
    // Replace variables with sample data
    for (const [key, value] of Object.entries(validated.sampleData)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      preview = preview.replace(regex, value);
    }

    // Find any unreplaced variables
    const unreplacedVariables = preview.match(/\{([^}]+)\}/g) || [];

    res.json({
      preview,
      unreplacedVariables: unreplacedVariables.map(v => v.slice(1, -1)),
      charactersUsed: preview.length,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", details: error.errors },
      });
    }
    res.status(500).json({
      error: { code: "PREVIEW_ERROR", message: "Failed to preview template" },
    });
  }
});

// ============================================
// DUPLICATE TEMPLATE
// ============================================

router.post("/templates/:templateId/duplicate", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { templateId } = req.params;
    const { newName } = req.body;

    // Get original template
    const original = await db.query(
      `SELECT * FROM cleaner_ai_templates 
       WHERE id = $1 AND cleaner_id = $2`,
      [templateId, cleanerId]
    );

    if (original.rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Template not found" },
      });
    }

    const template = original.rows[0];

    // Create duplicate
    const result = await db.query(
      `INSERT INTO cleaner_ai_templates 
        (cleaner_id, template_type, template_name, template_content, variables, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, template_name as name, template_type as type`,
      [
        cleanerId,
        template.template_type,
        newName || `${template.template_name} (Copy)`,
        template.template_content,
        template.variables,
        true
      ]
    );

    res.status(201).json({
      message: "Template duplicated successfully",
      template: result.rows[0],
    });
  } catch (error: any) {
    console.error("Error duplicating template:", error);
    res.status(500).json({
      error: { code: "DUPLICATE_ERROR", message: "Failed to duplicate template" },
    });
  }
});

// ============================================
// RESET TO DEFAULTS
// ============================================

router.post("/reset-to-defaults", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { resetType } = req.body; // 'settings', 'templates', 'responses', 'preferences', 'all'

    const client = await db.connect();
    let reset = { settings: 0, templates: 0, responses: 0, preferences: 0 };

    try {
      await client.query("BEGIN");

      if (resetType === 'settings' || resetType === 'all') {
        // Reset all settings to enabled state
        const result = await client.query(
          `UPDATE cleaner_ai_settings 
           SET is_enabled = true, last_updated_at = NOW()
           WHERE cleaner_id = $1`,
          [cleanerId]
        );
        reset.settings = result.rowCount || 0;
      }

      if (resetType === 'templates' || resetType === 'all') {
        // Delete non-default templates
        const result = await client.query(
          `DELETE FROM cleaner_ai_templates 
           WHERE cleaner_id = $1 AND is_default = false`,
          [cleanerId]
        );
        reset.templates = result.rowCount || 0;

        // Reactivate all default templates
        await client.query(
          `UPDATE cleaner_ai_templates 
           SET is_active = true 
           WHERE cleaner_id = $1 AND is_default = true`,
          [cleanerId]
        );
      }

      if (resetType === 'responses' || resetType === 'all') {
        // Reset usage counts and unfavorite all
        const result = await client.query(
          `UPDATE cleaner_quick_responses 
           SET is_favorite = false, usage_count = 0
           WHERE cleaner_id = $1`,
          [cleanerId]
        );
        reset.responses = result.rowCount || 0;
      }

      if (resetType === 'preferences' || resetType === 'all') {
        // Reset preferences to defaults
        const result = await client.query(
          `UPDATE cleaner_ai_preferences 
           SET 
             communication_tone = 'professional_friendly',
             formality_level = 3,
             emoji_usage = 'moderate',
             response_speed = 'balanced',
             full_automation_enabled = false,
             require_approval_for_bookings = true,
             priority_goal = 'balanced',
             updated_at = NOW()
           WHERE cleaner_id = $1`,
          [cleanerId]
        );
        reset.preferences = result.rowCount || 0;
      }

      await client.query("COMMIT");

      res.json({
        message: "Settings reset to defaults successfully",
        reset,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error resetting to defaults:", error);
    res.status(500).json({
      error: { code: "RESET_ERROR", message: "Failed to reset to defaults" },
    });
  }
});

// ============================================
// BATCH ACTIVATE/DEACTIVATE TEMPLATES
// ============================================

router.post("/templates/batch-toggle", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { templateIds, active } = req.body;

    if (!Array.isArray(templateIds) || typeof active !== 'boolean') {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid request format" },
      });
    }

    const result = await db.query(
      `UPDATE cleaner_ai_templates 
       SET is_active = $1, updated_at = NOW()
       WHERE id = ANY($2) AND cleaner_id = $3
       RETURNING id`,
      [active, templateIds, cleanerId]
    );

    res.json({
      message: `Templates ${active ? 'activated' : 'deactivated'} successfully`,
      updated: result.rowCount,
    });
  } catch (error: any) {
    console.error("Error batch toggling templates:", error);
    res.status(500).json({
      error: { code: "BATCH_ERROR", message: "Failed to update templates" },
    });
  }
});

// ============================================
// SEARCH TEMPLATES
// ============================================

router.get("/templates/search", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { q, type } = req.query;

    let query = `
      SELECT 
        id, template_type as type, template_name as name, 
        template_content as content, variables, is_active as active,
        usage_count as "usageCount"
      FROM cleaner_ai_templates
      WHERE cleaner_id = $1
    `;
    const params: any[] = [cleanerId];

    if (q) {
      query += ` AND (template_name ILIKE $${params.length + 1} OR template_content ILIKE $${params.length + 1})`;
      params.push(`%${q}%`);
    }

    if (type) {
      query += ` AND template_type = $${params.length + 1}`;
      params.push(type);
    }

    query += ` ORDER BY usage_count DESC, template_name`;

    const result = await db.query(query, params);

    res.json({
      templates: result.rows,
      count: result.rows.length,
      searchQuery: q || null,
    });
  } catch (error: any) {
    console.error("Error searching templates:", error);
    res.status(500).json({
      error: { code: "SEARCH_ERROR", message: "Failed to search templates" },
    });
  }
});

// ============================================
// SEARCH QUICK RESPONSES
// ============================================

router.get("/quick-responses/search", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { q, category } = req.query;

    let query = `
      SELECT 
        id, response_category as category, trigger_keywords as "triggerKeywords",
        response_text as text, is_favorite as favorite, usage_count as "usageCount"
      FROM cleaner_quick_responses
      WHERE cleaner_id = $1
    `;
    const params: any[] = [cleanerId];

    if (q) {
      query += ` AND (response_text ILIKE $${params.length + 1} OR $${params.length + 1} = ANY(trigger_keywords))`;
      params.push(`%${q}%`);
    }

    if (category) {
      query += ` AND response_category = $${params.length + 1}`;
      params.push(category);
    }

    query += ` ORDER BY is_favorite DESC, usage_count DESC`;

    const result = await db.query(query, params);

    res.json({
      responses: result.rows,
      count: result.rows.length,
      searchQuery: q || null,
    });
  } catch (error: any) {
    console.error("Error searching quick responses:", error);
    res.status(500).json({
      error: { code: "SEARCH_ERROR", message: "Failed to search responses" },
    });
  }
});

// ============================================
// INCREMENT USAGE COUNT
// ============================================

router.post("/templates/:templateId/use", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { templateId } = req.params;

    await db.query(
      `UPDATE cleaner_ai_templates 
       SET usage_count = usage_count + 1
       WHERE id = $1 AND cleaner_id = $2`,
      [templateId, cleanerId]
    );

    res.json({ message: "Usage recorded" });
  } catch (error: any) {
    console.error("Error recording usage:", error);
    res.status(500).json({
      error: { code: "USAGE_ERROR", message: "Failed to record usage" },
    });
  }
});

router.post("/quick-responses/:responseId/use", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { responseId } = req.params;

    await db.query(
      `UPDATE cleaner_quick_responses 
       SET usage_count = usage_count + 1
       WHERE id = $1 AND cleaner_id = $2`,
      [responseId, cleanerId]
    );

    res.json({ message: "Usage recorded" });
  } catch (error: any) {
    console.error("Error recording usage:", error);
    res.status(500).json({
      error: { code: "USAGE_ERROR", message: "Failed to record usage" },
    });
  }
});

export default router;

