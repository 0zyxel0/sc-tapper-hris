export default {
  routes: [
    {
      method: 'POST',
      path: '/notifications/send-overdue-reminders',
      handler: 'notification-log.sendOverdueReminders',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
