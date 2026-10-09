export default {
  async pull(ctx: any) {
    try {
      const { lastSyncTime } = ctx.query;
      const data = await (strapi.service('api::sync.sync') as any).pullData(lastSyncTime);
      return ctx.send({ success: true, data });
    } catch (error: any) {
      strapi.log.error('Pull sync failed:', error);
      return ctx.internalServerError('Failed to pull data');
    }
  },

  async push(ctx: any) {
    try {
      const body = ctx.request.body || {};
      const { deviceId, events = [] } = body;

      if (!events || !Array.isArray(events) || events.length === 0) {
        return ctx.badRequest('No events provided for sync');
      }

      const result = await (strapi.service('api::sync.sync') as any).pushData(deviceId, events);
      return ctx.send({ success: true, result });
    } catch (error: any) {
      strapi.log.error('Push sync failed:', error);
      return ctx.internalServerError('Failed to push data');
    }
  }
};
