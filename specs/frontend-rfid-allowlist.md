# Frontend Implementation Specification - RFID Card Allowlist & Inventory

This document details the frontend implementation requirements for the **RFID Card Allowlist** feature in the Nuxt Guardhouse UI (`sc-tapper-hris-web`). It outlines user interfaces, component behaviors, error states, and API integrations needed to manage the company's approved card inventory and enforce strict allowlist mapping.

---

## 1. Overview & User Journey

### The Problem
Previously, guards or administrators performing "Tap-to-Assign" card enrollment could tap any arbitrary RFID card (including personal transit cards or unregistered third-party cards) to associate with an employee profile.

### The Solution
1. **Inventory Pre-Registration:** Administrators bulk upload physical RFID card UIDs into the **Allowed RFID** inventory before distributing or assigning them.
2. **Strict Mapping Validation:** During enrollment ("Tap-to-Assign"), the backend strictly checks if the scanned UID exists in the allowlist and is unassigned.
3. **Real-Time Guard Feedback:** The frontend provides immediate visual and audible feedback if an unauthorized card is tapped, preventing accidental registration of rogue or invalid cards.

---

## 2. Page Specifications

### 2.1 Card Inventory Management (`/admin/cards` or `/admin/rfid-allowlist`)

A dedicated administrative view within the Guardhouse Admin panel for monitoring physical card stock and uploading new batches.

#### A. Key Metrics Header (Stat Badges)
Display high-level inventory counters at the top of the page:
- **Total Registered Cards:** Total count of all cards in the allowlist.
- **Available (Unassigned):** Count of cards ready for employee mapping (`status === 'Unassigned'`).
- **Assigned:** Count of active cards currently mapped to staff (`status === 'Assigned'`).
- **Disabled / Lost:** Count of deactivated or replaced cards (`status === 'Disabled'`).

#### B. Search, Filters, and Actions Bar
- **Search Input:** Debounced text input searching by `rfidUid` or `batchReference`.
- **Status Filter:** Dropdown or pill selector (`All`, `Unassigned`, `Assigned`, `Disabled`).
- **Upload Action Button:** Primary button labeled **"Upload Card Batch"** that opens the bulk upload modal.

#### C. Card Inventory Data Table
A paginated data table showing:
| Column | Description | Format / UI Element |
| :--- | :--- | :--- |
| **RFID UID** | Physical card identifier | Monospace badge (e.g., `04A1B2C3D4`) with copy-to-clipboard icon |
| **Status** | Allocation state | Badge: Green for `Assigned`, Gray/Neutral for `Unassigned`, Red for `Disabled` |
| **Batch Reference** | Inbound shipment / batch tag | Text label (e.g., `October-2026-Batch-A`) |
| **Created Date** | Date card was uploaded | Localized date format (e.g., `Oct 14, 2026 10:30 AM`) |
| **Notes** | Optional administrative memo | Short snippet or tooltip |

---

### 2.2 Bulk Upload Modal (`CardBatchUploadModal.vue`)

A modal dialog that enables admins to upload dozens or hundreds of card UIDs at once.

#### A. Input Methods
Provide tabs or toggles for two input formats:
1. **CSV File Drag-and-Drop:**
   - Accepts `.csv` files.
   - Supported CSV columns: `rfidUid` (mandatory), `batchReference` (optional), `notes` (optional).
   - Shows file preview: Detected row count, detected valid UIDs, parse errors.
2. **Direct Text Input:**
   - Multi-line textarea where administrators can scan multiple cards sequentially or paste UID strings (one per line, space-separated, or comma-separated).

#### B. Batch Metadata Inputs
- **Batch Name / Reference:** Text input (pre-filled with default like `Batch-YYYY-MM-DD`).
- **Batch Notes:** Optional textarea for supplier details or purchase order references.

#### C. Submission & Feedback
- Submits to `POST /api/rfid-allowlist/bulk-upload`.
- Displays a completion alert summary:
  ```
  ✅ Upload Complete: 120 cards processed.
     • 115 new cards added to inventory.
     • 5 duplicate cards skipped.
  ```

---

### 2.3 Updated "Tap-to-Assign" Card Enrollment Modal (`CardEnrollmentModal.vue`)

Located on the Employee Profile view (`/admin/profiles`), this modal pairs a physical card with an employee.

#### A. Scanning Step
1. Modal displays an animated visual prompt: *"Waiting for card tap..."*.
2. Hardware USB RFID scanner simulates keyboard input into the global or input-focused listener.
3. Keystrokes accumulate into the RFID buffer and submit automatically upon receiving the `Enter` keystroke.

#### B. Mapping Request
Calls `POST /api/employee-cards/issue`:
```json
{
  "employeeId": "emp-document-id-here",
  "rfidUid": "04A1B2C3D4",
  "cardNumber": "C-2026-0042"
}
```

#### C. Dynamic Error & Success States
- **Success (HTTP 200):** Plays success chime / green checkmark animation. Modal shows *"Card 04A1B2C3D4 successfully mapped to [Employee Name]"* and closes.
- **Unauthorized Card (HTTP 400 - `UNAUTHORIZED_CARD`):** Shows red alert banner: *"This card (UID: 04A1B2C3D4) is not in the company allowlist. Please add it to the Card Inventory before assigning."*
- **Card Unavailable (HTTP 400 - `CARD_UNAVAILABLE`):** Shows amber alert banner: *"This card is already mapped to an active employee or has been marked as disabled/lost."*

---

## 3. API Contract Reference

