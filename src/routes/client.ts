// src/routes/client.ts
// Client-specific routes (favorites, addresses, payment methods, recurring bookings, reviews)

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { logger } from "../lib/logger";
import {
  requireAuth,
  requireRole,
  AuthedRequest,
  authedHandler,
} from "../middleware/authCanonical";
import { query } from "../db/client";

const clientRouter = Router();

clientRouter.use(requireAuth);
clientRouter.use(requireRole("client", "admin"));

// ============================================
// FAVORITES
// ============================================

/**
 * @swagger
 * /client/favorites:
 *   get:
 *     summary: Get all favorite cleaners
 *     description: Get list of all favorite cleaners for the current client.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of favorite cleaners
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 favorites:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: 'string', format: 'uuid' }
 *                       cleaner:
 *                         type: object
 *                         properties:
 *                           id: { type: 'string', format: 'uuid' }
 *                           name: { type: 'string' }
 *                           email: { type: 'string' }
 *                           avatar_url: { type: 'string', nullable: true }
 *                           price_per_hour: { type: 'number' }
 *                           bio: { type: 'string', nullable: true }
 *                           rating: { type: 'number' }
 *                           reviews_count: { type: 'integer' }
 *                       created_at: { type: 'string', format: 'date-time' }
 *       401:
 *         description: Unauthorized
 */
clientRouter.get(
  "/favorites",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;

      const result = await query(
        `
      SELECT 
        fc.id,
        fc.created_at,
        u.id as cleaner_id,
        u.email as cleaner_email,
        cp.first_name || ' ' || COALESCE(cp.last_name, '') as cleaner_name,
        cp.avatar_url,
        cp.base_rate_cph as price_per_hour,
        cp.bio,
        COALESCE(avg_reviews.avg_rating, 0) as rating,
        COALESCE(avg_reviews.review_count, 0) as reviews_count
      FROM favorite_cleaners fc
      INNER JOIN users u ON u.id = fc.cleaner_id
      LEFT JOIN cleaner_profiles cp ON cp.user_id = u.id
      LEFT JOIN (
        SELECT 
          reviewee_id,
          AVG(rating)::numeric(3,2) as avg_rating,
          COUNT(*) as review_count
        FROM reviews
        WHERE reviewer_type = 'client'
        GROUP BY reviewee_id
      ) avg_reviews ON avg_reviews.reviewee_id = u.id
      WHERE fc.client_id = $1
      ORDER BY fc.created_at DESC
      `,
        [clientId]
      );

      res.json({
        favorites: result.rows.map((row) => ({
          id: row.id,
          cleaner: {
            id: row.cleaner_id,
            name: row.cleaner_name || row.cleaner_email,
            email: row.cleaner_email,
            avatar_url: row.avatar_url,
            price_per_hour: parseFloat(row.price_per_hour || "0"),
            bio: row.bio,
            rating: parseFloat(row.rating || "0"),
            reviews_count: parseInt(row.reviews_count || "0"),
          },
          created_at: row.created_at,
        })),
      });
    } catch (error) {
      logger.error("get_favorites_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "GET_FAVORITES_FAILED", message: "Failed to get favorites" },
      });
    }
  })
);

/**
 * @swagger
 * /client/favorites:
 *   post:
 *     summary: Add cleaner to favorites
 *     description: Add a cleaner to the client's favorites list.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cleaner_id
 *             properties:
 *               cleaner_id:
 *                 type: string
 *                 format: uuid
 *                 description: Cleaner user ID
 *     responses:
 *       201:
 *         description: Cleaner added to favorites
 *       404:
 *         description: Cleaner not found
 *       409:
 *         description: Already in favorites
 */
const addFavoriteSchema = z.object({
  cleaner_id: z.string().min(1),
});

