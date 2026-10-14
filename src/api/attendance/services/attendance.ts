import { Core } from '@strapi/strapi';
import crypto from 'crypto';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async openSession(data: any) {
    return await strapi.documents('api::attendance-session.attendance-session').create({
      data: {
        ...data,
        status: 'Open',
      }
    });
  },

  async closeSession(documentId: string, data: any) {
    return await strapi.documents('api::attendance-session.attendance-session').update({
      documentId,
      data: {
        status: 'Closed',
        ...data
      }
    });
  },

  async currentSession(deviceId: string | undefined) {
    const filters: any = { status: 'Open' };
    if (deviceId) {
      filters.deviceId = deviceId;
    }
    const sessions = await strapi.documents('api::attendance-session.attendance-session').findMany({
      filters,
      sort: 'createdAt:desc',
      limit: 1
    }) as any[];
    return sessions[0] || null;
  },

  async processScan(data: any) {
    const { rfidUid, deviceId, scannedAt } = data;
    const scanTime = scannedAt ? new Date(scannedAt) : new Date();

    // 1. Validate session
    const session = await this.currentSession(deviceId);
    if (!session) {
      return { success: false, code: 'SESSION_NOT_OPEN', message: 'No open session found' };
    }

    // 2. Find RFID card (across all statuses so we can differentiate Active, Suspended, Disabled)
    const cards = await strapi.documents('api::employee-card.employee-card').findMany({
      filters: { rfidUid },
      populate: { employee: { populate: ['profilePicture'] } },
      sort: 'updatedAt:desc',
    }) as any[];

    if (!cards || cards.length === 0) {
      return { success: false, code: 'UNKNOWN_CARD', message: 'Card not found or inactive' };
    }
    const card = cards.find((c: any) => c.status === 'Active') || cards[0];

    // 3. Check employee
    const employee = card.employee;

    // 3a. Handle Suspended or Disabled/Lost cards explicitly
    if (card.status === 'Suspended') {
      let notification = null;
      if (employee && card.current_status && card.current_status !== 'Cleared') {
        try {
          const notificationService = strapi.service('api::notification-log.notification-log' as any) as any;
          if (notificationService) {
            notification = await notificationService.sendPaymentReminder({
              card,
              employee,
              triggerSource: 'Gate_Scan',
            });
          }
        } catch (notifyErr: any) {
          strapi.log.error(`Failed to trigger reminder for suspended card ${rfidUid}: ${notifyErr.message}`);
        }
      }

      return {
        success: false,
        code: 'CARD_SUSPENDED',
        message: card.statusReason
          ? `ID Suspended: ${card.statusReason}`
          : 'This ID card is currently suspended. Please proceed to the Administration/Accounting Office.',
        card: {
          documentId: card.documentId,
          cardNumber: card.cardNumber,
          rfidUid: card.rfidUid,
          status: card.status,
          current_status: card.current_status || 'Flagged',
          statusReason: card.statusReason || null,
          paymentDueDate: card.paymentDueDate || null,
          suspendedAt: card.suspendedAt || null,
        },
        employee: employee
          ? {
              employeeNumber: employee.employeeNumber,
              personType: employee.personType || 'Employee',
              displayName: employee.displayName || `${employee.firstName} ${employee.lastName}`,
              department: employee.department || null,
              courseOrProgram: employee.courseOrProgram || null,
              yearOrGradeLevel: employee.yearOrGradeLevel || null,
              section: employee.section || null,
              profilePicture: employee.profilePicture,
            }
          : null,
        notification,
      };
    }

    if (card.status !== 'Active') {
      return {
        success: false,
        code: 'CARD_DISABLED',
        message: card.statusReason
          ? `ID ${card.status}: ${card.statusReason}`
          : `This ID card is ${card.status.toLowerCase()} and cannot be used.`,
        card: {
          documentId: card.documentId,
          cardNumber: card.cardNumber,
          rfidUid: card.rfidUid,
          status: card.status,
          current_status: card.current_status || 'Cleared',
          statusReason: card.statusReason || null,
        },
      };
    }

    if (!employee) {
      return { success: false, code: 'UNKNOWN_EMPLOYEE', message: 'No employee assigned to this card' };
    }
    if (employee.employmentStatus !== 'Active') {
      return { success: false, code: 'EMPLOYEE_INACTIVE', message: 'Employee is not active' };
    }


    // 4. Duplicate scan prevention & Find latest event for this session
    const lastEvents = await strapi.documents('api::attendance-event.attendance-event').findMany({
      filters: {
        employee: { documentId: employee.documentId },
        session: { documentId: session.documentId }
      },
      sort: 'eventTime:desc',
      limit: 1
    }) as any[];

    const lastEvent = lastEvents[0];
    let direction: 'IN' | 'OUT' = 'IN';

    if (lastEvent && lastEvent.eventTime) {
      const lastTime = new Date(lastEvent.eventTime as string).getTime();
      const diffSeconds = (scanTime.getTime() - lastTime) / 1000;

      // 5-second debounce
      if (diffSeconds < 5) {
        return { success: false, code: 'DUPLICATE_SCAN', message: 'Card scanned recently' };
      }

      // 5. Determine direction
      if (lastEvent.direction === 'IN') {
        direction = 'OUT';
      } else {
        direction = 'IN';
      }
    }

    // 6. Create attendance event
    const eventId = crypto.randomUUID();
    const event = await strapi.documents('api::attendance-event.attendance-event').create({
      data: {
        eventId,
        employee: employee.documentId,
        card: card.documentId,
        session: session.documentId,
        direction,
        eventTime: scanTime.toISOString(),
        source: 'RFID',
        deviceId,
        status: 'Valid'
      }
    }) as any;

    // 7. Check ID current_status flag (e.g., Payment_Overdue) & trigger SMS/notification reminder
    const currentStatus = card.current_status || 'Cleared';
    const isFlagged = currentStatus !== 'Cleared';
    let notificationResult: any = null;

    if (isFlagged) {
      try {
        const notificationService = strapi.service('api::notification-log.notification-log' as any) as any;
        if (notificationService) {
          notificationResult = await notificationService.sendPaymentReminder({
            card,
            employee,
            triggerSource: 'Gate_Scan',
          });
        }
      } catch (notifyErr: any) {
        strapi.log.error(`Failed to trigger payment reminder on scan for ${rfidUid}: ${notifyErr.message}`);
      }
    }

    // 8. Return useful response (including current_status warning & reminder details if flagged)
    return {
      success: true,
      event: {
        eventId: event.eventId,
        direction: event.direction,
        eventTime: event.eventTime
      },
      employee: {
        employeeNumber: employee.employeeNumber,
        personType: employee.personType || 'Employee',
        displayName: employee.displayName || `${employee.firstName} ${employee.lastName}`,
        department: employee.department || null,
        courseOrProgram: employee.courseOrProgram || null,
        yearOrGradeLevel: employee.yearOrGradeLevel || null,
        section: employee.section || null,
        profilePicture: employee.profilePicture
      },
      card: {
        documentId: card.documentId,
        cardNumber: card.cardNumber,
        rfidUid: card.rfidUid,
        status: card.status,
        current_status: currentStatus,
        statusReason: card.statusReason || null,
        paymentDueDate: card.paymentDueDate || null
      },
      warning: isFlagged
        ? {
            flagged: true,
            current_status: currentStatus,
            statusReason: card.statusReason || null,
            paymentDueDate: card.paymentDueDate || null,
            reminderTriggered: Boolean(notificationResult?.triggered),
            deliveryStatus: notificationResult?.deliveryStatus || null,
            warningMessage:
              currentStatus === 'Payment_Overdue'
                ? `Payment Overdue${card.statusReason ? `: ${card.statusReason}` : ''}. Reminder notification triggered.`
                : `ID Flagged (${currentStatus})${card.statusReason ? `: ${card.statusReason}` : ''}.`
          }
        : null,
      message: direction === 'IN' ? `Welcome, ${employee.firstName}!` : `Goodbye, ${employee.firstName}!`
    };
  }
});