"use strict";
// src/services/notifications/templates.ts
// Notification message templates
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmailSubject = getEmailSubject;
exports.getEmailBody = getEmailBody;
exports.getSmsBody = getSmsBody;
exports.getPushTitle = getPushTitle;
exports.getPushBody = getPushBody;
// ============================================
// Email Templates
// ============================================
function getEmailSubject(type) {
    const subjects = {
        "job.created": "Your cleaning job has been booked",
        "job.accepted": "A cleaner has accepted your job",
        "job.on_my_way": "Your cleaner is on the way",
        "job.started": "Your cleaner has arrived",
        "job.completed": "Cleaning completed - please review",
        "job.awaiting_approval": "Your job is awaiting approval",
        "job.approved": "Thanks for approving your job",
        "job.disputed": "Your dispute has been received",
        "job.cancelled": "Your job has been cancelled",
        "credits.purchased": "Credits added to your account",
        "credits.low": "Your credit balance is running low",
        "payout.processed": "Your payout has been processed",
        "payout.failed": "Payout issue - action required",
        "welcome": "Welcome to PureTask!",
        "password.reset": "Reset your PureTask password",
    };
    return subjects[type] || "PureTask Update";
}
function getEmailBody(type, data) {
    const jobId = data.jobId || "N/A";
    const clientName = data.clientName || "Customer";
    const cleanerName = data.cleanerName || "Your cleaner";
    const address = data.address || "";
    const creditAmount = data.creditAmount || 0;
    const amount = data.amount || 0;
    const name = data.name || "there";
    const templates = {
        "job.created": `Hi ${clientName},\n\nYour cleaning job (${jobId}) has been created and is awaiting a cleaner.\n\nAddress: ${address}\nCredits: ${creditAmount}\n\nWe'll notify you when a cleaner accepts your job.\n\nThanks,\nThe PureTask Team`,
        "job.accepted": `Hi ${clientName},\n\nGreat news! ${cleanerName} has accepted your cleaning job (${jobId}).\n\nThey will arrive at your scheduled time. You'll receive another notification when they're on their way.\n\nThanks,\nThe PureTask Team`,
        "job.on_my_way": `Hi ${clientName},\n\n${cleanerName} is on the way to your location for job ${jobId}.\n\nPlease ensure access to your property is available.\n\nThanks,\nThe PureTask Team`,
        "job.started": `Hi ${clientName},\n\n${cleanerName} has arrived and started working on job ${jobId}.\n\nWe'll notify you when they finish.\n\nThanks,\nThe PureTask Team`,
        "job.completed": `Hi ${clientName},\n\n${cleanerName} has finished your cleaning job (${jobId}).\n\nPlease open the app to review and approve the work.\n\nThanks,\nThe PureTask Team`,
        "job.awaiting_approval": `Hi ${clientName},\n\nYour cleaning job (${jobId}) is complete and awaiting your approval.\n\nPlease review and approve in the app.\n\nThanks,\nThe PureTask Team`,
        "job.approved": `Hi ${clientName},\n\nThank you for approving job ${jobId}.\n\n${creditAmount} credits have been charged. We hope you enjoyed the service!\n\nThanks,\nThe PureTask Team`,
        "job.disputed": `Hi ${clientName},\n\nWe received your dispute for job ${jobId}.\n\nOur team will review it and get back to you within 24-48 hours.\n\nThanks,\nThe PureTask Team`,
        "job.cancelled": `Hi ${clientName},\n\nYour job (${jobId}) has been cancelled.\n\nAny escrowed credits have been refunded to your account.\n\nThanks,\nThe PureTask Team`,
        "credits.purchased": `Hi ${clientName},\n\n${creditAmount} credits have been added to your account.\n\nYour new balance is ready to use for booking cleaning jobs.\n\nThanks,\nThe PureTask Team`,
        "credits.low": `Hi ${clientName},\n\nYour credit balance is running low.\n\nConsider purchasing more credits to continue booking cleaning services.\n\nThanks,\nThe PureTask Team`,
        "payout.processed": `Hi ${cleanerName},\n\nYour payout of $${(amount / 100).toFixed(2)} has been processed and sent to your bank account.\n\nIt should arrive within 2-3 business days.\n\nThanks,\nThe PureTask Team`,
        "payout.failed": `Hi ${cleanerName},\n\nWe encountered an issue processing your payout.\n\nPlease check your payment settings in the app and ensure your bank details are correct.\n\nThanks,\nThe PureTask Team`,
        "welcome": `Hi ${name},\n\nWelcome to PureTask!\n\nWe're excited to have you. Get started by browsing available cleaning services or adding credits to your account.\n\nIf you have any questions, we're here to help.\n\nThanks,\nThe PureTask Team`,
        "password.reset": `Hi ${name},\n\nWe received a request to reset your password.\n\nClick the link below to set a new password:\n${data.resetUrl || "[Reset Link]"}\n\nIf you didn't request this, you can safely ignore this email.\n\nThanks,\nThe PureTask Team`,
    };
    return templates[type] || `You have a new update from PureTask regarding ${type}.`;
}
// ============================================
// SMS Templates (shorter)
// ============================================
function getSmsBody(type, data) {
    const jobId = data.jobId?.slice(0, 8) || "job";
    const cleanerName = data.cleanerName || "Your cleaner";
    const templates = {
        "job.accepted": `PureTask: ${cleanerName} accepted your job. We'll notify you when they're on the way.`,
        "job.on_my_way": `PureTask: ${cleanerName} is on the way to your location now.`,
        "job.started": `PureTask: Your cleaner has arrived and started job ${jobId}.`,
        "job.completed": `PureTask: Job ${jobId} completed. Open the app to approve.`,
        "job.cancelled": `PureTask: Your job ${jobId} has been cancelled. Credits refunded.`,
        "payout.processed": `PureTask: Your payout has been sent to your bank.`,
    };
    return templates[type] || `PureTask: Update for job ${jobId}. Check the app for details.`;
}
// ============================================
// Push Notification Templates
// ============================================
function getPushTitle(type) {
    const titles = {
        "job.accepted": "Cleaner Accepted!",
        "job.on_my_way": "Cleaner On The Way",
        "job.started": "Cleaner Has Arrived",
        "job.completed": "Job Completed",
        "job.approved": "Job Approved",
        "job.cancelled": "Job Cancelled",
        "credits.purchased": "Credits Added",
        "payout.processed": "Payout Sent",
    };
    return titles[type] || "PureTask Update";
}
function getPushBody(type, data) {
    const jobId = data.jobId?.slice(0, 8) || "";
    const cleanerName = data.cleanerName || "Your cleaner";
    const creditAmount = data.creditAmount || 0;
    const bodies = {
        "job.accepted": `${cleanerName} accepted your job`,
        "job.on_my_way": `${cleanerName} is on the way`,
        "job.started": `${cleanerName} has started cleaning`,
        "job.completed": "Tap to review and approve",
        "job.approved": "Thanks for the review!",
        "job.cancelled": "Your job has been cancelled",
        "credits.purchased": `${creditAmount} credits added`,
        "payout.processed": "Check your bank in 2-3 days",
    };
    return bodies[type] || `Update for job ${jobId}`;
}
