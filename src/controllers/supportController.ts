import { Request, Response } from 'express';
import { appendSupportTicketToSheet } from '../services/googleSheetsService.js';
import { saveSupportTicketToFirestore } from '../services/firebaseService.js';
import { SupportTicketRecord } from '../types/index.js';

/**
 * Render FAQ Page
 */
export function renderFaqPage(req: Request, res: Response) {
  return res.render('faq');
}

/**
 * Render Support Contact Page
 */
export function renderSupportPage(req: Request, res: Response) {
  const isSuccess = req.query.success === 'true';
  return res.render('support', {
    success: isSuccess,
    error: null,
    ticket: null,
  });
}

/**
 * Handle Support Contact Form Submission
 * Route: POST /submit-support (and POST /support)
 * Appends Name, Email, Subject, Message, Current Date into Google Sheet tab "Support_Tickets"
 */
export async function handleSupportSubmit(req: Request, res: Response) {
  try {
    const { fullName, name, email, subject, message } = req.body;
    const clientName = (fullName || name || '').trim();
    const clientEmail = (email || '').trim();
    const clientSubject = (subject || '').trim();
    const clientMessage = (message || '').trim();

    // Validation
    if (!clientName || !clientEmail || !clientSubject || !clientMessage) {
      return res.render('support', {
        success: false,
        error: 'Please fill out all required fields (Name, Email, Subject, and Message).',
        ticket: null,
      });
    }

    // Generate unique Ticket ID
    const ticketId = `TICKET-${Math.floor(1000 + Math.random() * 9000)}`;

    // Current Date / Timestamp
    const currentDate = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const ticket: SupportTicketRecord = {
      id: ticketId,
      fullName: clientName,
      email: clientEmail,
      subject: clientSubject,
      message: clientMessage,
      submittedAt: currentDate,
      status: 'Open',
      syncedToGoogleSheets: true,
    };

    // Append Name, Email, Subject, Message, Current Date into "Support_Tickets" tab & Firebase
    const sheetResult = await appendSupportTicketToSheet(ticket);
    const fbResult = await saveSupportTicketToFirestore(ticket);
    console.log(`[Support Controller] Ticket ${ticketId} appended to Google Sheet 'Support_Tickets' and Firebase. Result: ${sheetResult.message}, ${fbResult.message}`);

    return res.render('support', {
      success: true,
      error: null,
      ticket,
      sheetMessage: sheetResult.message,
    });
  } catch (err: any) {
    console.error('[Support Controller Error]', err);
    return res.render('support', {
      success: false,
      error: 'An unexpected error occurred while processing your request. Please try again.',
      ticket: null,
    });
  }
}
