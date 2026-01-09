const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const County = require('./models/County');
const Task = require('./models/Task');
const Contact = require('./models/Contact');
const logger = require('./utils/logger');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/civisight';

const counties = [
  { name: 'Fulton County', code: 'FULTON', description: 'Largest county in Georgia', email: 'fulton@civisight.org' },
  { name: 'Gwinnett County', code: 'GWINNETT', description: 'Second most populous county', email: 'gwinnett@civisight.org' },
  { name: 'Cobb County', code: 'COBB', description: 'Third most populous county', email: 'cobb@civisight.org' },
  { name: 'DeKalb County', code: 'DEKALB', description: 'Fourth most populous county', email: 'dekalb@civisight.org' },
  { name: 'Clayton County', code: 'CLAYTON', description: 'Fifth most populous county', email: 'clayton@civisight.org' },
  { name: 'Chatham County', code: 'CHATHAM', description: 'Coastal county including Savannah', email: 'chatham@civisight.org' },
  { name: 'Richmond County', code: 'RICHMOND', description: 'Includes Augusta', email: 'richmond@civisight.org' },
  { name: 'Muscogee County', code: 'MUSCOGEE', description: 'Includes Columbus', email: 'muscogee@civisight.org' },
  { name: 'Bibb County', code: 'BIBB', description: 'Includes Macon', email: 'bibb@civisight.org' },
  { name: 'Hall County', code: 'HALL', description: 'Includes Gainesville', email: 'hall@civisight.org' },
  { name: 'Forsyth County', code: 'FORSYTH', description: 'Fast-growing suburban county', email: 'forsyth@civisight.org' },
  { name: 'Cherokee County', code: 'CHEROKEE', description: 'North Georgia county', email: 'cherokee@civisight.org' },
  { name: 'Henry County', code: 'HENRY', description: 'South metro Atlanta county', email: 'henry@civisight.org' },
  { name: 'Paulding County', code: 'PAULDING', description: 'West metro Atlanta county', email: 'paulding@civisight.org' },
  { name: 'Douglas County', code: 'DOUGLAS', description: 'West metro Atlanta county', email: 'douglas@civisight.org' },
  { name: 'Fayette County', code: 'FAYETTE', description: 'South metro Atlanta county', email: 'fayette@civisight.org' },
  { name: 'Coweta County', code: 'COWETA', description: 'Southwest Georgia county', email: 'coweta@civisight.org' },
  { name: 'Carroll County', code: 'CARROLL', description: 'West Georgia county', email: 'carroll@civisight.org' },
  { name: 'Newton County', code: 'NEWTON', description: 'East metro Atlanta county', email: 'newton@civisight.org' },
  { name: 'Bartow County', code: 'BARTOW', description: 'Northwest Georgia county', email: 'bartow@civisight.org' }
];

