const Task = require('../models/Task');
const County = require('../models/County');
const { sendReminderEmail } = require('./email');
const logger = require('./logger');

// Check and send automatic reminders (3 days before deadline)
const checkAndSendReminders = async () => {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Find tasks that are due in 3 days and not completed
    const tasks = await Task.find({
      status: { $ne: 'completed' },
      deadline: {
        $gte: now,
        $lte: threeDaysFromNow
      }
    })
      .populate('countyId', 'name email');

    for (const task of tasks) {
      // Check if reminder was already sent in the last 24 hours
      const recentReminder = task.reminders.find(r => {
        const reminderDate = new Date(r.sentAt);
        const hoursSinceReminder = (now - reminderDate) / (1000 * 60 * 60);
        return hoursSinceReminder < 24;
      });

      if (!recentReminder && task.countyId) {
        // Always send reminder emails to EMAIL_TO, regardless of county email
        const emailTo = process.env.EMAIL_TO || 'thekautilyaveer@gmail.com';
        
        try {
          await sendReminderEmail(
            emailTo,
            task.countyId.name,
            task.title,
            task.deadline
          );

          // Record the reminder
          task.reminders.push({
            sentAt: new Date(),
            sentBy: null // System-generated
          });
          await task.save();

          logger.info(`Automatic reminder sent for task: ${task.title} (${task.countyId.name})`, { taskId: task._id, countyId: task.countyId._id });
        } catch (error) {
          logger.error(`Failed to send automatic reminder for task ${task._id}:`, { error, taskId: task._id });
        }
      }
    }
  } catch (error) {
    logger.error('Error in reminder scheduler:', error);
  }
};

// Run reminder check every hour
const startReminderScheduler = () => {
  // Run immediately on start
  checkAndSendReminders();
  
  // Then run every hour
  setInterval(checkAndSendReminders, 60 * 60 * 1000);
  
  logger.info('Automatic reminder scheduler started (checks every hour)');
};

module.exports = {
  checkAndSendReminders,
  startReminderScheduler
};

