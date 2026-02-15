// src/config/swagger.ts
// Swagger/OpenAPI configuration for API documentation

import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "PureTask API",
      version: "1.0.0",
      description: "PureTask Backend API Documentation - Uber-style cleaning marketplace",
      contact: {
        name: "PureTask Support",
        email: "support@puretask.com",
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: "Development",
      },
      {
        url: "https://api.puretask.com",
        description: "Production",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token obtained from /auth/login endpoint",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  description: "Error code",
                },
                message: {
                  type: "string",
                  description: "Error message",
                },
              },
            },
            requestId: {
              type: "string",
              description: "Request ID for tracking",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "Timestamp of the error",
            },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["client", "cleaner", "admin"] },
            first_name: { type: "string", nullable: true },
            last_name: { type: "string", nullable: true },
            phone: { type: "string", nullable: true },
            email_verified: { type: "boolean" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        Job: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            client_id: { type: "string", format: "uuid" },
            cleaner_id: { type: "string", format: "uuid", nullable: true },
            status: {
              type: "string",
              enum: [
                "requested",
                "accepted",
                "on_my_way",
                "in_progress",
                "awaiting_approval",
                "completed",
                "disputed",
                "cancelled",
              ],
              description: "Current job status",
            },
            scheduled_start_at: { type: "string", format: "date-time" },
            scheduled_end_at: { type: "string", format: "date-time" },
            address: { type: "string" },
            latitude: { type: "number", nullable: true },
            longitude: { type: "number", nullable: true },
            credit_amount: { type: "number", description: "Credits required for this job" },
            cleaning_type: {
              type: "string",
              enum: ["basic", "deep", "move_out", "recurring"],
              nullable: true,
            },
            client_notes: { type: "string", nullable: true },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        CreditPackage: {
          type: "object",
          properties: {
            id: { type: "string" },
            credits: { type: "number" },
            price_cents: { type: "number" },
            price_formatted: { type: "string" },
            bonus_credits: { type: "number", nullable: true },
          },
        },
        PaymentIntent: {
          type: "object",
          properties: {
            clientSecret: { type: "string", description: "Stripe client secret for payment" },
            paymentIntentId: { type: "string", description: "Stripe payment intent ID" },
            credits: { type: "number", description: "Number of credits" },
            amountCents: { type: "number", description: "Amount in cents" },
            amountFormatted: { type: "string", description: "Formatted amount (e.g., $50.00)" },
          },
        },
        CleanerProfile: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            user_id: { type: "string", format: "uuid" },
            base_rate_cph: { type: "number", description: "Base rate per hour" },
            deep_addon_cph: { type: "number", nullable: true },
            moveout_addon_cph: { type: "number", nullable: true },
            bio: { type: "string", nullable: true },
            tier: { type: "string", enum: ["bronze", "silver", "gold", "platinum"] },
            reliability_score: { type: "number", description: "Reliability score (0-100)" },
            avatar_url: { type: "string", nullable: true },
          },
        },
        Payout: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            cleaner_id: { type: "string", format: "uuid" },
            amount_cents: { type: "number" },
            status: { type: "string", enum: ["pending", "processing", "paid", "failed"] },
            stripe_transfer_id: { type: "string", nullable: true },
            created_at: { type: "string", format: "date-time" },
            paid_at: { type: "string", format: "date-time", nullable: true },
          },
        },
        JobEvent: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            job_id: { type: "string", format: "uuid" },
            event_type: {
              type: "string",
              enum: [
                "job_created",
                "job_accepted",
                "cleaner_on_my_way",
                "job_started",
                "job_completed",
                "job_approved",
                "job_disputed",
                "job_cancelled",
              ],
            },
            payload: { type: "object", nullable: true },
            created_at: { type: "string", format: "date-time" },
          },
        },
      },
    },
    tags: [
      { name: "Auth", description: "Authentication endpoints" },
      { name: "Users", description: "User management endpoints" },
      { name: "Jobs", description: "Job management endpoints" },
      { name: "Payments", description: "Payment and credit endpoints" },
      { name: "Cleaners", description: "Cleaner-specific endpoints" },
      { name: "Clients", description: "Client-specific endpoints" },
      { name: "Health", description: "Health check endpoints" },
    ],
  },
  apis: ["./src/routes/**/*.ts", "./src/index.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
