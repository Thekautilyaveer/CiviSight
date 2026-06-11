const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { interpretMessage } = require('../utils/gemini');
const { sendTicketEmail } = require('../utils/email');
const logger = require('../utils/logger');

// Where support tickets raised from the chat are emailed.
const TICKET_EMAIL = 'kautilyaveer24@gmail.com';

// @route   POST /api/chatbot/message
// @desc    Interpret a chat message with Gemini; raise a ticket (email) if requested
// @access  Private
router.post('/message', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    let result;
    try {
      result = await interpretMessage(message.trim());
    } catch (err) {
      logger.error('Chatbot interpret error:', err.message);
      return res.json({
        reply: "I'm having trouble processing that right now. Please try again in a moment.",
        ticketRaised: false
      });
    }

    let ticketRaised = false;
    if (result.isTicket) {
      const raisedBy = {
        name: req.user.username,
        email: req.user.email,
        role: req.user.role,
        countyId: req.user.countyId
      };
      try {
        await sendTicketEmail(
          TICKET_EMAIL,
          result.subject,
          `${result.details}\n\nOriginal message: "${message.trim()}"`,
          raisedBy
        );
        ticketRaised = true;
        logger.info(`Support ticket raised via chat by ${req.user.username}: ${result.subject}`);
      } catch (emailErr) {
        logger.error('Failed to send ticket email:', emailErr.message);
        return res.json({
          reply: "I understood you'd like to raise a ticket, but I couldn't send it just now. Please try again shortly.",
          ticketRaised: false
        });
      }
    }

    res.json({ reply: result.reply, ticketRaised });
  } catch (error) {
    logger.error('Chatbot route error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
