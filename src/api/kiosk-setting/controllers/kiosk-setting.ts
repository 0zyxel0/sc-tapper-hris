import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::kiosk-setting.kiosk-setting' as any, ({ strapi }) => ({
  async find(ctx: any) {
    try {
      const service = strapi.service('api::kiosk-setting.kiosk-setting' as any) as any;
      const settings = await service.getSettings();
      ctx.send({ data: settings });
    } catch (err: any) {
      ctx.throw(500, err);
    }
  },

  async update(ctx: any) {
    try {
      const user = ctx.state?.user;
      if (user) {
        let roleType = user.role?.type?.toLowerCase();
        let roleName = user.role?.name?.toLowerCase();

        if (!roleType && user.id) {
          const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: user.id },
            populate: ['role'],
          });
          roleType = fullUser?.role?.type?.toLowerCase();
          roleName = fullUser?.role?.name?.toLowerCase();
        }

        const isAllowedRole =
          roleType === 'super_admin' ||
          roleType === 'it' ||
          roleName === 'super admin' ||
          roleName === 'it';

        if (!isAllowedRole) {
          return ctx.forbidden('Only Super Admin or IT roles are permitted to customize the kiosk.');
        }
      }

      const service = strapi.service('api::kiosk-setting.kiosk-setting' as any) as any;
      const updated = await service.updateSettings(ctx.request.body || {});
      ctx.send({ data: updated });
    } catch (err: any) {
      ctx.throw(500, err);
    }
  },
}));
