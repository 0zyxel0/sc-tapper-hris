# Frontend Implementation Specification - Kiosk Logo & Background Customization

This document specifies the Nuxt Guardhouse UI (`sc-tapper-hris-web`) implementation for customizing the kiosk screen with a company logo background, custom welcome text, and visual styling controls.

---

## 1. Overview & User Roles

| Role | Access Level | Capabilities |
| :--- | :--- | :--- |
| **`Super Admin` / `IT`** | **Read & Write** | Can access `/admin/customization` (or `/admin/settings`), upload a company logo or background image, adjust opacity/fit, preview changes live, and save to the server. |
| **`Guard` / `Registrar` / Public** | **Read-Only** | Automatically fetches and renders the configured logo background and welcome text on `/kiosk` and `/login`. Cannot modify settings (`403 Forbidden`). |

---

## 2. Kiosk Display Integration (`/kiosk` & `/login`)

### 2.1 Background Layer Architecture
On the fullscreen `/kiosk` view, insert a non-interactive background layer (`pointer-events-none select-none z-0`) behind the main scan card container (`z-10`):

1. **Image Source Resolution:**
   - If `settings.backgroundImage?.url` exists, use `resolveMediaUrl(settings.backgroundImage.url)`.
   - Otherwise, if `settings.useLogoAsBackground && settings.logo?.url` exists, use `resolveMediaUrl(settings.logo.url)`.
   - If neither is set, render the default clean dark slate gradient.

2. **Background Fit Modes (`settings.backgroundFit`):**
   - **`watermark` (Default):** Centered logo watermark (`w-[45vw] max-w-[520px] max-h-[55vh] object-contain mx-auto my-auto`). Ideal for transparent PNG/SVG company logos.
   - **`contain`:** Full-screen fitted image (`w-full h-full object-contain p-12`).
   - **`cover`:** Edge-to-edge full-bleed background (`w-full h-full object-cover`).

3. **Opacity Control (`settings.backgroundOpacity`):**
   - Apply inline style `:style="{ opacity: (settings.backgroundOpacity ?? 15) / 100 }"`.
   - Keep foreground scan cards backed by `backdrop-blur-md bg-slate-900/80` so employee names, timestamps, and status badges remain 100% legible at any opacity setting.

4. **Header & Idle Branding:**
   - Top-left kiosk header displays `settings.logo` (if uploaded) next to `settings.companyName`.
   - Idle waiting state displays `settings.welcomeTitle` (default: `"Ready to Scan"`) and `settings.welcomeSubtitle` (default: `"Please tap your RFID card on the reader"`).

---

## 3. Admin Customization Page (`/admin/customization`)

### 3.1 Route Guard & Navigation
- Show the **"Kiosk Appearance"** navigation item in the Admin sidebar when `user.role?.type === 'super_admin' || user.role?.type === 'it'`.
- Protect the route with middleware redirecting non-admin users back to `/admin/history` or `/kiosk`.

### 3.2 Layout: Two-Column Split View
- **Left Column (Configuration Form):**
  1. **Company Branding:**
     - `Company Name` text input.
     - `Welcome Title` text input.
     - `Welcome Subtitle` text input.
  2. **Company Logo Upload:**
     - Drag-and-drop image zone accepting `.png`, `.svg`, `.webp`, `.jpg` (recommended: transparent PNG or SVG, max 5MB).
     - **"Remove Logo"** button (sets `logo: null`).
     - Toggle switch: **"Use Logo as Kiosk Background"** (`useLogoAsBackground`).
  3. **Background Styling Controls:**
     - **Display Mode (`backgroundFit`):** Segmented pill selector (`watermark`, `contain`, `cover`).
     - **Background Opacity (`backgroundOpacity`):** Range slider (`0%` to `100%`, step `1%`, recommended `10%–25%`).
  4. **Action Bar:**
     - **"Reset to Defaults"** secondary button.
     - **"Save Changes"** primary button with loading spinner and toast notification.

