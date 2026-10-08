import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Auto-configure permissions for custom attendance endpoints
    try {
      const authRole = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' } });
      
      if (authRole) {
        const permissionsToEnable = [
          'api::attendance.attendance.openSession',
          'api::attendance.attendance.closeSession',
          'api::attendance.attendance.currentSession',
          'api::attendance.attendance.scan',
          'api::employee-card.employee-card.disable',
          'api::employee-card.employee-card.issue',
          'api::employee.employee.find',
          'api::employee.employee.findOne',
          'api::employee.employee.create',
          'api::employee.employee.update',
          'api::employee.employee.delete',
          'api::employee-card.employee-card.find',
          'api::employee-card.employee-card.findOne',
          'api::employee-card.employee-card.create',
          'api::employee-card.employee-card.update',
          'api::employee-card.employee-card.delete',
          'api::reports.reports.daily',
          'api::reports.reports.monthly',
          'api::reports.reports.employee'
        ];

        for (const action of permissionsToEnable) {
          const exists = await strapi.db.query('plugin::users-permissions.permission').findOne({
            where: { role: authRole.id, action }
          });
          
          if (!exists) {
            await strapi.db.query('plugin::users-permissions.permission').create({
              data: {
                role: authRole.id,
                action
              }
            });
          }
        }
        strapi.log.info('API permissions automatically granted to the Authenticated role.');
      }
    } catch (error) {
      strapi.log.error('Failed to bootstrap permissions:', error);
    }
  },
};
