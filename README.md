# CiviSight - ACCG Dashboard

A full-stack web application for the Association of County Commissioners of Georgia (ACCG) to manage counties and tasks.

## Features

- **Authentication System**: Login with user roles (admin/county user)
- **Dashboard**: View all counties with task statistics
- **County Management**: View detailed county pages with task lists
- **Task Management**: Create, edit, delete, and track tasks
- **Reminders**: Send mock reminders to counties
- **Search & Filter**: Search counties and tasks by name, status, or deadline
- **Notifications**: View upcoming deadlines and notifications
- **Responsive Design**: Modern, mobile-friendly UI with Tailwind CSS

## Tech Stack

- **Frontend**: React, Tailwind CSS, React Router
- **Backend**: Node.js, Express
- **Database**: MongoDB with Mongoose

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or connection string)

### Installation

1. Install root dependencies:
```bash
npm run install-all
```

2. Set up MongoDB:
   - Make sure MongoDB is running locally, or
   - Update the `MONGODB_URI` in `backend/.env` with your MongoDB connection string

3. Seed the database with sample data:
```bash
cd backend
node seed.js
```

This will create:
- ACCG user: `accg@civisight.org` / `accg123`
- DCA user: `dca@civisight.org` / `dca123`
- County user: `county@civisight.org` / `county123`
- 10 sample counties
- 5 sample tasks

### Running the Application

1. Start both frontend and backend:
```bash
npm run dev
```

Or run them separately:

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm start
```

2. Open your browser and navigate to:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Project Structure

```
civisight/
├── backend/
│   ├── models/          # MongoDB models (User, County, Task, Notification)
│   ├── routes/          # API routes
│   ├── middleware/      # Auth middleware
│   ├── server.js        # Express server
│   └── seed.js          # Database seeder
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── context/     # React context (Auth)
│   │   └── utils/       # Utilities (API client)
│   └── ...
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Counties
- `GET /api/counties` - Get all counties with stats
- `GET /api/counties/:id` - Get single county
- `POST /api/counties` - Create county (admin only)
- `PUT /api/counties/:id` - Update county (admin only)
- `DELETE /api/counties/:id` - Delete county (admin only)

### Tasks
- `GET /api/tasks` - Get all tasks (with filters)
- `GET /api/tasks/:id` - Get single task
- `POST /api/tasks` - Create task (admin only)
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task (admin only)
- `POST /api/tasks/:id/reminder` - Send reminder (admin only)

### Notifications
- `GET /api/notifications` - Get all notifications
- `GET /api/notifications/upcoming` - Get upcoming deadlines
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read

## Default Credentials

- **ACCG**: accg@civisight.org / accg123
- **DCA**: dca@civisight.org / dca123
- **County User**: county@civisight.org / county123

## Environment Variables

Create a `.env` file in the `backend` directory:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/civisight
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
```

## License

ISC

