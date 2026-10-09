export default () => ({
  async pullData(lastSyncTime?: string) {
    const employeeFilters: any = { employmentStatus: 'Active' };
    const cardFilters: any = { status: 'Active' };
    const sessionFilters: any = { status: 'Open' };

    if (lastSyncTime) {
      employeeFilters.updatedAt = { $gte: lastSyncTime };
      cardFilters.updatedAt = { $gte: lastSyncTime };
      sessionFilters.updatedAt = { $gte: lastSyncTime };
    }

    const employees = await strapi.documents('api::employee.employee' as any).findMany({
      filters: employeeFilters,
      populate: ['profilePicture']
    });

    const cards = await strapi.documents('api::employee-card.employee-card' as any).findMany({
      filters: cardFilters,
      populate: ['employee']
    });

    const sessions = await strapi.documents('api::attendance-session.attendance-session' as any).findMany({
      filters: sessionFilters
    });

    return {
      employees,
      cards,
      sessions,
      serverTime: new Date().toISOString()
    };
  },

  async pushData(deviceId: string, events: any[]) {
    let synced = 0;
    let failed = 0;
    const syncedEventIds: string[] = [];
    const errors: any[] = [];

    // Find current open session if deviceId is provided or any open session
    let activeSessionId = null;
    if (deviceId) {
      const sessions = await strapi.documents('api::attendance-session.attendance-session' as any).findMany({
        filters: { status: 'Open', deviceId },
        limit: 1
      });
      if (sessions.length > 0) activeSessionId = sessions[0].documentId;
    }

    if (!activeSessionId) {
      const globalSessions = await strapi.documents('api::attendance-session.attendance-session' as any).findMany({
        filters: { status: 'Open' },
        sort: 'createdAt:desc',
        limit: 1
      });
      if (globalSessions.length > 0) activeSessionId = globalSessions[0].documentId;
    }

    for (let i = 0; i < events.length; i++) {
      const evt = events[i];
      try {
        if (!evt.eventId) throw new Error('Missing eventId');
        
        // Idempotency: Check if already exists
        const existing = await strapi.documents('api::attendance-event.attendance-event' as any).findMany({
          filters: { eventId: evt.eventId },
          limit: 1
        });

        if (existing.length > 0) {
          syncedEventIds.push(evt.eventId);
          continue; // Already synced
        }

        // Resolve Employee and Card
        let employeeDocId = evt.employeeId; // Might be documentId
        let cardDocId = null;

        if (!employeeDocId && evt.employeeNumber) {
          const emp = await strapi.documents('api::employee.employee' as any).findMany({
            filters: { employeeNumber: evt.employeeNumber },
            limit: 1
          });
          if (emp.length > 0) employeeDocId = emp[0].documentId;
        }

        if (evt.rfidUid || evt.cardNumber) {
          const cardFilters: any = {};
          if (evt.rfidUid) cardFilters.rfidUid = evt.rfidUid;
          if (evt.cardNumber) cardFilters.cardNumber = evt.cardNumber;

          const cards = await strapi.documents('api::employee-card.employee-card' as any).findMany({
            filters: cardFilters,
            limit: 1,
            populate: ['employee']
          });
          
          if (cards.length > 0) {
            cardDocId = cards[0].documentId;
            if (!employeeDocId && cards[0].employee) {
              employeeDocId = (cards[0].employee as any).documentId;
            }
          }
        }

        if (!employeeDocId) {
          throw new Error('Could not resolve employee');
        }

        // Insert
        await strapi.documents('api::attendance-event.attendance-event' as any).create({
          data: {
            eventId: evt.eventId,
            employee: employeeDocId,
            card: cardDocId,
            session: activeSessionId,
            direction: evt.direction || 'IN',
            eventTime: evt.eventTime || new Date().toISOString(),
            source: 'Sync',
            deviceId: deviceId || evt.deviceId,
            syncStatus: 'Synced',
            status: 'Valid'
          } as any
        });

        synced++;
        syncedEventIds.push(evt.eventId);
      } catch (err: any) {
        failed++;
        errors.push({ eventId: evt.eventId, index: i, error: err.message });
      }
    }

    return {
      total: events.length,
      synced,
      failed,
      syncedEventIds,
      errors
    };
  }
});