import { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async seed(ctx: any) {
    try {
      const service = strapi.service('api::testing.testing') as any;
      const result = await service.seed();
      ctx.send({ success: true, data: result });
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async reset(ctx: any) {
    try {
      const service = strapi.service('api::testing.testing') as any;
      await service.reset();
      ctx.send({ success: true, message: 'Test data reset successfully.' });
    } catch (err) {
      ctx.throw(500, err);
    }
  }
});