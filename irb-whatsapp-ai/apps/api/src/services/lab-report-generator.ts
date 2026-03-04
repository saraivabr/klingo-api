import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

interface LabReportData {
  order: any;
  items: any[];
  patient: any;
  doctor?: any;
}

const CLINIC_NAME = 'IRB Prime Care';
const CITY = 'Brasília - DF';
const DATA_DIR = '/data/lab-reports';

export async function generateLabReportPDF(reportId: string, data: LabReportData): Promise<string> {
  const dirPath = dirname(`${DATA_DIR}/temp`);
  await mkdir(dirPath, { recursive: true });

  const filePath = `${DATA_DIR}/${reportId}.pdf`;

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
      // Header
      drawHeader(doc);

      // Patient Info
      doc.fontSize(11).font('Helvetica-Bold').text('INFORMAÇÕES DO PACIENTE');
      doc.fontSize(10).font('Helvetica');
      doc.text(`Nome: ${data.patient?.name || 'N/A'}`);
      doc.moveDown(0.5);

      // Doctor Info
      if (data.doctor) {
        doc.fontSize(11).font('Helvetica-Bold').text('MÉDICO SOLICITANTE');
        doc.fontSize(10).font('Helvetica');
        doc.text(`Nome: ${data.doctor.name}`);
        doc.text(`CRM: ${data.doctor.crm || 'N/A'}`);
        doc.text(`Especialidade: ${data.doctor.specialty || 'N/A'}`);
      }

      doc.moveDown(1);

      // Order Info
      doc.fontSize(11).font('Helvetica-Bold').text('INFORMAÇÕES DO PEDIDO');
      doc.fontSize(10).font('Helvetica');
      doc.text(`Número do Pedido: ${data.order.orderNumber}`);
      doc.text(`Data do Pedido: ${formatDate(new Date(data.order.orderedAt))}`);
      doc.text(`Prioridade: ${data.order.priority === 'urgent' ? 'URGENTE' : 'Normal'}`);
      doc.text(`Status: ${formatStatus(data.order.status)}`);

      if (data.order.notes) {
        doc.text(`Observações: ${data.order.notes}`);
      }

      doc.moveDown(1.5);

      // Test Results
      doc.fontSize(12).font('Helvetica-Bold').text('RESULTADOS DOS EXAMES');
      doc.moveDown(0.5);

      data.items.forEach((item, index) => {
        doc.fontSize(11).font('Helvetica-Bold').text(`${index + 1}. ${item.test?.name || 'Teste desconhecido'}`);

        if (item.results && item.results.length > 0) {
          doc.fontSize(10).font('Helvetica');
          item.results.forEach((result: any) => {
            const value = result.value || '—';
            const abnormal = result.isAbnormal ? ' ⚠️ ANORMAL' : '';
            const paramName = result.parameter?.parameterName || 'Parâmetro';
            const unit = result.parameter?.unit || '';

            doc.text(`  ${paramName}: ${value} ${unit}${abnormal}`);
          });
        } else {
          doc.fontSize(10).font('Helvetica').text('  Resultados ainda não inseridos');
        }

        doc.moveDown(0.3);
      });

      doc.moveDown(1.5);

      // Footer
      drawFooter(doc);

      doc.end();

      stream.on('finish', () => {
        resolve(`/api/files/lab-reports/${reportId}.pdf`);
      });
    } catch (error) {
      stream.destroy();
      reject(error);
    }
  });
}

function drawHeader(doc: any): void {
  doc.fontSize(16).font('Helvetica-Bold').text(CLINIC_NAME, { align: 'center' });
  doc.fontSize(10).font('Helvetica').text('RELATÓRIO DE EXAMES LABORATORIAIS', { align: 'center' });
  doc.moveTo(50, 100).lineTo(545, 100).stroke();
  doc.moveDown(1);
}

function drawFooter(doc: any): void {
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica').text(`${CITY}, ${formatDate(new Date())}`, { align: 'center' });
  doc.text('Documento gerado pelo sistema IRB Prime Care', { align: 'center' });
}

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatStatus(status: string): string {
  const statuses: Record<string, string> = {
    ordered: 'Solicitado',
    collected: 'Coletado',
    processing: 'Processando',
    completed: 'Concluído',
    cancelled: 'Cancelado',
  };
  return statuses[status] || status;
}
