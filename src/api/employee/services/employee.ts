import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::employee.employee', ({ strapi }) => ({
  async findByEmployeeNumber(employeeNumber: string) {
    const employees = await strapi.documents('api::employee.employee').findMany({
      filters: { employeeNumber },
      populate: ['cards', 'profilePicture']
    }) as any[];
    return employees[0] || null;
  },

  async findByCardNumber(cardNumber: string) {
    const cards = await strapi.documents('api::employee-card.employee-card').findMany({
      filters: { cardNumber, status: 'Active' },
      populate: ['employee']
    }) as any[];
    
    if (cards && cards.length > 0) {
      return cards[0].employee;
    }
    return null;
  },

  async findByRfid(rfidUid: string) {
    const cards = await strapi.documents('api::employee-card.employee-card').findMany({
      filters: { rfidUid, status: 'Active' },
      populate: ['employee']
    }) as any[];

    if (cards && cards.length > 0) {
      return cards[0].employee;
    }
    return null;
  },

  async createEmployee(data: any) {
    return await strapi.documents('api::employee.employee').create({ data });
  },

  async updateEmployee(documentId: string, data: any) {
    return await strapi.documents('api::employee.employee').update({
      documentId,
      data
    });
  }
}));
