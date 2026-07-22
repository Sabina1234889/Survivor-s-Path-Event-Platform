import { Request, Response } from 'express';
import { INITIAL_EVENTS, REGISTRATIONS_STORE, getNextTicketId } from '../data/eventsData.js';
import { appendRegistrationToSheet } from '../services/googleSheetsService.js';
import { saveRegistrationToFirestore } from '../services/firebaseService.js';
import { generateTicketPdfBuffer } from '../services/pdfTicketService.js';
import { getSessionUser } from './authController.js';
import { RegistrationRecord } from '../types/index.js';

export function getAllEvents() {
  return INITIAL_EVENTS;
}

export function getEventByIdOrSlug(identifier: string) {
  return INITIAL_EVENTS.find((e) => e.id === identifier || e.slug === identifier);
}

export function renderHomePage(req: Request, res: Response) {
  const lang = req.cookies?.sp_lang || 'en';
  const i18n = (res as any).locals.i18n;
  const currentUser = getSessionUser(req);
  const events = getAllEvents();

  return res.render('index', {
    i18n,
    lang,
    currentUser,
    events,
    myTicketsCount: REGISTRATIONS_STORE.filter((r) => r.email === currentUser?.email).length,
  });
}

export function renderEventsPage(req: Request, res: Response) {
  const lang = req.cookies?.sp_lang || 'en';
  const i18n = (res as any).locals.i18n;
  const currentUser = getSessionUser(req);
  const events = getAllEvents();

  return res.render('events', {
    i18n,
    lang,
    currentUser,
    events,
    myTicketsCount: REGISTRATIONS_STORE.filter((r) => r.email === currentUser?.email).length,
  });
}

export function renderEventDetailsPage(req: Request, res: Response) {
  const { slug } = req.params;
  const event = getEventByIdOrSlug(slug);
  if (!event) {
    return res.status(404).render('404', { message: 'Event not found' });
  }

  const lang = req.cookies?.sp_lang || 'en';
  const i18n = (res as any).locals.i18n;
  const currentUser = getSessionUser(req);

  const spotsLeft = Math.max(0, event.capacity - event.currentRegistrations);
  const isFull = spotsLeft === 0;

  return res.render('event-details', {
    i18n,
    lang,
    currentUser,
    event,
    spotsLeft,
    isFull,
  });
}

export function renderRegisterPage(req: Request, res: Response) {
  const { slug } = req.params;
  const event = getEventByIdOrSlug(slug);
  if (!event) {
    return res.status(404).render('404', { message: 'Event not found' });
  }

  const lang = req.cookies?.sp_lang || 'en';
  const i18n = (res as any).locals.i18n;
  const currentUser = getSessionUser(req);

  const spotsLeft = Math.max(0, event.capacity - event.currentRegistrations);
  const isWaitlist = spotsLeft === 0;

  return res.render('register', {
    i18n,
    lang,
    currentUser,
    event,
    spotsLeft,
    isWaitlist,
  });
}

