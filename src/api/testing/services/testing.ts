import { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async reset() {
    // 1. Delete events for test employees (and test sessions)
    const testEvents = await strapi.documents('api::attendance-event.attendance-event').findMany({
      filters: {
        $or: [
          { employee: { employeeNumber: { $startsWith: 'TEST-' } } },
          { session: { name: { $startsWith: 'TEST-SESSION' } } }
        ]
      }
    }) as any[];
    
    for (const event of testEvents) {
      await strapi.documents('api::attendance-event.attendance-event').delete({ documentId: event.documentId });
    }

    // 2. Delete test sessions
    const testSessions = await strapi.documents('api::attendance-session.attendance-session').findMany({
      filters: { name: { $startsWith: 'TEST-SESSION' } }
    }) as any[];
    
    for (const session of testSessions) {
      await strapi.documents('api::attendance-session.attendance-session').delete({ documentId: session.documentId });
    }

    // 3. Delete test cards
    const testCards = await strapi.documents('api::employee-card.employee-card').findMany({
      filters: { cardNumber: { $startsWith: 'C-TEST-' } }
    }) as any[];
    
    for (const card of testCards) {
      await strapi.documents('api::employee-card.employee-card').delete({ documentId: card.documentId });
    }

    // 4. Delete test employees
    const testEmployees = await strapi.documents('api::employee.employee').findMany({
      filters: { employeeNumber: { $startsWith: 'TEST-' } }
    }) as any[];
    
    for (const employee of testEmployees) {
      await strapi.documents('api::employee.employee').delete({ documentId: employee.documentId });
    }

    // 5. Delete test allowed RFID records
    const testAllowedCards = await strapi.documents('api::allowed-rfid.allowed-rfid').findMany({
      filters: {
        $or: [
          { batchReference: { $startsWith: 'TEST-' } },
          { rfidUid: { $in: ['111111', '222222', '333333', '444444', '555555'] } }
        ]
      }
    }) as any[];

    for (const allowed of testAllowedCards) {
      await strapi.documents('api::allowed-rfid.allowed-rfid').delete({ documentId: allowed.documentId });
    }

    return true;
  },

  async seed() {
    // First, clear old test data
    await this.reset();

    // Pre-seed Allowed RFID Cards
    const allowedCards = [
      { rfidUid: '111111', status: 'Assigned', batchReference: 'TEST-BATCH-001' },
      { rfidUid: '222222', status: 'Assigned', batchReference: 'TEST-BATCH-001' },
      { rfidUid: '333333', status: 'Assigned', batchReference: 'TEST-BATCH-001' },
      { rfidUid: '444444', status: 'Assigned', batchReference: 'TEST-BATCH-001' },
      { rfidUid: '555555', status: 'Unassigned', batchReference: 'TEST-BATCH-001', notes: 'Pre-allowed test card ready to be mapped' },
    ];

    for (const cardData of allowedCards) {
      await strapi.documents('api::allowed-rfid.allowed-rfid').create({
        data: cardData as any,
      });
    }

    // Seed Data
    // Employee 1: Active
    const emp1 = await strapi.documents('api::employee.employee').create({
      data: {
        employeeNumber: 'TEST-001',
        firstName: 'John',
        lastName: 'Doe',
        employmentStatus: 'Active',
      }
    }) as any;

    const card1 = await strapi.documents('api::employee-card.employee-card').create({
      data: {
        cardNumber: 'C-TEST-001',
        rfidUid: '111111',
        employee: emp1.documentId,
        cardType: 'RFID',
        status: 'Active'
      }
    });

    // Employee 2: Active
    const emp2 = await strapi.documents('api::employee.employee').create({
      data: {
        employeeNumber: 'TEST-002',
        firstName: 'Jane',
        lastName: 'Smith',
        employmentStatus: 'Active',
      }
    }) as any;

    const card2 = await strapi.documents('api::employee-card.employee-card').create({
      data: {
        cardNumber: 'C-TEST-002',
        rfidUid: '222222',
        employee: emp2.documentId,
        cardType: 'RFID',
        status: 'Active'
      }
    });

    // Employee 3: Inactive
    const emp3 = await strapi.documents('api::employee.employee').create({
      data: {
        employeeNumber: 'TEST-003',
        firstName: 'Bob',
        lastName: 'Inactive',
        employmentStatus: 'Inactive',
      }
    }) as any;

    const card3 = await strapi.documents('api::employee-card.employee-card').create({
      data: {
        cardNumber: 'C-TEST-003',
        rfidUid: '333333',
        employee: emp3.documentId,
        cardType: 'RFID',
        status: 'Active' // Card active, employee inactive
      }
    });
    
    // Card 4: Unassigned / Lost (No Employee)
    const card4 = await strapi.documents('api::employee-card.employee-card').create({
      data: {
        cardNumber: 'C-TEST-004',
        rfidUid: '444444',
        cardType: 'RFID',
        status: 'Active' // Active but no employee
      }
    });

    // Create an open session
    const session = await strapi.documents('api::attendance-session.attendance-session').create({
      data: {
        name: 'TEST-SESSION-TODAY',
        sessionDate: new Date().toISOString().split('T')[0],
        status: 'Open',
        deviceId: 'TEST-DEVICE-01'
      }
    });

    return {
      employees: [emp1, emp2, emp3],
      cards: [card1, card2, card3, card4],
      allowedCards,
      session
    };
  }
});