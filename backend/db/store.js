// Data-store selector. Routes/middleware import `store` and never touch a specific driver.
// DATA_DRIVER=supabase (default) uses the Postgres repos; DATA_DRIVER=mongo uses the
// Mongoose repos (instant rollback). Both expose the same repository interface.
const DATA_DRIVER = (process.env.DATA_DRIVER || 'supabase').toLowerCase();

const store = DATA_DRIVER === 'mongo'
  ? {
      counties: require('./mongo/counties'),
      users: require('./mongo/users'),
      tasks: require('./mongo/tasks'),
      contacts: require('./mongo/contacts'),
      notifications: require('./mongo/notifications'),
      submissions: require('./mongo/submissions'),
      forms: require('./mongo/forms'),
      explorer: require('./mongo/explorer'),
    }
  : {
      counties: require('./repos/counties'),
      users: require('./repos/users'),
      tasks: require('./repos/tasks'),
      contacts: require('./repos/contacts'),
      notifications: require('./repos/notifications'),
      submissions: require('./repos/submissions'),
      forms: require('./repos/forms'),
      explorer: require('./repos/explorer'),
    };

store.driver = DATA_DRIVER;
module.exports = store;
