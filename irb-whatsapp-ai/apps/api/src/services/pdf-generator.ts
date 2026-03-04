import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

interface DoctorInfo {
  name: string;
  crm: string;
  specialty: string;
}

interface PatientInfo {
  name: string;
}

interface PrescriptionContent {
  medications?: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
  }>;
}

interface CertificateContent {
  days?: number;
  cid?: string;
  text?: string;
}

interface ReferralContent {
  specialty?: string;
  reason?: string;
}

interface ExamRequestContent {
  exams?: string[];
  justification?: string;
}

type DocumentContent =
  | PrescriptionContent
  | CertificateContent
  | ReferralContent
  | ExamRequestContent;

type DocumentType = 'prescription' | 'certificate' | 'referral' | 'exam_request';

const CLINIC_NAME = 'IRB Prime Care';
const CITY = 'Brasília - DF';
const DATA_DIR = '/data/prescriptions';

/**
 * Generate a PDF document for medical prescriptions, certificates, referrals, or exam requests
 * @param prescriptionId Unique identifier for the prescription
 * @param type Type of document to generate
 * @param content Content specific to the document type
 * @param doctorInfo Doctor information (name, CRM, specialty)
 * @param patientInfo Patient information (name)
 * @returns Public URL path to the generated PDF
 */
export async function generatePrescriptionPDF(
  prescriptionId: string,
  type: DocumentType,
  content: DocumentContent,
  doctorInfo: DoctorInfo,
  patientInfo: PatientInfo
): Promise<string> {
  // Ensure data directory exists
  const dirPath = dirname(`${DATA_DIR}/temp`);
  await mkdir(dirPath, { recursive: true });

  const filePath = `${DATA_DIR}/${prescriptionId}.pdf`;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      bufferPages: true,
    });

    const stream = createWriteStream(filePath);

    doc.on('error', (err: Error) => {
      stream.destroy();
      reject(err);
    });

    stream.on('error', reject);

    doc.pipe(stream);

    try {
      // Common header for all documents
      drawHeader(doc);

      // Draw content based on type
      switch (type) {
        case 'prescription':
          drawPrescription(doc, content as PrescriptionContent, doctorInfo, patientInfo);
          break;
        case 'certificate':
          drawCertificate(doc, content as CertificateContent, doctorInfo, patientInfo);
          break;
        case 'referral':
          drawReferral(doc, content as ReferralContent, doctorInfo, patientInfo);
          break;
        case 'exam_request':
          drawExamRequest(doc, content as ExamRequestContent, doctorInfo, patientInfo);
          break;
        default:
          throw new Error(`Unknown document type: ${type}`);
      }

      // Common footer
      drawFooter(doc, doctorInfo);

      doc.end();

      stream.on('finish', () => {
        resolve(`/api/files/prescriptions/${prescriptionId}.pdf`);
      });
    } catch (error) {
      stream.destroy();
      reject(error);
    }
  });
}

function drawHeader(doc: any): void {
  // Clinic name
  doc.fontSize(16).font('Helvetica-Bold').text(CLINIC_NAME, { align: 'center' });

  // Decorative line
  doc.moveTo(50, 80).lineTo(545, 80).stroke();

  doc.moveDown(1);
}

function drawPrescription(
  doc: any,
  content: PrescriptionContent,
  doctorInfo: DoctorInfo,
  patientInfo: PatientInfo
): void {
  // Title
  doc
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('RECEITUÁRIO MÉDICO', { align: 'center' });

  doc.moveDown(1.5);

  // Patient info
  doc.fontSize(11).font('Helvetica');
  doc.text(`Paciente: ${patientInfo.name}`);
  doc.text(`Data: ${formatDate(new Date())}`);

  doc.moveDown(1);

  // Medications header
  doc.fontSize(12).font('Helvetica-Bold').text('MEDICAMENTOS PRESCRITOS:');

  doc.moveDown(0.5);

  // Medications list
  if (content.medications && content.medications.length > 0) {
    content.medications.forEach((med, index) => {
      doc.fontSize(10).font('Helvetica');
      doc.text(`${index + 1}. ${med.name}`);
      doc.fontSize(9).font('Helvetica').text(`    Dosagem: ${med.dosage}`, { indent: 20 });
      doc.text(`    Frequência: ${med.frequency}`, { indent: 20 });
      doc.text(`    Duração: ${med.duration}`, { indent: 20 });
      doc.moveDown(0.3);
    });
  }

  doc.moveDown(1.5);

  // Signature area
  drawSignatureArea(doc, doctorInfo);
}