export async function handleRegistrationSubmit(req: Request, res: Response) {
  const { slug } = req.params;
  const event = getEventByIdOrSlug(slug);
  if (!event) {
    return res.status(404).send('Event not found');
  }

  const currentUser = getSessionUser(req);
  const fullName = req.body.fullName || currentUser?.name || 'Youth Delegate';
  const email = req.body.email || currentUser?.email || 'delegate@survivorspath.org';
  const phone = req.body.phone || '+880 1712-345678';
  const organization = req.body.organization || 'Youth Organization';
  const youthGroup = req.body.youthGroup || 'Central District Chapter';
  const age = Number(req.body.age) || 20;
  const emergencyContact = req.body.emergencyContact || '+880 1819-000000';
  const transactionId = (req.body.transactionId || '').trim();
  const paymentMethod = req.body.paymentMethod || 'bKash';

  // Capacity & Waitlist Logic
  const isFull = event.currentRegistrations >= event.capacity;
  
  let status: 'Confirmed' | 'Pending' | 'Waitlist' = 'Confirmed';
  let paymentStatus: 'Completed' | 'Pending Verification' | 'N/A' = 'N/A';

  if (isFull) {
    status = 'Waitlist';
    paymentStatus = event.isPaid ? 'Pending Verification' : 'N/A';
  } else if (event.isPaid) {
    // Paid events require Admin approval -> Status is set to 'Pending'
    status = 'Pending';
    paymentStatus = 'Pending Verification';
  } else {
    // Free events -> Status is automatically set to 'Confirmed'
    status = 'Confirmed';
    paymentStatus = 'Completed';
    event.currentRegistrations += 1;
  }

  const ticketId = getNextTicketId();
  const registeredAt = new Date().toISOString();

  const qrPayload = JSON.stringify({
    ticketId,
    eventId: event.id,
    eventTitle: event.titleEn,
    fullName,
    email,
    status,
    registeredAt,
    verificationCode: `SP-VERIFY-${Date.now()}`,
  });

  const registrationRecord: RegistrationRecord = {
    id: ticketId,
    eventId: event.id,
    eventTitle: event.titleEn,
    fullName,
    email,
    phone,
    organization,
    youthGroup,
    age,
    emergencyContact,
    status,
    registeredAt,
    qrPayload,
    syncedToGoogleSheets: false,
    isPaidEvent: Boolean(event.isPaid),
    paymentAmount: event.price || 0,
    transactionId: transactionId || undefined,
    paymentMethod,
    paymentStatus,
  };

  // Google Sheets Integration: Append to event-specific sheet tab name
  const sheetSyncResult = await appendRegistrationToSheet(event.sheetTabName, registrationRecord);
  registrationRecord.syncedToGoogleSheets = sheetSyncResult.success;

  // Firebase Firestore Integration
  const fbSyncResult = await saveRegistrationToFirestore(registrationRecord);

  // Save to persistent memory
  REGISTRATIONS_STORE.push(registrationRecord);

  console.log(`[Event Registration Controller] User ${fullName} (${email}) registered for '${event.titleEn}'. Ticket ID: ${ticketId}. Status: ${status}, Paid: ${event.isPaid}, TxID: ${transactionId}. Google Sheets: ${sheetSyncResult.message}, Firebase: ${fbSyncResult.message}`);

  return res.redirect(`/tickets/${ticketId}?success=1`);
}

export function renderTicketPage(req: Request, res: Response) {
  const { ticketId } = req.params;
  const registration = REGISTRATIONS_STORE.find((r) => r.id === ticketId);

  if (!registration) {
    return res.status(404).render('404', { message: 'Ticket pass not found' });
  }

  const event = INITIAL_EVENTS.find((e) => e.id === registration.eventId);
  const lang = req.cookies?.sp_lang || 'en';
  const i18n = (res as any).locals.i18n;
  const currentUser = getSessionUser(req);

  return res.render('ticket', {
    i18n,
    lang,
    currentUser,
    registration,
    event,
    isJustRegistered: req.query.success === '1',
  });
}

export async function downloadTicketPdf(req: Request, res: Response) {
  const { ticketId } = req.params;
  const registration = REGISTRATIONS_STORE.find((r) => r.id === ticketId);

  if (!registration) {
    return res.status(404).send('Ticket not found');
  }

  const event = INITIAL_EVENTS.find((e) => e.id === registration.eventId) || INITIAL_EVENTS[0];

  try {
    const pdfBuffer = await generateTicketPdfBuffer(registration, event);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SurvivorsPath-Pass-${registration.id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err: any) {
    console.error('Error generating PDF:', err);
    return res.status(500).send('Error generating PDF ticket');
  }
}

export function renderMyTicketsPage(req: Request, res: Response) {
  const currentUser = getSessionUser(req);
  if (!currentUser) {
    return res.redirect('/login?redirect=/my-tickets');
  }

  const userTickets = REGISTRATIONS_STORE.filter((r) => r.email === currentUser.email);

  const lang = req.cookies?.sp_lang || 'en';
  const i18n = (res as any).locals.i18n;

  return res.render('my-tickets', {
    i18n,
    lang,
    currentUser,
    tickets: userTickets,
    events: INITIAL_EVENTS,
  });
}
