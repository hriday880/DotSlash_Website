import {
  getLaserTagSlots as serviceGetSlots,
  registerLaserTagSlot as serviceRegister,
  getLaserTagRegistrations as serviceGetRegistrations,
  updateLaserTagRegistrationAdmin as serviceUpdateAdmin,
  lookupLaserTagRegistration as serviceLookup,
  uploadPaymentScreenshot,
} from './laserTagService';

/**
 * Helper to test if a response is JSON
 */
async function parseJsonResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await res.json();
  }
  return null;
}

export const laserTagApi = {
  /**
   * GET /api/laser-tag/slots
   * Returns all 36 slots with live computed capacities and statuses.
   */
  async getSlots() {
    try {
      const res = await fetch('/api/laser-tag/slots');
      if (res.ok) {
        const data = await parseJsonResponse(res);
        if (data && data.slots) return data.slots;
      }
    } catch {
      // Dev proxy or network failure -> fallback to service
    }
    return await serviceGetSlots();
  },

  /**
   * POST /api/laser-tag/register
   * Registers a slot booking with screenshot and squad roster.
   */
  async registerSlot(payload) {
    let screenshotUrl = payload.screenshotUrl;

    // Upload file if not already uploaded
    if (!screenshotUrl && payload.screenshotFile) {
      screenshotUrl = await uploadPaymentScreenshot(payload.screenshotFile);
    }

    const body = {
      slotId: payload.slotId,
      team: payload.team,
      players: payload.players,
      utrReference: payload.utrReference,
      screenshotUrl,
    };

    try {
      const res = await fetch('/api/laser-tag/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await parseJsonResponse(res);
      if (data) {
        if (!res.ok) {
          throw new Error(data.error || 'Registration failed');
        }
        return data.registration;
      }
    } catch (err) {
      if (err.message && !err.message.includes('fetch')) {
        throw err;
      }
    }

    // Direct DB service fallback
    return await serviceRegister({
      ...payload,
      screenshotUrl,
    });
  },

  /**
   * PATCH /api/laser-tag/admin/registrations/:id
   * Admin approve or reject action.
   */
  async updateAdminRegistration(id, { action, adminNote }) {
    try {
      const res = await fetch(`/api/laser-tag/admin/registrations/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, adminNote }),
      });

      const data = await parseJsonResponse(res);
      if (data) {
        if (!res.ok) throw new Error(data.error || 'Admin update failed');
        return data.registration;
      }
    } catch (err) {
      if (err.message && !err.message.includes('fetch')) throw err;
    }

    return await serviceUpdateAdmin(id, { action, adminNote });
  },

  /**
   * GET /api/laser-tag/admin/registrations
   * Admin queue with KPIs.
   */
  async getAdminRegistrations(filter = 'ALL') {
    try {
      const res = await fetch(`/api/laser-tag/admin/registrations?status=${encodeURIComponent(filter)}`);
      if (res.ok) {
        const data = await parseJsonResponse(res);
        if (data && data.registrations) {
          return {
            registrations: data.registrations,
            kpis: data.kpis,
          };
        }
      }
    } catch {
      // Fallback
    }

    return await serviceGetRegistrations(filter);
  },

  /**
   * GET /api/laser-tag/lookup?q=...
   * Player receipt status check.
   */
  async lookupRegistration(query) {
    if (!query?.trim()) return [];
    try {
      const res = await fetch(`/api/laser-tag/lookup?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const data = await parseJsonResponse(res);
        if (data && data.results) return data.results;
      }
    } catch {
      // Fallback
    }

    return await serviceLookup(query);
  },
};
