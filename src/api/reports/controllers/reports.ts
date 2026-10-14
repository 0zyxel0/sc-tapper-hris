import { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async daily(ctx: any) {
    try {
      const { date, personType } = ctx.query;
      const service = strapi.service('api::reports.reports') as any;
      const report = await service.getDailyAttendance(date, personType);
      ctx.send({ success: true, data: report });
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async monthly(ctx: any) {
    try {
      const { month, year, personType } = ctx.query;
      const service = strapi.service('api::reports.reports') as any;
      const report = await service.getMonthlyAttendance(year, month, personType);
      ctx.send({ success: true, data: report });
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async employee(ctx: any) {
    try {
      const { id } = ctx.params;
      const { startDate, endDate } = ctx.query;
      const service = strapi.service('api::reports.reports') as any;
      const report = await service.getEmployeeAttendance(id, startDate, endDate);
      ctx.send({ success: true, data: report });
    } catch (err) {
      ctx.throw(500, err);
    }
  }
});