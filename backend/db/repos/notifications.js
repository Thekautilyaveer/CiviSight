// Notification repository (Supabase Postgres).
const { query } = require('../pool');
const m = require('../mapper');

const COLS = `id,user_id,type,title,message,task_id,read,created_at,updated_at`;

async function create({ userId, type, title, message, taskId = null }) {
  const id = m.newId();
  const { rows } = await query(
    `insert into notifications (id,user_id,type,title,message,task_id)
     values ($1,$2,$3,$4,$5,$6) returning ${COLS}`,
    [id, userId, type, title, message, taskId || null]
  );
  return m.notification(rows[0]);
}

// GET /notifications — user's notifications, taskId populated {_id,title,deadline,status},
// sorted createdAt desc, limit 50.
async function findForUser(userId) {
  const { rows } = await query(
    `select n.id,n.user_id,n.type,n.title,n.message,n.task_id,n.read,n.created_at,n.updated_at,
            t.id as t_id, t.title as t_title, t.deadline as t_deadline, t.status as t_status
       from notifications n
       left join tasks t on t.id = n.task_id
      where n.user_id = $1
      order by n.created_at desc
      limit 50`,
    [userId]
  );
  return rows.map((r) =>
    m.notification(r, {
      populatedTask: r.task_id
        ? { id: r.t_id, title: r.t_title, deadline: r.t_deadline, status: r.t_status }
        : null,
    })
  );
}

// Raw fetch for ownership check (returns shaped, unpopulated taskId).
async function findById(id) {
  const { rows } = await query(`select ${COLS} from notifications where id = $1`, [id]);
  return rows[0] ? m.notification(rows[0]) : null;
}

async function markRead(id) {
  const { rows } = await query(
    `update notifications set read = true where id = $1 returning ${COLS}`,
    [id]
  );
  return rows[0] ? m.notification(rows[0]) : null;
}

async function markAllRead(userId) {
  await query(`update notifications set read = true where user_id = $1 and read = false`, [userId]);
}

async function deleteByTaskId(taskId) {
  await query(`delete from notifications where task_id = $1`, [taskId]);
}

module.exports = {
  create,
  findForUser,
  findById,
  markRead,
  markAllRead,
  deleteByTaskId,
};
