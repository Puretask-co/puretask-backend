# ENGINE_MESSAGING_NOTIFICATIONS

## Status
Canonical - Final Form Specification  
Part of PURETASK_FINAL_BLUEPRINT

---

## 1. Purpose of the Messaging and Notifications Engine

This engine governs all communication in PureTask. Goals: enable clear, contextual communication; reduce no-shows, confusion, and cancellations; deliver the right message at the right time; avoid spam; ensure messages reflect system state accurately; maintain auditable records. Communication is event-driven and state-aware.

---

## 2. Design Philosophy

- Context first: all messages are tied to jobs, disputes, subscriptions, or account status; no free-form global chat.  
- State-driven: messages and notifications are triggered by system events.  
- Channel appropriateness: push for urgent, SMS for critical reminders, email for summaries/receipts, in-app for conversation.

---

## 3. Core Concepts

- Threads: conversation containers tied to context (job, dispute, subscription, admin/system). Define participants, permissions, history.  
- Messages: user, system, or admin generated; include sender, timestamp, type, context reference.  
- Notifications: deliveries of information, not conversations; may reference messages or events.

---

## 4. Permissions and Visibility

- Client <-> cleaner: allowed only within job or subscription context; disabled after terminal states (except disputes).  
- Admin visibility: admins can view all threads, inject system messages, restrict messaging if abuse detected.  
- System messages: clearly labeled, not replyable, represent authoritative state.

---

## 5. Notification Triggers

- Booking lifecycle: job created, cleaner assigned, job confirmed, reminders before start, job completed.  
- Reliability and risk: warnings, prepayment requirements, temporary restrictions.  
- Disputes: dispute created, evidence requested, resolution delivered.  
- Payments and payouts: payment receipt, refund issued, payout sent, payout failed.

---

## 6. Reminder and Alert Flows

Common reminders: cleaner check-in, client preparation, confirmation deadlines, subscription renewal. Reminders are time-based, idempotent, and cancelled if no longer relevant.

---

## 7. Channel Strategy

- In-app: primary conversation medium, full context and history.  
- Push: time-sensitive alerts, minimal content.  
- SMS: critical reminders, used sparingly.  
- Email: receipts, summaries, formal notices.  

---

## 8. Interaction With Other Engines

- Booking: supplies lifecycle events and message timing.  
- Reliability & Tier: triggers warnings and notices.  
- Credit & Payment: sends receipts and refund notices.  
- Dispute: controls dispute threads.  
- Risk & Fraud: can suppress or enforce notifications.  
- Admin & Ops: can broadcast notices and mute users or threads.

---

## 9. Automation and Workers

Workers: retryFailedNotifications, queueProcessor. Responsibilities: deliver notifications, retry failures, de-duplicate messages, maintain delivery logs.

---

## 10. Data Model (Conceptual)

Key entities: threads, messages, notifications, notification_deliveries. All communication is auditable.

---

## 11. Failure and Edge Case Handling

Handle duplicate events, delayed notifications, muted users, timezone differences, partial delivery failures. System must never misrepresent state.

---

## 12. Canonical Rules

- No messaging without context.  
- System messages override user messages.  
- Notifications reflect system truth.  
- All deliveries are logged.  
- Abuse is monitored and controlled.  

---

## 13. Versioning Guidance

- V1: Core job messaging + basic notifications.  
- V2: Smarter reminders and dispute flows.  
- V3: Subscription communications.  
- V4+: Risk-based notification strategies.  

---

End of document.