- **Right Column (Live Interactive 16:9 Kiosk Preview):**
  - Renders a scaled 16:9 miniature replica of the `/kiosk` terminal (`aspect-video rounded-xl overflow-hidden border border-slate-700 relative bg-slate-950`).
  - Reactively updates in real time as the admin selects a new logo file, slides the opacity bar, or edits the welcome text—before clicking Save.

---

## 4. Nuxt TypeScript Types & Composable

### 4.1 Types (`types/kiosk-setting.ts`)
```typescript
export type KioskBackgroundFit = 'watermark' | 'contain' | 'cover';

export interface StrapiMediaFile {
  id: number;
  url: string;
  name: string;
  mime?: string;
  width?: number;
  height?: number;
}

export interface KioskSetting {
  documentId?: string;
  companyName: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  logo: StrapiMediaFile | null;
  backgroundImage: StrapiMediaFile | null;
  useLogoAsBackground: boolean;
  backgroundFit: KioskBackgroundFit;
  backgroundOpacity: number;
  primaryColor: string;
}

export interface UpdateKioskSettingPayload {
  companyName?: string;
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  logo?: number | null;
  backgroundImage?: number | null;
  logoBase64?: string;
  backgroundImageBase64?: string;
  useLogoAsBackground?: boolean;
  backgroundFit?: KioskBackgroundFit;
  backgroundOpacity?: number;
  primaryColor?: string;
}
```

### 4.2 Composable (`composables/useKioskSettings.ts`)
```typescript
export const useKioskSettings = () => {
  const config = useRuntimeConfig();
  const settings = useState<KioskSetting>('kiosk-settings', () => ({
    companyName: 'SC Tapper HRIS',
    welcomeTitle: 'Ready to Scan',
    welcomeSubtitle: 'Please tap your RFID card on the reader',
    logo: null,
    backgroundImage: null,
    useLogoAsBackground: true,
    backgroundFit: 'watermark',
    backgroundOpacity: 15,
    primaryColor: '#0F172A',
  }));

  const resolveMediaUrl = (url?: string | null) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    return `${config.public.apiUrl}${url}`;
  };

  const fetchSettings = async () => {
    try {
      const response = await $fetch<{ data: KioskSetting }>('/api/kiosk-setting');
      if (response?.data) {
        settings.value = response.data;
        if (import.meta.client) {
          localStorage.setItem('cached_kiosk_settings', JSON.stringify(response.data));
        }
      }
    } catch {
      if (import.meta.client) {
        const cached = localStorage.getItem('cached_kiosk_settings');
        if (cached) {
          settings.value = JSON.parse(cached);
        }
      }
    }
    return settings.value;
  };

  const updateSettings = async (payload: UpdateKioskSettingPayload) => {
    const response = await $fetch<{ data: KioskSetting }>('/api/kiosk-setting', {
      method: 'PUT',
      body: { data: payload },
    });
    if (response?.data) {
      settings.value = response.data;
      if (import.meta.client) {
        localStorage.setItem('cached_kiosk_settings', JSON.stringify(response.data));
      }
    }
    return response.data;
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  return {
    settings,
    resolveMediaUrl,
    fetchSettings,
    updateSettings,
    fileToBase64,
  };
};
```

---

## 5. Acceptance Criteria & QA Checklist
- [ ] **Default Fallback:** Kiosk renders cleanly with `"SC Tapper HRIS"` and `"Ready to Scan"` when no custom logo has been uploaded yet.
- [ ] **Logo Upload & Watermark:** Super Admin or IT user can upload a PNG/SVG logo via `/admin/customization` and see it rendered as the kiosk background watermark.
- [ ] **Opacity & Fit Controls:** Changing `backgroundFit` (`watermark`, `contain`, `cover`) and `backgroundOpacity` (`0–100%`) updates both the live preview and `/kiosk` view.
- [ ] **Role Restriction:** `Guard` and `Registrar` accounts cannot modify kiosk settings (`403 Forbidden` enforced by backend).
- [ ] **Offline Caching:** Kiosk caches the fetched settings in `localStorage` / offline sync store so branding persists even if the network drops.

