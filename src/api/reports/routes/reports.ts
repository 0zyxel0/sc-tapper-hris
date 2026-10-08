export default {
  routes: [
    {
      method: 'GET',
      path: '/reports/attendance/daily',
      handler: 'reports.daily',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/reports/attendance/monthly',
      handler: 'reports.monthly',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/reports/attendance/employee/:id',
      handler: 'reports.employee',
      config: {
        policies: [],
        middlewares: [],
      },
    }
  ],
};