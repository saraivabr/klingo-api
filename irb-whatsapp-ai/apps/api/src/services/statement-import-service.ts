import { createHash } from 'node:crypto';
import { db, schema } from '@irb/database';
import { and, desc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';

type StatementType = 'credit' | 'debit';

interface StatementRowInput {
  date: string;
  description: string;
  amount: number;
  balance?: number | null;
  type?: StatementType | null;
  reference?: string | null;
}

interface StatementImportPayload {
  bankAccountId: string;
  fileName: string;
  rows: StatementRowInput[];
}

interface ClassifiedRow {
  index: number;
  normalizedDescription: string;
  categorySuggestion: string;
  confidence: number;
  type: StatementType;
}

interface PreviewRow {
  index: number;
  date: string;
  description: string;
  amount: number;
  balance: number | null;
  type: StatementType;
  normalizedDescription: string;
  categorySuggestion: string;
  aiConfidence: number;
  externalRef: string;
  duplicate: boolean;
  match: {
    kind: 'payable' | 'receivable' | 'none';
    confidence: number;
    autoAction: 'mark_paid' | 'register_receipt' | 'record_only';
    label: string | null;
    id: string | null;
    reason: string;
  };
}

function normalizeText(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 2);
}

function overlapScore(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let hits = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) hits += 1;
  }

  return hits / Math.max(leftTokens.size, rightTokens.size);
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function inferCategory(description: string, type: StatementType) {
  const text = normalizeText(description);

  if (text.includes('pix')) return 'PIX';
  if (text.includes('boleto')) return 'Boleto';
  if (text.includes('folha')) return 'Folha';
  if (text.includes('imposto') || text.includes('darf')) return 'Impostos';
  if (text.includes('google') || text.includes('meta') || text.includes('ads')) return 'Marketing';
  if (text.includes('emprestimo') || text.includes('financiamento')) return 'Empréstimos';
  if (text.includes('salario') || text.includes('pro labore')) return 'Folha';
  if (text.includes('aluguel') || text.includes('condominio')) return 'Infraestrutura';
  if (text.includes('energia') || text.includes('agua')) return 'Utilidades';
  if (type === 'credit') return 'Recebimento';
  return 'Despesa operacional';
}

function normalizeType(row: StatementRowInput): StatementType {
  if (row.type === 'credit' || row.type === 'debit') return row.type;
  return row.amount >= 0 ? 'credit' : 'debit';
}

function cents(value: number) {
  return Math.round(Math.abs(value));
}

async function classifyRowsWithAI(rows: PreviewRow[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || rows.length === 0) return new Map<number, ClassifiedRow>();

  const payload = rows.slice(0, 80).map((row) => ({
    index: row.index,
    description: row.description,
    amount: row.amount,
    type: row.type,
  }));

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_FINANCE_MODEL || process.env.AI_MODEL || 'gpt-4o-mini',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Voce classifica linhas de extrato bancario. Responda JSON com chave rows. Cada item deve conter: index, normalizedDescription, categorySuggestion, confidence, type. type deve ser credit ou debit. confidence vai de 0 a 1.',
          },
          {
            role: 'user',
            content: JSON.stringify(payload),
          },
        ],
      }),
    });

    if (!response.ok) return new Map<number, ClassifiedRow>();

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return new Map<number, ClassifiedRow>();

    const parsed = JSON.parse(content);
    const result = new Map<number, ClassifiedRow>();
    for (const row of parsed.rows || []) {
      if (typeof row.index !== 'number') continue;
      result.set(row.index, {
        index: row.index,
        normalizedDescription: normalizeText(row.normalizedDescription || ''),
        categorySuggestion: String(row.categorySuggestion || ''),
        confidence: clamp(Number(row.confidence || 0)),
        type: row.type === 'debit' ? 'debit' : 'credit',
      });
    }
    return result;
  } catch {
    return new Map<number, ClassifiedRow>();
  }
}

