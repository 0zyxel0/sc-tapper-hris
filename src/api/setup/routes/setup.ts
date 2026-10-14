export default {
  routes: [
    {
      method: 'POST',
      path: '/setup/seed',
      handler: 'setup.seed',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/setup/status',
      handler: 'setup.status',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