### 3.1 Fetch Allowed Cards Inventory
**Endpoint:** `GET /api/allowed-rfids`  
**Headers:** `Authorization: Bearer <JWT>`  
**Query Parameters:**
- `pagination[page]`: Current page (e.g., `1`)
- `pagination[pageSize]`: Items per page (e.g., `25`)
- `filters[status][$eq]`: Filter by status (`Unassigned` | `Assigned` | `Disabled`)
- `filters[rfidUid][$containsi]`: Search by UID substring
- `sort`: `createdAt:desc`

**Sample Response:**
```json
{
  "data": [
    {
      "id": 1,
      "documentId": "card-doc-1",
      "rfidUid": "111111",
      "status": "Assigned",
      "batchReference": "TEST-BATCH-001",
      "notes": null,
      "createdAt": "2026-10-14T04:00:00.000Z"
    },
    {
      "id": 2,
      "documentId": "card-doc-2",
      "rfidUid": "555555",
      "status": "Unassigned",
      "batchReference": "TEST-BATCH-001",
      "notes": "Pre-allowed test card ready to be mapped",
      "createdAt": "2026-10-14T04:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "pageCount": 1,
      "total": 2
    }
  }
}
```

---

### 3.2 Bulk Upload Cards
**Endpoint:** `POST /api/rfid-allowlist/bulk-upload`  
**Headers:** `Authorization: Bearer <JWT>`  
**Payload:**
```json
{
  "rfidUids": ["778899", "889900", "990011"],
  "batchReference": "Shipment-Q4-2026",
  "notes": "Standard 13.56MHz Mifare cards"
}
```

**Response (HTTP 200):**
```json
{
  "success": true,
  "summary": {
    "totalProcessed": 3,
    "added": 3,
    "skippedDuplicates": 0
  }
}
```

---

### 3.3 Map Card to Employee
**Endpoint:** `POST /api/employee-cards/issue`  
**Headers:** `Authorization: Bearer <JWT>`  
**Payload:**
```json
{
  "employeeId": "emp-doc-id",
  "rfidUid": "555555",
  "cardNumber": "C-2026-009"
}
```

**Error Response - Unregistered Card (HTTP 400):**
```json
{
  "data": null,
  "error": {
    "status": 400,
    "name": "ApplicationError",
    "message": "UNAUTHORIZED_CARD: This RFID card is not in the system allowlist."
  }
}
```

**Error Response - Already Assigned (HTTP 400):**
```json
{
  "data": null,
  "error": {
    "status": 400,
    "name": "ApplicationError",
    "message": "CARD_UNAVAILABLE: This RFID card is already assigned to another employee or disabled."
  }
}
```

---

### 3.4 Disable / Revoke Card
**Endpoint:** `POST /api/employee-cards/:documentId/disable`  
**Headers:** `Authorization: Bearer <JWT>`  
**Response (HTTP 200):**
```json
{
  "success": true,
  "card": {
    "documentId": "card-doc-id",
    "status": "Disabled"
  }
}
```

---

## 4. Nuxt 3/4 TypeScript Types & Composable

### 4.1 Types (`types/inventory.ts`)
```typescript
export type CardStatus = 'Unassigned' | 'Assigned' | 'Disabled';

export interface AllowedRfid {
  id: number;
  documentId: string;
  rfidUid: string;
  status: CardStatus;
  batchReference?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BulkUploadPayload {
  rfidUids: string[];
  batchReference?: string;
  notes?: string;
}

export interface BulkUploadResponse {
  success: boolean;
  summary: {
    totalProcessed: number;
    added: number;
    skippedDuplicates: number;
  };
}
```

### 4.2 Composable (`composables/useRfidAllowlist.ts`)
```typescript
export const useRfidAllowlist = () => {
  const { $fetchApi } = useNuxtApp();

  const fetchCards = async (params: Record<string, any> = {}) => {
    return await $fetchApi<{ data: AllowedRfid[]; meta: any }>('/api/allowed-rfids', {
      params,
    });
  };

  const uploadBatch = async (payload: BulkUploadPayload): Promise<BulkUploadResponse> => {
    return await $fetchApi<BulkUploadResponse>('/api/rfid-allowlist/bulk-upload', {
      method: 'POST',
      body: payload,
    });
  };

  const issueCard = async (employeeId: string, rfidUid: string, cardNumber?: string) => {
    return await $fetchApi('/api/employee-cards/issue', {
      method: 'POST',
      body: { employeeId, rfidUid, cardNumber },
    });
  };

  const disableCard = async (documentId: string) => {
    return await $fetchApi(`/api/employee-cards/${documentId}/disable`, {
      method: 'POST',
    });
  };

  return {
    fetchCards,
    uploadBatch,
    issueCard,
    disableCard,
  };
};
```

---

## 5. Acceptance Criteria & QA Checklist

- [ ] **Inventory Visibility:** Admins can view the complete list of allowed RFID cards with pagination, search, and status filtering.
- [ ] **Batch Upload:** Admins can upload multiple card UIDs simultaneously via CSV or multi-line text input.
- [ ] **Duplicate Handling:** Re-uploading an existing UID reports it as a skipped duplicate without failing the whole batch.
- [ ] **Strict Tap-to-Assign Validation:** Tapping an unlisted card during enrollment halts the workflow and shows the `UNAUTHORIZED_CARD` banner.
- [ ] **Double Assignment Prevention:** Tapping an already mapped card shows the `CARD_UNAVAILABLE` warning.
- [ ] **Status Synchronization:** When an unassigned allowed card is mapped to an employee, its status in the inventory automatically transitions to `Assigned`.
- [ ] **Card Deactivation:** When an employee card is revoked/disabled, its inventory status transitions to `Disabled`.

