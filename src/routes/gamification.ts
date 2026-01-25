/**
 * Gamification & Onboarding API
 * 
 * Handles: onboarding progress, achievements, certifications, template library
 */

import { Router, Response, NextFunction } from "express";
import { z } from "zod";
import { query } from "../db/client";
import { jwtAuthMiddleware } from "../middleware/jwtAuth";
import { AuthedRequest } from "../types/express";

const router = Router();
router.use(jwtAuthMiddleware);

// ============================================
// ONBOARDING PROGRESS
// ============================================

router.get("/onboarding/progress", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;

    const result = await query(
      `SELECT 
        profile_completion_percentage as "completionPercentage",
        setup_wizard_completed as "wizardCompleted",
        setup_wizard_step as "currentStep",
        profile_photo_uploaded as "photoUploaded",
        bio_completed as "bioCompleted",
        services_defined as "servicesDefined",
        availability_set as "availabilitySet",
        pricing_configured as "pricingConfigured",
        ai_personality_set as "aiPersonalitySet",
        templates_customized as "templatesCustomized",
        quick_responses_added as "quickResponsesAdded",
        first_template_used as "firstTemplateUsed",
        viewed_insights_dashboard as "viewedDashboard",
        created_custom_template as "createdCustomTemplate",
        marked_favorite_response as "markedFavorite",
        days_since_signup as "daysSinceSignup",
        total_logins as "totalLogins",
        onboarding_abandoned as "abandoned"
      FROM cleaner_onboarding_progress
      WHERE cleaner_id = $1`,
      [cleanerId]
    );

    if (result.rows.length === 0) {
      // Initialize if not exists
      await query(
        `INSERT INTO cleaner_onboarding_progress (cleaner_id) VALUES ($1)`,
        [cleanerId]
      );
      return res.json({
        completionPercentage: 0,
        wizardCompleted: false,
        currentStep: 0,
      });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error fetching onboarding progress:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch progress" },
    });
  }
});

// Update onboarding progress
router.post("/onboarding/update", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const updates = req.body;

    const allowedFields = [
      'setup_wizard_step',
      'setup_wizard_completed',
      'profile_photo_uploaded',
      'bio_completed',
      'services_defined',
      'availability_set',
      'pricing_configured',
      'ai_personality_set',
      'templates_customized',
      'quick_responses_added',
      'first_template_used',
      'viewed_insights_dashboard',
      'created_custom_template',
      'marked_favorite_response',
    ];

    const updateFields = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    if (!updateFields) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "No valid fields to update" },
      });
    }

    const values = [cleanerId, ...Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .map(key => updates[key])
    ];

    await db.query(
      `UPDATE cleaner_onboarding_progress
       SET ${updateFields}, updated_at = NOW()
       WHERE cleaner_id = $1`,
      values
    );

    // Check if any achievements unlocked
    await checkAndUnlockAchievements(cleanerId);

    res.json({ message: "Progress updated successfully" });
  } catch (error: any) {
    console.error("Error updating onboarding progress:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to update progress" },
    });
  }
});

// ============================================
// ACHIEVEMENTS
// ============================================

router.get("/achievements", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;

    // Get all achievements with earned status
    const result = await query(
      `SELECT 
        a.id,
        a.achievement_key as "key",
        a.name,
        a.description,
        a.category,
        a.tier,
        a.icon,
        a.points,
        a.criteria,
        CASE WHEN ca.id IS NOT NULL THEN true ELSE false END as earned,
        ca.earned_at as "earnedAt",
        ca.seen,
        ca.progress_percentage as "progressPercentage"
      FROM achievements a
      LEFT JOIN cleaner_achievements ca ON a.id = ca.achievement_id AND ca.cleaner_id = $1
      WHERE a.is_active = true
      ORDER BY a.display_order, a.created_at`,
      [cleanerId]
    );

    // Group by category
    const grouped = result.rows.reduce((acc: any, achievement: any) => {
      if (!acc[achievement.category]) {
        acc[achievement.category] = [];
      }
      acc[achievement.category].push(achievement);
      return acc;
    }, {});

    // Calculate total points
    const earnedPoints = result.rows
      .filter((a: any) => a.earned)
      .reduce((sum: number, a: any) => sum + a.points, 0);

    const totalPoints = result.rows
      .reduce((sum: number, a: any) => sum + a.points, 0);

    res.json({
      achievements: grouped,
      stats: {
        earnedPoints,
        totalPoints,
        earnedCount: result.rows.filter((a: any) => a.earned).length,
        totalCount: result.rows.length,
      },
    });
  } catch (error: any) {
    console.error("Error fetching achievements:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch achievements" },
    });
  }
});