clientRouter.post(
  "/favorites",
  validateBody(addFavoriteSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { cleaner_id } = req.body;

      // Check if cleaner exists
      const cleanerCheck = await query("SELECT id FROM users WHERE id = $1 AND role = 'cleaner'", [
        cleaner_id,
      ]);
      if (cleanerCheck.rows.length === 0) {
        return res.status(404).json({
          error: { code: "CLEANER_NOT_FOUND", message: "Cleaner not found" },
        });
      }

      // Insert favorite (ON CONFLICT DO NOTHING)
      const result = await query(
        `
        INSERT INTO favorite_cleaners (client_id, cleaner_id)
        VALUES ($1, $2)
        ON CONFLICT (client_id, cleaner_id) DO NOTHING
        RETURNING id, created_at
        `,
        [clientId, cleaner_id]
      );

      if (result.rows.length === 0) {
        return res.status(200).json({
          message: "Already in favorites",
          favorite: { id: null },
        });
      }

      res.status(201).json({
        favorite: {
          id: result.rows[0].id,
          created_at: result.rows[0].created_at,
        },
      });
    } catch (error) {
      logger.error("add_favorite_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "ADD_FAVORITE_FAILED", message: "Failed to add favorite" },
      });
    }
  })
);

/**
 * DELETE /client/favorites/:id
 * Remove a favorite
 */
clientRouter.delete(
  "/favorites/:id",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { id } = req.params;

      const result = await query(
        "DELETE FROM favorite_cleaners WHERE id = $1 AND client_id = $2 RETURNING id",
        [id, clientId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: { code: "FAVORITE_NOT_FOUND", message: "Favorite not found" },
        });
      }

      res.json({ success: true });
    } catch (error) {
      logger.error("remove_favorite_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "REMOVE_FAVORITE_FAILED", message: "Failed to remove favorite" },
      });
    }
  })
);

// ============================================
// ADDRESSES
// ============================================

/**
 * @swagger
 * /client/addresses:
 *   get:
 *     summary: Get all addresses
 *     description: Get all saved addresses for the current client.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of addresses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 addresses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: 'string', format: 'uuid' }
 *                       label: { type: 'string', nullable: true }
 *                       line1: { type: 'string' }
 *                       line2: { type: 'string', nullable: true }
 *                       city: { type: 'string' }
 *                       state: { type: 'string', nullable: true }
 *                       zip_code: { type: 'string', nullable: true }
 *                       country: { type: 'string' }
 *                       latitude: { type: 'number', nullable: true }
 *                       longitude: { type: 'number', nullable: true }
 *                       is_default: { type: 'boolean' }
 */
clientRouter.get(
  "/addresses",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;

      const result = await query(
        `
      SELECT 
        id,
        label,
        line1,
        line2,
        city,
        state,
        postal_code as zip_code,
        country,
        lat as latitude,
        lng as longitude,
        is_default,
        created_at,
        updated_at
      FROM addresses
      WHERE user_id = $1
      ORDER BY is_default DESC, created_at DESC
      `,
        [clientId]
      );

      res.json({
        addresses: result.rows,
      });
    } catch (error) {
      logger.error("get_addresses_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "GET_ADDRESSES_FAILED", message: "Failed to get addresses" },
      });
    }
  })
);

/**
 * @swagger
 * /client/addresses:
 *   post:
 *     summary: Add a new address
 *     description: Add a new address for the current client.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - line1
 *               - city
 *             properties:
 *               label: { type: 'string' }
 *               line1: { type: 'string' }
 *               line2: { type: 'string' }
 *               city: { type: 'string' }
 *               state: { type: 'string' }
 *               postal_code: { type: 'string' }
 *               country: { type: 'string', default: 'US' }
 *               latitude: { type: 'number' }
 *               longitude: { type: 'number' }
 *               is_default: { type: 'boolean', default: false }
 *     responses:
 *       201:
 *         description: Address created
 */
const addAddressSchema = z.object({
  label: z.string().optional(),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().default("US"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  is_default: z.boolean().default(false),
});

clientRouter.post(
  "/addresses",
  validateBody(addAddressSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const {
        label,
        line1,
        line2,
        city,
        state,
        postal_code,
        country,
        latitude,
        longitude,
        is_default,
      } = req.body;

      // If setting as default, unset other defaults
      if (is_default) {
        await query("UPDATE addresses SET is_default = false WHERE user_id = $1", [clientId]);
      }

      const result = await query(
        `
        INSERT INTO addresses (
          user_id, label, line1, line2, city, state, postal_code, country, lat, lng, is_default
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, created_at, updated_at
        `,
        [
          clientId,
          label || null,
          line1,
          line2 || null,
          city,
          state || null,
          postal_code || null,
          country || "US",
          latitude || null,
          longitude || null,
          is_default,
        ]
      );

      res.status(201).json({
        address: {
          id: result.rows[0].id,
          ...req.body,
          created_at: result.rows[0].created_at,
          updated_at: result.rows[0].updated_at,
        },
      });
    } catch (error) {
      logger.error("add_address_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "ADD_ADDRESS_FAILED", message: "Failed to add address" },
      });
    }
  })
);

