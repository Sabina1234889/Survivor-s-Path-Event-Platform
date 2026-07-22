import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { UserAccount, RegistrationRecord, SupportTicketRecord, EventItem } from '../types/index.js';

export const firebaseConfig = {
  apiKey: "AIzaSyCYIjVrdDhLVxQLc1RNZ4FmhiOkbwVoAuE",
  authDomain: "survivor-s-path-event-platform.firebaseapp.com",
  projectId: "survivor-s-path-event-platform",
  storageBucket: "survivor-s-path-event-platform.firebasestorage.app",
  messagingSenderId: "440368564839",
  appId: "1:440368564839:web:16d731af30aebcb3c2a2c2",
  measurementId: "G-ZPW32N456B"
};

// Initialize Firebase SDK
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

console.log(`[Firebase Service] Initialized successfully with Project ID: ${firebaseConfig.projectId}`);

/**
 * Save or update User Account in Firebase Firestore ("users" collection)
 */
export async function saveUserToFirestore(user: UserAccount): Promise<{ success: boolean; message: string }> {
  try {
    const userRef = doc(db, 'users', user.id);
    await setDoc(
      userRef,
      {
        id: user.id,
        name: user.name,
        email: user.email.toLowerCase(),
        passwordHash: user.passwordHash,
        phone: user.phone || '',
        address: user.address || '',
        organization: user.organization || '',
        role: user.role || 'attendee',
        createdAt: user.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log(`[Firebase Firestore] Successfully synced User document: users/${user.id} (${user.email})`);
    return {
      success: true,
      message: `User ${user.email} saved to Firebase Firestore successfully.`,
    };
  } catch (err: any) {
    console.error(`[Firebase Firestore Error] Failed to save user to Firestore:`, err?.message || err);
    return {
      success: false,
      message: `Firestore sync notice: ${err?.message || 'Error writing document'}`,
    };
  }
}

/**
 * Update User Profile in Firebase Firestore ("users" collection)
 */
export async function updateUserInFirestore(
  userId: string,
  updatedFields: { name?: string; phone?: string; address?: string; organization?: string }
): Promise<{ success: boolean; message: string }> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...updatedFields,
      updatedAt: new Date().toISOString(),
    });

    console.log(`[Firebase Firestore] Successfully updated User profile in users/${userId}`);
    return {
      success: true,
      message: `Profile updated in Firebase Firestore.`,
    };
  } catch (err: any) {
    console.warn(`[Firebase Firestore Warning] Profile update warning:`, err?.message || err);
    return {
      success: false,
      message: `Firestore update notice: ${err?.message || 'Error updating document'}`,
    };
  }
}

/**
 * Save Event Ticket Registration in Firebase Firestore ("registrations" collection)
 */
export async function saveRegistrationToFirestore(
  registration: RegistrationRecord
): Promise<{ success: boolean; message: string }> {
  try {
    const regRef = doc(db, 'registrations', registration.id);
    await setDoc(regRef, {
      ...registration,
      syncedToFirebase: true,
      updatedAt: new Date().toISOString(),
    });

    console.log(`[Firebase Firestore] Successfully saved Event Registration: registrations/${registration.id}`);
    return {
      success: true,
      message: `Registration ticket ${registration.id} saved to Firebase Firestore.`,
    };
  } catch (err: any) {
    console.error(`[Firebase Firestore Error] Failed to save registration:`, err?.message || err);
    return {
      success: false,
      message: `Firestore registration notice: ${err?.message || 'Error writing registration'}`,
    };
  }
}

/**
 * Fetch all registrations from Firestore for a specific user email
 */
export async function getRegistrationsFromFirestore(email: string): Promise<RegistrationRecord[]> {
  try {
    const regCol = collection(db, 'registrations');
    const q = query(regCol, where('email', '==', email.toLowerCase()));
    const querySnapshot = await getDocs(q);
    const records: RegistrationRecord[] = [];

    querySnapshot.forEach((docSnap) => {
      records.push(docSnap.data() as RegistrationRecord);
    });

    return records;
  } catch (err: any) {
    console.warn(`[Firebase Firestore Warning] Failed to query registrations for ${email}:`, err?.message || err);
    return [];
  }
}

/**
 * Save Support Ticket to Firebase Firestore ("support_tickets" collection)
 */
export async function saveSupportTicketToFirestore(
  ticket: SupportTicketRecord
): Promise<{ success: boolean; message: string }> {
  try {
    const ticketRef = doc(db, 'support_tickets', ticket.id);
    await setDoc(ticketRef, {
      ...ticket,
      createdAt: new Date().toISOString(),
    });

    console.log(`[Firebase Firestore] Saved support ticket: support_tickets/${ticket.id}`);
    return {
      success: true,
      message: `Support ticket ${ticket.id} synced to Firebase.`,
    };
  } catch (err: any) {
    console.warn(`[Firebase Firestore Warning] Failed to save support ticket:`, err?.message || err);
    return {
      success: false,
      message: `Support ticket Firestore notice: ${err?.message || 'Error writing ticket'}`,
    };
  }
}

/**
 * Seed / Sync initial Events list to Firebase Firestore ("events" collection)
 */
export async function syncEventsToFirestore(events: EventItem[]): Promise<void> {
  try {
    for (const evt of events) {
      const evtRef = doc(db, 'events', evt.id);
      await setDoc(evtRef, evt, { merge: true });
    }
    console.log(`[Firebase Firestore] Initialized/Synced ${events.length} events to 'events' collection.`);
  } catch (err: any) {
    console.warn(`[Firebase Firestore Notice] Event sync notice:`, err?.message || err);
  }
}
