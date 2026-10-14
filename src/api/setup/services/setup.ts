import type { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async getStatus() {
    const authRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'authenticated' },
    });

    const superAdminRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'super_admin' },
    });

    const checkUsernames = [
      'admin',
      'kiosk',
      'guard',
      'gate-01',
      'gate-02',
      'gate-03',
      'gate-1',
      'gate-2',
      'gate-3',
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

    return {
      authenticatedRoleFound: !!authRole,
      superAdminRoleFound: !!superAdminRole,
      seededUsersCount: users.length,
      users: users.map((u: any) => ({
        username: u.username,
        email: u.email,
        role: u.role?.name || null,
      })),
      activeGateSessionsCount: sessions.length,
      gateSessions: sessions.map((s: any) => ({ name: s.name, deviceId: s.deviceId, status: s.status })),
    };
  },

  async seed(options: { defaultPassword?: string } = {}) {
    const password = options.defaultPassword || process.env.SEED_DEFAULT_PASSWORD || 'Password123!';

    // 1. Locate Authenticated Role & Super Admin Role
    const authRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'authenticated' },
    });

    if (!authRole) {
      throw new Error('Authenticated role not found in database.');
    }

    let superAdminRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'super_admin' },
    });

    if (!superAdminRole) {
      superAdminRole = await strapi.db.query('plugin::users-permissions.role').create({
        data: {
          name: 'Super Admin',
          description: 'Super Administrator with full API access',
          type: 'super_admin',
        },
      });
    }

    // 2. Define standard deployment users (including aliases for gate devices)
    const usersToSeed = [
      { username: 'admin', email: 'admin@sc-tapper.local', password, roleId: superAdminRole.id, roleName: 'Super Admin' },
      { username: 'kiosk', email: 'kiosk@sc-tapper.local', password, roleId: authRole.id, roleName: 'Authenticated' },
      { username: 'guard', email: 'guard@sc-tapper.local', password, roleId: authRole.id, roleName: 'Authenticated' },
      { username: 'gate-01', email: 'gate01@sc-tapper.local', password, roleId: authRole.id, roleName: 'Authenticated' },
      { username: 'gate-02', email: 'gate02@sc-tapper.local', password, roleId: authRole.id, roleName: 'Authenticated' },
      { username: 'gate-03', email: 'gate03@sc-tapper.local', password, roleId: authRole.id, roleName: 'Authenticated' },
      { username: 'gate-1', email: 'gate1@sc-tapper.local', password, roleId: authRole.id, roleName: 'Authenticated' },
      { username: 'gate-2', email: 'gate2@sc-tapper.local', password, roleId: authRole.id, roleName: 'Authenticated' },
      { username: 'gate-3', email: 'gate3@sc-tapper.local', password, roleId: authRole.id, roleName: 'Authenticated' },
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
    };
  },
});
