export default {
  routes: [
    {
      method: 'POST',
      path: '/rfid-allowlist/bulk-upload',
      handler: 'allowed-rfid.bulkUpload',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
