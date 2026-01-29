// src/config/swagger.ts
// Swagger/OpenAPI configuration for API documentation

import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PureTask API',
      version: '1.0.0',
      description: 'PureTask Backend API Documentation - Uber-style cleaning marketplace',
      contact: {
        name: 'PureTask Support',
        email: 'support@puretask.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Development',
      },
      {
        url: 'https://api.puretask.com',
        description: 'Production',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /auth/login endpoint',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Error code',
                },
                message: {
                  type: 'string',
                  description: 'Error message',
                },
              },
            },
            requestId: {
              type: 'string',
              description: 'Request ID for tracking',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp of the error',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['client', 'cleaner', 'admin'] },
            first_name: { type: 'string', nullable: true },
            last_name: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            email_verified: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Job: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            client_id: { type: 'string', format: 'uuid' },
            cleaner_id: { type: 'string', format: 'uuid', nullable: true },
            status: {
              type: 'string',
              enum: [
                'requested',
                'accepted',
                'on_my_way',
                'in_progress',
                'awaiting_approval',
                'completed',
                'disputed',
                'cancelled',
              ],
            },
            scheduled_start_at: { type: 'string', format: 'date-time' },
            scheduled_end_at: { type: 'string', format: 'date-time' },
            address: { type: 'string' },
            credit_amount: { type: 'number' },
            cleaning_type: {
              type: 'string',
              enum: ['basic', 'deep', 'move_out', 'recurring'],
              nullable: true,
            },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User management endpoints' },
      { name: 'Jobs', description: 'Job management endpoints' },
      { name: 'Payments', description: 'Payment and credit endpoints' },
      { name: 'Cleaners', description: 'Cleaner-specific endpoints' },
      { name: 'Clients', description: 'Client-specific endpoints' },
      { name: 'Health', description: 'Health check endpoints' },
    ],
  },
  apis: ['./src/routes/**/*.ts', './src/index.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
