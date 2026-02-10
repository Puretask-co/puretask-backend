// src/routes/admin/index.ts
// Main admin router that combines all admin sub-routes

import { Router } from 'express';
import analyticsRouter from './analytics';
import bookingsRouter from './bookings';
import cleanersRouter from './cleaners';
import clientsRouter from './clients';
import financeRouter from './finance';
import riskRouter from './risk';
import messagesRouter from './messages';
import systemRouter from './system';
import settingsRouter from './settings';
import webhooksRouter from './webhooks';
import jobsRouter from './jobs';
import levelTuningRouter from './levelTuning';
import gamificationControlRouter from './gamificationControl';

const adminRouter = Router();

// Mount all admin sub-routes
adminRouter.use('/webhooks', webhooksRouter);
adminRouter.use('/jobs', jobsRouter);
adminRouter.use('/analytics', analyticsRouter);
adminRouter.use('/bookings', bookingsRouter);
adminRouter.use('/cleaners', cleanersRouter);
adminRouter.use('/clients', clientsRouter);
adminRouter.use('/finance', financeRouter);
adminRouter.use('/risk', riskRouter);
adminRouter.use('/messages', messagesRouter);
adminRouter.use('/system', systemRouter);
adminRouter.use('/settings', settingsRouter);
adminRouter.use('/level-tuning', levelTuningRouter);
adminRouter.use('/gamification', gamificationControlRouter);

export default adminRouter;

