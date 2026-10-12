export default {
  routes: [
    {
      method: 'POST',
      path: '/testing/seed',
      handler: 'testing.seed',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/testing/reset',
      handler: 'testing.reset',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};