const nodemailer = require('nodemailer');
const logger = require('./logger');

// Create transporter only if email credentials are available
let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
  try {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  } catch (error) {
    logger.error('Failed to create email transporter:', error);
  }
} else {
  logger.warn('Email credentials not configured. Email functionality will be disabled.');
}

// Send reminder email. `customMessage` (optional) is included when an admin
// sends a manual reminder from the Reminders page.
const sendReminderEmail = async (to, countyName, taskName, deadline, customMessage = '') => {
  if (!transporter) {
    logger.warn('Email transporter not available. Skipping email send.');
    return { success: false, message: 'Email not configured' };
  }

  const messageBlockHtml = customMessage
    ? `<div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 14px 16px; border-radius: 6px; margin: 20px 0;">
         <p style="margin: 0; color: #1e3a8a; font-size: 14px; white-space: pre-wrap;">${customMessage}</p>
       </div>`
    : '';
  const messageBlockText = customMessage ? `\nMessage: ${customMessage}\n` : '';

  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: `${countyName} Task Reminder`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">Task Reminder</h2>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong style="color: #374151;">Task Name:</strong> <span style="color: #111827;">${taskName}</span></p>
            <p style="margin: 10px 0;"><strong style="color: #374151;">Deadline:</strong> <span style="color: #111827;">${new Date(deadline).toLocaleString()}</span></p>
            <p style="margin: 10px 0;"><strong style="color: #374151;">County:</strong> <span style="color: #111827;">${countyName}</span></p>
          </div>
          ${messageBlockHtml}
          <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">This is a reminder from CiviSight - Association of County Commissioners of Georgia.</p>
        </div>
      `,
      text: `Task Reminder\n\nTask Name: ${taskName}\nDeadline: ${new Date(deadline).toLocaleString()}\nCounty: ${countyName}\n${messageBlockText}\nThis is a reminder from CiviSight.`
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('Reminder email sent successfully:', { messageId: info.messageId, to });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Error sending reminder email:', { error, to, countyName, taskName });
    throw error;
  }
};

// Send task assignment email
const sendTaskAssignmentEmail = async (to, countyName, taskName, deadline, assignedBy) => {
  if (!transporter) {
    logger.warn('Email transporter not available. Skipping email send.');
    return { success: false, message: 'Email not configured' };
  }
  
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: `New Task Assigned: ${taskName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">New Task Assigned</h2>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong style="color: #374151;">Task Name:</strong> <span style="color: #111827;">${taskName}</span></p>
            <p style="margin: 10px 0;"><strong style="color: #374151;">County:</strong> <span style="color: #111827;">${countyName}</span></p>
            <p style="margin: 10px 0;"><strong style="color: #374151;">Deadline:</strong> <span style="color: #111827;">${new Date(deadline).toLocaleString()}</span></p>
            <p style="margin: 10px 0;"><strong style="color: #374151;">Assigned By:</strong> <span style="color: #111827;">${assignedBy}</span></p>
          </div>
          <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">Please log in to CiviSight to view task details and download required forms.</p>
        </div>
      `,
      text: `New Task Assigned\n\nTask Name: ${taskName}\nCounty: ${countyName}\nDeadline: ${new Date(deadline).toLocaleString()}\nAssigned By: ${assignedBy}\n\nPlease log in to CiviSight to view task details.`
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('Task assignment email sent successfully:', { messageId: info.messageId, to, taskName });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Error sending task assignment email:', { error, to, countyName, taskName });
    throw error;
  }
};

// Send form upload notification email
const sendFormUploadEmail = async (to, countyName, taskName, formName) => {
  if (!transporter) {
    logger.warn('Email transporter not available. Skipping email send.');
    return { success: false, message: 'Email not configured' };
  }
  
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: `Form Available: ${taskName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">Form Available for Download</h2>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong style="color: #374151;">Task Name:</strong> <span style="color: #111827;">${taskName}</span></p>
            <p style="margin: 10px 0;"><strong style="color: #374151;">County:</strong> <span style="color: #111827;">${countyName}</span></p>
            <p style="margin: 10px 0;"><strong style="color: #374151;">Form:</strong> <span style="color: #111827;">${formName}</span></p>
          </div>
          <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">Please log in to CiviSight to download the form and submit your completed version.</p>
        </div>
      `,
      text: `Form Available for Download\n\nTask Name: ${taskName}\nCounty: ${countyName}\nForm: ${formName}\n\nPlease log in to CiviSight to download the form.`
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('Form upload notification email sent successfully:', { messageId: info.messageId, to, formName });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Error sending form upload email:', { error, to, countyName, taskName, formName });
    throw error;
  }
};

// Send a support ticket email (raised from the chatbot)
const sendTicketEmail = async (to, subject, details, raisedBy = {}) => {
  if (!transporter) {
    logger.warn('Email transporter not available. Skipping ticket email.');
    return { success: false, message: 'Email not configured' };
  }

  const who = [
    raisedBy.name ? `Name: ${raisedBy.name}` : null,
    raisedBy.email ? `Email: ${raisedBy.email}` : null,
    raisedBy.role ? `Role: ${raisedBy.role}` : null,
    raisedBy.countyId ? `County ID: ${raisedBy.countyId}` : null
  ].filter(Boolean);

  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject: `New Support Ticket: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">New Support Ticket</h2>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong style="color: #374151;">Subject:</strong> <span style="color: #111827;">${subject}</span></p>
            <p style="margin: 10px 0;"><strong style="color: #374151;">Details:</strong></p>
            <p style="margin: 6px 0; color: #111827; white-space: pre-wrap;">${details}</p>
          </div>
          ${who.length ? `<p style="color:#6b7280; font-size:14px;"><strong>Raised by</strong><br>${who.join('<br>')}</p>` : ''}
          <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">Raised via the CiviSight chat assistant.</p>
        </div>
      `,
      text: `New Support Ticket\n\nSubject: ${subject}\n\nDetails:\n${details}\n\n${who.join('\n')}\n\nRaised via the CiviSight chat assistant.`
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('Ticket email sent successfully:', { messageId: info.messageId, to, subject });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Error sending ticket email:', { error, to, subject });
    throw error;
  }
};

module.exports = {
  sendReminderEmail,
  sendTaskAssignmentEmail,
  sendFormUploadEmail,
  sendTicketEmail
};