// Mark achievement as seen
router.post("/achievements/:achievementId/mark-seen", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { achievementId } = req.params;

    await db.query(
      `UPDATE cleaner_achievements
       SET seen = true
       WHERE cleaner_id = $1 AND achievement_id = $2`,
      [cleanerId, achievementId]
    );

    res.json({ message: "Achievement marked as seen" });
  } catch (error: any) {
    console.error("Error marking achievement:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to mark achievement" },
    });
  }
});

// ============================================
// CERTIFICATIONS
// ============================================

router.get("/certifications", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;

    const result = await query(
      `SELECT 
        c.id,
        c.certification_key as "key",
        c.name,
        c.description,
        c.level,
        c.icon,
        c.badge_color as "badgeColor",
        c.requirements,
        c.benefits,
        CASE WHEN cc.id IS NOT NULL THEN true ELSE false END as earned,
        cc.earned_at as "earnedAt",
        cc.expires_at as "expiresAt",
        cc.certificate_url as "certificateUrl",
        cc.is_active as "isActive"
      FROM certifications c
      LEFT JOIN cleaner_certifications cc ON c.id = cc.certification_id AND cc.cleaner_id = $1
      WHERE c.is_active = true
      ORDER BY c.level`,
      [cleanerId]
    );

    // Calculate progress for each certification
    const certsWithProgress = await Promise.all(
      result.rows.map(async (cert: any) => {
        const progress = await calculateCertificationProgress(cleanerId, cert.requirements);
        return {
          ...cert,
          progress,
          canEarn: progress >= 100 && !cert.earned,
        };
      })
    );

    res.json({
      certifications: certsWithProgress,
      currentLevel: certsWithProgress.filter((c: any) => c.earned).length,
    });
  } catch (error: any) {
    console.error("Error fetching certifications:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch certifications" },
    });
  }
});

// Claim certification
router.post("/certifications/:certificationId/claim", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { certificationId } = req.params;

    // Check if requirements met
    const cert = await query(
      `SELECT requirements FROM certifications WHERE id = $1`,
      [certificationId]
    );

    if (cert.rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Certification not found" },
      });
    }

    const progress = await calculateCertificationProgress(cleanerId, cert.rows[0].requirements);

    if (progress < 100) {
      return res.status(400).json({
        error: { code: "REQUIREMENTS_NOT_MET", message: "Requirements not yet met" },
      });
    }

    // Award certification
    const result = await query(
      `INSERT INTO cleaner_certifications (cleaner_id, certification_id)
       VALUES ($1, $2)
       ON CONFLICT (cleaner_id, certification_id) DO UPDATE SET is_active = true
       RETURNING id, earned_at as "earnedAt"`,
      [cleanerId, certificationId]
    );

    res.json({
      message: "Certification earned!",
      certification: result.rows[0],
    });
  } catch (error: any) {
    console.error("Error claiming certification:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to claim certification" },
    });
  }
});

// ============================================
// TEMPLATE LIBRARY
// ============================================

router.get("/template-library", async (req: AuthedRequest, res) => {
  try {
    const { category, type, search, sort = 'rating' } = req.query;

    let query = `
      SELECT 
        id,
        template_type as type,
        template_name as name,
        template_content as content,
        variables,
        category,
        subcategory,
        description,
        rating_average as "ratingAverage",
        rating_count as "ratingCount",
        usage_count as "usageCount",
        favorite_count as "favoriteCount",
        is_featured as "isFeatured",
        is_verified as "isVerified",
        tags,
        created_at as "createdAt"
      FROM template_library
      WHERE is_active = true
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (type) {
      query += ` AND template_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (search) {
      query += ` AND (template_name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR $${paramIndex} = ANY(tags))`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Sorting
    if (sort === 'rating') {
      query += ` ORDER BY is_featured DESC, rating_average DESC, rating_count DESC`;
    } else if (sort === 'popular') {
      query += ` ORDER BY is_featured DESC, usage_count DESC`;
    } else if (sort === 'recent') {
      query += ` ORDER BY is_featured DESC, created_at DESC`;
    }

    query += ` LIMIT 50`;

    const result = await query(query, params);

    res.json({
      templates: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error("Error fetching template library:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch templates" },
    });
  }
});

// Save template from library
router.post("/template-library/:templateId/save", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { templateId } = req.params;
    const { customizedContent } = req.body;

    // Get template from library
    const template = await query(
      `SELECT * FROM template_library WHERE id = $1`,
      [templateId]
    );

    if (template.rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Template not found" },
      });
    }

    // Save to user's templates
    await db.query(
      `INSERT INTO cleaner_saved_library_templates 
        (cleaner_id, library_template_id, customized_content)
       VALUES ($1, $2, $3)
       ON CONFLICT (cleaner_id, library_template_id) 
       DO UPDATE SET customized_content = EXCLUDED.customized_content, saved_at = NOW()`,
      [cleanerId, templateId, customizedContent || template.rows[0].template_content]
    );

    // Increment usage count
    await db.query(
      `UPDATE template_library 
       SET usage_count = usage_count + 1 
       WHERE id = $1`,
      [templateId]
    );

    res.json({ message: "Template saved successfully" });
  } catch (error: any) {
    console.error("Error saving template:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to save template" },
    });
  }
});

