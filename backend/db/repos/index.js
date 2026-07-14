// Barrel for the Supabase Postgres repositories. Routes import these instead of Mongoose
// models when DATA_DRIVER=supabase. Each repo returns Mongoose-shaped JSON (see mapper.js).
module.exports = {
  counties: require('./counties'),
  users: require('./users'),
  tasks: require('./tasks'),
  contacts: require('./contacts'),
  notifications: require('./notifications'),
  submissions: require('./submissions'),
  forms: require('./forms'),
};
