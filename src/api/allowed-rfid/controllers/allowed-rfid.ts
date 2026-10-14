import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::allowed-rfid.allowed-rfid', ({ strapi }) => ({
  async bulkUpload(ctx: any) {
    try {
      const { rfidUids, batchReference, notes } = ctx.request.body || {};

      if (!Array.isArray(rfidUids) || rfidUids.length === 0) {
        return ctx.badRequest('rfidUids must be a non-empty array of strings');
      }

      let added = 0;
      let skippedDuplicates = 0;

      for (const rawUid of rfidUids) {
        const rfidUid = String(rawUid).trim();
        if (!rfidUid) continue;

        // Check if UID already exists in allowed-rfid
        const existing = await strapi.documents('api::allowed-rfid.allowed-rfid').findFirst({
          filters: { rfidUid },
        });

        if (existing) {
          skippedDuplicates++;
          continue;
        }

        await strapi.documents('api::allowed-rfid.allowed-rfid').create({
          data: {
            rfidUid,
            status: 'Unassigned',
            batchReference: batchReference || 'Manual Upload',
            notes: notes || null,
          },
        });
        added++;
      }

      ctx.send({
        success: true,
        summary: {
          totalProcessed: rfidUids.length,
          added,
          skippedDuplicates,
        },
      });
    } catch (err: any) {
      ctx.throw(500, err);
    }
  },
}));
