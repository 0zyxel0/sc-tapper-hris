export default {
  routes: [
    {
      method: 'POST',
      path: '/employees/import',
      handler: 'import.importEmployees',
      config: {
        auth: false, // Set to true with proper policies in production
      },
    },
  ],
};