/**
 * @swagger
 * /client/addresses/{id}:
 *   patch:
 *     summary: Update an address
 *     description: Update an existing address.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: 'string' }
 *               line1: { type: 'string' }
 *               line2: { type: 'string' }
 *               city: { type: 'string' }
 *               state: { type: 'string' }
 *               postal_code: { type: 'string' }
 *               country: { type: 'string' }
 *               latitude: { type: 'number' }
 *               longitude: { type: 'number' }
 *               is_default: { type: 'boolean' }
 *     responses:
 *       200:
 *         description: Address updated
 *       404:
 *         description: Address not found
 */
const updateAddressSchema = addAddressSchema.partial();

clientRouter.patch(
  "/addresses/:id",
  validateBody(updateAddressSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { id } = req.params;
      const updates = req.body;

      // If setting as default, unset other defaults
      if (updates.is_default) {
        await query("UPDATE addresses SET is_default = false WHERE user_id = $1 AND id != $2", [
          clientId,
          id,
        ]);
      }

      const setClause: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          const dbKey =
            key === "postal_code"
              ? "postal_code"
              : key === "latitude"
                ? "lat"
                : key === "longitude"
                  ? "lng"
                  : key;
          setClause.push(`${dbKey} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      });

      if (setClause.length === 0) {
        return res.status(400).json({
          error: { code: "NO_UPDATES", message: "No fields to update" },
        });
      }

      values.push(id, clientId);
      const result = await query(
        `
        UPDATE addresses
        SET ${setClause.join(", ")}, updated_at = NOW()
        WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
        RETURNING *
        `,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: { code: "ADDRESS_NOT_FOUND", message: "Address not found" },
        });
      }

      res.json({ address: result.rows[0] });
    } catch (error) {
      logger.error("update_address_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "UPDATE_ADDRESS_FAILED", message: "Failed to update address" },
      });
    }
  })
);

/**
 * @swagger
 * /client/addresses/{id}/default:
 *   patch:
 *     summary: Set address as default
 *     description: Set an address as the default address for the client.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Address set as default
 *       404:
 *         description: Address not found
 */
clientRouter.patch(
  "/addresses/:id/default",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { id } = req.params;

      // Unset all other defaults
      await query("UPDATE addresses SET is_default = false WHERE user_id = $1", [clientId]);

      // Set this one as default
      const result = await query(
        `
      UPDATE addresses
      SET is_default = true, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
      `,
        [id, clientId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: { code: "ADDRESS_NOT_FOUND", message: "Address not found" },
        });
      }

      res.json({ address: result.rows[0] });
    } catch (error) {
      logger.error("set_default_address_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "SET_DEFAULT_ADDRESS_FAILED", message: "Failed to set default address" },
      });
    }
  })
);

/**
 * @swagger
 * /client/addresses/{id}:
 *   delete:
 *     summary: Delete an address
 *     description: Delete an address.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Address deleted
 *       404:
 *         description: Address not found
 */
clientRouter.delete(
  "/addresses/:id",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { id } = req.params;

      const result = await query(
        "DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id",
        [id, clientId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: { code: "ADDRESS_NOT_FOUND", message: "Address not found" },
        });
      }

      res.json({ success: true });
    } catch (error) {
      logger.error("delete_address_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "DELETE_ADDRESS_FAILED", message: "Failed to delete address" },
      });
    }
  })
);

// ============================================
// PAYMENT METHODS
// ============================================

/**
 * @swagger
 * /client/payment-methods:
 *   get:
 *     summary: Get payment methods
 *     description: Get all payment methods for the current client (managed through Stripe).
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of payment methods
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 paymentMethods:
 *                   type: array
 *                   items:
 *                     type: object
 */
clientRouter.get(
  "/payment-methods",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;

      // Get Stripe customer ID
      const customerResult = await query(
        "SELECT stripe_customer_id, default_payment_method_id FROM stripe_customers WHERE user_id = $1",
        [clientId]
      );

      if (customerResult.rows.length === 0) {
        // No Stripe customer yet - return empty array
        return res.json({ paymentMethods: [] });
      }

      const stripeCustomerId = customerResult.rows[0].stripe_customer_id;
      const defaultPaymentMethodId = customerResult.rows[0].default_payment_method_id;

      // TODO: Call Stripe API to get payment methods
      // For now, return empty array or placeholder
      // In production, you would use:
      // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      // const paymentMethods = await stripe.paymentMethods.list({
      //   customer: stripeCustomerId,
      //   type: 'card',
      // });

      res.json({
        paymentMethods: [], // Placeholder - would be populated from Stripe API
        message: "Payment methods are managed through Stripe. Integration pending.",
      });
    } catch (error) {
      logger.error("get_payment_methods_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "GET_PAYMENT_METHODS_FAILED", message: "Failed to get payment methods" },
      });
    }
  })
);

/**
 * @swagger
 * /client/payment-methods/{id}/default:
 *   patch:
 *     summary: Set default payment method
 *     description: Set a payment method as the default for the client.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Stripe payment method ID
 *     responses:
 *       200:
 *         description: Default payment method updated
 *       404:
 *         description: Customer not found
 */
clientRouter.patch(
  "/payment-methods/:id/default",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { id } = req.params; // This is the Stripe payment method ID

      // Get Stripe customer ID
      const customerResult = await query(
        "SELECT stripe_customer_id FROM stripe_customers WHERE user_id = $1",
        [clientId]
      );

      if (customerResult.rows.length === 0) {
        return res.status(404).json({
          error: { code: "CUSTOMER_NOT_FOUND", message: "Stripe customer not found" },
        });
      }

      const stripeCustomerId = customerResult.rows[0].stripe_customer_id;

      // TODO: Call Stripe API to set default payment method
      // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      // await stripe.customers.update(stripeCustomerId, {
      //   invoice_settings: {
      //     default_payment_method: id,
      //   },
      // });

      // Update our database
      await query(
        "UPDATE stripe_customers SET default_payment_method_id = $1, updated_at = NOW() WHERE user_id = $2",
        [id, clientId]
      );

      res.json({ success: true, message: "Default payment method updated" });
    } catch (error) {
      logger.error("set_default_payment_method_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: {
          code: "SET_DEFAULT_PAYMENT_METHOD_FAILED",
          message: "Failed to set default payment method",
        },
      });
    }
  })
);

/**
 * @swagger
 * /client/payment-methods/{id}:
 *   delete:
 *     summary: Delete payment method
 *     description: Remove a payment method from the client's account.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Stripe payment method ID
 *     responses:
 *       200:
 *         description: Payment method removed
 *       404:
 *         description: Customer not found
 */
clientRouter.delete(
  "/payment-methods/:id",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { id } = req.params; // This is the Stripe payment method ID

      // Get Stripe customer ID
      const customerResult = await query(
        "SELECT stripe_customer_id, default_payment_method_id FROM stripe_customers WHERE user_id = $1",
        [clientId]
      );

      if (customerResult.rows.length === 0) {
        return res.status(404).json({
          error: { code: "CUSTOMER_NOT_FOUND", message: "Stripe customer not found" },
        });
      }

      // If this is the default payment method, clear it
      if (customerResult.rows[0].default_payment_method_id === id) {
        await query(
          "UPDATE stripe_customers SET default_payment_method_id = NULL, updated_at = NOW() WHERE user_id = $1",
          [clientId]
        );
      }

      // TODO: Call Stripe API to detach payment method
      // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      // await stripe.paymentMethods.detach(id);

      res.json({ success: true, message: "Payment method removed" });
    } catch (error) {
      logger.error("delete_payment_method_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "DELETE_PAYMENT_METHOD_FAILED", message: "Failed to delete payment method" },
      });
    }
  })
);

// ============================================
// RECURRING BOOKINGS
// ============================================

/**
 * @swagger
 * /client/recurring-bookings:
 *   get:
 *     summary: Get recurring bookings
 *     description: Get all recurring booking subscriptions for the current client.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of recurring bookings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recurringBookings:
 *                   type: array
 *                   items:
 *                     type: object
 */
clientRouter.get(
  "/recurring-bookings",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;

      const result = await query(
        `
      SELECT 
        cs.id,
        cs.frequency,
        cs.day_of_week,
        cs.preferred_time,
        cs.address,
        cs.next_job_date,
        cs.status,
        cs.credit_amount,
        cs.base_hours,
        cs.cleaning_type,
        cs.created_at,
        cs.updated_at,
        u.id as cleaner_id,
        cp.first_name || ' ' || COALESCE(cp.last_name, '') as cleaner_name
      FROM cleaning_subscriptions cs
      LEFT JOIN users u ON u.id = cs.cleaner_id
      LEFT JOIN cleaner_profiles cp ON cp.user_id = u.id
      WHERE cs.client_id = $1
      ORDER BY cs.created_at DESC
      `,
        [clientId]
      );

      res.json({
        recurringBookings: result.rows.map((row) => ({
          id: row.id,
          frequency: row.frequency,
          day_of_week: row.day_of_week,
          preferred_time: row.preferred_time,
          address: row.address,
          next_booking_date: row.next_job_date,
          status: row.status,
          cleaner: row.cleaner_id
            ? {
                id: row.cleaner_id,
                name: row.cleaner_name,
              }
            : null,
        })),
      });
    } catch (error) {
      logger.error("get_recurring_bookings_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: {
          code: "GET_RECURRING_BOOKINGS_FAILED",
          message: "Failed to get recurring bookings",
        },
      });
    }
  })
);

/**
 * @swagger
 * /client/recurring-bookings:
 *   post:
 *     summary: Create recurring booking
 *     description: Create a new recurring booking subscription.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - frequency
 *               - start_date
 *               - address
 *             properties:
 *               cleaner_id: { type: 'string', format: 'uuid' }
 *               service_type: { type: 'string', enum: ['standard', 'deep', 'move_in_out', 'airbnb'], default: 'standard' }
 *               frequency: { type: 'string', enum: ['weekly', 'biweekly', 'monthly'] }
 *               start_date: { type: 'string', format: 'date' }
 *               time: { type: 'string' }
 *               address: { type: 'string' }
 *               duration_hours: { type: 'number', default: 2 }
 *     responses:
 *       201:
 *         description: Recurring booking created
 */
const createRecurringBookingSchema = z.object({
  cleaner_id: z.string().optional(),
  service_type: z.enum(["standard", "deep", "move_in_out", "airbnb"]).default("standard"),
  frequency: z.enum(["weekly", "biweekly", "monthly"]),
  start_date: z.string(),
  time: z.string().optional(),
  address: z.string().min(1),
  duration_hours: z.number().positive().default(2),
});

clientRouter.post(
  "/recurring-bookings",
  validateBody(createRecurringBookingSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { cleaner_id, service_type, frequency, start_date, time, address, duration_hours } =
        req.body;

      // Calculate credit amount (simplified - would use pricing service)
      const baseRate = 35; // Default rate
      const creditAmount = Math.round(baseRate * duration_hours * 100); // In cents

      // Map frequency to database format
      const dbFrequency = frequency === "biweekly" ? "bi-weekly" : frequency;

      // Calculate next job date
      const startDate = new Date(start_date);
      const nextJobDate = new Date(startDate);

      const result = await query(
        `
        INSERT INTO cleaning_subscriptions (
          client_id, cleaner_id, frequency, preferred_time, address, 
          credit_amount, base_hours, cleaning_type, next_job_date, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
        RETURNING id, created_at, updated_at
        `,
        [
          clientId,
          cleaner_id || null,
          dbFrequency,
          time || null,
          address,
          creditAmount,
          duration_hours,
          service_type,
          nextJobDate,
        ]
      );

      res.status(201).json({
        recurringBooking: {
          id: result.rows[0].id,
          ...req.body,
          status: "active",
          created_at: result.rows[0].created_at,
        },
      });
    } catch (error) {
      logger.error("create_recurring_booking_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: {
          code: "CREATE_RECURRING_BOOKING_FAILED",
          message: "Failed to create recurring booking",
        },
      });
    }
  })
);

/**
 * @swagger
 * /client/recurring-bookings/{id}:
 *   patch:
 *     summary: Update recurring booking
 *     description: Update an existing recurring booking subscription.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               frequency: { type: 'string', enum: ['weekly', 'biweekly', 'monthly'] }
 *               start_date: { type: 'string', format: 'date' }
 *               time: { type: 'string' }
 *               address: { type: 'string' }
 *               duration_hours: { type: 'number' }
 *               status: { type: 'string', enum: ['active', 'paused', 'cancelled'] }
 *     responses:
 *       200:
 *         description: Recurring booking updated
 *       404:
 *         description: Recurring booking not found
 */
const updateRecurringBookingSchema = createRecurringBookingSchema.partial().extend({
  status: z.enum(["active", "paused", "cancelled"]).optional(),
});

clientRouter.patch(
  "/recurring-bookings/:id",
  validateBody(updateRecurringBookingSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { id } = req.params;
      const updates = req.body;

      const setClause: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          const dbKey =
            key === "service_type"
              ? "cleaning_type"
              : key === "duration_hours"
                ? "base_hours"
                : key === "start_date"
                  ? "next_job_date"
                  : key;
          setClause.push(`${dbKey} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      });

      if (setClause.length === 0) {
        return res.status(400).json({
          error: { code: "NO_UPDATES", message: "No fields to update" },
        });
      }

      values.push(id, clientId);
      const result = await query(
        `
        UPDATE cleaning_subscriptions
        SET ${setClause.join(", ")}, updated_at = NOW()
        WHERE id = $${paramIndex}::uuid AND client_id = $${paramIndex + 1}
        RETURNING *
        `,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: { code: "RECURRING_BOOKING_NOT_FOUND", message: "Recurring booking not found" },
        });
      }

      res.json({ recurringBooking: result.rows[0] });
    } catch (error) {
      logger.error("update_recurring_booking_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: {
          code: "UPDATE_RECURRING_BOOKING_FAILED",
          message: "Failed to update recurring booking",
        },
      });
    }
  })
);

