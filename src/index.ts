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
    // Auto-configure roles and permissions for custom HRIS and attendance endpoints
    try {
      // 1. Ensure custom API roles exist in users-permissions
      const rolesToEnsure = [
        {
          name: 'Super Admin',
          description: 'Super Administrator with full API access',
          type: 'super_admin',
        },
        {
          name: 'Guard',
          description: 'Security guard and kiosk operator role',
          type: 'guard',
        },
        {
          name: 'Registrar',
          description: 'Registrar with full API access for employee and card registration',
          type: 'registrar',
        },
        {
          name: 'IT',
          description: 'IT personnel and technical operator role',
          type: 'it',
        },
      ];

      const customRoles: any[] = [];
      for (const r of rolesToEnsure) {
        let role = await strapi.db.query('plugin::users-permissions.role').findOne({
          where: { type: r.type },
        });

        if (!role) {
          role = await strapi.db.query('plugin::users-permissions.role').create({
            data: r,
          });
          strapi.log.info(`${r.name} role created in plugin::users-permissions.`);
        }
        customRoles.push(role);
      }

      const authRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'authenticated' },
      });

      const rolesToConfigure = [authRole, ...customRoles].filter(Boolean);

      if (rolesToConfigure.length > 0) {
        const permissionsToEnable = [
          'api::attendance.attendance.openSession',
          'api::attendance.attendance.closeSession',
          'api::attendance.attendance.currentSession',
          'api::attendance.attendance.scan',
          'api::employee-card.employee-card.disable',
          'api::employee-card.employee-card.suspend',
          'api::employee-card.employee-card.activate',
          'api::employee-card.employee-card.updateCurrentStatus',
          'api::employee-card.employee-card.sendReminder',
          'api::employee-card.employee-card.bulkFlag',
          'api::employee-card.employee-card.issue',
          'api::notification-log.notification-log.find',
          'api::notification-log.notification-log.findOne',
          'api::notification-log.notification-log.create',
          'api::notification-log.notification-log.sendOverdueReminders',
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
          'api::reports.reports.employee',
          'api::allowed-rfid.allowed-rfid.find',
          'api::allowed-rfid.allowed-rfid.findOne',
          'api::allowed-rfid.allowed-rfid.create',
          'api::allowed-rfid.allowed-rfid.update',
          'api::allowed-rfid.allowed-rfid.delete',
          'api::allowed-rfid.allowed-rfid.bulkUpload',
          'api::kiosk-setting.kiosk-setting.find',
          'plugin::upload.content-api.find',
          'plugin::upload.content-api.findOne'
        ];

        for (const role of rolesToConfigure) {
          for (const action of permissionsToEnable) {
            const exists = await strapi.db.query('plugin::users-permissions.permission').findOne({
              where: { role: role.id, action }
            });

            if (!exists) {
              await strapi.db.query('plugin::users-permissions.permission').create({
                data: {
                  role: role.id,
                  action
                }
              });
            }
          }
        }

        // Grant kiosk customization update & media upload permissions to Super Admin and IT roles
        const adminRoles = customRoles.filter((r) => r && (r.type === 'super_admin' || r.type === 'it'));
        const adminPermissions = [
          'api::kiosk-setting.kiosk-setting.update',
          'plugin::upload.content-api.upload',
          'plugin::upload.content-api.destroy',
        ];

        for (const role of adminRoles) {
          for (const action of adminPermissions) {
            const exists = await strapi.db.query('plugin::users-permissions.permission').findOne({
              where: { role: role.id, action },
            });

            if (!exists) {
              await strapi.db.query('plugin::users-permissions.permission').create({
                data: {
                  role: role.id,
                  action,
                },
              });
            }
          }
        }

        // Allow Public role to read kiosk-setting so login/idle screens can render company logo & background
        const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
          where: { type: 'public' },
        });
        if (publicRole) {
          const publicReadExists = await strapi.db.query('plugin::users-permissions.permission').findOne({
            where: { role: publicRole.id, action: 'api::kiosk-setting.kiosk-setting.find' },
          });
          if (!publicReadExists) {
            await strapi.db.query('plugin::users-permissions.permission').create({
              data: {
                role: publicRole.id,
                action: 'api::kiosk-setting.kiosk-setting.find',
              },
            });
          }
        }
        strapi.log.info('API permissions automatically granted to Authenticated, Super Admin, Guard, Registrar, and IT roles on start.');

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
