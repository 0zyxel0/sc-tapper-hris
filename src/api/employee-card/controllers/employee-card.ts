import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::employee-card.employee-card', ({ strapi }) => ({
  async disable(ctx: any) {
    try {
      const { documentId } = ctx.params;
      const { reason, notes } = ctx.request.body || {};
      const service = strapi.service('api::employee-card.employee-card') as any;
      const card = await service.disableCard(documentId, { reason, notes });
      ctx.send({ success: true, card });
    } catch (err: any) {
      if (err.name === 'ApplicationError' || err.name === 'ValidationError') {
        return ctx.badRequest(err.message, { details: err.details });
      }
      ctx.throw(500, err);
    }
  },

  async suspend(ctx: any) {
    try {
      const { documentId } = ctx.params;
      const { reason, current_status, paymentDueDate, sendReminder, customMessage, notes } =
        ctx.request.body || {};
      const service = strapi.service('api::employee-card.employee-card') as any;
      const result = await service.suspendCard(documentId, {
        reason,
        current_status,
        paymentDueDate,
        sendReminder,
        customMessage,
        notes,
      });
      ctx.send({ success: true, ...result });
    } catch (err: any) {
      if (err.name === 'ApplicationError' || err.name === 'ValidationError') {
        return ctx.badRequest(err.message, { details: err.details });
      }
      ctx.throw(500, err);
    }
  },

  async activate(ctx: any) {
    try {
      const { documentId } = ctx.params;
      const { current_status, reason, notes } = ctx.request.body || {};
      const service = strapi.service('api::employee-card.employee-card') as any;
      const card = await service.activateCard(documentId, {
        current_status,
        reason,
        notes,
      });
      ctx.send({ success: true, card });
    } catch (err: any) {
      if (err.name === 'ApplicationError' || err.name === 'ValidationError') {
        return ctx.badRequest(err.message, { details: err.details });
      }
      ctx.throw(500, err);
    }
  },

  async updateCurrentStatus(ctx: any) {
    try {
      const { documentId } = ctx.params;
      const body = ctx.request.body || {};
      const service = strapi.service('api::employee-card.employee-card') as any;
      const result = await service.updateCurrentStatus(documentId, body);
      ctx.send({ success: true, ...result });
    } catch (err: any) {
      if (err.name === 'ApplicationError' || err.name === 'ValidationError') {
        return ctx.badRequest(err.message, { details: err.details });
      }
      ctx.throw(500, err);
    }
  },

  async bulkFlag(ctx: any) {
    try {
      const body = ctx.request.body || {};
      const service = strapi.service('api::employee-card.employee-card') as any;
      const result = await service.bulkFlagCards(body);
      ctx.send(result);
    } catch (err: any) {
      if (err.name === 'ApplicationError' || err.name === 'ValidationError') {
        return ctx.badRequest(err.message, { details: err.details });
      }
      ctx.throw(500, err);
    }
  },

  async sendReminder(ctx: any) {
    try {
      const { documentId } = ctx.params;
      const { force, customMessage } = ctx.request.body || {};
      const notificationService = strapi.service('api::notification-log.notification-log' as any) as any;
      const notification = await notificationService.sendPaymentReminder({
        card: documentId,
        triggerSource: 'Manual_Reminder',
        force: force !== undefined ? Boolean(force) : true,
        customMessage,
      });
      ctx.send({ success: true, notification });
    } catch (err: any) {
      if (err.name === 'ApplicationError' || err.name === 'ValidationError') {
        return ctx.badRequest(err.message, { details: err.details });
      }
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
    } catch (err: any) {
      if (err.name === 'ApplicationError' || err.name === 'ValidationError') {
        return ctx.badRequest(err.message, { details: err.details });
      }
      ctx.throw(500, err);
    }
  },
}));