/**
 * @swagger
 * /client/recurring-bookings/{id}:
 *   delete:
 *     summary: Cancel recurring booking
 *     description: Cancel a recurring booking subscription.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Recurring booking cancelled
 *       404:
 *         description: Recurring booking not found
 */
clientRouter.delete(
  "/recurring-bookings/:id",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { id } = req.params;

      const result = await query(
        "UPDATE cleaning_subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1::uuid AND client_id = $2 RETURNING id",
        [id, clientId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: { code: "RECURRING_BOOKING_NOT_FOUND", message: "Recurring booking not found" },
        });
      }

      res.json({ success: true });
    } catch (error) {
      logger.error("delete_recurring_booking_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: {
          code: "DELETE_RECURRING_BOOKING_FAILED",
          message: "Failed to delete recurring booking",
        },
      });
    }
  })
);

// ============================================
// REVIEWS
// ============================================

/**
 * @swagger
 * /client/reviews/given:
 *   get:
 *     summary: Get reviews given
 *     description: Get all reviews given by the current client to cleaners.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of reviews given
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reviews:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: 'string', format: 'uuid' }
 *                       job_id: { type: 'string', format: 'uuid' }
 *                       rating: { type: 'integer', minimum: 1, maximum: 5 }
 *                       comment: { type: 'string', nullable: true }
 *                       cleaner: { type: 'object' }
 *                       created_at: { type: 'string', format: 'date-time' }
 */