function drawCertificate(
  doc: any,
  content: CertificateContent,
  doctorInfo: DoctorInfo,
  patientInfo: PatientInfo
): void {
  // Title
  doc
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('ATESTADO MÉDICO', { align: 'center' });

  doc.moveDown(2);

  // Certificate content
  doc.fontSize(11).font('Helvetica');
  doc.text(
    `Atestamos, para devidos fins, que o(a) paciente ${patientInfo.name}, necessita afastar-se de suas atividades pelo prazo de ${content.days || 1} dias, a contar da data de hoje, por motivo de saúde.`,
    { align: 'justify' }
  );

  doc.moveDown(1.5);

  // CID
  if (content.cid) {
    doc.fontSize(10).font('Helvetica-Bold').text('Diagnóstico (CID):');
    doc.fontSize(10).font('Helvetica').text(content.cid);
    doc.moveDown(1);
  }

  // Text content
  if (content.text) {
    doc.fontSize(10).font('Helvetica').text(content.text, { align: 'justify' });
    doc.moveDown(1);
  }

  doc.moveDown(1);

  // Signature area
  drawSignatureArea(doc, doctorInfo);
}

function drawReferral(
  doc: any,
  content: ReferralContent,
  doctorInfo: DoctorInfo,
  patientInfo: PatientInfo
): void {
  // Title
  doc.fontSize(18).font('Helvetica-Bold').text('ENCAMINHAMENTO', { align: 'center' });

  doc.moveDown(2);

  // Patient info
  doc.fontSize(11).font('Helvetica');
  doc.text(`Paciente: ${patientInfo.name}`);
  doc.text(`Data: ${formatDate(new Date())}`);

  doc.moveDown(1.5);

  // Specialty
  if (content.specialty) {
    doc.fontSize(11).font('Helvetica-Bold').text('Especialidade Solicitada:');
    doc.fontSize(10).font('Helvetica').text(content.specialty);
    doc.moveDown(1);
  }

  // Reason
  if (content.reason) {
    doc.fontSize(11).font('Helvetica-Bold').text('Motivo do Encaminhamento:');
    doc.fontSize(10).font('Helvetica').text(content.reason, { align: 'justify' });
    doc.moveDown(1);
  }

  doc.moveDown(1);

  // Signature area
  drawSignatureArea(doc, doctorInfo);
}

function drawExamRequest(
  doc: any,
  content: ExamRequestContent,
  doctorInfo: DoctorInfo,
  patientInfo: PatientInfo
): void {
  // Title
  doc
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('SOLICITAÇÃO DE EXAMES', { align: 'center' });

  doc.moveDown(2);

  // Patient info
  doc.fontSize(11).font('Helvetica');
  doc.text(`Paciente: ${patientInfo.name}`);
  doc.text(`Data: ${formatDate(new Date())}`);

  doc.moveDown(1.5);

  // Exams list
  doc.fontSize(11).font('Helvetica-Bold').text('EXAMES SOLICITADOS:');
  doc.moveDown(0.5);

  if (content.exams && content.exams.length > 0) {
    content.exams.forEach((exam, index) => {
      doc.fontSize(10).font('Helvetica').text(`${index + 1}. ${exam}`);
    });
  }

  doc.moveDown(1.5);

  // Justification
  if (content.justification) {
    doc.fontSize(11).font('Helvetica-Bold').text('Justificativa:');
    doc.fontSize(10).font('Helvetica').text(content.justification, { align: 'justify' });
    doc.moveDown(1);
  }

  doc.moveDown(1);

  // Signature area
  drawSignatureArea(doc, doctorInfo);
}

function drawSignatureArea(doc: any, doctorInfo: DoctorInfo): void {
  // Signature line
  doc.moveTo(100, doc.y).lineTo(250, doc.y).stroke();

  doc.moveDown(0.3);

  // Doctor info
  doc.fontSize(10).font('Helvetica');
  doc.text(doctorInfo.name);
  doc.text(`CRM: ${doctorInfo.crm}`);
  doc.text(doctorInfo.specialty);

  doc.moveDown(1.5);

  // City and date
  doc.fontSize(10).text(`${CITY}, ${formatDate(new Date())}`);
}

function drawFooter(doc: any, _doctorInfo: DoctorInfo): void {
  // Footer is handled in drawSignatureArea which is called at the end
  // This function is kept for consistency with header/footer pattern
}

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}
