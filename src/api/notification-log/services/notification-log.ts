import { factories } from '@strapi/strapi';
import axios from 'axios';

const VALID_TRIGGER_SOURCES = ['Gate_Scan', 'Admin_Flag', 'Manual_Reminder', 'Batch_Reminder'] as const;

export default factories.createCoreService('api::notification-log.notification-log' as any, ({ strapi }) => ({
  buildReminderMessage(employee: any, card: any, customMessage?: string): string {
    if (customMessage && customMessage.trim()) {
      return customMessage.trim();
    }

    const fullName =
      employee?.displayName ||
      [employee?.firstName, employee?.lastName].filter(Boolean).join(' ') ||
      'Student/User';
    const idNumber = employee?.employeeNumber || card?.cardNumber || card?.rfidUid || 'N/A';
    const currentStatus = card?.current_status || 'Payment_Overdue';
    const reasonText = card?.statusReason ? ` (${card.statusReason})` : '';
    const dueText = card?.paymentDueDate ? ` Due date: ${card.paymentDueDate}.` : '';

    if (currentStatus === 'Payment_Overdue') {
      return `[SC Tapper Notice] Reminder for ${fullName} (ID: ${idNumber}): Your account is flagged as PAYMENT OVERDUE${reasonText}.${dueText} Please settle your balance at the Cashier/Accounting Office.`;
    }

    if (currentStatus === 'Payment_Pending') {
      return `[SC Tapper Notice] Reminder for ${fullName} (ID: ${idNumber}): You have a pending payment${reasonText}.${dueText} Please settle on or before the due date.`;
    }

    return `[SC Tapper Notice] Status update for ${fullName} (ID: ${idNumber}): Your ID current_status is flagged as ${currentStatus}${reasonText}. Please coordinate with the Administration Office.`;
  },

  async sendPaymentReminder(options: {
    card: any;
    employee?: any;
    triggerSource?: 'Gate_Scan' | 'Admin_Flag' | 'Manual_Reminder' | 'Batch_Reminder';
    force?: boolean;
    customMessage?: string;
  }) {
    const triggerSource = VALID_TRIGGER_SOURCES.includes(options.triggerSource as any)
      ? options.triggerSource!
      : 'Gate_Scan';

    let card = options.card;
    if (typeof card === 'string') {
      card = await strapi.documents('api::employee-card.employee-card').findOne({
        documentId: card,
        populate: ['employee'],
      });
    }
    if (!card) {
      throw new Error('Card not found for notification reminder');
    }

    let employee = options.employee || card.employee;
    if (typeof employee === 'string') {
      employee = await strapi.documents('api::employee.employee').findOne({
        documentId: employee,
      });
    }

    const cooldownHours = Number(process.env.SMS_REMINDER_COOLDOWN_HOURS ?? 24);
    const now = new Date();

    if (!options.force && card.lastReminderSentAt && cooldownHours > 0) {
      const lastSent = new Date(card.lastReminderSentAt);
      const elapsedHours = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
      if (elapsedHours < cooldownHours) {
        return {
          triggered: false,
          deliveryStatus: 'Skipped_Cooldown',
          reason: `Reminder already sent within the last ${cooldownHours} hours`,
          lastReminderSentAt: card.lastReminderSentAt,
        };
      }
    }

    const preferGuardian =
      employee?.personType === 'Student' && employee?.notifyGuardianSms !== false;
    const recipientNumber = preferGuardian
      ? employee?.emergencyContactNumber?.trim() || employee?.mobileNumber?.trim() || null
      : employee?.mobileNumber?.trim() || employee?.emergencyContactNumber?.trim() || null;
    const message = this.buildReminderMessage(employee, card, options.customMessage);
    const statusFlag = card.current_status || 'Payment_Overdue';

    if (!recipientNumber) {
      const logEntry = await strapi.documents('api::notification-log.notification-log' as any).create({
        data: {
          employee: employee?.documentId || null,
          card: card.documentId,
          channel: 'In_App',
          recipientNumber: null,
          triggerSource,
          statusFlag,
          message,
          deliveryStatus: 'Skipped_No_Recipient',
          providerResponse: { note: 'No mobileNumber or emergencyContactNumber on profile; logged as In_App alert.' },
          sentAt: now.toISOString(),
        } as any,
      });

      await strapi.documents('api::employee-card.employee-card').update({
        documentId: card.documentId,
        data: { lastReminderSentAt: now.toISOString() } as any,
      });

      return {
        triggered: true,
        deliveryStatus: 'Skipped_No_Recipient',
        channel: 'In_App',
        recipientNumber: null,
        message,
        log: logEntry,
      };
    }

    let deliveryStatus: 'Sent' | 'Simulated' | 'Failed' = 'Simulated';
    let providerResponse: any = {
      mode: 'simulated',
      provider: process.env.SMS_PROVIDER || 'mock',
      timestamp: now.toISOString(),
    };

    const smsEnabled = process.env.SMS_ENABLED === 'true';
    const smsProviderUrl = process.env.SMS_PROVIDER_URL;

    if (smsEnabled && smsProviderUrl) {
      try {
        const res = await axios.post(
          smsProviderUrl,
          {
            apikey: process.env.SMS_API_KEY,
            number: recipientNumber,
            message,
            sendername: process.env.SMS_SENDER_NAME || 'SCTAPPER',
          },
          {
            headers: {
              'Content-Type': 'application/json',
              ...(process.env.SMS_API_KEY ? { Authorization: `Bearer ${process.env.SMS_API_KEY}` } : {}),
            },
            timeout: 10000,
          }
        );
        deliveryStatus = 'Sent';
        providerResponse = res.data || { status: res.status };
      } catch (err: any) {
        deliveryStatus = 'Failed';
        providerResponse = {
          error: err.message || 'SMS gateway request failed',
          response: err.response?.data || null,
        };
        strapi.log.error(`Failed to send SMS reminder to ${recipientNumber}: ${err.message}`);
      }
    } else {
      strapi.log.info(`[Simulated SMS Reminder] To: ${recipientNumber} | Message: ${message}`);
    }

    const logEntry = await strapi.documents('api::notification-log.notification-log' as any).create({
      data: {
        employee: employee?.documentId || null,
        card: card.documentId,
        channel: 'SMS',
        recipientNumber,
        triggerSource,
        statusFlag,
        message,
        deliveryStatus,
        providerResponse,
        sentAt: now.toISOString(),
      } as any,
    });

    if (deliveryStatus === 'Sent' || deliveryStatus === 'Simulated') {
      await strapi.documents('api::employee-card.employee-card').update({
        documentId: card.documentId,
        data: { lastReminderSentAt: now.toISOString() } as any,
      });
    }

    return {
      triggered: deliveryStatus === 'Sent' || deliveryStatus === 'Simulated',
      deliveryStatus,
      channel: 'SMS',
      recipientNumber,
      message,
      log: logEntry,
    };
  },

  async sendBatchOverdueReminders(options?: {
    current_status?: string;
    force?: boolean;
    customMessage?: string;
  }) {
    const targetStatus = options?.current_status || 'Payment_Overdue';
    const flaggedCards = (await strapi.documents('api::employee-card.employee-card').findMany({
      filters: {
        current_status: targetStatus,
        status: { $in: ['Active', 'Suspended'] },
      } as any,
      populate: ['employee'],
    })) as any[];

    let sentOrSimulated = 0;
    let skippedCooldown = 0;
    let skippedNoRecipient = 0;
    let failed = 0;
    const results: any[] = [];

    for (const card of flaggedCards) {
      const res = await this.sendPaymentReminder({
        card,
        employee: card.employee,
        triggerSource: 'Batch_Reminder',
        force: options?.force ?? false,
        customMessage: options?.customMessage,
      });

      if (res.deliveryStatus === 'Sent' || res.deliveryStatus === 'Simulated') {
        sentOrSimulated++;
      } else if (res.deliveryStatus === 'Skipped_Cooldown') {
        skippedCooldown++;
      } else if (res.deliveryStatus === 'Skipped_No_Recipient') {
        skippedNoRecipient++;
      } else {
        failed++;
      }

      results.push({
        cardDocumentId: card.documentId,
        cardNumber: card.cardNumber,
        rfidUid: card.rfidUid,
        employeeNumber: card.employee?.employeeNumber || null,
        recipientNumber: res.recipientNumber || null,
        deliveryStatus: res.deliveryStatus,
      });
    }

    return {
      success: true,
      summary: {
        totalFlaggedCards: flaggedCards.length,
        sentOrSimulated,
        skippedCooldown,
        skippedNoRecipient,
        failed,
      },
      results,
    };
  },
}));