clientRouter.get(
  "/reviews/given",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;

      const result = await query(
        `
      SELECT 
        r.id,
        r.job_id,
        r.rating,
        r.comment,
        r.created_at,
        r.updated_at,
        u.id as cleaner_id,
        cp.first_name || ' ' || COALESCE(cp.last_name, '') as cleaner_name,
        cp.avatar_url as cleaner_avatar
      FROM reviews r
      INNER JOIN users u ON u.id = r.reviewee_id
      LEFT JOIN cleaner_profiles cp ON cp.user_id = u.id
      WHERE r.reviewer_id = $1 AND r.reviewer_type = 'client'
      ORDER BY r.created_at DESC
      `,
        [clientId]
      );

      res.json({
        reviews: result.rows.map((row) => ({
          id: row.id,
          job_id: row.job_id,
          rating: row.rating,
          comment: row.comment,
          cleaner_id: row.cleaner_id,
          cleaner: {
            id: row.cleaner_id,
            name: row.cleaner_name,
            avatar_url: row.cleaner_avatar,
          },
          created_at: row.created_at,
          updated_at: row.updated_at,
        })),
      });
    } catch (error) {
      logger.error("get_reviews_given_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "GET_REVIEWS_FAILED", message: "Failed to get reviews" },
      });
    }
  })
);

