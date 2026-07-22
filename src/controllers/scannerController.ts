import { Request, Response } from 'express';
import { REGISTRATIONS_STORE, INITIAL_EVENTS } from '../data/eventsData.js';
import { getSessionUser } from './authController.js';

export function renderScannerPage(req: Request, res: Response) {
  const lang = req.cookies?.sp_lang || 'en';
  const i18n = (res as any).locals.i18n;
  const currentUser = getSessionUser(req);

  return res.render('scanner', {
    i18n,
    lang,
    currentUser,
    recentRegistrations: REGISTRATIONS_STORE.slice(-5).reverse(),
  });
}

export function handleVerifyTicket(req: Request, res: Response) {
  const { code } = req.body;
  let searchId = code?.trim();

  // Try parsing JSON if code was scanned from QR payload
  if (code && code.includes('{')) {
    try {
      const parsed = JSON.parse(code);
      if (parsed.ticketId) {
        searchId = parsed.ticketId;
      }
    } catch {
      // Keep as string
    }
  }

  const record = REGISTRATIONS_STORE.find(
    (r) => r.id === searchId || r.qrPayload.includes(searchId)
  );

  if (!record) {
    return res.json({ verified: false, message: 'Invalid or unknown ticket ID.' });
  }

  const event = INITIAL_EVENTS.find((e) => e.id === record.eventId);

  return res.json({
    verified: true,
    record,
    event,
    statusBadge: record.status === 'Registered' ? 'CONFIRMED ATTENDEE' : 'PRIORITY WAITLIST',
  });
}
