import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { USER_ACCOUNTS, MOCK_USERS, REGISTRATIONS_STORE, INITIAL_EVENTS } from '../data/eventsData.js';
import { appendUserToSheet, updateUserInSheet } from '../services/googleSheetsService.js';
import { saveUserToFirestore, updateUserInFirestore } from '../services/firebaseService.js';
import { UserSession, UserAccount } from '../types/index.js';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const DEFAULT_ADMIN_EMAIL = 'mdanontosunny1068@gmail.com';

export function getSessionUser(req: Request): UserSession | null {
  const userCookie = req.cookies?.sp_user;
  if (!userCookie) return null;
  try {
    const user: UserSession = JSON.parse(userCookie);
    if (user.email && user.email.toLowerCase() === DEFAULT_ADMIN_EMAIL) {
      user.role = 'admin';
    }
    return user;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getSessionUser(req);
  if (!user) {
    const originalUrl = req.originalUrl || '/events';
    console.log(`[Auth Middleware] Unauthenticated user attempted to access ${originalUrl}. Redirecting to /login?redirect=${encodeURIComponent(originalUrl)}`);
    return res.redirect(`/login?redirect=${encodeURIComponent(originalUrl)}`);
  }
  (req as any).user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = getSessionUser(req);
  if (!user) {
    return res.redirect(`/login?redirect=${encodeURIComponent(req.originalUrl || '/admin/sheets')}`);
  }
  const isDefaultAdmin = user.email.toLowerCase() === DEFAULT_ADMIN_EMAIL;
  if (user.role !== 'admin' && user.role !== 'organizer' && !isDefaultAdmin) {
    console.warn(`[Admin Security] Access denied for non-admin user ${user.email} attempting to reach ${req.originalUrl}`);
    return res.redirect('/events?error=' + encodeURIComponent('Access denied: You need administrator permissions to access the Admin Panel.'));
  }
  (req as any).user = user;
  next();
}

/**
 * Render Login Page
 */
export function renderLoginPage(req: Request, res: Response) {
  const redirectUrl = (req.query.redirect as string) || '/events';
  const error = req.query.error as string | undefined;
  const success = req.query.success as string | undefined;

  return res.render('login', {
    redirectUrl,
    error,
    success,
  });
}

/**
 * Render Signup Page
 */
export function renderSignupPage(req: Request, res: Response) {
  const redirectUrl = (req.query.redirect as string) || '/events';
  const error = req.query.error as string | undefined;

  return res.render('signup', {
    redirectUrl,
    error,
  });
}

/**
 * Handle Login Form Submission
 */
export function handleLogin(req: Request, res: Response) {
  const { email, password, redirect } = req.body;
  const targetRedirect = (redirect || req.query.redirect || '/profile') as string;

  const normalizedEmail = (email || '').trim().toLowerCase();

  // Handle Quick Demo Login / One-Click Sign In
  if (!password && req.body.name) {
    let user = USER_ACCOUNTS.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!user) {
      user = {
        id: `usr-${Date.now()}`,
        name: req.body.name,
        email: normalizedEmail,
        passwordHash: hashPassword('password123'),
        phone: '+880 1712-000000',
        address: 'Dhaka, Bangladesh',
        organization: 'Youth Member',
        role: 'attendee',
        createdAt: new Date().toISOString(),
      };
      USER_ACCOUNTS.push(user);
      appendUserToSheet(user);
      saveUserToFirestore(user);
    } else {
      saveUserToFirestore(user);
    }

    const sessionUser: UserSession = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      address: user.address,
      organization: user.organization,
      role: user.role,
    };

    res.cookie('sp_user', JSON.stringify(sessionUser), {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    console.log(`[Auth Controller] Quick Demo Login successful for ${user.name} (${user.email}). Redirecting to: ${targetRedirect}`);
    return res.redirect(targetRedirect);
  }

  // Password-Based Login Verification
  if (!normalizedEmail || !password) {
    return res.render('login', {
      redirectUrl: targetRedirect,
      error: 'Please provide both email address and password.',
      success: undefined,
    });
  }

  const existingUser = USER_ACCOUNTS.find((u) => u.email.toLowerCase() === normalizedEmail);
  const inputHash = hashPassword(password);

  if (!existingUser || (existingUser.passwordHash && existingUser.passwordHash !== inputHash)) {
    return res.render('login', {
      redirectUrl: targetRedirect,
      error: 'Invalid email or password. Please check your credentials or create a new account.',
      success: undefined,
    });
  }

  // Create Session Cookie
  const isDefaultAdmin = normalizedEmail === DEFAULT_ADMIN_EMAIL;
  if (isDefaultAdmin) existingUser.role = 'admin';

  const sessionUser: UserSession = {
    id: existingUser.id,
    email: existingUser.email,
    name: existingUser.name,
    phone: existingUser.phone,
    address: existingUser.address,
    organization: existingUser.organization,
    role: isDefaultAdmin ? 'admin' : existingUser.role,
  };

  res.cookie('sp_user', JSON.stringify(sessionUser), {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  console.log(`[Auth Controller] User ${existingUser.name} (${existingUser.email}) logged in successfully. Post-login redirecting to: ${targetRedirect}`);
  return res.redirect(targetRedirect);
}

/**
 * Handle Signup Form Submission (Validates unique email & saves to Google Sheets)
 */
export async function handleSignup(req: Request, res: Response) {
  const { name, email, password, phone, address, organization, redirect } = req.body;
  const targetRedirect = (redirect || '/profile') as string;

  const normalizedEmail = (email || '').trim().toLowerCase();

  // 1. Validation
  if (!name || !normalizedEmail || !password) {
    return res.render('signup', {
      redirectUrl: targetRedirect,
      error: 'Full Name, Email Address, and Password are required fields.',
    });
  }

  // 2. Email Uniqueness Check against Google Sheets / Database store
  const existingUser = USER_ACCOUNTS.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (existingUser) {
    return res.render('signup', {
      redirectUrl: targetRedirect,
      error: `An account with the email '${normalizedEmail}' already exists. Please sign in instead.`,
    });
  }

  // 3. Hash Password & Construct User Object
  const isDefaultAdmin = normalizedEmail === DEFAULT_ADMIN_EMAIL;
  const newUser: UserAccount = {
    id: `usr-${Date.now()}`,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    phone: (phone || '').trim() || '+880 1700-000000',
    address: (address || '').trim() || 'Dhaka, Bangladesh',
    organization: (organization || '').trim() || 'Youth Changemaker',
    role: isDefaultAdmin ? 'admin' : 'attendee',
    createdAt: new Date().toISOString(),
  };

  // 4. Save to Database Store, Google Sheets, & Firebase Firestore
  USER_ACCOUNTS.push(newUser);
  const sheetResult = await appendUserToSheet(newUser);
  const fbResult = await saveUserToFirestore(newUser);

  console.log(`[Auth Controller] New user registered: ${newUser.name} (${newUser.email}). Google Sheets result: ${sheetResult.message}. Firebase result: ${fbResult.message}`);

  // 5. Establish Session Cookie
  const sessionUser: UserSession = {
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    phone: newUser.phone,
    address: newUser.address,
    organization: newUser.organization,
    role: newUser.role,
  };

  res.cookie('sp_user', JSON.stringify(sessionUser), {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.redirect(targetRedirect);
}

/**
 * Handle Promoting an existing user to Admin
 */
export async function handlePromoteToAdmin(req: Request, res: Response) {
  const { email } = req.body;
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (!normalizedEmail) {
    return res.redirect('/admin/sheets?msg=' + encodeURIComponent('⚠ Please enter a valid email address to promote.'));
  }

  const user = USER_ACCOUNTS.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (!user) {
    return res.redirect('/admin/sheets?msg=' + encodeURIComponent(`⚠ User with email '${normalizedEmail}' not found in registered accounts.`));
  }

  user.role = 'admin';
  await saveUserToFirestore(user);

  console.log(`[Auth Controller] User ${user.email} successfully promoted to Admin!`);
  return res.redirect('/admin/sheets?msg=' + encodeURIComponent(`✓ User '${user.email}' has been successfully promoted to Admin!`));
}

/**
 * Render User Profile Dashboard
 */
export function renderProfilePage(req: Request, res: Response) {
  const sessionUser = getSessionUser(req);
  if (!sessionUser) {
    return res.redirect('/login?redirect=/profile');
  }

  const fullAccount = USER_ACCOUNTS.find((u) => u.email.toLowerCase() === sessionUser.email.toLowerCase()) || {
    id: sessionUser.id,
    name: sessionUser.name,
    email: sessionUser.email,
    passwordHash: '',
    phone: sessionUser.phone || '+880 1712-345678',
    address: sessionUser.address || 'Dhaka, Bangladesh',
    organization: sessionUser.organization || 'Youth Member',
    role: sessionUser.role,
    createdAt: new Date().toISOString(),
  };

  // User's Ticket Registrations
  const userTickets = REGISTRATIONS_STORE.filter(
    (r) => r.email.toLowerCase() === sessionUser.email.toLowerCase()
  );

  const msg = req.query.msg as string | undefined;

  return res.render('profile', {
    user: fullAccount,
    userTickets,
    events: INITIAL_EVENTS,
    msg,
  });
}

/**
 * Handle Profile Update (Phone, Address, Organization)
 * CRUCIAL RULE: Email is strictly locked/disabled and cannot be changed.
 */
export async function handleProfileUpdate(req: Request, res: Response) {
  const sessionUser = getSessionUser(req);
  if (!sessionUser) {
    return res.redirect('/login?redirect=/profile');
  }

  const { name, phone, address, organization } = req.body;

  // Find user in memory DB
  const userIndex = USER_ACCOUNTS.findIndex(
    (u) => u.email.toLowerCase() === sessionUser.email.toLowerCase()
  );

  if (userIndex !== -1) {
    if (name) USER_ACCOUNTS[userIndex].name = name.trim();
    if (phone) USER_ACCOUNTS[userIndex].phone = phone.trim();
    if (address) USER_ACCOUNTS[userIndex].address = address.trim();
    if (organization) USER_ACCOUNTS[userIndex].organization = organization.trim();
  }

  // Update session cookie
  const updatedSessionUser: UserSession = {
    ...sessionUser,
    name: name ? name.trim() : sessionUser.name,
    phone: phone ? phone.trim() : sessionUser.phone,
    address: address ? address.trim() : sessionUser.address,
    organization: organization ? organization.trim() : sessionUser.organization,
  };

  res.cookie('sp_user', JSON.stringify(updatedSessionUser), {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  // Sync update to Google Sheets "Users" tab and Firebase Firestore
  await updateUserInSheet(sessionUser.email, {
    name: name?.trim(),
    phone: phone?.trim(),
    address: address?.trim(),
    organization: organization?.trim(),
  });

  const matchedAccount = USER_ACCOUNTS.find((u) => u.email.toLowerCase() === sessionUser.email.toLowerCase());
  if (matchedAccount) {
    await updateUserInFirestore(matchedAccount.id, {
      name: name?.trim(),
      phone: phone?.trim(),
      address: address?.trim(),
      organization: organization?.trim(),
    });
  }

  console.log(`[Auth Controller] Profile updated for ${sessionUser.email} in Google Sheets and Firebase. Email remained strictly locked.`);

  return res.redirect(`/profile?msg=${encodeURIComponent('✓ Profile details updated successfully in database and Google Sheets!')}`);
}

/**
 * Handle Logout
 */
export function handleLogout(req: Request, res: Response) {
  res.clearCookie('sp_user');
  return res.redirect('/');
}
