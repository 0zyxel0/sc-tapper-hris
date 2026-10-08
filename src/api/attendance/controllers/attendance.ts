import { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async openSession(ctx: any) {
    try {
      const data = ctx.request.body;
      const service = strapi.service('api::attendance.attendance') as any;
      const session = await service.openSession(data);
      ctx.send({ success: true, session });
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async closeSession(ctx: any) {
    try {
      const { documentId } = ctx.params;
      const data = ctx.request.body;
      const service = strapi.service('api::attendance.attendance') as any;
      const session = await service.closeSession(documentId, data);
      ctx.send({ success: true, session });
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async currentSession(ctx: any) {
    try {
      const { deviceId } = ctx.query;
      const service = strapi.service('api::attendance.attendance') as any;
      const session = await service.currentSession(deviceId);
      if (!session) {
        return ctx.send({ success: true, session: null });
      }
      ctx.send({ success: true, session });
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async scan(ctx: any) {
    try {
      const data = ctx.request.body;
      const service = strapi.service('api::attendance.attendance') as any;
      const result = await service.processScan(data);
      if (result.success) {
        ctx.send(result);
      } else {
        ctx.badRequest(result.message, { code: result.code });
      }
    } catch (err) {
      ctx.throw(500, err);
    }
  }
});