export class StatementImportService {
  async preview(payload: StatementImportPayload) {
    const bankAccount = await db.query.bankAccounts.findFirst({
      where: and(eq(schema.bankAccounts.id, payload.bankAccountId), eq(schema.bankAccounts.isActive, true)),
    });

    if (!bankAccount) {
      throw new Error('Conta bancária não encontrada');
    }

    const normalizedRows = payload.rows
      .map((row, index) => {
        const type = normalizeType(row);
        const amount = cents(row.amount);
        if (!row.date || !row.description || !amount) return null;

        const externalRef = createHash('sha1')
          .update(`${payload.bankAccountId}|${payload.fileName}|${row.date}|${type}|${amount}|${normalizeText(row.description)}|${row.reference || ''}`)
          .digest('hex')
          .slice(0, 24);

        return {
          index,
          date: row.date,
          description: row.description.trim(),
          amount,
          balance: row.balance == null ? null : cents(row.balance),
          type,
          normalizedDescription: normalizeText(row.description),
          categorySuggestion: inferCategory(row.description, type),
          aiConfidence: 0,
          externalRef,
          duplicate: false,
          match: {
            kind: 'none' as const,
            confidence: 0,
            autoAction: 'record_only' as const,
            label: null,
            id: null,
            reason: 'Sem match ainda.',
          },
        };
      })
      .filter(Boolean) as PreviewRow[];

    const aiSuggestions = await classifyRowsWithAI(normalizedRows);
    normalizedRows.forEach((row) => {
      const suggestion = aiSuggestions.get(row.index);
      if (!suggestion) return;
      row.normalizedDescription = suggestion.normalizedDescription || row.normalizedDescription;
      row.categorySuggestion = suggestion.categorySuggestion || row.categorySuggestion;
      row.aiConfidence = suggestion.confidence;
      row.type = suggestion.type || row.type;
    });

    const externalRefs = normalizedRows.map((row) => row.externalRef);
    const existingTransactions = externalRefs.length
      ? await db.select({
          externalRef: schema.bankTransactions.externalRef,
        }).from(schema.bankTransactions).where(inArray(schema.bankTransactions.externalRef, externalRefs))
      : [];

    const duplicates = new Set(existingTransactions.map((item) => item.externalRef).filter(Boolean) as string[]);
    normalizedRows.forEach((row) => {
      row.duplicate = duplicates.has(row.externalRef);
    });

    const dateRange = normalizedRows.reduce(
      (acc, row) => {
        if (row.date < acc.min) acc.min = row.date;
        if (row.date > acc.max) acc.max = row.date;
        return acc;
      },
      { min: '9999-12-31', max: '0000-01-01' },
    );

    const amountPool = [...new Set(normalizedRows.map((row) => row.amount))];

    const payables = amountPool.length
      ? await db.select({
          id: schema.accountsPayable.id,
          description: schema.accountsPayable.description,
          supplierName: schema.suppliers.legalName,
          netAmount: schema.accountsPayable.netAmount,
          dueDate: schema.accountsPayable.dueDate,
          paymentDate: schema.accountsPayable.paymentDate,
          status: schema.accountsPayable.status,
        })
          .from(schema.accountsPayable)
          .leftJoin(schema.suppliers, eq(schema.accountsPayable.supplierId, schema.suppliers.id))
          .where(and(
            inArray(schema.accountsPayable.netAmount, amountPool),
            gte(schema.accountsPayable.dueDate, new Date(new Date(dateRange.min).getTime() - 45 * 86400000).toISOString().slice(0, 10)),
            lte(schema.accountsPayable.dueDate, new Date(new Date(dateRange.max).getTime() + 45 * 86400000).toISOString().slice(0, 10)),
            or(
              eq(schema.accountsPayable.status, 'pending'),
              eq(schema.accountsPayable.status, 'approved'),
              eq(schema.accountsPayable.status, 'overdue'),
              eq(schema.accountsPayable.status, 'paid'),
            ),
          ))
          .orderBy(desc(schema.accountsPayable.dueDate))
      : [];

    const receivables = amountPool.length
      ? await db.select({
          id: schema.accountsReceivable.id,
          patientName: schema.patients.name,
          insuranceName: schema.insuranceProviders.name,
          procedureDescription: schema.accountsReceivable.procedureDescription,
          totalAmount: schema.accountsReceivable.totalAmount,
          receivedAmount: schema.accountsReceivable.receivedAmount,
          glosaAmount: schema.accountsReceivable.glosaAmount,
          dueDate: schema.accountsReceivable.dueDate,
          status: schema.accountsReceivable.status,
        })
          .from(schema.accountsReceivable)
          .leftJoin(schema.patients, eq(schema.accountsReceivable.patientId, schema.patients.id))
          .leftJoin(schema.insuranceProviders, eq(schema.accountsReceivable.insuranceProviderId, schema.insuranceProviders.id))
          .where(and(
            gte(schema.accountsReceivable.dueDate, new Date(new Date(dateRange.min).getTime() - 60 * 86400000).toISOString().slice(0, 10)),
            lte(schema.accountsReceivable.dueDate, new Date(new Date(dateRange.max).getTime() + 60 * 86400000).toISOString().slice(0, 10)),
            or(
              eq(schema.accountsReceivable.status, 'pending'),
              eq(schema.accountsReceivable.status, 'partial'),
              eq(schema.accountsReceivable.status, 'overdue'),
              eq(schema.accountsReceivable.status, 'received'),
            ),
          ))
          .orderBy(desc(schema.accountsReceivable.dueDate))
      : [];

    normalizedRows.forEach((row) => {
      if (row.duplicate) {
        row.match = {
          kind: 'none',
          confidence: 1,
          autoAction: 'record_only',
          label: 'Transação já importada',
          id: null,
          reason: 'externalRef já existe na base.',
        };
        return;
      }

      if (row.type === 'debit') {
        let bestScore = 0;
        let best: any = null;

        for (const payable of payables) {
          const amountScore = payable.netAmount === row.amount ? 0.6 : 0;
          if (!amountScore) continue;

          const descriptionScore = Math.max(
            overlapScore(row.normalizedDescription, payable.description || ''),
            overlapScore(row.normalizedDescription, payable.supplierName || ''),
          ) * 0.3;

          const baseDate = payable.paymentDate || payable.dueDate;
          const dayGap = Math.abs((new Date(baseDate).getTime() - new Date(row.date).getTime()) / 86400000);
          const dateScore = dayGap <= 3 ? 0.12 : dayGap <= 10 ? 0.06 : 0;
          const score = amountScore + descriptionScore + dateScore + Math.min(row.aiConfidence * 0.08, 0.08);

          if (score > bestScore) {
            bestScore = score;
            best = payable;
          }
        }

        if (best && bestScore >= 0.7) {
          row.match = {
            kind: 'payable',
            confidence: clamp(bestScore),
            autoAction: best.status === 'paid' ? 'record_only' : 'mark_paid',
            id: best.id,
            label: best.supplierName || best.description,
            reason: 'Valor igual, proximidade de data e similaridade de descrição.',
          };
        }
        return;
      }

      let bestScore = 0;
      let best: any = null;
      for (const receivable of receivables) {
        const openBalance = receivable.totalAmount - (receivable.receivedAmount || 0) - (receivable.glosaAmount || 0);
        if (openBalance < row.amount) continue;

        const amountScore = openBalance === row.amount || receivable.totalAmount === row.amount ? 0.56 : openBalance > row.amount ? 0.3 : 0;
        if (!amountScore) continue;

        const descriptionScore = Math.max(
          overlapScore(row.normalizedDescription, receivable.patientName || ''),
          overlapScore(row.normalizedDescription, receivable.procedureDescription || ''),
          overlapScore(row.normalizedDescription, receivable.insuranceName || ''),
        ) * 0.28;

        const dayGap = Math.abs((new Date(receivable.dueDate).getTime() - new Date(row.date).getTime()) / 86400000);
        const dateScore = dayGap <= 5 ? 0.12 : dayGap <= 15 ? 0.06 : 0;
        const score = amountScore + descriptionScore + dateScore + Math.min(row.aiConfidence * 0.08, 0.08);

        if (score > bestScore) {
          bestScore = score;
          best = receivable;
        }
      }

      if (best && bestScore >= 0.66) {
        row.match = {
          kind: 'receivable',
          confidence: clamp(bestScore),
          autoAction: best.status === 'received' ? 'record_only' : 'register_receipt',
          id: best.id,
          label: best.patientName || best.procedureDescription || best.insuranceName,
          reason: 'Saldo compatível com a entrada e aderência textual.',
        };
      }
    });

    return {
      bankAccount: {
        id: bankAccount.id,
        nickname: bankAccount.nickname,
        bankName: bankAccount.bankName,
        accountNumber: bankAccount.accountNumber,
      },
      rows: normalizedRows,
      summary: {
        totalRows: normalizedRows.length,
        duplicates: normalizedRows.filter((row) => row.duplicate).length,
        matchedPayables: normalizedRows.filter((row) => row.match.kind === 'payable').length,
        matchedReceivables: normalizedRows.filter((row) => row.match.kind === 'receivable').length,
        credits: normalizedRows.filter((row) => row.type === 'credit').reduce((sum, row) => sum + row.amount, 0),
        debits: normalizedRows.filter((row) => row.type === 'debit').reduce((sum, row) => sum + row.amount, 0),
      },
    };
  }

