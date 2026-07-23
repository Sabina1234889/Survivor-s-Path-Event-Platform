import { Request, Response } from 'express';
import { getSheetsConfig, getLocalSheetData, appendRegistrationToSheet } from '../services/googleSheetsService.js';
import { syncEventsToFirestore } from '../services/firebaseService.js';
import { INITIAL_EVENTS, REGISTRATIONS_STORE, USER_ACCOUNTS, getNextTicketId } from '../data/eventsData.js';
import { sendBulkEventEmails } from '../services/emailService.js';
import { getSessionUser } from './authController.js';
import { RegistrationRecord, EventItem } from '../types/index.js';

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
    userAccounts: USER_ACCOUNTS,
    msg,
  });
}

/**
 * Create a New Event with dynamic sub-collection / sheet tab mapping
 */
export async function handleCreateEvent(req: Request, res: Response) {
  try {
    const {
      titleEn,
      titleBn,
      category,
      date,
      time,
      locationEn,
      locationBn,
      capacity,
      price,
      descriptionEn,
      descriptionBn,
      organizer,
    } = req.body;

    if (!titleEn || !date || !locationEn) {
      return res.redirect('/admin/sheets?msg=' + encodeURIComponent('⚠ Title (EN), Date, and Location (EN) are required fields to create an event.'));
    }

    const eventId = `evt-${Date.now()}`;
    const slug = titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `event-${Date.now()}`;
    const numericPrice = Number(price) || 0;
    const isPaid = numericPrice > 0;
    const sheetTabName = `event_registrations_${eventId}`;

    const newEvent: EventItem = {
      id: eventId,
      slug,
      titleEn: titleEn.trim(),
      titleBn: (titleBn || titleEn).trim(),
      descriptionEn: (descriptionEn || 'Official Youth Event').trim(),
      descriptionBn: (descriptionBn || descriptionEn || 'অফিসিয়াল ইভেন্ট').trim(),
      date: date.trim(),
      time: (time || '10:00 AM - 04:00 PM').trim(),
      locationEn: locationEn.trim(),
      locationBn: (locationBn || locationEn).trim(),
      category: category || 'Community',
      capacity: Number(capacity) || 100,
      currentRegistrations: 0,
      sheetTabName,
      imageBg: 'from-cyan-900/80 via-blue-950/90 to-slate-950',
      accentColor: '#06b6d4',
      organizer: (organizer || "Survivor's Path Youth Council").trim(),
      isPaid,
      price: numericPrice,
    };

    INITIAL_EVENTS.push(newEvent);
    await syncEventsToFirestore(INITIAL_EVENTS);

    console.log(`[Event Controller] Created new event '${newEvent.titleEn}' (ID: ${eventId}, Sheet Tab: ${sheetTabName})`);
    return res.redirect(`/admin/sheets?msg=${encodeURIComponent(`✓ New Event '${newEvent.titleEn}' created successfully! Registration sub-collection initialized.`)}`);
  } catch (err: any) {
    console.error('Error in handleCreateEvent:', err);
    return res.redirect('/admin/sheets?msg=' + encodeURIComponent('⚠ Server error creating event.'));
  }
}

/**
 * Export Event Registrations to CSV
 */
export function handleExportEventCSV(req: Request, res: Response) {
  try {
    const { eventId } = req.params;
    const event = INITIAL_EVENTS.find((e) => e.id === eventId);
    const targetRegistrations = eventId === 'ALL'
      ? REGISTRATIONS_STORE
      : REGISTRATIONS_STORE.filter((r) => r.eventId === eventId);

    const headers = ['Ticket ID', 'Event Title', 'Full Name', 'Email', 'Phone', 'Organization', 'Youth Group', 'Age', 'Status', 'Payment Status', 'Transaction ID', 'Registered At'];

    const csvRows = targetRegistrations.map((r) => [
      `"${r.id}"`,
      `"${(r.eventTitle || '').replace(/"/g, '""')}"`,
      `"${(r.fullName || '').replace(/"/g, '""')}"`,
      `"${(r.email || '').replace(/"/g, '""')}"`,
      `"${(r.phone || '').replace(/"/g, '""')}"`,
      `"${(r.organization || '').replace(/"/g, '""')}"`,
      `"${(r.youthGroup || '').replace(/"/g, '""')}"`,
      `"${r.age || ''}"`,
      `"${r.status}"`,
      `"${r.paymentStatus || 'N/A'}"`,
      `"${r.transactionId || ''}"`,
      `"${r.registeredAt}"`,
    ]);

    const csvContent = [headers.join(','), ...csvRows.map((row) => row.join(','))].join('\n');
    const filename = event ? `registrations_${event.slug}.csv` : 'registrations_all_events.csv';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error in handleExportEventCSV:', error);
    return res.status(500).send('Error generating CSV export.');
  }
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
