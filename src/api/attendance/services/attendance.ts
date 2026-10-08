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

    // 2. Find RFID card
    const cards = await strapi.documents('api::employee-card.employee-card').findMany({
      filters: { rfidUid, status: 'Active' },
      populate: { employee: { populate: ['profilePicture'] } }
    }) as any[];
    
    if (!cards || cards.length === 0) {
      return { success: false, code: 'UNKNOWN_CARD', message: 'Card not found or inactive' };
    }
    const card = cards[0];

    // 3. Check employee
    const employee = card.employee;
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

    // 7. Return useful response
    return {
      success: true,
      event: {
        eventId: event.eventId,
        direction: event.direction,
        eventTime: event.eventTime
      },
      employee: {
        employeeNumber: employee.employeeNumber,
        displayName: employee.displayName || `${employee.firstName} ${employee.lastName}`,
        profilePicture: employee.profilePicture
      },
      message: direction === 'IN' ? `Welcome, ${employee.firstName}!` : `Goodbye, ${employee.firstName}!`
    };
  }
});