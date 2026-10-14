import type { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async getStatus() {
    const authRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'authenticated' },
    });

    const superAdminRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'super_admin' },
    });

    const guardRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'guard' },
    });

    const registrarRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'registrar' },
    });

    const itRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'it' },
    });

    const checkUsernames = [
      'admin',
      'guard',
      'registrar',
      'it',
    ];

    const users = await strapi.db.query('plugin::users-permissions.user').findMany({
      where: {
        username: { $in: checkUsernames },
      },
      select: ['id', 'username', 'email', 'confirmed', 'blocked'],
      populate: ['role'],
    });

    const checkDevices = ['GATE-01', 'GATE-02', 'GATE-03'];
    const sessions = await strapi.documents('api::attendance-session.attendance-session').findMany({
      filters: {
        deviceId: { $in: checkDevices },
        status: 'Open',
      },
    });

    const kioskSetting = await strapi.documents('api::kiosk-setting.kiosk-setting' as any).findFirst({
      populate: ['logo', 'backgroundImage'],
    });

    return {
      authenticatedRoleFound: !!authRole,
      superAdminRoleFound: !!superAdminRole,
      guardRoleFound: !!guardRole,
      registrarRoleFound: !!registrarRole,
      itRoleFound: !!itRole,
      seededUsersCount: users.length,
      users: users.map((u: any) => ({
        username: u.username,
        email: u.email,
        role: u.role?.name || null,
      })),
      activeGateSessionsCount: sessions.length,
      gateSessions: sessions.map((s: any) => ({ name: s.name, deviceId: s.deviceId, status: s.status })),
      kioskSettingInitialized: !!kioskSetting,
    };
  },

  async seed(options: { defaultPassword?: string } = {}) {
    const password = options.defaultPassword || process.env.SEED_DEFAULT_PASSWORD || 'Password123!';

    // 1. Ensure required roles exist
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

    const rolesMap: Record<string, any> = {};
    for (const r of rolesToEnsure) {
      let role = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: r.type },
      });

      if (!role) {
        role = await strapi.db.query('plugin::users-permissions.role').create({
          data: r,
        });
      }
      rolesMap[r.type] = role;
    }

    // 2. Define standard deployment users (4 essential deployment accounts)
    const usersToSeed = [
      { username: 'admin', email: 'admin@sc-tapper.local', password, roleId: rolesMap['super_admin'].id, roleName: 'Super Admin' },
      { username: 'guard', email: 'guard@sc-tapper.local', password, roleId: rolesMap['guard'].id, roleName: 'Guard' },
      { username: 'registrar', email: 'registrar@sc-tapper.local', password, roleId: rolesMap['registrar'].id, roleName: 'Registrar' },
      { username: 'it', email: 'it@sc-tapper.local', password, roleId: rolesMap['it'].id, roleName: 'IT' },
    ];

    const seededUsers: Array<{ username: string; email: string; role: string }> = [];
    const existingUsers: Array<{ username: string; email: string; role: string }> = [];

    for (const userDef of usersToSeed) {
      const existing = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: {
          $or: [
            { username: userDef.username },
            { email: userDef.email },
          ],
        },
        populate: ['role'],
      });

      if (!existing) {
        const created = await strapi.plugin('users-permissions').service('user').add({
          username: userDef.username,
          email: userDef.email,
          password: userDef.password,
          confirmed: true,
          blocked: false,
          role: userDef.roleId,
          provider: 'local',
        });
        seededUsers.push({
          username: created.username,
          email: created.email,
          role: userDef.roleName,
        });
      } else {
        // Upgrade role if it differs (e.g. upgrading admin from Authenticated to Super Admin)
        if (existing.role?.id !== userDef.roleId) {
          await strapi.db.query('plugin::users-permissions.user').update({
            where: { id: existing.id },
            data: { role: userDef.roleId },
          });
        }
        existingUsers.push({
          username: existing.username,
          email: existing.email,
          role: userDef.roleName,
        });
      }
    }

    // 3. Define 3 deployment gates & initial active sessions
    const gatesToSeed = [
      {
        deviceId: 'GATE-01',
        name: 'Gate 1 - Main Entrance',
        location: 'Main Entrance / Guardhouse',
      },
      {
        deviceId: 'GATE-02',
        name: 'Gate 2 - Back Entrance',
        location: 'Back Entrance',
      },
      {
        deviceId: 'GATE-03',
        name: 'Gate 3 - Warehouse',
        location: 'Warehouse Gate',
      },
    ];

    const seededGates: any[] = [];
    const existingGates: any[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (const gate of gatesToSeed) {
      const existingSessions = await strapi.documents('api::attendance-session.attendance-session').findMany({
        filters: {
          deviceId: gate.deviceId,
          status: 'Open',
        },
      });

      if (existingSessions.length === 0) {
        const createdSession = await strapi.documents('api::attendance-session.attendance-session').create({
          data: {
            name: gate.name,
            sessionDate: today,
            startTime: new Date().toISOString(),
            status: 'Open',
            location: gate.location,
            deviceId: gate.deviceId,
            notes: 'Initial deployment seeded session',
          },
        });
        seededGates.push({
          deviceId: gate.deviceId,
          name: gate.name,
          location: gate.location,
          sessionDocumentId: createdSession.documentId,
          status: 'Open',
        });
      } else {
        existingGates.push({
          deviceId: gate.deviceId,
          name: existingSessions[0].name,
          status: existingSessions[0].status,
          sessionDocumentId: existingSessions[0].documentId,
        });
      }
    }

    // 4. Ensure default Kiosk Setting exists
    const kioskSettingService = strapi.service('api::kiosk-setting.kiosk-setting' as any) as any;
    const kioskSettingResult = kioskSettingService
      ? await kioskSettingService.ensureDefaultSettings()
      : null;

    return {
      message: 'Deployment seeding completed successfully.',
      users: {
        created: seededUsers,
        existing: existingUsers,
      },
      gates: {
        created: seededGates,
        existing: existingGates,
      },
      kioskSetting: kioskSettingResult,
    };
  },
});
