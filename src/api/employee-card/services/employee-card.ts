import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::employee-card.employee-card', ({ strapi }) => ({
  async disableCard(documentId: string) {
    return await strapi.documents('api::employee-card.employee-card').update({
      documentId,
      data: {
        status: 'Disabled'
      }
    });
  },

  async issueCard(employeeId: string, data: any) {
    return await strapi.documents('api::employee-card.employee-card').create({
      data: {
        employee: employeeId,
        status: 'Active',
        issuedAt: new Date().toISOString(),
        ...data
      }
    });
  }
}));
