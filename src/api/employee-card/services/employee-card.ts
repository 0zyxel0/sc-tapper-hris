import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';

export default factories.createCoreService('api::employee-card.employee-card', ({ strapi }) => ({
  async disableCard(documentId: string) {
    const existing = await strapi.documents('api::employee-card.employee-card').findOne({
      documentId,
    }) as any;

    const card = await strapi.documents('api::employee-card.employee-card').update({
      documentId,
      data: {
        status: 'Disabled',
      },
    });

    if (existing?.rfidUid) {
      const allowedCard = await strapi.documents('api::allowed-rfid.allowed-rfid').findFirst({
        filters: { rfidUid: existing.rfidUid },
      }) as any;

      if (allowedCard) {
        await strapi.documents('api::allowed-rfid.allowed-rfid').update({
          documentId: allowedCard.documentId,
          data: {
            status: 'Disabled',
          },
        });
      }
    }

    return card;
  },

  async issueCard(employeeId: string, data: any) {
    const { rfidUid } = data;

    if (rfidUid) {
      const allowedCard = await strapi.documents('api::allowed-rfid.allowed-rfid').findFirst({
        filters: { rfidUid },
      }) as any;

      if (!allowedCard) {
        throw new errors.ApplicationError('UNAUTHORIZED_CARD: This RFID card is not in the system allowlist.');
      }

      if (allowedCard.status === 'Assigned' || allowedCard.status === 'Disabled') {
        throw new errors.ApplicationError('CARD_UNAVAILABLE: This RFID card is already assigned to another employee or disabled.');
      }

      const card = await strapi.documents('api::employee-card.employee-card').create({
        data: {
          employee: employeeId,
          status: 'Active',
          cardType: 'RFID',
          issuedAt: new Date().toISOString(),
          ...data,
        },
      });

      await strapi.documents('api::allowed-rfid.allowed-rfid').update({
        documentId: allowedCard.documentId,
        data: {
          status: 'Assigned',
        },
      });

      return card;
    }

    return await strapi.documents('api::employee-card.employee-card').create({
      data: {
        employee: employeeId,
        status: 'Active',
        issuedAt: new Date().toISOString(),
        ...data,
      },
    });
  },
}));

