import express from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';

// Controllers
import {
  renderHomePage,
  renderEventsPage,
  renderEventDetailsPage,
  renderRegisterPage,
  handleRegistrationSubmit,
  renderTicketPage,
  downloadTicketPdf,
  renderMyTicketsPage,
} from './src/controllers/eventController.js';

import {
  renderLoginPage,
  renderSignupPage,
  handleLogin,
  handleSignup,
  renderProfilePage,
  handleProfileUpdate,
  handleLogout,
  requireAuth,
  getSessionUser,
} from './src/controllers/authController.js';

import {
  renderSheetsAdminPage,
  handleTestAppend,
  handleApproveRegistration,
  handleSendBulkEmail,
} from './src/controllers/sheetsController.js';

import {
  renderScannerPage,
  handleVerifyTicket,
} from './src/controllers/scannerController.js';

import {
  renderFaqPage,
  renderSupportPage,
  handleSupportSubmit,
} from './src/controllers/supportController.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body and Cookie parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Static files serving from /public
  app.use(express.static(path.join(process.cwd(), 'public')));

  // EJS View Engine Setup
  app.set('view engine', 'ejs');
  app.set('views', path.join(process.cwd(), 'src', 'views'));

  // Load i18n Translation Dictionaries
  const enDict = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'src', 'i18n', 'en.json'), 'utf-8')
  );
  const bnDict = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'src', 'i18n', 'bn.json'), 'utf-8')
  );

  // i18n Middleware
  app.use((req, res, next) => {
    const lang = req.cookies?.sp_lang === 'bn' ? 'bn' : 'en';
    res.locals.lang = lang;
    res.locals.i18n = lang === 'bn' ? bnDict : enDict;
    res.locals.currentUrl = req.originalUrl;
    res.locals.currentUser = getSessionUser(req);
    next();
  });

  // Language Toggle Switch Route
  app.get('/set-lang', (req, res) => {
    const newLang = req.query.lang === 'bn' ? 'bn' : 'en';
    res.cookie('sp_lang', newLang, { maxAge: 365 * 24 * 60 * 60 * 1000 });
    const redirectTarget = (req.query.redirect as string) || req.get('Referrer') || '/';
    return res.redirect(redirectTarget);
  });

  // Application Routes

  // Home & Events Catalog
  app.get('/', renderHomePage);
  app.get('/events', renderEventsPage);

  // Individual Event Overview
  app.get('/events/:slug', renderEventDetailsPage);

  // Frictionless Auth Event Registration (Redirects to login if not authenticated)
  app.get('/events/:slug/register', requireAuth, renderRegisterPage);
  app.post('/events/:slug/register', requireAuth, handleRegistrationSubmit);

  // Digital Ticket Pass & Downloadable PDF Pass
  app.get('/tickets/:ticketId', renderTicketPage);
  app.get('/api/tickets/:ticketId/pdf', downloadTicketPdf);

  // User's Digital Ticket Wallet
  app.get('/my-tickets', requireAuth, renderMyTicketsPage);

  // User Auth & Sign Up / Login Routes
  app.get('/login', renderLoginPage);
  app.post('/login', handleLogin);
  app.get('/signup', renderSignupPage);
  app.post('/signup', handleSignup);
  app.get('/logout', handleLogout);

  // User Profile Dashboard Route
  app.get('/profile', requireAuth, renderProfilePage);
  app.post('/profile/update', requireAuth, handleProfileUpdate);

  // Google Sheets Admin Hub & Registration Approvals
  app.get('/admin/sheets', renderSheetsAdminPage);
  app.post('/admin/sheets/test-append', handleTestAppend);
  app.post('/admin/registrations/:ticketId/approve', handleApproveRegistration);
  app.post('/admin/send-bulk-email', handleSendBulkEmail);

  // QR Verification Gate Scanner
  app.get('/scanner', renderScannerPage);
  app.post('/api/verify-ticket', handleVerifyTicket);

  // FAQ & Support Hub
  app.get('/faq', renderFaqPage);
  app.get('/support', renderSupportPage);
  app.post('/submit-support', handleSupportSubmit);
  app.post('/support', handleSupportSubmit);

  // Vite Middleware for Development / Static serving in Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
  }

  // 404 Fallback Route
  app.use((req, res) => {
    res.status(404).render('404', { message: 'Page or Route Not Found' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Survivor's Path Platform] Express Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Startup Error]', err);
});
