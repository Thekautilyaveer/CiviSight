const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Task = require('./models/Task');
const Submission = require('./models/Submission');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/civisight';
const RLGF_RE = /\brlgf\b|report of local government financ/i;

async function run() {
  await mongoose.connect(MONGODB_URI);

  const rlgfTasks = await Task.find({ title: RLGF_RE });
  let reset = 0;
  let keptSubmitted = 0;

  for (const task of rlgfTasks) {
    const actualSubmission = await Submission.exists({ taskId: task._id });
    if (actualSubmission) {
      keptSubmitted += 1;
      continue;
    }

    if (task.status === 'completed' || task.completedAt) {
      task.status = 'pending';
      task.completedAt = undefined;
      await task.save();
      reset += 1;
    }
  }

  console.log(`RLGF cleanup complete. Reset ${reset} fake completions; kept ${keptSubmitted} tasks with actual submissions.`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
