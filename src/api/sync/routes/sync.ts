export default {
  routes: [
    {
      method: 'GET',
      path: '/sync/pull',
      handler: 'sync.pull',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/sync/push',
      handler: 'sync.push',
      config: {
        auth: false,
      },
    },
  ],
};
