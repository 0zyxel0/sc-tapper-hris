import { Core } from '@strapi/strapi';
import axios from 'axios';
import mime from 'mime-types';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { randomUUID } from 'crypto';

export default () => ({
  async processImport(jobDocumentId: string, options: any) {
    const { conflictResolution, matchBy, records } = options;
    
    let processedRecords = 0;
    let successfulRecords = 0;
    let failedRecords = 0;
    const errors: any[] = [];

    await strapi.documents('api::import-job.import-job' as any).update({
      documentId: jobDocumentId,
      data: { status: 'Processing' } as any,
    });

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        const matchValue = record[matchBy];
        if (!matchValue) throw new Error(`Missing ${matchBy} for record at index ${i}`);

        const existingEmployees = await strapi.documents('api::employee.employee').findMany({
          filters: { [matchBy]: matchValue },
          limit: 1,
        });

        let employeeDocId = null;

        if (existingEmployees.length > 0) {
          employeeDocId = existingEmployees[0].documentId;
          if (conflictResolution === 'SKIP') {
            successfulRecords++;
            processedRecords++;
            continue;
          }
        }

        let profilePictureId = record.profilePicture;
        
        if (!profilePictureId && record.photoUrl) {
          try {
            profilePictureId = await this.downloadAndUploadImage(record.photoUrl, matchValue);
          } catch (photoErr: any) {
            errors.push({ index: i, error: `Photo error: ${photoErr.message}` });
          }
        }

        const employeeData = { ...record };
        delete employeeData.rfidUid;
        delete employeeData.cardNumber;
        delete employeeData.photoUrl;
        
        if (profilePictureId) employeeData.profilePicture = profilePictureId;
        if (!employeeDocId && !employeeData.employmentStatus) employeeData.employmentStatus = 'Active';

        if (employeeDocId) {
          await strapi.documents('api::employee.employee').update({
            documentId: employeeDocId,
            data: employeeData,
          });
        } else {
          const newEmployee = await strapi.documents('api::employee.employee').create({
            data: employeeData,
          });
          employeeDocId = newEmployee.documentId;
        }

        if (record.rfidUid || record.cardNumber) {
          await this.upsertCard(employeeDocId, record.rfidUid, record.cardNumber);
        }

        successfulRecords++;
      } catch (error: any) {
        failedRecords++;
        errors.push({ index: i, error: error.message || 'Unknown error' });
      }

      processedRecords++;
      if (processedRecords % 10 === 0 || processedRecords === records.length) {
        await strapi.documents('api::import-job.import-job' as any).update({
          documentId: jobDocumentId,
          data: { processedRecords, successfulRecords, failedRecords, errors } as any,
        });
      }
    }

    await strapi.documents('api::import-job.import-job' as any).update({
      documentId: jobDocumentId,
      data: {
        status: failedRecords === records.length ? 'Failed' : 'Completed' as any,
        completedAt: new Date().toISOString(),
      },
    });
  },

  async upsertCard(employeeDocId: string, rfidUid: string, cardNumber: string) {
    const existingCards = await strapi.documents('api::employee-card.employee-card').findMany({
      filters: { employee: employeeDocId } as any,
    });

    for (const card of existingCards) {
      if ((rfidUid && card.rfidUid === rfidUid) || (cardNumber && card.cardNumber === cardNumber)) {
        return; // Card exists
      }
    }

    await strapi.documents('api::employee-card.employee-card').create({
      data: {
        employee: employeeDocId,
        rfidUid,
        cardNumber,
        status: 'Active',
        cardType: rfidUid ? 'RFID' : 'Other',
        issuedAt: new Date().toISOString(),
      },
    });
  },

  async downloadAndUploadImage(url: string, matchValue: string) {
    const response = await axios({ method: 'GET', url: url, responseType: 'stream' });
    const ext = mime.extension(response.headers['content-type'] as string) || 'jpg';
    const fileName = `${matchValue}_${randomUUID()}.${ext}`;
    const tmpPath = path.join(os.tmpdir(), fileName);
    
    const writer = fs.createWriteStream(tmpPath);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(true));
      writer.on('error', reject);
    });

    const stats = fs.statSync(tmpPath);
    const uploadedFiles = await strapi.plugins.upload.services.upload.upload({
      data: {},
      files: { path: tmpPath, name: fileName, type: response.headers['content-type'], size: stats.size },
    });

    fs.unlinkSync(tmpPath);
    if (uploadedFiles && uploadedFiles.length > 0) return uploadedFiles[0].id;
    throw new Error('Upload failed');
  }
});