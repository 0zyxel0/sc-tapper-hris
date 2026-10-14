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
          'api::employee.import.importEmployees',
          'api::attendance-session.attendance-session.find',
          'api::attendance-session.attendance-session.findOne',
          'api::attendance-session.attendance-session.create',
          'api::attendance-session.attendance-session.update',
          'api::attendance-session.attendance-session.delete',
          'api::attendance-event.attendance-event.find',
          'api::attendance-event.attendance-event.findOne',
          'api::attendance-event.attendance-event.create',
          'api::attendance-event.attendance-event.update',
          'api::attendance-event.attendance-event.delete',
          'api::import-job.import-job.find',
          'api::import-job.import-job.findOne',
          'api::import-job.import-job.create',
          'api::import-job.import-job.update',
          'api::sync.sync.pull',
          'api::sync.sync.push',
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
        strapi.log.info('API permissions automatically granted to the Authenticated role on start.');

        // Optional automated deployment seeding on startup via AUTO_SEED=true
        if (process.env.AUTO_SEED === 'true') {
          strapi.log.info('AUTO_SEED=true detected. Seeding deployment data...');
          const setupService = strapi.service('api::setup.setup') as any;
          if (setupService) {
            const seedResult = await setupService.seed();
            strapi.log.info(`Deployment data seeded: ${JSON.stringify(seedResult)}`);
          }
        }
      }
    } catch (error) {
      strapi.log.error('Failed to bootstrap permissions or seed deployment data:', error);
    }
  },
};
