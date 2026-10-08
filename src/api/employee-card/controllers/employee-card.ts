import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::employee-card.employee-card', ({ strapi }) => ({
  async disable(ctx: any) {
    try {
      const { documentId } = ctx.params;
      const service = strapi.service('api::employee-card.employee-card') as any;
      const card = await service.disableCard(documentId);
      ctx.send({ success: true, card });
    } catch (err) {
      ctx.throw(500, err);
    }
  },
  
  async issue(ctx: any) {
    try {
      const { employeeId, ...data } = ctx.request.body;
      if (!employeeId) {
        return ctx.badRequest('employeeId is required');
      }
      const service = strapi.service('api::employee-card.employee-card') as any;
      const card = await service.issueCard(employeeId, data);
      ctx.send({ success: true, card });
    } catch (err) {
      ctx.throw(500, err);
    }
  }
}));