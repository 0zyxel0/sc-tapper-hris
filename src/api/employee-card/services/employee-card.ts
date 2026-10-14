import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const VALID_CURRENT_STATUSES = [
  'Cleared',
  'Payment_Overdue',
  'Payment_Pending',
  'Flagged',
  'Under_Review',
];

export default factories.createCoreService('api::employee-card.employee-card', ({ strapi }) => ({
  async syncAllowedRfidStatus(
    rfidUid: string | undefined,
    status: 'Unassigned' | 'Assigned' | 'Suspended' | 'Disabled'
  ) {
    if (!rfidUid) return;
    const allowedCard = (await strapi.documents('api::allowed-rfid.allowed-rfid').findFirst({
      filters: { rfidUid },
    })) as any;

    if (allowedCard) {
      await strapi.documents('api::allowed-rfid.allowed-rfid').update({
        documentId: allowedCard.documentId,
        data: { status } as any,
      });
    }
  },

  async disableCard(documentId: string, options?: { reason?: string; notes?: string }) {
    const existing = (await strapi.documents('api::employee-card.employee-card').findOne({
      documentId,
      populate: ['employee'],
    })) as any;

    if (!existing) {
      throw new errors.ApplicationError('CARD_NOT_FOUND: Employee card not found.');
    }

    const updateData: any = { status: 'Disabled' };
    if (options?.reason !== undefined) updateData.statusReason = options.reason;
    if (options?.notes !== undefined) updateData.notes = options.notes;

    const card = await strapi.documents('api::employee-card.employee-card').update({
      documentId,
      data: updateData,
      populate: ['employee'],
    });

    await this.syncAllowedRfidStatus(existing.rfidUid, 'Disabled');
    return card;
  },

  async suspendCard(
    documentId: string,
    options?: {
      reason?: string;
      current_status?: string;
      paymentDueDate?: string;
      sendReminder?: boolean;
      customMessage?: string;
      notes?: string;
    }
  ) {
    const existing = (await strapi.documents('api::employee-card.employee-card').findOne({
      documentId,
      populate: ['employee'],
    })) as any;

    if (!existing) {
      throw new errors.ApplicationError('CARD_NOT_FOUND: Employee card not found.');
    }

    if (options?.current_status && !VALID_CURRENT_STATUSES.includes(options.current_status)) {
      throw new errors.ApplicationError(
        `INVALID_CURRENT_STATUS: current_status must be one of ${VALID_CURRENT_STATUSES.join(', ')}`
      );
    }

    const nowIso = new Date().toISOString();
    const resolvedCurrentStatus = options?.current_status || existing.current_status || 'Flagged';

    const updateData: any = {
      status: 'Suspended',
      suspendedAt: nowIso,
      current_status: resolvedCurrentStatus,
    };

    if (resolvedCurrentStatus !== 'Cleared' && !existing.flaggedAt) {
      updateData.flaggedAt = nowIso;
    }
    if (options?.reason !== undefined) updateData.statusReason = options.reason;
    if (options?.paymentDueDate !== undefined) updateData.paymentDueDate = options.paymentDueDate;
    if (options?.notes !== undefined) updateData.notes = options.notes;

    const card = (await strapi.documents('api::employee-card.employee-card').update({
      documentId,
      data: updateData,
      populate: ['employee'],
    })) as any;

    await this.syncAllowedRfidStatus(existing.rfidUid, 'Suspended');

    let notification = null;
    if (options?.sendReminder) {
      const notificationService = strapi.service('api::notification-log.notification-log' as any) as any;
      notification = await notificationService.sendPaymentReminder({
        card,
        employee: card.employee,
        triggerSource: 'Admin_Flag',
        force: true,
        customMessage: options?.customMessage,
      });
    }

    return { card, notification };
  },

  async activateCard(
    documentId: string,
    options?: { current_status?: string; reason?: string; notes?: string }
  ) {
    const existing = (await strapi.documents('api::employee-card.employee-card').findOne({
      documentId,
      populate: ['employee'],
    })) as any;
    if (!existing) {
      throw new errors.ApplicationError('CARD_NOT_FOUND: Employee card not found.');
    }

    const resolvedCurrentStatus = options?.current_status || 'Cleared';
    if (!VALID_CURRENT_STATUSES.includes(resolvedCurrentStatus)) {
      throw new errors.ApplicationError(
        `INVALID_CURRENT_STATUS: current_status must be one of ${VALID_CURRENT_STATUSES.join(', ')}`
      );
    }

    const updateData: any = {
      status: 'Active',
      suspendedAt: null,
      current_status: resolvedCurrentStatus,
      flaggedAt: resolvedCurrentStatus === 'Cleared' ? null : existing.flaggedAt || new Date().toISOString(),
      statusReason:
        options?.reason !== undefined
          ? options.reason
          : resolvedCurrentStatus === 'Cleared'
          ? null
          : existing.statusReason,
    };
    if (resolvedCurrentStatus === 'Cleared') updateData.paymentDueDate = null;
    if (options?.notes !== undefined) updateData.notes = options.notes;

    const card = await strapi.documents('api::employee-card.employee-card').update({
      documentId,
      data: updateData,
      populate: ['employee'],
    });

    await this.syncAllowedRfidStatus(existing.rfidUid, 'Assigned');
    return card;
  },

  async updateCurrentStatus(
    documentId: string,
    options: {
      current_status: string;
      statusReason?: string;
      paymentDueDate?: string | null;
      suspendCard?: boolean;
      activateCard?: boolean;
      sendReminder?: boolean;
      forceReminder?: boolean;
      customMessage?: string;
    }
  ) {
    const existing = (await strapi.documents('api::employee-card.employee-card').findOne({
      documentId,
      populate: ['employee'],
    })) as any;
    if (!existing) {
      throw new errors.ApplicationError('CARD_NOT_FOUND: Employee card not found.');
    }

    const { current_status } = options;
    if (!current_status || !VALID_CURRENT_STATUSES.includes(current_status)) {
      throw new errors.ApplicationError(
        `INVALID_CURRENT_STATUS: current_status must be one of ${VALID_CURRENT_STATUSES.join(', ')}`
      );
    }

    const nowIso = new Date().toISOString();
    const updateData: any = {
      current_status,
      flaggedAt: current_status === 'Cleared' ? null : nowIso,
    };
    if (options.statusReason !== undefined) {
      updateData.statusReason = options.statusReason;
    } else if (current_status === 'Cleared') {
      updateData.statusReason = null;
    }
    if (options.paymentDueDate !== undefined) {
      updateData.paymentDueDate = options.paymentDueDate;
    } else if (current_status === 'Cleared') {
      updateData.paymentDueDate = null;
    }

    if (options.suspendCard === true) {
      updateData.status = 'Suspended';
      updateData.suspendedAt = nowIso;
    } else if (options.activateCard === true) {
      updateData.status = 'Active';
      updateData.suspendedAt = null;
    }

    const card = (await strapi.documents('api::employee-card.employee-card').update({
      documentId,
      data: updateData,
      populate: ['employee'],
    })) as any;

    if (options.suspendCard === true) {
      await this.syncAllowedRfidStatus(existing.rfidUid, 'Suspended');
    } else if (options.activateCard === true) {
      await this.syncAllowedRfidStatus(existing.rfidUid, 'Assigned');
    }

    let notification = null;
    const shouldSendReminder =
      options.sendReminder !== undefined ? Boolean(options.sendReminder) : current_status === 'Payment_Overdue';

    if (shouldSendReminder && current_status !== 'Cleared') {
      const notificationService = strapi.service('api::notification-log.notification-log' as any) as any;
      notification = await notificationService.sendPaymentReminder({
        card,
        employee: card.employee,
        triggerSource: 'Admin_Flag',
        force: Boolean(options.forceReminder),
        customMessage: options.customMessage,
      });
    }

    return { card, notification };
  },

  async bulkFlagCards(payload: {
    employeeNumbers?: string[];
    cardNumbers?: string[];
    rfidUids?: string[];
    current_status?: string;
    statusReason?: string;
    paymentDueDate?: string;
    suspendCard?: boolean;
    sendReminder?: boolean;
    forceReminder?: boolean;
    customMessage?: string;
  }) {
    const current_status = payload.current_status || 'Payment_Overdue';
    if (!VALID_CURRENT_STATUSES.includes(current_status)) {
      throw new errors.ApplicationError(
        `INVALID_CURRENT_STATUS: current_status must be one of ${VALID_CURRENT_STATUSES.join(', ')}`
      );
    }

    const employeeNumbers = Array.isArray(payload.employeeNumbers)
      ? payload.employeeNumbers.filter(Boolean)
      : [];
    const cardNumbers = Array.isArray(payload.cardNumbers) ? payload.cardNumbers.filter(Boolean) : [];
    const rfidUids = Array.isArray(payload.rfidUids) ? payload.rfidUids.filter(Boolean) : [];

    if (employeeNumbers.length === 0 && cardNumbers.length === 0 && rfidUids.length === 0) {
      throw new errors.ApplicationError(
        'MISSING_IDENTIFIERS: Provide at least one of employeeNumbers, cardNumbers, or rfidUids.'
      );
    }

    const orFilters: any[] = [];
    if (employeeNumbers.length > 0) {
      orFilters.push({ employee: { employeeNumber: { $in: employeeNumbers } } });
    }
    if (cardNumbers.length > 0) {
      orFilters.push({ cardNumber: { $in: cardNumbers } });
    }
    if (rfidUids.length > 0) {
      orFilters.push({ rfidUid: { $in: rfidUids } });
    }

    const matchedCards = (await strapi.documents('api::employee-card.employee-card').findMany({
      filters: { $or: orFilters } as any,
      populate: ['employee'],
    })) as any[];

    let updatedCount = 0;
    let remindersSent = 0;
    const updatedCards: any[] = [];

    for (const card of matchedCards) {
      const result = await this.updateCurrentStatus(card.documentId, {
        current_status,
        statusReason: payload.statusReason,
        paymentDueDate: payload.paymentDueDate,
        suspendCard: payload.suspendCard,
        sendReminder:
          payload.sendReminder !== undefined
            ? payload.sendReminder
            : current_status === 'Payment_Overdue',
        forceReminder: payload.forceReminder,
        customMessage: payload.customMessage,
      });

      updatedCount++;
      if (result.notification?.triggered) {
        remindersSent++;
      }
      updatedCards.push({
        documentId: result.card.documentId,
        cardNumber: result.card.cardNumber,
        rfidUid: result.card.rfidUid,
        status: result.card.status,
        current_status: result.card.current_status,
        employeeNumber: result.card.employee?.employeeNumber || null,
        notificationStatus: result.notification?.deliveryStatus || null,
      });
    }

    return {
      success: true,
      summary: {
        totalMatched: matchedCards.length,
        updated: updatedCount,
        remindersSent,
      },
      cards: updatedCards,
    };
  },

  async issueCard(employeeId: string, data: any) {
    const { rfidUid } = data;

    if (rfidUid) {
      const allowedCard = (await strapi.documents('api::allowed-rfid.allowed-rfid').findFirst({
        filters: { rfidUid },
      })) as any;

      if (!allowedCard) {
        throw new errors.ApplicationError('UNAUTHORIZED_CARD: This RFID card is not in the system allowlist.');
      }

      if (
        allowedCard.status === 'Assigned' ||
        allowedCard.status === 'Suspended' ||
        allowedCard.status === 'Disabled'
      ) {
        throw new errors.ApplicationError(
          'CARD_UNAVAILABLE: This RFID card is already assigned to another employee, suspended, or disabled.'
        );
      }

      const card = await strapi.documents('api::employee-card.employee-card').create({
        data: {
          employee: employeeId,
          status: 'Active',
          current_status: data.current_status || 'Cleared',
          cardType: 'RFID',
          issuedAt: new Date().toISOString(),
          ...data,
        },
      });

      await strapi.documents('api::allowed-rfid.allowed-rfid').update({
        documentId: allowedCard.documentId,
        data: {
          status: 'Assigned',
        },
      });

      return card;
    }

    return await strapi.documents('api::employee-card.employee-card').create({
      data: {
        employee: employeeId,
        status: 'Active',
        current_status: data.current_status || 'Cleared',
        issuedAt: new Date().toISOString(),
        ...data,
      },
    });
  },
}));


