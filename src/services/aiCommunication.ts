// src/services/aiCommunication.ts
// Central AI Communication Service - Replaces Base44 CommunicationService

import { query } from '../db/client';
import { logger } from '../lib/logger';
import { sendEmail } from './notifications/providers/emailProvider';
import { sendSMS } from './notifications/providers/smsProvider';

interface MessageData {
  cleaner_id: string;
  client_id: string;
  message_type: string;
  booking_id?: string;
  custom_data?: Record<string, any>;
}

interface DeliveryResult {
  channel: string;
  success: boolean;
  result?: any;
  error?: string;
}

export class AICommunicationService {
  /**
   * Send automated message via configured channels
   */
  static async sendMessage(data: MessageData): Promise<{
    success: boolean;
    deliveryResults: DeliveryResult[];
    error?: string;
  }> {
    try {
      const { cleaner_id, client_id, message_type, booking_id, custom_data = {} } = data;

      // Fetch cleaner's communication settings
      const cleanerResult = await query(
        `SELECT communication_settings, first_name || ' ' || last_name as full_name
         FROM cleaner_profiles
         WHERE user_id = $1`,
        [cleaner_id]
      );

      if (cleanerResult.rows.length === 0) {
        return { success: false, deliveryResults: [], error: 'Cleaner profile not found' };
      }

      const cleaner = cleanerResult.rows[0];
      const commSettings = cleaner.communication_settings || {};
      const messageConfig = commSettings[message_type];

      if (!messageConfig || !messageConfig.enabled) {
        logger.info('message_type_not_enabled', { cleaner_id, message_type });
        return { success: false, deliveryResults: [], error: 'Message type not enabled' };
      }

      // Get client info
      const clientResult = await query(
        `SELECT email, phone, first_name, last_name
         FROM users u
         LEFT JOIN client_profiles cp ON cp.user_id = u.id
         WHERE u.id = $1`,
        [client_id]
      );

      if (clientResult.rows.length === 0) {
        return { success: false, deliveryResults: [], error: 'Client not found' };
      }

      const client = clientResult.rows[0];

      // Replace template variables
      const template = messageConfig.custom_template || '';
      const message = this.replaceVariables(template, {
        ...custom_data,
        cleaner_name: cleaner.full_name || 'Your cleaner',
        client_name: client.first_name || 'Valued client'
      });

      const channels = messageConfig.channels || [];
      const deliveryResults: DeliveryResult[] = [];

      // Send via all enabled channels
      for (const channel of channels) {
        try {
          let result;
          if (channel === 'sms' && client.phone) {
            result = await this.sendViaSMS(client.phone, message);
            deliveryResults.push({ channel, success: true, result });
          } else if (channel === 'email') {
            result = await this.sendViaEmail(client.email, `PureTask - ${message_type}`, message);
            deliveryResults.push({ channel, success: true, result });
          } else if (channel === 'in_app') {
            result = await this.sendViaInApp(booking_id, client_id, cleaner_id, message);
            deliveryResults.push({ channel, success: true, result });
          }
        } catch (error) {
          deliveryResults.push({ 
            channel, 
            success: false, 
            error: (error as Error).message 
          });
        }
      }

      // Log delivery
      await this.logDelivery(message_type, cleaner_id, client_id, booking_id, channels, deliveryResults);

      return {
        success: true,
        deliveryResults
      };

    } catch (error) {
      logger.error('ai_communication_error', { error });
      return { 
        success: false, 
        deliveryResults: [], 
        error: (error as Error).message 
      };
    }
  }

  /**
   * Replace template variables with actual data
   */
  static replaceVariables(template: string, data: Record<string, any>): string {
    let result = template;
    
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{${key}}`, 'g');
      result = result.replace(regex, data[key] || '');
    });

    return result;
  }

  /**
   * Send message via SMS
   */
  private static async sendViaSMS(to_number: string, message_body: string) {
    if (!to_number) {
      throw new Error('Phone number not available for SMS');
    }

    return await sendSMS({ to: to_number, message: message_body });
  }

  /**
   * Send message via Email
   */
  private static async sendViaEmail(to: string, subject: string, body: string) {
    return await sendEmail({
      to,
      subject,
      text: body,
      html: `<p>${body.replace(/\n/g, '<br>')}</p>`
    });
  }

  /**
   * Send message via In-App messaging
   */
  private static async sendViaInApp(
    booking_id: string | undefined,
    client_id: string,
    cleaner_id: string,
    message: string
  ) {
    // Find or create conversation thread
    let thread;
    
    if (booking_id) {
      const threadResult = await query(
        `SELECT * FROM conversation_threads WHERE booking_id = $1`,
        [booking_id]
      );
      if (threadResult.rows.length > 0) {
        thread = threadResult.rows[0];
      }
    }

    if (!thread) {
      // Create new thread
      const newThreadResult = await query(
        `INSERT INTO conversation_threads (
          participants, booking_id, subject, last_message_at, unread_count_client
        ) VALUES ($1, $2, $3, NOW(), 1)
        RETURNING *`,
        [[client_id, cleaner_id], booking_id || null, 'Booking Communication']
      );
      thread = newThreadResult.rows[0];
    }

    // Create message
    const msgResult = await query(
      `INSERT INTO messages (
        thread_id, sender_id, content, type, timestamp
      ) VALUES ($1, $2, $3, $4, NOW())
      RETURNING *`,
      [thread.id, cleaner_id, message, 'system_message']
    );

    // Update thread
    await query(
      `UPDATE conversation_threads
       SET last_message_at = NOW(),
           last_message_content = $1,
           unread_count_client = unread_count_client + 1
       WHERE id = $2`,
      [message.substring(0, 100), thread.id]
    );

    return msgResult.rows[0];
  }

  /**
   * Log message delivery for tracking and analytics
   */
  private static async logDelivery(
    message_type: string,
    cleaner_id: string,
    client_id: string,
    booking_id: string | undefined,
    channels: string[],
    results: DeliveryResult[]
  ) {
    try {
      await query(
        `INSERT INTO message_delivery_log (
          message_type, cleaner_id, client_id, booking_id, channels, delivery_results
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [message_type, cleaner_id, client_id, booking_id || null, channels, JSON.stringify(results)]
      );
    } catch (error) {
      logger.error('failed_to_log_delivery', { error });
    }
  }
}

