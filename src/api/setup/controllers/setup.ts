import type { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async seed(ctx: any) {
    try {
      const defaultPassword = ctx.request?.body?.password;
      const service = strapi.service('api::setup.setup') as any;
      const result = await service.seed({ defaultPassword });
      ctx.send({ success: true, data: result });
    } catch (err: any) {
      ctx.throw(500, err);
    }
  },

  async status(ctx: any) {
    try {
      const service = strapi.service('api::setup.setup') as any;
      const result = await service.getStatus();
      ctx.send({ success: true, data: result });
    } catch (err: any) {
      ctx.throw(500, err);
    }
  },
});
