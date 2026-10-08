import { Core } from '@strapi/strapi';

function calculateTotalHours(events: any[]) {
  let totalHours = 0;
  let inTime: Date | null = null;
  let missingOut = false;
  
  for (const event of events) {
    if (event.direction === 'IN') {
      inTime = new Date(event.eventTime);
    } else if (event.direction === 'OUT' && inTime) {
      const outTime = new Date(event.eventTime);
      totalHours += (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
      inTime = null;
    } else if (event.direction === 'OUT' && !inTime) {
      // Missing IN
    }
  }

  if (inTime) {
    missingOut = true;
  }

  return {
    totalHours: Number(totalHours.toFixed(2)),
    missingOut,
    firstIn: events.find(e => e.direction === 'IN')?.eventTime || null,
    lastOut: [...events].reverse().find(e => e.direction === 'OUT')?.eventTime || null,
    currentStatus: events.length > 0 ? events[events.length - 1].direction : 'OUT',
    numberOfScans: events.length
  };
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async getDailyAttendance(dateString?: string) {
    const targetDate = dateString ? new Date(dateString) : new Date();
    // Assuming YYYY-MM-DD format, set bounds
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const events = await strapi.documents('api::attendance-event.attendance-event').findMany({
      filters: {
        eventTime: {
          $gte: startOfDay.toISOString(),
          $lte: endOfDay.toISOString(),
        }
      },
      populate: ['employee'],
      sort: 'eventTime:asc'
    }) as any[];

    const employees = await strapi.documents('api::employee.employee').findMany({
      filters: { employmentStatus: 'Active' }
    }) as any[];

    const report = employees.map(emp => {
      const empEvents = events.filter(e => e.employee?.documentId === emp.documentId);
      const metrics = calculateTotalHours(empEvents);
      
      return {
        employee: {
          id: emp.documentId,
          employeeNumber: emp.employeeNumber,
          displayName: emp.displayName || `${emp.firstName} ${emp.lastName}`
        },
        ...metrics
      };
    });

    return report;
  },

  async getMonthlyAttendance(year?: string, month?: string) {
    const now = new Date();
    const targetYear = year ? parseInt(year) : now.getFullYear();
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
    
    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    const events = await strapi.documents('api::attendance-event.attendance-event').findMany({
      filters: {
        eventTime: {
          $gte: startOfMonth.toISOString(),
          $lte: endOfMonth.toISOString(),
        }
      },
      populate: ['employee'],
      sort: 'eventTime:asc'
    }) as any[];

    const employees = await strapi.documents('api::employee.employee').findMany({
      filters: { employmentStatus: 'Active' }
    }) as any[];

    const report = employees.map(emp => {
      const empEvents = events.filter(e => e.employee?.documentId === emp.documentId);
      
      // Group by date
      const dailyEvents: Record<string, any[]> = {};
      for (const e of empEvents) {
        const dateStr = new Date(e.eventTime).toISOString().split('T')[0];
        if (!dailyEvents[dateStr]) dailyEvents[dateStr] = [];
        dailyEvents[dateStr].push(e);
      }

      let daysPresent = 0;
      let totalMonthlyHours = 0;
      let missingOutDays = 0;
      let missingInDays = 0;

      for (const [dateStr, dayEvents] of Object.entries(dailyEvents)) {
        if (dayEvents.length > 0) {
          daysPresent++;
        }
        
        const metrics = calculateTotalHours(dayEvents);
        totalMonthlyHours += metrics.totalHours;
        if (metrics.missingOut) missingOutDays++;
        if (dayEvents[0]?.direction === 'OUT') missingInDays++;
      }

      return {
        employee: {
          id: emp.documentId,
          employeeNumber: emp.employeeNumber,
          displayName: emp.displayName || `${emp.firstName} ${emp.lastName}`
        },
        daysPresent,
        totalHours: Number(totalMonthlyHours.toFixed(2)),
        missingOutDays,
        missingInDays
      };
    });

    return report;
  },

  async getEmployeeAttendance(employeeId: string, startDate?: string, endDate?: string) {
    const filters: any = {
      employee: { documentId: employeeId }
    };

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filters.eventTime = {
        $gte: start.toISOString(),
        $lte: end.toISOString()
      };
    }

    const events = await strapi.documents('api::attendance-event.attendance-event').findMany({
      filters,
      sort: 'eventTime:asc'
    }) as any[];

    // Group by date
    const dailyEvents: Record<string, any[]> = {};
    for (const e of events) {
      const dateStr = new Date(e.eventTime).toISOString().split('T')[0];
      if (!dailyEvents[dateStr]) dailyEvents[dateStr] = [];
      dailyEvents[dateStr].push(e);
    }

    const report = Object.entries(dailyEvents).map(([date, dayEvents]) => {
      const metrics = calculateTotalHours(dayEvents);
      return {
        date,
        ...metrics
      };
    });

    return report;
  }
});