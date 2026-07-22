import { Request, Response } from 'express';
import { getSheetsConfig, getLocalSheetData, appendRegistrationToSheet } from '../services/googleSheetsService.js';
import { INITIAL_EVENTS, REGISTRATIONS_STORE, getNextTicketId } from '../data/eventsData.js';
import { sendBulkEventEmails } from '../services/emailService.js';
import { getSessionUser } from './authController.js';
import { RegistrationRecord } from '../types/index.js';

export function renderSheetsAdminPage(req: Request, res: Response) {
  const lang = req.cookies?.sp_lang || 'en';
  const i18n = (res as any).locals.i18n;
  const currentUser = getSessionUser(req);
  const config = getSheetsConfig();
  const localData = getLocalSheetData();
  const msg = req.query.msg as string | undefined;

  return res.render('admin-sheets', {
    i18n,
    lang,
    currentUser,
    config,
    localData,
    events: INITIAL_EVENTS,
    allRegistrations: REGISTRATIONS_STORE,
    msg,
  });
}

export async function handleApproveRegistration(req: Request, res: Response) {
  const { ticketId } = req.params;
  const registration = REGISTRATIONS_STORE.find((r) => r.id === ticketId);

  if (!registration) {
    return res.redirect(`/admin/sheets?msg=${encodeURIComponent('Registration not found')}`);
  }

  // Update Status to Confirmed
  registration.status = 'Confirmed';
  registration.paymentStatus = 'Completed';

  const event = INITIAL_EVENTS.find((e) => e.id === registration.eventId);
  if (event) {
    event.currentRegistrations = Math.min(event.capacity, event.currentRegistrations + 1);
    
    // Attempt updating sheet
    await appendRegistrationToSheet(event.sheetTabName, {
      ...registration,
      status: 'Confirmed',
    });
  }

  console.log(`[Admin Approval] Approved registration ${ticketId} for ${registration.fullName}. Status is now Confirmed.`);

  return res.redirect(`/admin/sheets?msg=${encodeURIComponent(`✓ Registration ${ticketId} for ${registration.fullName} approved successfully! Ticket pass unlocked.`)}`);
}

export async function handleSendBulkEmail(req: Request, res: Response) {
  const { eventId, subject, customInstructions } = req.body;

  const result = await sendBulkEventEmails({
    eventId: eventId || 'ALL',
    subject: subject || "Survivor's Path Official Event Ticket & Updates",
    customInstructions: customInstructions || "Dear {NAME},\n\nWe are pleased to confirm your participation in {EVENT}.\n\nYour official ticket pass ID is {TICKET_ID}. Please find your PDF Ticket attached.",
  });

  console.log(`[Bulk Email Controller] Result: ${result.message}`);

  return res.redirect(`/admin/sheets?msg=${encodeURIComponent(result.message)}`);
}

export async function handleTestAppend(req: Request, res: Response) {
  const { eventId } = req.body;
  const event = INITIAL_EVENTS.find((e) => e.id === eventId) || INITIAL_EVENTS[0];

  const testRecord: RegistrationRecord = {
    id: getNextTicketId(),
    eventId: event.id,
    eventTitle: event.titleEn,
    fullName: 'Test Service Account Registrant',
    email: 'test.sheet.sync@survivorspath.org',
    phone: '+880 1900-112233',
    organization: "Survivor's Path QA Lab",
    youthGroup: 'Tech & Data Wing',
    age: 22,
    emergencyContact: '+880 1700-000000',
    status: 'Confirmed',
    registeredAt: new Date().toISOString(),
    qrPayload: 'TEST_SHEET_APPEND_PAYLOAD',
    syncedToGoogleSheets: true,
  };

  const result = await appendRegistrationToSheet(event.sheetTabName, testRecord);
  return res.redirect(`/admin/sheets?msg=${encodeURIComponent(result.message)}`);
}