// Rate template
router.post("/template-library/:templateId/rate", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { templateId } = req.params;
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Rating must be between 1 and 5" },
      });
    }

    await db.query(
      `INSERT INTO template_library_ratings (template_id, cleaner_id, rating, review)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (template_id, cleaner_id) 
       DO UPDATE SET rating = EXCLUDED.rating, review = EXCLUDED.review`,
      [templateId, cleanerId, rating, review]
    );

    res.json({ message: "Rating submitted successfully" });
  } catch (error: any) {
    console.error("Error rating template:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to rate template" },
    });
  }
});

// Get saved templates
router.get("/template-library/saved", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;

    const result = await query(
      `SELECT 
        st.id,
        st.customized_content as "customizedContent",
        st.is_active as "isActive",
        st.saved_at as "savedAt",
        tl.template_type as type,
        tl.template_name as name,
        tl.template_content as "originalContent",
        tl.variables,
        tl.category
      FROM cleaner_saved_library_templates st
      JOIN template_library tl ON st.library_template_id = tl.id
      WHERE st.cleaner_id = $1 AND st.is_active = true
      ORDER BY st.saved_at DESC`,
      [cleanerId]
    );

    res.json({
      templates: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error("Error fetching saved templates:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch saved templates" },
    });
  }
});

// ============================================
// TOOLTIPS
// ============================================

router.get("/tooltips", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;

    const result = await query(
      `SELECT 
        t.id,
        t.tooltip_key as "key",
        t.target_element as "targetElement",
        t.title,
        t.content,
        t.position,
        t.trigger_condition as "triggerCondition",
        t.display_order as "displayOrder",
        t.category,
        CASE WHEN ti.id IS NOT NULL THEN true ELSE false END as dismissed
      FROM app_tooltips t
      LEFT JOIN cleaner_tooltip_interactions ti ON t.id = ti.tooltip_id AND ti.cleaner_id = $1
      WHERE t.is_active = true AND ti.id IS NULL
      ORDER BY t.display_order`,
      [cleanerId]
    );

    res.json({
      tooltips: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error("Error fetching tooltips:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch tooltips" },
    });
  }
});

// Dismiss tooltip
router.post("/tooltips/:tooltipId/dismiss", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { tooltipId } = req.params;
    const { helpful } = req.body;

    await db.query(
      `INSERT INTO cleaner_tooltip_interactions (cleaner_id, tooltip_id, marked_helpful)
       VALUES ($1, $2, $3)
       ON CONFLICT (cleaner_id, tooltip_id) DO UPDATE SET marked_helpful = EXCLUDED.marked_helpful`,
      [cleanerId, tooltipId, helpful]
    );

    // Update tooltip dismissed count in onboarding
    await db.query(
      `UPDATE cleaner_onboarding_progress
       SET tooltip_dismissed_count = tooltip_dismissed_count + 1
       WHERE cleaner_id = $1`,
      [cleanerId]
    );

    res.json({ message: "Tooltip dismissed" });
  } catch (error: any) {
    console.error("Error dismissing tooltip:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to dismiss tooltip" },
    });
  }
});

