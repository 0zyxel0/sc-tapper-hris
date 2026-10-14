# Feature: Kiosk Logo & Background Customization

## 1. Overview
To allow organizations to brand their physical gate terminals and security kiosks, the **Kiosk Customization** feature enables **Super Admin** and **IT** administrators to configure a custom company logo as the kiosk background/watermark, alongside custom welcome text, background fit modes, and opacity controls.

## 2. Core Requirements
- **Global Single-Type Configuration:** Centralize kiosk branding in a single Strapi resource (`api::kiosk-setting.kiosk-setting`) so all gate kiosks automatically inherit the organization's branding.
- **Logo & Background Support:** Allow uploading a primary company `logo` (which can double as the centered background watermark when `useLogoAsBackground` is enabled) as well as an optional dedicated `backgroundImage`.
- **Visual Readability Controls:** Provide `backgroundFit` (`watermark`, `contain`, `cover`) and `backgroundOpacity` (`0` to `100`, default `15`) so foreground scan cards and employee photos remain high-contrast and legible.
- **Role-Based Access Control (RBAC):**
  - **Read (`GET /api/kiosk-setting`):** Accessible to `Public` and all authenticated roles (`Super Admin`, `Guard`, `Registrar`, `IT`, `Authenticated`) so `/login` and `/kiosk` screens load branding immediately.
  - **Update (`PUT /api/kiosk-setting`):** Strictly restricted to **`Super Admin`** (`super_admin`) and **`IT`** (`it`) roles.
- **Offline Sync Integration:** Included automatically in `GET /api/sync/pull` responses so edge kiosks can cache branding metadata for offline operation.

## 3. Data Model (`api::kiosk-setting.kiosk-setting`)

**Kind:** `singleType` (`collectionName: "kiosk_settings"`)

| Attribute | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `companyName` | `string` (required) | `"SC Tapper HRIS"` | Organization name displayed in kiosk header and login view |
| `welcomeTitle` | `string` (required) | `"Ready to Scan"` | Main heading shown on the idle kiosk screen |
| `welcomeSubtitle` | `string` | `"Please tap your RFID card on the reader"` | Subtext instruction shown on the idle kiosk screen |
| `logo` | `media` (single image) | `null` | Company logo image (populated automatically) |
| `backgroundImage` | `media` (single image) | `null` | Optional dedicated full-bleed background image |
| `useLogoAsBackground` | `boolean` | `true` | If `true`, renders the `logo` as the kiosk background when no `backgroundImage` is set |
| `backgroundFit` | `enumeration` | `"watermark"` | `"watermark"` (centered 45% max width), `"contain"`, or `"cover"` |
| `backgroundOpacity` | `integer` (`0`–`100`) | `15` | Opacity percentage applied to the background image/logo layer |
| `primaryColor` | `string` | `"#0F172A"` | Brand primary/accent hex color |

## 4. API Endpoints

### 4.1 Fetch Kiosk Settings
- **Endpoint:** `GET /api/kiosk-setting`
- **Access:** Public & Authenticated (`Guard`, `Registrar`, `IT`, `Super Admin`)
- **Behavior:** Automatically populates `logo` and `backgroundImage`. If no record exists yet in the database, returns the default settings object so the kiosk UI never fails on first boot.

**Sample Response (`200 OK`):**
```json
{
  "data": {
    "documentId": "kiosk-setting-doc-id",
    "companyName": "SC Tapper HRIS",
    "welcomeTitle": "Ready to Scan",
    "welcomeSubtitle": "Please tap your RFID card on the reader",
    "useLogoAsBackground": true,
    "backgroundFit": "watermark",
    "backgroundOpacity": 15,
    "primaryColor": "#0F172A",
    "logo": {
      "id": 1,
      "url": "/uploads/company_logo_a1b2c3.png",
      "name": "company_logo.png"
    },
    "backgroundImage": null
  }
}
```

### 4.2 Update Kiosk Settings
- **Endpoint:** `PUT /api/kiosk-setting`
- **Access:** **`Super Admin`** and **`IT`** roles only (`403 Forbidden` for `Guard` or `Registrar`).
- **Supported Upload Modes:**
  1. **Base64 Data URL Upload (Single Request):** Pass `logoBase64` or `backgroundImageBase64` (e.g., `"data:image/png;base64,iVBORw0KGgo..."`) directly in the JSON body; the backend decodes, stores the image in Strapi's media library, and links it automatically.
  2. **Standard Strapi Media ID:** Upload via `POST /api/upload` first, then pass the numeric media ID in `logo` or `backgroundImage` (or pass `null` to clear).

**Sample Request (`PUT /api/kiosk-setting`):**
```json
{
  "data": {
    "companyName": "Acme Manufacturing Corp",
    "welcomeTitle": "Welcome to Gate 1",
    "welcomeSubtitle": "Tap your employee ID badge to clock IN or OUT",
    "useLogoAsBackground": true,
    "backgroundFit": "watermark",
    "backgroundOpacity": 18,
    "logoBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."
  }
}
```
