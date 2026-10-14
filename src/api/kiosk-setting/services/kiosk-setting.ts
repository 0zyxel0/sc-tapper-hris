import { factories } from '@strapi/strapi';
import fs from 'fs';
import os from 'os';
import path from 'path';
import mime from 'mime-types';
import { randomUUID } from 'crypto';

export const DEFAULT_KIOSK_SETTINGS = {
  companyName: 'SC Tapper HRIS',
  welcomeTitle: 'Ready to Scan',
  welcomeSubtitle: 'Please tap your RFID card on the reader',
  logo: null,
  backgroundImage: null,
  useLogoAsBackground: true,
  backgroundFit: 'watermark',
  backgroundOpacity: 15,
  primaryColor: '#0F172A',
};

export default factories.createCoreService('api::kiosk-setting.kiosk-setting' as any, ({ strapi }) => ({
  async getSettings() {
    const existing = await strapi.documents('api::kiosk-setting.kiosk-setting' as any).findFirst({
      populate: ['logo', 'backgroundImage'],
    });

    if (!existing) {
      return {
        ...DEFAULT_KIOSK_SETTINGS,
      };
    }

    return existing;
  },

  async ensureDefaultSettings() {
    const existing = await strapi.documents('api::kiosk-setting.kiosk-setting' as any).findFirst({
      populate: ['logo', 'backgroundImage'],
    });

    if (existing) {
      return { created: false, settings: existing };
    }

    const created = await strapi.documents('api::kiosk-setting.kiosk-setting' as any).create({
      data: {
        companyName: DEFAULT_KIOSK_SETTINGS.companyName,
        welcomeTitle: DEFAULT_KIOSK_SETTINGS.welcomeTitle,
        welcomeSubtitle: DEFAULT_KIOSK_SETTINGS.welcomeSubtitle,
        useLogoAsBackground: DEFAULT_KIOSK_SETTINGS.useLogoAsBackground,
        backgroundFit: DEFAULT_KIOSK_SETTINGS.backgroundFit,
        backgroundOpacity: DEFAULT_KIOSK_SETTINGS.backgroundOpacity,
        primaryColor: DEFAULT_KIOSK_SETTINGS.primaryColor,
      } as any,
      populate: ['logo', 'backgroundImage'],
    });

    return { created: true, settings: created };
  },

  async uploadBase64Image(base64Data: string, prefix = 'kiosk-logo') {
    const matches = base64Data.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    const mimeType = matches ? matches[1] : 'image/png';
    const rawBase64 = matches ? matches[2] : base64Data;

    const ext = mime.extension(mimeType) || 'png';
    const fileName = `${prefix}_${randomUUID()}.${ext}`;
    const tmpPath = path.join(os.tmpdir(), fileName);

    const buffer = Buffer.from(rawBase64, 'base64');
    fs.writeFileSync(tmpPath, buffer);

    try {
      const stats = fs.statSync(tmpPath);
      const uploadedFiles = await strapi.plugins.upload.services.upload.upload({
        data: {},
        files: {
          filepath: tmpPath,
          path: tmpPath,
          originalFilename: fileName,
          name: fileName,
          mimetype: mimeType,
          type: mimeType,
          size: stats.size,
        },
      });

      if (uploadedFiles && uploadedFiles.length > 0) {
        return uploadedFiles[0].id;
      }
      throw new Error('Failed to upload image file');
    } finally {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    }
  },

  async updateSettings(payload: Record<string, any>) {
    const rawData = payload?.data ? payload.data : payload;
    const updateData: Record<string, any> = {};

    const allowedFields = [
      'companyName',
      'welcomeTitle',
      'welcomeSubtitle',
      'logo',
      'backgroundImage',
      'useLogoAsBackground',
      'backgroundFit',
      'backgroundOpacity',
      'primaryColor',
    ];

    for (const field of allowedFields) {
      if (rawData[field] !== undefined) {
        updateData[field] = rawData[field];
      }
    }

    if (updateData.backgroundOpacity !== undefined) {
      const opacity = Number(updateData.backgroundOpacity);
      updateData.backgroundOpacity = Math.max(0, Math.min(100, Number.isNaN(opacity) ? 15 : Math.round(opacity)));
    }

    if (rawData.logoBase64) {
      updateData.logo = await this.uploadBase64Image(rawData.logoBase64, 'kiosk-logo');
    }

    if (rawData.backgroundImageBase64) {
      updateData.backgroundImage = await this.uploadBase64Image(rawData.backgroundImageBase64, 'kiosk-bg');
    }

    const existing = await strapi.documents('api::kiosk-setting.kiosk-setting' as any).findFirst();

    if (existing) {
      return await strapi.documents('api::kiosk-setting.kiosk-setting' as any).update({
        documentId: existing.documentId,
        data: updateData as any,
        populate: ['logo', 'backgroundImage'],
      });
    }

    return await strapi.documents('api::kiosk-setting.kiosk-setting' as any).create({
      data: {
        ...DEFAULT_KIOSK_SETTINGS,
        ...updateData,
      } as any,
      populate: ['logo', 'backgroundImage'],
    });
  },
}));