// Publish template to marketplace
router.post("/template-library", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const {
      template_type,
      template_name,
      template_content,
      variables,
      category,
      subcategory,
      description,
      tags,
    } = req.body;

    // Validation
    if (!template_name || !template_content || !category) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Template name, content, and category are required" },
      });
    }

    // Insert template into library
    const result = await query(
      `INSERT INTO template_library (
        template_type,
        template_name,
        template_content,
        variables,
        category,
        subcategory,
        description,
        author_id,
        tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, template_name as name, created_at as "createdAt"`,
      [
        template_type || 'custom',
        template_name,
        template_content,
        JSON.stringify(variables || []),
        category,
        subcategory || null,
        description || '',
        cleanerId,
        tags || []
      ]
    );

    // Update onboarding progress
    await db.query(
      `UPDATE cleaner_onboarding_progress
       SET created_custom_template = true, templates_customized = templates_customized + 1
       WHERE cleaner_id = $1`,
      [cleanerId]
    );

    // Check achievements
    await checkAndUnlockAchievements(cleanerId);

    res.status(201).json({
      message: "Template published to marketplace successfully!",
      template: result.rows[0],
    });
  } catch (error: any) {
    console.error("Error publishing template:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to publish template" },
    });
  }
});

// Get single template from library
router.get("/template-library/:templateId", async (req: AuthedRequest, res) => {
  try {
    const { templateId } = req.params;

    const result = await query(
      `SELECT 
        id,
        template_type as type,
        template_name as name,
        template_content as content,
        variables,
        category,
        subcategory,
        description,
        rating_average as "ratingAverage",
        rating_count as "ratingCount",
        usage_count as "usageCount",
        favorite_count as "favoriteCount",
        is_featured as "isFeatured",
        is_verified as "isVerified",
        tags,
        created_at as "createdAt"
      FROM template_library
      WHERE id = $1 AND is_active = true`,
      [templateId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Template not found" },
      });
    }

    res.json({ template: result.rows[0] });
  } catch (error: any) {
    console.error("Error fetching template:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch template" },
    });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function checkAndUnlockAchievements(cleanerId: string) {
  try {
    // Get user's progress
    const progress = await query(
      `SELECT * FROM cleaner_onboarding_progress WHERE cleaner_id = $1`,
      [cleanerId]
    );

    if (progress.rows.length === 0) return;

    const userProgress = progress.rows[0];

    // Get all unearned achievements
    const achievements = await query(
      `SELECT a.* 
       FROM achievements a
       WHERE a.is_active = true 
       AND NOT EXISTS (
         SELECT 1 FROM cleaner_achievements ca 
         WHERE ca.achievement_id = a.id AND ca.cleaner_id = $1
       )`,
      [cleanerId]
    );

    // Check each achievement
    for (const achievement of achievements.rows) {
      const criteria = achievement.criteria;
      let earned = false;

      // Check criteria based on achievement type
      if (criteria.action === 'login' && criteria.count === 1) {
        earned = true; // First login
      } else if (criteria.profile_completion && userProgress.profile_completion_percentage >= criteria.profile_completion) {
        earned = true;
      } else if (criteria.setup_wizard_completed && userProgress.setup_wizard_completed) {
        earned = true;
      } else if (criteria.first_template_used && userProgress.first_template_used) {
        earned = true;
      } else if (criteria.created_custom_template && userProgress.created_custom_template) {
        earned = true;
      } else if (criteria.templates_customized && userProgress.templates_customized >= criteria.templates_customized) {
        earned = true;
      } else if (criteria.quick_responses_added && userProgress.quick_responses_added >= criteria.quick_responses_added) {
        earned = true;
      } else if (criteria.days_since_signup && userProgress.days_since_signup >= criteria.days_since_signup) {
        earned = true;
      }

      if (earned) {
        await query(
          `INSERT INTO cleaner_achievements (cleaner_id, achievement_id)
           VALUES ($1, $2)
           ON CONFLICT (cleaner_id, achievement_id) DO NOTHING`,
          [cleanerId, achievement.id]
        );
      }
    }
  } catch (error) {
    console.error("Error checking achievements:", error);
  }
}

async function calculateCertificationProgress(cleanerId: string, requirements: any): Promise<number> {
  try {
    const progress = await query(
      `SELECT * FROM cleaner_onboarding_progress WHERE cleaner_id = $1`,
      [cleanerId]
    );

    if (progress.rows.length === 0) return 0;

    const userProgress = progress.rows[0];
    const requiredFields = Object.keys(requirements);
    let metCount = 0;

    for (const field of requiredFields) {
      if (userProgress[field] >= requirements[field]) {
        metCount++;
      }
    }

    return Math.round((metCount / requiredFields.length) * 100);
  } catch (error) {
    console.error("Error calculating progress:", error);
    return 0;
  }
}

export default router;

