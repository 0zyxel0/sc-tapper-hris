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
      path: '/employee-cards/issue',
      handler: 'employee-card.issue',
      config: {
        policies: [],
        middlewares: [],
      }
    }
  ]
};