/**
 * @swagger
 * /client/reviews:
 *   post:
 *     summary: Create review
 *     description: Create a new review for a cleaner (optionally linked to a job).
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cleaner_id
 *               - rating
 *             properties:
 *               cleaner_id:
 *                 type: string
 *               job_id:
 *                 type: string
 *                 format: uuid
 *                 description: Optional job ID to link review to
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *                 maxLength: 2000
 *     responses:
 *       201:
 *         description: Review created
 *       400:
 *         description: Invalid input or duplicate review
 *       404:
 *         description: Cleaner or job not found
 */
const createReviewSchema = z.object({
  cleaner_id: z.string().min(1),
  job_id: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

clientRouter.post(
  "/reviews",
  validateBody(createReviewSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { cleaner_id, job_id, rating, comment } = req.body;

      // If job_id provided, verify it belongs to the client and cleaner
      if (job_id) {
        const jobCheck = await query(
          "SELECT id FROM jobs WHERE id = $1 AND client_id = $2 AND cleaner_id = $3",
          [job_id, clientId, cleaner_id]
        );
        if (jobCheck.rows.length === 0) {
          return res.status(404).json({
            error: { code: "JOB_NOT_FOUND", message: "Job not found or doesn't match" },
          });
        }
      }

      const result = await query(
        `
        INSERT INTO reviews (job_id, reviewer_id, reviewee_id, reviewer_type, rating, comment)
        VALUES ($1, $2, $3, 'client', $4, $5)
        ON CONFLICT (job_id) DO UPDATE SET
          rating = EXCLUDED.rating,
          comment = EXCLUDED.comment,
          updated_at = NOW()
        RETURNING id, created_at, updated_at
        `,
        [job_id || null, clientId, cleaner_id, rating, comment || null]
      );

      res.status(201).json({
        review: {
          id: result.rows[0].id,
          job_id: job_id || null,
          cleaner_id,
          rating,
          comment: comment || null,
          created_at: result.rows[0].created_at,
          updated_at: result.rows[0].updated_at,
        },
      });
    } catch (error) {
      logger.error("create_review_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "CREATE_REVIEW_FAILED", message: "Failed to create review" },
      });
    }
  })
);

