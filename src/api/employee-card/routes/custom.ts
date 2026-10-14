export default {
  routes: [
    {
      method: 'POST',
      path: '/employee-cards/:documentId/disable',
      handler: 'employee-card.disable',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/employee-cards/:documentId/suspend',
      handler: 'employee-card.suspend',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/employee-cards/:documentId/activate',
      handler: 'employee-card.activate',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PATCH',
      path: '/employee-cards/:documentId/current-status',
      handler: 'employee-card.updateCurrentStatus',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/employee-cards/:documentId/send-reminder',
      handler: 'employee-card.sendReminder',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/employee-cards/bulk-flag',
      handler: 'employee-card.bulkFlag',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/employee-cards/issue',
      handler: 'employee-card.issue',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

