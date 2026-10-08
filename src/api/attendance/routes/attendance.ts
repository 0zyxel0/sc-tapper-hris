export default {
  routes: [
    {
      method: 'POST',
      path: '/attendance/sessions/open',
      handler: 'attendance.openSession',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/attendance/sessions/:documentId/close',
      handler: 'attendance.closeSession',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/attendance/sessions/current',
      handler: 'attendance.currentSession',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/attendance/scan',
      handler: 'attendance.scan',
      config: {
        policies: [],
        middlewares: [],
      },
    }
  ],
};