/**
 * PATCH /client/reviews/:id
 * Update a review
 */
const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(2000).optional(),
});

clientRouter.patch(
  "/reviews/:id",
  validateBody(updateReviewSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { id } = req.params;
      const { rating, comment } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (rating !== undefined) {
        updates.push(`rating = $${paramIndex}`);
        values.push(rating);
        paramIndex++;
      }

      if (comment !== undefined) {
        updates.push(`comment = $${paramIndex}`);
        values.push(comment);
        paramIndex++;
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: { code: "NO_UPDATES", message: "No fields to update" },
        });
      }

      values.push(id, clientId);
      const result = await query(
        `
        UPDATE reviews
        SET ${updates.join(", ")}, updated_at = NOW()
        WHERE id = $${paramIndex}::uuid AND reviewer_id = $${paramIndex + 1}
        RETURNING *
        `,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: { code: "REVIEW_NOT_FOUND", message: "Review not found" },
        });
      }

      res.json({ review: result.rows[0] });
    } catch (error) {
      logger.error("update_review_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "UPDATE_REVIEW_FAILED", message: "Failed to update review" },
      });
    }
  })
);

/**
 * DELETE /client/reviews/:id
 * Delete a review
 */
clientRouter.delete(
  "/reviews/:id",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const clientId = req.user!.id;
      const { id } = req.params;

      const result = await query(
        "DELETE FROM reviews WHERE id = $1::uuid AND reviewer_id = $2 RETURNING id",
        [id, clientId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: { code: "REVIEW_NOT_FOUND", message: "Review not found" },
        });
      }

      res.json({ success: true });
    } catch (error) {
      logger.error("delete_review_failed", {
        error: (error as Error).message,
        userId: req.user?.id,
      });
      res.status(500).json({
        error: { code: "DELETE_REVIEW_FAILED", message: "Failed to delete review" },
      });
    }
  })
);

export default clientRouter;
