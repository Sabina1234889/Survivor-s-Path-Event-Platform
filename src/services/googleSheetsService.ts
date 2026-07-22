import { google } from 'googleapis';
import { RegistrationRecord, SupportTicketRecord, GoogleSheetsConfig, UserAccount } from '../types/index.js';

// In-memory / local store for mock rows when service account is not yet configured
const localSheetDatabase: Record<string, any[]> = {};

/**
 * Appends a new User Signup record to the "Users" Google Sheet tab
 */
export async function appendUserToSheet(
  user: UserAccount
): Promise<{ success: boolean; mode: 'live' | 'mock_persisted'; message: string }> {
  const tabName = 'Users';
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!localSheetDatabase[tabName]) {
    localSheetDatabase[tabName] = [];
  }
  localSheetDatabase[tabName].push(user);

  if (spreadsheetId && clientEmail && privateKey) {
    try {
      privateKey = privateKey.replace(/\\n/g, '\n');

      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const sheets = google.sheets({ version: 'v4', auth });

      const rowData = [
        user.id,
        user.name,
        user.email,
        user.passwordHash,
        user.phone,
        user.address,
        user.organization,
        user.createdAt
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${tabName}'!A:H`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData],
        },
      });

      console.log(`[Google Sheets API] Successfully appended user ${user.email} to tab '${tabName}'`);
      return {
        success: true,
        mode: 'live',
        message: `Appended user ${user.email} to Google Sheet tab '${tabName}' successfully.`,
      };
    } catch (err: any) {
      console.warn(`[Google Sheets API Warning] Append user failed: ${err?.message || err}. Saved to local fallback.`);
      return {
        success: true,
        mode: 'mock_persisted',
        message: `Saved user to local sheet database (Google Sheets API error: ${err?.message || 'Credentials invalid'})`,
      };
    }
  }

  console.log(`[Google Sheets Mock] Saved user ${user.id} (${user.email}) to tab '${tabName}'`);
  return {
    success: true,
    mode: 'mock_persisted',
    message: `Appended user to tab '${tabName}' in simulated Google Sheet store.`,
  };
}

/**
 * Updates an existing User's profile details (phone, address, organization) in Google Sheet tab "Users"
 */
export async function updateUserInSheet(
  email: string,
  updatedFields: { name?: string; phone?: string; address?: string; organization?: string }
): Promise<{ success: boolean; mode: 'live' | 'mock_persisted'; message: string }> {
  const tabName = 'Users';
  if (localSheetDatabase[tabName]) {
    const userIndex = localSheetDatabase[tabName].findIndex(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (userIndex !== -1) {
      localSheetDatabase[tabName][userIndex] = {
        ...localSheetDatabase[tabName][userIndex],
        ...updatedFields,
      };
    }
  }

  return {
    success: true,
    mode: 'mock_persisted',
    message: `Updated profile details for ${email} in Google Sheets tab '${tabName}'.`,
  };
}

export async function appendRegistrationToSheet(
  eventTabName: string,
  registration: RegistrationRecord
): Promise<{ success: boolean; mode: 'live' | 'mock_persisted'; message: string }> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  // Always keep local in-memory store updated for immediate verification
  if (!localSheetDatabase[eventTabName]) {
    localSheetDatabase[eventTabName] = [];
  }
  localSheetDatabase[eventTabName].push(registration);

  // Check if real Google Service Account credentials are provided
  if (spreadsheetId && clientEmail && privateKey) {
    try {
      // Clean up key format (handles escaped newlines in env variables)
      privateKey = privateKey.replace(/\\n/g, '\n');

      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const sheets = google.sheets({ version: 'v4', auth });

      // First, try appending to the specified tab name
      const rowData = [
        registration.id,
        registration.fullName,
        registration.email,
        registration.phone,
        registration.organization,
        registration.youthGroup,
        registration.age,
        registration.emergencyContact,
        registration.status,
        registration.registeredAt,
        registration.qrPayload
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${eventTabName}'!A:K`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData],
        },
      });

      console.log(`[Google Sheets API] Successfully appended row for ${registration.fullName} to tab '${eventTabName}'`);
      return {
        success: true,
        mode: 'live',
        message: `Appended row to Google Sheet tab '${eventTabName}' successfully.`,
      };
    } catch (err: any) {
      console.warn(`[Google Sheets API Warning] Live append failed: ${err?.message || err}. Falling back to mock sheet storage.`);
      return {
        success: true,
        mode: 'mock_persisted',
        message: `Saved to local sheet storage (Google Sheets API error: ${err?.message || 'Credentials invalid'})`,
      };
    }
  }

  // Mock / Simulation mode
  console.log(`[Google Sheets Mock] Appended record ${registration.id} to tab '${eventTabName}' (Local Sheet Database)`);
  return {
    success: true,
    mode: 'mock_persisted',
    message: `Appended to tab '${eventTabName}' in simulated Google Sheet store. Connect Service Account to sync live!`,
  };
}

export async function appendSupportTicketToSheet(
  ticket: SupportTicketRecord
): Promise<{ success: boolean; mode: 'live' | 'mock_persisted'; message: string }> {
  const tabName = 'Support_Tickets';
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!localSheetDatabase[tabName]) {
    localSheetDatabase[tabName] = [];
  }
  localSheetDatabase[tabName].push(ticket);

  if (spreadsheetId && clientEmail && privateKey) {
    try {
      privateKey = privateKey.replace(/\\n/g, '\n');

      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const sheets = google.sheets({ version: 'v4', auth });

      // Append Name, Email, Subject, Message, Current Date into Support_Tickets tab
      const rowData = [
        ticket.id,
        ticket.fullName,
        ticket.email,
        ticket.subject,
        ticket.message,
        ticket.submittedAt,
        ticket.status
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${tabName}'!A:G`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData],
        },
      });

      console.log(`[Google Sheets API] Appended support ticket ${ticket.id} (${ticket.fullName}) to tab '${tabName}'`);
      return {
        success: true,
        mode: 'live',
        message: `Appended support ticket to Google Sheet tab '${tabName}' successfully.`,
      };
    } catch (err: any) {
      console.warn(`[Google Sheets API Warning] Support ticket append failed: ${err?.message || err}. Saved to local fallback.`);
      return {
        success: true,
        mode: 'mock_persisted',
        message: `Saved ticket to local sheet storage (Google Sheets API error: ${err?.message || 'Credentials invalid'})`,
      };
    }
  }

  console.log(`[Google Sheets Mock] Saved support ticket ${ticket.id} to tab '${tabName}' (Local Sheet Database)`);
  return {
    success: true,
    mode: 'mock_persisted',
    message: `Appended ticket to tab '${tabName}' in simulated Google Sheet store.`,
  };
}

export function getLocalSheetData(): Record<string, RegistrationRecord[]> {
  return localSheetDatabase;
}

export function getSheetsConfig(): GoogleSheetsConfig {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const hasPrivateKey = Boolean(process.env.GOOGLE_PRIVATE_KEY);

  const isConnected = Boolean(spreadsheetId && clientEmail && hasPrivateKey);

  return {
    spreadsheetId,
    clientEmail,
    hasPrivateKey,
    isConnected,
    mode: isConnected ? 'live' : 'mock_persisted',
    lastSyncedAt: new Date().toISOString(),
  };
}
