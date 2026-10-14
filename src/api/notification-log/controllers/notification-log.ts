import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::notification-log.notification-log' as any, ({ strapi }) => ({
  async sendOverdueReminders(ctx: any) {
    try {
      const { current_status, force, customMessage } = ctx.request.body || {};
      const service = strapi.service('api::notification-log.notification-log' as any) as any;
      const result = await service.sendBatchOverdueReminders({
        current_status,
        force: Boolean(force),
        customMessage,
      });
      ctx.send(result);
    } catch (err: any) {
      ctx.throw(500, err);
    }
  },
}));
