const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const logger = require('./utils/logger');

dotenv.config();

// Data driver: 'supabase' (default) or 'mongo' (rollback). Selects the backing store.
const DATA_DRIVER = (process.env.DATA_DRIVER || 'supabase').toLowerCase();

// Validate required environment variables (driver-specific connection string included)
const requiredEnvVars = [
  'JWT_SECRET',
  'EMAIL_USER',
  'EMAIL_PASSWORD',
  DATA_DRIVER === 'mongo' ? 'MONGODB_URI' : 'SUPABASE_DB_URL'
];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    logger.error(`ERROR: ${varName} environment variable is required`);
    process.exit(1);
  }
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use('/api/files', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/counties', require('./routes/counties'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/users', require('./routes/users'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/submissions', require('./routes/submissions'));

// Connect to the selected data store
if (DATA_DRIVER === 'mongo') {
  const mongoose = require('mongoose');
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/civisight')
    .then(() => logger.info('Data driver: mongo — MongoDB connected'))
    .catch(err => logger.error('MongoDB connection error:', err));
} else {
  const { getPool } = require('./db/pool');
  getPool().query('select 1')
    .then(() => logger.info('Data driver: supabase — Postgres connected'))
    .catch(err => logger.error('Postgres connection error:', err));
}

const PORT = process.env.PORT || 5001;

// Start automatic reminder scheduler
const { startReminderScheduler } = require('./utils/reminderScheduler');
startReminderScheduler();

// Global error handler - must be after all routes
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
