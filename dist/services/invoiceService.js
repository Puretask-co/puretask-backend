"use strict";
// src/services/invoiceService.ts
// Cleaner-Initiated Invoicing System
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInvoice = createInvoice;
exports.sendInvoice = sendInvoice;
exports.payInvoiceWithCredits = payInvoiceWithCredits;
exports.payInvoiceWithCard = payInvoiceWithCard;
exports.handleInvoicePaymentSuccess = handleInvoicePaymentSuccess;
exports.declineInvoice = declineInvoice;
exports.cancelInvoice = cancelInvoice;
exports.adminApproveInvoice = adminApproveInvoice;
exports.adminDenyInvoice = adminDenyInvoice;
exports.getInvoiceById = getInvoiceById;
exports.getInvoiceWithLineItems = getInvoiceWithLineItems;
exports.getCleanerInvoices = getCleanerInvoices;
exports.getClientInvoices = getClientInvoices;
exports.getAdminInvoices = getAdminInvoices;
exports.getInvoiceStatusHistory = getInvoiceStatusHistory;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const alerting_1 = require("../lib/alerting");
const cleanerClientsService_1 = require("./cleanerClientsService");
const creditsService_1 = require("./creditsService");
const paymentService_1 = require("./paymentService");
// ============================================
// Config Helpers
// ============================================
async function getInvoiceConfig() {
    const result = await (0, client_1.query)(`
      SELECT key, value FROM feature_flags
      WHERE key IN ('INVOICE_APPROVAL_THRESHOLD_CENTS', 'INVOICE_EXPIRY_DAYS', 'INVOICE_TAX_RATE_BPS')
    `, []);
    const config = {};
    for (const row of result.rows) {
        config[row.key] = row.value;
    }
    return {
        approvalThreshold: parseInt(config.INVOICE_APPROVAL_THRESHOLD_CENTS || "10000", 10),
        expiryDays: parseInt(config.INVOICE_EXPIRY_DAYS || "30", 10),
        taxRateBps: parseInt(config.INVOICE_TAX_RATE_BPS || "0", 10),
    };
}
function centsToCredits(cents) {
    // 1 credit = $1 = 100 cents
    return Math.ceil(cents / 100);
}
// ============================================
// Create Invoice
// ============================================
async function createInvoice(cleanerId, input) {
    // Validate cleaner-client relationship
    const hasRelationship = await (0, cleanerClientsService_1.validateCleanerClientRelationship)(cleanerId, input.client_id);
    if (!hasRelationship) {
        throw Object.assign(new Error("You can only invoice clients you have worked with"), {
            statusCode: 403,
        });
    }
    // Validate line items
    if (!input.line_items || input.line_items.length === 0) {
        throw Object.assign(new Error("Invoice must have at least one line item"), {
            statusCode: 400,
        });
    }
    const config = await getInvoiceConfig();
    // Calculate totals
    let subtotal = 0;
    for (const item of input.line_items) {
        if (item.quantity <= 0 || item.unit_price_cents <= 0) {
            throw Object.assign(new Error("Line item quantity and price must be positive"), {
                statusCode: 400,
            });
        }
        subtotal += Math.round(item.quantity * item.unit_price_cents);
    }
    const taxCents = Math.round((subtotal * config.taxRateBps) / 10000);
    const totalCents = subtotal + taxCents;
    const totalCredits = centsToCredits(totalCents);
    // Determine if approval is required
    const requiresApproval = totalCents > config.approvalThreshold;
    const initialStatus = requiresApproval ? "pending_approval" : "draft";
    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.expiryDays);
    // Generate invoice number
    const invoiceNumberResult = await (0, client_1.query)(`SELECT generate_invoice_number()`, []);
    const invoiceNumber = invoiceNumberResult.rows[0]?.generate_invoice_number;
    // Create invoice
    const invoiceResult = await (0, client_1.query)(`
      INSERT INTO invoices (
        invoice_number,
        cleaner_id,
        client_id,
        job_id,
        subtotal_cents,
        tax_cents,
        total_cents,
        total_credits,
        status,
        title,
        description,
        notes_to_client,
        requires_approval,
        due_date,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
        invoiceNumber,
        cleanerId,
        input.client_id,
        input.job_id || null,
        subtotal,
        taxCents,
        totalCents,
        totalCredits,
        initialStatus,
        input.title || null,
        input.description || null,
        input.notes_to_client || null,
        requiresApproval,
        input.due_date || null,
        expiresAt.toISOString(),
    ]);
    const invoice = invoiceResult.rows[0];
    // Insert line items
    const lineItems = [];
    for (let i = 0; i < input.line_items.length; i++) {
        const item = input.line_items[i];
        const itemTotal = Math.round(item.quantity * item.unit_price_cents);
        const itemResult = await (0, client_1.query)(`
        INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price_cents, total_cents, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [invoice.id, item.description, item.quantity, item.unit_price_cents, itemTotal, i]);
        lineItems.push(itemResult.rows[0]);
    }
    // Record status history
    await recordStatusChange(invoice.id, null, initialStatus, cleanerId, "cleaner", "Invoice created");
    // Log and alert if needs approval
    logger_1.logger.info("invoice_created", {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        cleanerId,
        clientId: input.client_id,
        totalCents,
        requiresApproval,
    });
    if (requiresApproval) {
        await (0, alerting_1.sendAlert)({
            level: "warning",
            title: "Invoice Requires Approval",
            message: `Invoice ${invoiceNumber} for $${(totalCents / 100).toFixed(2)} requires admin approval`,
            details: {
                invoiceId: invoice.id,
                cleanerId,
                clientId: input.client_id,
                amount: totalCents,
            },
        });
    }
    return { ...invoice, line_items: lineItems };
}
// ============================================
// Send Invoice (after optional approval)
// ============================================
async function sendInvoice(invoiceId, actorId, actorType) {
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
        throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });
    }
    // Validate status transition
    const validFromStatuses = ["draft", "pending_approval"];
    if (!validFromStatuses.includes(invoice.status)) {
        throw Object.assign(new Error(`Cannot send invoice with status '${invoice.status}'`), { statusCode: 400 });
    }
    // If pending approval, only admin can send
    if (invoice.status === "pending_approval" && actorType !== "admin") {
        throw Object.assign(new Error("This invoice requires admin approval before sending"), {
            statusCode: 403,
        });
    }
    // Update status
    const result = await (0, client_1.query)(`
      UPDATE invoices
      SET status = 'sent', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [invoiceId]);
    await recordStatusChange(invoiceId, invoice.status, "sent", actorId, actorType, "Invoice sent to client");
    logger_1.logger.info("invoice_sent", {
        invoiceId,
        invoiceNumber: invoice.invoice_number,
        clientId: invoice.client_id,
        totalCents: invoice.total_cents,
    });
    // TODO: Send notification to client (push + email)
    return result.rows[0];
}
// ============================================
// Pay Invoice (Client)
// ============================================
async function payInvoiceWithCredits(invoiceId, clientId) {
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
        throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });
    }
    if (invoice.client_id !== clientId) {
        throw Object.assign(new Error("This invoice is not for you"), { statusCode: 403 });
    }
    if (invoice.status !== "sent") {
        throw Object.assign(new Error(`Cannot pay invoice with status '${invoice.status}'`), {
            statusCode: 400,
        });
    }
    // Check client balance
    const balance = await (0, creditsService_1.getUserCreditBalance)(clientId);
    if (balance < invoice.total_credits) {
        throw Object.assign(new Error(`Insufficient credits. Need ${invoice.total_credits}, have ${balance}`), { statusCode: 400 });
    }
    // Deduct credits from client
    await (0, creditsService_1.addLedgerEntry)({
        userId: clientId,
        deltaCredits: -invoice.total_credits,
        reason: "invoice_payment",
        jobId: invoice.id,
    });
    // Credit cleaner earnings (via ledger for cleaner-visible balance, and earnings table)
    await creditCleanerFromInvoice(invoice.cleaner_id, invoice.total_cents, invoice.id);
    // Update invoice
    const result = await (0, client_1.query)(`
      UPDATE invoices
      SET status = 'paid', paid_at = NOW(), paid_via = 'credits', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [invoiceId]);
    await recordStatusChange(invoiceId, "sent", "paid", clientId, "client", "Paid with credits");
    logger_1.logger.info("invoice_paid", {
        invoiceId,
        invoiceNumber: invoice.invoice_number,
        clientId,
        cleanerId: invoice.cleaner_id,
        totalCents: invoice.total_cents,
        paidVia: "credits",
    });
    // TODO: Send confirmation notifications
    return result.rows[0];
}
async function payInvoiceWithCard(invoiceId, clientId) {
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
        throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });
    }
    if (invoice.client_id !== clientId) {
        throw Object.assign(new Error("This invoice is not for you"), { statusCode: 403 });
    }
    if (invoice.status !== "sent") {
        throw Object.assign(new Error(`Cannot pay invoice with status '${invoice.status}'`), {
            statusCode: 400,
        });
    }
    // Create payment intent
    const paymentIntent = await (0, paymentService_1.createInvoicePaymentIntent)({
        invoiceId: invoice.id,
        amountCents: invoice.total_cents,
        currency: "usd",
        clientId,
        cleanerId: invoice.cleaner_id,
    });
    // Update invoice with payment intent ID
    const result = await (0, client_1.query)(`
      UPDATE invoices
      SET payment_intent_id = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [paymentIntent.id, invoiceId]);
    logger_1.logger.info("invoice_payment_intent_created", {
        invoiceId,
        paymentIntentId: paymentIntent.id,
        totalCents: invoice.total_cents,
    });
    return {
        invoice: result.rows[0],
        paymentIntentClientSecret: paymentIntent.client_secret,
    };
}
// Called by Stripe webhook when payment_intent.succeeded with purpose='invoice_payment'
async function handleInvoicePaymentSuccess(paymentIntentId) {
    const invoiceResult = await (0, client_1.query)(`SELECT * FROM invoices WHERE payment_intent_id = $1`, [paymentIntentId]);
    const invoice = invoiceResult.rows[0];
    if (!invoice) {
        logger_1.logger.warn("invoice_payment_success_no_invoice", { paymentIntentId });
        return null;
    }
    if (invoice.status === "paid") {
        // Already processed
        return invoice;
    }
    // Credit cleaner earnings
    await creditCleanerFromInvoice(invoice.cleaner_id, invoice.total_cents, invoice.id);
    // Update invoice
    const result = await (0, client_1.query)(`
      UPDATE invoices
      SET status = 'paid', paid_at = NOW(), paid_via = 'card', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [invoice.id]);
    await recordStatusChange(invoice.id, invoice.status, "paid", null, "system", "Paid with card via Stripe");
    logger_1.logger.info("invoice_paid_stripe", {
        invoiceId: invoice.id,
        paymentIntentId,
        totalCents: invoice.total_cents,
    });
    return result.rows[0];
}
// ============================================
// Decline Invoice (Client)
// ============================================
async function declineInvoice(invoiceId, clientId, reason) {
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
        throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });
    }
    if (invoice.client_id !== clientId) {
        throw Object.assign(new Error("This invoice is not for you"), { statusCode: 403 });
    }
    if (invoice.status !== "sent") {
        throw Object.assign(new Error(`Cannot decline invoice with status '${invoice.status}'`), {
            statusCode: 400,
        });
    }
    const result = await (0, client_1.query)(`
      UPDATE invoices
      SET status = 'declined', denial_reason = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [invoiceId, reason || null]);
    await recordStatusChange(invoiceId, "sent", "declined", clientId, "client", reason || "Client declined");
    logger_1.logger.info("invoice_declined", {
        invoiceId,
        clientId,
        reason,
    });
    // TODO: Notify cleaner
    return result.rows[0];
}
// ============================================
// Cancel Invoice (Cleaner)
// ============================================
async function cancelInvoice(invoiceId, cleanerId, reason) {
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
        throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });
    }
    if (invoice.cleaner_id !== cleanerId) {
        throw Object.assign(new Error("This is not your invoice"), { statusCode: 403 });
    }
    const cancellableStatuses = ["draft", "pending_approval", "sent"];
    if (!cancellableStatuses.includes(invoice.status)) {
        throw Object.assign(new Error(`Cannot cancel invoice with status '${invoice.status}'`), { statusCode: 400 });
    }
    const result = await (0, client_1.query)(`
      UPDATE invoices
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [invoiceId]);
    await recordStatusChange(invoiceId, invoice.status, "cancelled", cleanerId, "cleaner", reason || "Cancelled by cleaner");
    logger_1.logger.info("invoice_cancelled", {
        invoiceId,
        cleanerId,
        reason,
    });
    return result.rows[0];
}
// ============================================
// Admin: Approve Invoice
// ============================================
async function adminApproveInvoice(invoiceId, adminId, autoSend = true) {
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
        throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });
    }
    if (invoice.status !== "pending_approval") {
        throw Object.assign(new Error(`Invoice is not pending approval (status: ${invoice.status})`), { statusCode: 400 });
    }
    const newStatus = autoSend ? "sent" : "draft";
    const result = await (0, client_1.query)(`
      UPDATE invoices
      SET status = $2, approved_by = $3, approved_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [invoiceId, newStatus, adminId]);
    await recordStatusChange(invoiceId, "pending_approval", newStatus, adminId, "admin", `Approved by admin${autoSend ? " and sent" : ""}`);
    logger_1.logger.info("invoice_approved", {
        invoiceId,
        adminId,
        autoSend,
        newStatus,
    });
    return result.rows[0];
}
// ============================================
// Admin: Deny Invoice
// ============================================
async function adminDenyInvoice(invoiceId, adminId, reason) {
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
        throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });
    }
    if (invoice.status !== "pending_approval") {
        throw Object.assign(new Error(`Invoice is not pending approval (status: ${invoice.status})`), { statusCode: 400 });
    }
    const result = await (0, client_1.query)(`
      UPDATE invoices
      SET status = 'cancelled', denial_reason = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [invoiceId, reason]);
    await recordStatusChange(invoiceId, "pending_approval", "cancelled", adminId, "admin", `Denied: ${reason}`);
    logger_1.logger.info("invoice_denied", {
        invoiceId,
        adminId,
        reason,
    });
    // TODO: Notify cleaner
    return result.rows[0];
}
// ============================================
// Get Invoices
// ============================================
async function getInvoiceById(invoiceId) {
    const result = await (0, client_1.query)(`SELECT * FROM invoices WHERE id = $1`, [invoiceId]);
    return result.rows[0] ?? null;
}
async function getInvoiceWithLineItems(invoiceId) {
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice)
        return null;
    const lineItemsResult = await (0, client_1.query)(`SELECT * FROM invoice_line_items WHERE invoice_id = $1 ORDER BY sort_order`, [invoiceId]);
    // Get names
    const namesResult = await (0, client_1.query)(`
      SELECT 
        c.first_name as cleaner_first_name,
        c.last_name as cleaner_last_name,
        cl.first_name as client_first_name,
        cl.last_name as client_last_name
      FROM invoices i
      JOIN users c ON c.id = i.cleaner_id
      JOIN users cl ON cl.id = i.client_id
      WHERE i.id = $1
    `, [invoiceId]);
    const names = namesResult.rows[0];
    return {
        ...invoice,
        line_items: lineItemsResult.rows,
        cleaner_name: names ? `${names.cleaner_first_name || ""} ${names.cleaner_last_name || ""}`.trim() : undefined,
        client_name: names ? `${names.client_first_name || ""} ${names.client_last_name || ""}`.trim() : undefined,
    };
}
async function getCleanerInvoices(cleanerId, filters = {}) {
    const conditions = ["cleaner_id = $1"];
    const params = [cleanerId];
    let paramIndex = 2;
    if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        conditions.push(`status = ANY($${paramIndex})`);
        params.push(statuses);
        paramIndex++;
    }
    const whereClause = conditions.join(" AND ");
    const countResult = await (0, client_1.query)(`SELECT COUNT(*) as count FROM invoices WHERE ${whereClause}`, params);
    const total = parseInt(countResult.rows[0]?.count || "0", 10);
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    params.push(limit, offset);
    const result = await (0, client_1.query)(`
      SELECT * FROM invoices
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params);
    return { invoices: result.rows, total };
}
async function getClientInvoices(clientId, filters = {}) {
    const conditions = ["client_id = $1", "status NOT IN ('draft', 'pending_approval')"];
    const params = [clientId];
    let paramIndex = 2;
    if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        conditions.push(`status = ANY($${paramIndex})`);
        params.push(statuses);
        paramIndex++;
    }
    const whereClause = conditions.join(" AND ");
    const countResult = await (0, client_1.query)(`SELECT COUNT(*) as count FROM invoices WHERE ${whereClause}`, params);
    const total = parseInt(countResult.rows[0]?.count || "0", 10);
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    params.push(limit, offset);
    const result = await (0, client_1.query)(`
      SELECT * FROM invoices
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params);
    return { invoices: result.rows, total };
}
async function getAdminInvoices(filters = {}) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        conditions.push(`status = ANY($${paramIndex})`);
        params.push(statuses);
        paramIndex++;
    }
    if (filters.requiresApproval !== undefined) {
        conditions.push(`requires_approval = $${paramIndex}`);
        params.push(filters.requiresApproval);
        paramIndex++;
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const countResult = await (0, client_1.query)(`SELECT COUNT(*) as count FROM invoices ${whereClause}`, params);
    const total = parseInt(countResult.rows[0]?.count || "0", 10);
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    params.push(limit, offset);
    const result = await (0, client_1.query)(`
      SELECT i.*, 
        c.first_name || ' ' || c.last_name as cleaner_name,
        cl.first_name || ' ' || cl.last_name as client_name
      FROM invoices i
      JOIN users c ON c.id = i.cleaner_id
      JOIN users cl ON cl.id = i.client_id
      ${whereClause}
      ORDER BY 
        CASE WHEN i.status = 'pending_approval' THEN 0 ELSE 1 END,
        i.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params);
    return { invoices: result.rows, total };
}
// ============================================
// Helper: Record Status Change
// ============================================
async function recordStatusChange(invoiceId, oldStatus, newStatus, changedBy, actorType, reason) {
    await (0, client_1.query)(`
      INSERT INTO invoice_status_history (invoice_id, old_status, new_status, changed_by, actor_type, reason)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [invoiceId, oldStatus, newStatus, changedBy, actorType, reason || null]);
}
// ============================================
// Helper: Credit Cleaner from Invoice
// ============================================
async function creditCleanerFromInvoice(cleanerId, amountCents, invoiceId) {
    // Platform fee: use same rate as jobs (configurable per tier, but for simplicity use flat 15% here)
    const platformFeePercent = 15;
    const platformFeeCents = Math.round((amountCents * platformFeePercent) / 100);
    const cleanerEarningsCents = amountCents - platformFeeCents;
    // Record in cleaner_earnings table for payout processing
    await (0, client_1.query)(`
      INSERT INTO cleaner_earnings (cleaner_id, job_id, amount_cents, status)
      VALUES ($1, NULL, $2, 'pending')
    `, [cleanerId, cleanerEarningsCents]);
    logger_1.logger.info("cleaner_invoice_earnings_credited", {
        cleanerId,
        invoiceId,
        totalCents: amountCents,
        platformFeeCents,
        cleanerEarningsCents,
    });
}
// ============================================
// Get Invoice Status History
// ============================================
async function getInvoiceStatusHistory(invoiceId) {
    const result = await (0, client_1.query)(`
      SELECT * FROM invoice_status_history
      WHERE invoice_id = $1
      ORDER BY created_at ASC
    `, [invoiceId]);
    return result.rows;
}