  async apply(payload: StatementImportPayload, userId?: string) {
    const preview = await this.preview(payload);
    let imported = 0;
    let payablesUpdated = 0;
    let receivablesUpdated = 0;

    for (const row of preview.rows) {
      if (row.duplicate) continue;

      await db.insert(schema.bankTransactions).values({
        bankAccountId: payload.bankAccountId,
        transactionDate: row.date,
        type: row.type,
        amount: row.amount,
        balance: row.balance ?? undefined,
        description: row.description,
        externalRef: row.externalRef,
        accountPayableId: row.match.kind === 'payable' ? row.match.id || undefined : undefined,
        accountReceivableId: row.match.kind === 'receivable' ? row.match.id || undefined : undefined,
        reconciled: row.match.kind !== 'none',
        reconciledAt: row.match.kind !== 'none' ? new Date() : undefined,
        reconciledBy: row.match.kind !== 'none' ? userId : undefined,
      });
      imported += 1;

      if (row.match.kind === 'payable' && row.match.id && row.match.autoAction === 'mark_paid') {
        const [existing] = await db.select().from(schema.accountsPayable).where(eq(schema.accountsPayable.id, row.match.id));
        if (existing && existing.status !== 'paid' && existing.status !== 'cancelled') {
          await db.update(schema.accountsPayable)
            .set({
              status: 'paid',
              paymentDate: row.date,
              paymentMethod: existing.paymentMethod || 'statement_import',
              bankAccountId: payload.bankAccountId,
              paidBy: userId,
              updatedAt: new Date(),
              notes: `${existing.notes || ''}\n[Extrato IA] ${payload.fileName}`.trim(),
            })
            .where(eq(schema.accountsPayable.id, row.match.id));
          payablesUpdated += 1;
        }
      }

      if (row.match.kind === 'receivable' && row.match.id && row.match.autoAction === 'register_receipt') {
        const [existing] = await db.select().from(schema.accountsReceivable).where(eq(schema.accountsReceivable.id, row.match.id));
        if (!existing) continue;

        const currentBalance = existing.totalAmount - (existing.receivedAmount || 0) - (existing.glosaAmount || 0);
        if (currentBalance <= 0 || row.amount > currentBalance) continue;

        await db.insert(schema.receivablePayments).values({
          accountReceivableId: row.match.id,
          amount: row.amount,
          paymentDate: row.date,
          paymentMethod: 'statement_import',
          bankAccountId: payload.bankAccountId,
          transactionRef: row.externalRef,
          notes: `[Extrato IA] ${payload.fileName}`,
          receivedBy: userId,
        });

        const newReceivedAmount = (existing.receivedAmount || 0) + row.amount;
        const newBalance = existing.totalAmount - newReceivedAmount - (existing.glosaAmount || 0);

        await db.update(schema.accountsReceivable)
          .set({
            receivedAmount: newReceivedAmount,
            receivedDate: newBalance <= 0 ? row.date : existing.receivedDate,
            status: newBalance <= 0 ? 'received' : 'partial',
            updatedAt: new Date(),
          })
          .where(eq(schema.accountsReceivable.id, row.match.id));

        receivablesUpdated += 1;
      }
    }

    const latestBalancedRow = [...preview.rows]
      .filter((row) => !row.duplicate && row.balance != null)
      .sort((left, right) => `${left.date}-${left.index}`.localeCompare(`${right.date}-${right.index}`))
      .pop();

    if (latestBalancedRow?.balance != null) {
      await db.update(schema.bankAccounts)
        .set({
          currentBalance: latestBalancedRow.balance,
          updatedAt: new Date(),
        })
        .where(eq(schema.bankAccounts.id, payload.bankAccountId));
    }

    return {
      ...preview,
      applied: {
        imported,
        payablesUpdated,
        receivablesUpdated,
        bankBalanceUpdated: Boolean(latestBalancedRow?.balance != null),
      },
    };
  }
}