const seedData = async () => {
  try {
    await mongoose.connect(MONGODB_URI);

    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await County.deleteMany({});
    await Task.deleteMany({});
    await Contact.deleteMany({});

    console.log('Cleared existing data');

    // Create counties
    const createdCounties = await County.insertMany(counties);
    console.log(`Created ${createdCounties.length} counties`);

    // Create admin user
    const admin = new User({
      username: 'admin',
      email: 'admin@civisight.org',
      password: 'admin123',
      role: 'admin'
    });
    await admin.save();
    console.log('Created admin user (email: admin@civisight.org, password: admin123)');

    // Create a county user for each county
// Create a county user for each county
    const countyUsers = [];
    for (const county of createdCounties) {
      const countyName = county.name.toLowerCase().replace(/\s+/g, '');
      const countyUser = new User({
        username: `${countyName}_user`,
        email: `${countyName}@civisight.org`,
        password: 'county123',
        role: 'county_user',
        countyId: county._id
      });
      await countyUser.save();
      countyUsers.push(countyUser);
    }

    console.log(`Created ${countyUsers.length} county users`);
    console.log('\nCounty user credentials:');
    countyUsers.forEach(user => {
      console.log(`  ${user.email} / county123 (${user.username})`);
    });

    // Task templates with different priorities and statuses
    const taskTemplates = [
      {
        title: 'Annual Budget Review',
        description: 'Review and approve the annual budget for the upcoming fiscal year. Includes department allocations and capital expenditures.',
        priority: 'high',
        status: 'pending',
        daysOffset: 3 // Due in 3 days (urgent)
      },
      {
        title: 'Infrastructure Assessment Report',
        description: 'Complete comprehensive assessment of county infrastructure needs including roads, bridges, and public facilities.',
        priority: 'high',
        status: 'in_progress',
        daysOffset: 7 // Due in 7 days
      },
      {
        title: 'Public Safety Quarterly Report',
        description: 'Submit quarterly public safety report covering crime statistics, response times, and department activities.',
        priority: 'medium',
        status: 'pending',
        daysOffset: 14 // Due in 14 days
      },
      {
        title: 'Zoning Ordinance Update',
        description: 'Review and update zoning ordinances to reflect current development patterns and community needs.',
        priority: 'medium',
        status: 'completed',
        daysOffset: -10 // Completed 10 days ago
      },
      {
        title: 'Environmental Compliance Audit',
        description: 'Conduct annual environmental compliance audit to ensure adherence to state and federal regulations.',
        priority: 'low',
        status: 'pending',
        daysOffset: 30 // Due in 30 days
      },
      {
        title: 'Emergency Preparedness Plan',
        description: 'Update emergency preparedness plan including evacuation routes, shelter locations, and communication protocols.',
        priority: 'high',
        status: 'in_progress',
        daysOffset: 5 // Due in 5 days
      },
      {
        title: 'Property Tax Assessment Review',
        description: 'Review property tax assessments and ensure accuracy of valuations for upcoming tax year.',
        priority: 'medium',
        status: 'in_progress',
        daysOffset: 21 // Due in 21 days
      },
      {
        title: 'Community Development Grant Application',
        description: 'Prepare and submit application for state community development grant funding.',
        priority: 'low',
        status: 'completed',
        daysOffset: -5 // Completed 5 days ago
      },
      {
        title: 'Water Quality Testing Report',
        description: 'Complete quarterly water quality testing and submit results to state environmental agency.',
        priority: 'medium',
        status: 'pending',
        daysOffset: 18 // Due in 18 days
      },
      {
        title: 'Employee Training Program',
        description: 'Organize and conduct mandatory employee training program on workplace safety and compliance.',
        priority: 'low',
        status: 'completed',
        daysOffset: -15 // Completed 15 days ago
      }
    ];

    // Create 5 tasks for each county with varied priorities and statuses
    const allTasks = [];
    const now = Date.now();
    
    for (let i = 0; i < createdCounties.length; i++) {
      const county = createdCounties[i];
      
      // Ensure each county has at least one task of each priority and status
      // Task 1: High priority, pending
      allTasks.push({
        title: `${county.name} - ${taskTemplates[0].title}`,
        description: taskTemplates[0].description,
        countyId: county._id,
        priority: 'high',
        status: 'pending',
        deadline: new Date(now + taskTemplates[0].daysOffset * 24 * 60 * 60 * 1000),
        assignedBy: admin._id
      });

      // Task 2: High priority, in_progress
      allTasks.push({
        title: `${county.name} - ${taskTemplates[1].title}`,
        description: taskTemplates[1].description,
        countyId: county._id,
        priority: 'high',
        status: 'in_progress',
        deadline: new Date(now + taskTemplates[1].daysOffset * 24 * 60 * 60 * 1000),
        assignedBy: admin._id
      });

      // Task 3: Medium priority, pending
      allTasks.push({
        title: `${county.name} - ${taskTemplates[2].title}`,
        description: taskTemplates[2].description,
        countyId: county._id,
        priority: 'medium',
        status: 'pending',
        deadline: new Date(now + taskTemplates[2].daysOffset * 24 * 60 * 60 * 1000),
        assignedBy: admin._id
      });

      // Task 4: Medium priority, completed
      allTasks.push({
        title: `${county.name} - ${taskTemplates[3].title}`,
        description: taskTemplates[3].description,
        countyId: county._id,
        priority: 'medium',
        status: 'completed',
        deadline: new Date(now + taskTemplates[3].daysOffset * 24 * 60 * 60 * 1000),
        completedAt: new Date(now + taskTemplates[3].daysOffset * 24 * 60 * 60 * 1000),
        assignedBy: admin._id
      });

      // Task 5: Low priority, pending (or vary based on county index)
      const task5Index = (i % 3) + 4; // Cycle through different templates
      allTasks.push({
        title: `${county.name} - ${taskTemplates[task5Index].title}`,
        description: taskTemplates[task5Index].description,
        countyId: county._id,
        priority: taskTemplates[task5Index].priority,
        status: taskTemplates[task5Index].status,
        deadline: new Date(now + taskTemplates[task5Index].daysOffset * 24 * 60 * 60 * 1000),
        completedAt: taskTemplates[task5Index].status === 'completed' 
          ? new Date(now + taskTemplates[task5Index].daysOffset * 24 * 60 * 60 * 1000)
          : undefined,
        assignedBy: admin._id
      });
    }

    await Task.insertMany(allTasks);
    console.log(`Created ${allTasks.length} tasks (5 tasks per county)`);
    
    // Summary by priority and status
    const priorityCount = { high: 0, medium: 0, low: 0 };
    const statusCount = { pending: 0, in_progress: 0, completed: 0 };
    allTasks.forEach(task => {
      priorityCount[task.priority]++;
      statusCount[task.status]++;
    });
    
    console.log('\nTask Summary:');
    console.log(`  By Priority: High: ${priorityCount.high}, Medium: ${priorityCount.medium}, Low: ${priorityCount.low}`);
    console.log(`  By Status: Pending: ${statusCount.pending}, In Progress: ${statusCount.in_progress}, Completed: ${statusCount.completed}`);

    // Create dummy contacts for Bartow County
    const bartowCounty = createdCounties.find(c => c.code === 'BARTOW');
    if (bartowCounty) {
      const bartowContacts = new Contact({
        countyId: bartowCounty._id,
        contacts: [
          {
            role: 'County Administrator',
            name: 'John Smith',
            email: 'john.smith@bartowcounty.gov',
            phone: '(770) 387-5000'
          },
          {
            role: 'County Clerk',
            name: 'Sarah Johnson',
            email: 'sarah.johnson@bartowcounty.gov',
            phone: '(770) 387-5001'
          },
          {
            role: 'Finance Director',
            name: 'Michael Davis',
            email: 'michael.davis@bartowcounty.gov',
            phone: '(770) 387-5002'
          },
          {
            role: 'Public Works Director',
            name: 'Emily Wilson',
            email: 'emily.wilson@bartowcounty.gov',
            phone: '(770) 387-5003'
          },
          {
            role: 'Emergency Management Director',
            name: 'Robert Brown',
            email: 'robert.brown@bartowcounty.gov',
            phone: '(770) 387-5004'
          }
        ]
      });
      await bartowContacts.save();
      console.log(`\nCreated ${bartowContacts.contacts.length} contacts for Bartow County`);
    }

    console.log('Seed data created successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding data:', error);
    console.error('Error seeding data:', error.message);
    process.exit(1);
  }
};

seedData();

