import { Core } from '@strapi/strapi';

export default {
  async importEmployees(ctx: any) {
    try {
      const body = ctx.request.body || {};
      const { conflictResolution = 'SKIP', matchBy = 'employeeNumber', records = [] } = body;

      if (!records || !Array.isArray(records) || records.length === 0) {
        return ctx.badRequest('No records provided for import');
      }

      // Create an import job record instantly
      const importJob = await strapi.documents('api::import-job.import-job' as any).create({
        data: {
          status: 'Pending',
          totalRecords: records.length,
          processedRecords: 0,
          successfulRecords: 0,
          failedRecords: 0,
          errors: [],
        } as any,
      });

      // Pass the job and data to the background service
      // We don't await this so it runs asynchronously
      (strapi.service('api::employee.import') as any).processImport(importJob.documentId, {
        conflictResolution,
        matchBy,
        records,
      }).catch((err: any) => {
        strapi.log.error('Error in background import process:', err);
      });

      // Return the job ID immediately
      return ctx.send({
        message: 'Import job started',
        importJobId: importJob.documentId,
      });
    } catch (error) {
      strapi.log.error('Failed to initialize import job:', error);
      return ctx.internalServerError('Failed to initialize import job');
    }
  },
};
