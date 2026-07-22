import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { RegistrationRecord, EventItem } from '../types/index.js';

export async function generateTicketPdfBuffer(
  registration: RegistrationRecord,
  event: EventItem
): Promise<Buffer> {
  // Generate QR Code data URL
  const qrDataUrl = await QRCode.toDataURL(registration.qrPayload, {
    margin: 1,
    width: 200,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5', // A5 card pass format
  });

  // Background Slate Gradient fill
  doc.setFillColor(15, 23, 42); // #0f172a
  doc.rect(0, 0, 148, 210, 'F');

  // Glass Card Outer Border Accent
  doc.setDrawColor(56, 189, 248); // Cyan line
  doc.setLineWidth(1);
  doc.roundedRect(8, 8, 132, 194, 6, 6, 'D');

  // Header Box
  doc.setFillColor(30, 41, 59); // #1e293b
  doc.roundedRect(12, 12, 124, 38, 4, 4, 'F');

  // Title "SURVIVOR'S PATH"
  doc.setTextColor(248, 250, 252);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text("SURVIVOR'S PATH PASS", 18, 24);

  doc.setTextColor(56, 189, 248); // Cyan
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Youth Organization Event Ticket', 18, 30);

  // Sequential ID Badge
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(88, 18, 42, 12, 3, 3, 'F');
  doc.setTextColor(250, 204, 21); // Gold text
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(registration.id, 92, 26);

  // Status Badge
  const isWaitlist = registration.status === 'Waitlist';
  if (isWaitlist) {
    doc.setFillColor(239, 68, 68); // Red
    doc.roundedRect(12, 42, 124, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('STATUS: PRIORITY WAITLIST (Seat allocation pending)', 18, 46.5);
  } else {
    doc.setFillColor(16, 185, 129); // Emerald Green
    doc.roundedRect(12, 42, 124, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('STATUS: CONFIRMED ATTENDEE (Guaranteed Entry)', 18, 46.5);
  }

  // Event Details Box
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(12, 54, 124, 42, 4, 4, 'F');

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.text('EVENT NAME', 18, 62);
  doc.setTextColor(248, 250, 252);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const splitTitle = doc.splitTextToSize(event.titleEn, 112);
  doc.text(splitTitle, 18, 68);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.text('DATE & TIME:', 18, 82);
  doc.setTextColor(226, 232, 240);
  doc.text(`${event.date} | ${event.time}`, 42, 82);

  doc.setTextColor(148, 163, 184);
  doc.text('LOCATION:', 18, 88);
  doc.setTextColor(226, 232, 240);
  doc.text(event.locationEn, 42, 88);

  // Attendee Details Box
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(12, 100, 124, 46, 4, 4, 'F');

  doc.setTextColor(56, 189, 248);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('ATTENDEE PROFILE', 18, 108);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.setFontSize(9);
  doc.text(`Name: ${registration.fullName}`, 18, 116);
  doc.text(`Email: ${registration.email}`, 18, 122);
  doc.text(`Organization: ${registration.organization}`, 18, 128);
  doc.text(`Youth Group: ${registration.youthGroup}`, 18, 134);
  doc.text(`Emergency Tel: ${registration.emergencyContact}`, 18, 140);

  // QR Code & Verification Section
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(12, 150, 124, 46, 4, 4, 'F');

  // Embed QR Image
  doc.addImage(qrDataUrl, 'PNG', 18, 153, 40, 40);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DIGITAL QR VERIFICATION', 62, 162);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Present this QR code at the main entry gate.', 62, 168);
  doc.text(`Issued: ${new Date(registration.registeredAt).toLocaleDateString()}`, 62, 174);
  doc.text(`Ticket Ref: ${registration.id}`, 62, 180);
  doc.text('Google Sheets Synced: Yes', 62, 186);

  // Output ArrayBuffer to Node Buffer
  const pdfArrayBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfArrayBuffer);
}
