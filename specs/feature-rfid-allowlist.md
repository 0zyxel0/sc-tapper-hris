# Feature: RFID Card Allowlist (Whitelist)

## 1. Overview
Currently, the system allows any RFID card tapped during the "Tap-to-Assign" process to be registered and mapped to an employee profile. To enhance security and ensure only company-issued or approved RFID cards are used, we are introducing the **RFID Card Allowlist** feature. 

This feature will allow administrators to bulk upload a list of valid RFID card UIDs (the "allowlist"). Once this feature is active, the system will strictly reject any attempt to assign an unlisted or unauthorized RFID card to an employee.

## 2. Core Requirements
- **Bulk Upload:** Provide a mechanism for administrators to upload multiple RFID UIDs at once (e.g., via JSON payload or CSV upload).
- **Validation on Mapping:** The `employee-card` mapping process must validate the tapped RFID UID against the allowlist before associating it with a user.
- **Strict Enforcement:** Only cards existing in the allowlist and currently marked as unassigned can be successfully mapped.
- **Inventory Tracking:** Maintain the status of each uploaded card (e.g., `Unassigned`, `Assigned`, `Disabled`) for clear visibility into the organization's physical card inventory.

## 3. Data Model Changes

### 3.1 New Content Type: `allowed-rfid`
We will introduce a new Strapi collection type: `api::allowed-rfid.allowed-rfid`.

**Schema Attributes:**
- `rfidUid` (String, Required, Unique): The unique identifier of the RFID card.
- `status` (Enumeration): The current status of the card.
  - `Unassigned` (Default)
  - `Assigned`
  - `Disabled` / `Lost`
- `batchReference` (String, Optional): A reference or tag for the batch upload (e.g., "Batch-2026-10-14").
- `notes` (Text, Optional): Internal remarks about the card.

### 3.2 Update to `employee-card` Mapping (Validation)
When an `employee-card` is created or updated (e.g., via the backend card issuance endpoint):
- The backend will perform a lookup on the `allowed-rfid` table using the provided `rfidUid`.
- **Not Found:** Throw an HTTP 400 Validation Error: `"UNAUTHORIZED_CARD: This RFID card is not in the system allowlist."`
- **Already Assigned:** Throw an HTTP 400 Validation Error: `"CARD_UNAVAILABLE: This RFID card is already assigned to another employee or disabled."`
- **Success:** Proceed with mapping and update the associated `allowed-rfid` record's status to `Assigned`.

## 4. API Endpoints

### 4.1 Allowlist Bulk Upload Endpoint
**Endpoint:** `POST /api/rfid-allowlist/bulk-upload`  
**Role:** Authenticated (Admin/HR role only)

**Payload (JSON):**
```json
{
  "rfidUids": ["111111", "222222", "333333"],
  "batchReference": "October-2026-Resupply"
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalProcessed": 3,
    "added": 2,
    "skippedDuplicates": 1
  }
}
```

## 5. Admin & Frontend Integration

### 5.1 Nuxt Guardhouse UI / Admin Portal
- **Allowlist Management Page:** A new page in the Admin section where administrators can view all uploaded cards in a data table, filter by status (Unassigned/Assigned), and trigger the bulk upload modal.
- **Error Handling on Tap-to-Assign:** Update the "Tap-to-Assign" modal (from Phase 2) to gracefully handle the `UNAUTHORIZED_CARD` and `CARD_UNAVAILABLE` error responses, displaying a clear, user-friendly notification to the admin (e.g., *"Card mapping failed. This card is not an approved company card."*).

## 6. Next Steps & Implementation
1. **Strapi Data Model:** Create the `allowed-rfid` content type in Strapi and configure permissions.
2. **Bulk Upload Service:** Implement the custom Strapi controller and route for the bulk upload API.
3. **Validation Logic:** Inject lifecycle hooks (`beforeCreate` / `beforeUpdate`) in the `employee-card` model to enforce the allowlist constraint and synchronize statuses.
4. **Seed Data Integrity:** Update the deployment seeder (`/api/setup/seed`) and testing seeder (`/api/testing/seed`) to insert baseline test cards into the `allowed-rfid` collection to ensure automated setups do not break under the new strict validation.
5. **Frontend UI:** Develop the upload interface and error handling workflows in the Nuxt application.
