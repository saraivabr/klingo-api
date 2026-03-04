import { pgTable, uuid, varchar, text, integer, boolean, date, time, timestamp, jsonb, serial, index, uniqueIndex, customType } from 'drizzle-orm/pg-core';

const vector = customType<{ data: number[]; dpiData: unknown }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]) {
    return JSON.stringify(value);
  },
  fromDriver(value: unknown) {
    if (typeof value === 'string') return JSON.parse(value) as number[];
    return value as number[];
  },
});

export const patients = pgTable('patients', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: varchar('phone', { length: 20 }).unique().notNull(),
  name: varchar('name', { length: 255 }),
  cpfHash: varchar('cpf_hash', { length: 64 }),
  birthDate: date('birth_date'),
  source: varchar('source', { length: 50 }),
  email: varchar('email', { length: 255 }),
  klingoPatientId: integer('klingo_patient_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  role: varchar('role', { length: 20 }).default('attendant'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  priceCents: integer('price_cents'),
  durationMinutes: integer('duration_minutes'),
  category: varchar('category', { length: 100 }),
  isActive: boolean('is_active').default(true),
});

export const doctors = pgTable('doctors', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  specialty: varchar('specialty', { length: 100 }),
  crm: varchar('crm', { length: 20 }),
  klingoId: integer('klingo_id'),
  isActive: boolean('is_active').default(true),
});

export const appointments = pgTable('appointments', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').references(() => patients.id),
  doctorId: uuid('doctor_id').references(() => doctors.id),
  serviceId: uuid('service_id').references(() => services.id),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 20 }).default('scheduled'),
  notes: text('notes'),
  createdBy: varchar('created_by', { length: 20 }).default('ai'),
  conversationMongoId: varchar('conversation_mongo_id', { length: 24 }),
  klingoSyncStatus: varchar('klingo_sync_status', { length: 20 }).default('pending'),
  klingoSyncError: text('klingo_sync_error'),
  klingoSyncAttempts: integer('klingo_sync_attempts').default(0),
  klingoVoucherId: integer('klingo_voucher_id'),
  klingoReservationId: varchar('klingo_reservation_id', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const escalations = pgTable('escalations', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationMongoId: varchar('conversation_mongo_id', { length: 24 }).notNull(),
  patientId: uuid('patient_id').references(() => patients.id),
  assignedTo: uuid('assigned_to').references(() => users.id),
  reason: varchar('reason', { length: 50 }).notNull(),
  priority: integer('priority').default(5),
  status: varchar('status', { length: 20 }).default('pending'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const businessHours = pgTable('business_hours', {
  id: serial('id').primaryKey(),
  dayOfWeek: integer('day_of_week').notNull(),
  openTime: time('open_time'),
  closeTime: time('close_time'),
  isOpen: boolean('is_open').default(true),
});

export const knowledgeBase = pgTable('knowledge_base', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 100 }).unique().notNull(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  category: varchar('category', { length: 50 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const aiSettings = pgTable('ai_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const bookingLinks = pgTable('booking_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: varchar('token', { length: 30 }).notNull(),
  patientPhone: varchar('patient_phone', { length: 20 }),
  patientName: varchar('patient_name', { length: 255 }),
  conversationMongoId: varchar('conversation_mongo_id', { length: 24 }),
  specialty: varchar('specialty', { length: 100 }).notNull(),
  doctorId: uuid('doctor_id').references(() => doctors.id),
  serviceId: uuid('service_id').references(() => services.id),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  appointmentId: uuid('appointment_id').references(() => appointments.id),
  bookedAt: timestamp('booked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  tokenIdx: uniqueIndex('booking_links_token_idx').on(table.token),
  statusIdx: index('booking_links_status_idx').on(table.status),
}));

export const knowledgeEmbeddings = pgTable('knowledge_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  chunkId: varchar('chunk_id', { length: 255 }).unique().notNull(),
  content: text('content').notNull(),
  section: varchar('section', { length: 100 }),
  embedding: vector('embedding').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  sectionIdx: index('knowledge_embeddings_section_idx').on(table.section),
}));

// === Plans & Subscriptions (Asaas) ===

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  klingoPlanId: integer('klingo_plan_id').unique(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  priceCents: integer('price_cents').notNull(),
  description: text('description'),
  features: jsonb('features'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const asaasCustomers = pgTable('asaas_customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').references(() => patients.id).unique().notNull(),
  asaasId: varchar('asaas_id', { length: 100 }).unique().notNull(),
  cpf: varchar('cpf', { length: 14 }).notNull(),
  email: varchar('email', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').references(() => patients.id).notNull(),
  planId: uuid('plan_id').references(() => plans.id).notNull(),
  asaasSubscriptionId: varchar('asaas_subscription_id', { length: 100 }).unique(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  billingType: varchar('billing_type', { length: 20 }).notNull(),
  nextDueDate: date('next_due_date'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  patientIdx: index('subscriptions_patient_id_idx').on(table.patientId),
  statusIdx: index('subscriptions_status_idx').on(table.status),
}));

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id).notNull(),
  asaasPaymentId: varchar('asaas_payment_id', { length: 100 }).unique(),
  status: varchar('status', { length: 20 }).default('PENDING').notNull(),
  billingType: varchar('billing_type', { length: 20 }),
  amountCents: integer('amount_cents').notNull(),
  dueDate: date('due_date'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  invoiceUrl: text('invoice_url'),
  pixQrCode: text('pix_qr_code'),
  asaasPayload: jsonb('asaas_payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  subscriptionIdx: index('payments_subscription_id_idx').on(table.subscriptionId),
  statusIdx: index('payments_status_idx').on(table.status),
}));

// === Teleconsultation ===

export const teleconsultationRooms = pgTable('teleconsultation_rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  appointmentId: uuid('appointment_id').references(() => appointments.id),
  patientId: uuid('patient_id').references(() => patients.id),
  doctorId: uuid('doctor_id').references(() => doctors.id),
  roomCode: varchar('room_code', { length: 20 }).unique().notNull(),
  patientToken: varchar('patient_token', { length: 30 }).unique().notNull(),
  status: varchar('status', { length: 20 }).default('waiting').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationSeconds: integer('duration_seconds'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  statusIdx: index('teleconsultation_rooms_status_idx').on(table.status),
  roomCodeIdx: uniqueIndex('teleconsultation_rooms_room_code_idx').on(table.roomCode),
  patientTokenIdx: uniqueIndex('teleconsultation_rooms_patient_token_idx').on(table.patientToken),
  scheduledAtIdx: index('teleconsultation_rooms_scheduled_at_idx').on(table.scheduledAt),
}));

export const prescriptions = pgTable('prescriptions', {
   id: uuid('id').primaryKey().defaultRandom(),
   teleconsultationId: uuid('teleconsultation_id').references(() => teleconsultationRooms.id),
   doctorId: uuid('doctor_id').references(() => doctors.id),
   patientId: uuid('patient_id').references(() => patients.id),
   type: varchar('type', { length: 20 }).notNull(),
   content: jsonb('content').notNull(),
   pdfUrl: text('pdf_url'),
   sentViaWhatsapp: boolean('sent_via_whatsapp').default(false),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   teleconsultationIdx: index('prescriptions_teleconsultation_id_idx').on(table.teleconsultationId),
}));

// === Doctor Schedules ===

export const schedules = pgTable('schedules', {
   id: uuid('id').primaryKey().defaultRandom(),
   doctorId: uuid('doctor_id').references(() => doctors.id).notNull(),
   dayOfWeek: integer('day_of_week').notNull(), // 0-6 (Sun-Sat)
   startTime: time('start_time').notNull(),
   endTime: time('end_time').notNull(),
   perPatientTime: integer('per_patient_time').notNull(), // minutes
   isActive: boolean('is_active').default(true),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   doctorDayIdx: index('schedules_doctor_day_idx').on(table.doctorId, table.dayOfWeek),
}));

export const doctorHolidays = pgTable('doctor_holidays', {
   id: uuid('id').primaryKey().defaultRandom(),
   doctorId: uuid('doctor_id').references(() => doctors.id).notNull(),
   date: date('date').notNull(),
   reason: varchar('reason', { length: 255 }),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   doctorDateIdx: index('doctor_holidays_doctor_date_idx').on(table.doctorId, table.date),
}));

export const lunchBreaks = pgTable('lunch_breaks', {
   id: uuid('id').primaryKey().defaultRandom(),
   doctorId: uuid('doctor_id').references(() => doctors.id).notNull(),
   startTime: time('start_time').notNull(),
   endTime: time('end_time').notNull(),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   doctorIdx: index('lunch_breaks_doctor_idx').on(table.doctorId),
}));

// === Billing & Invoices ===

export const chargeCategories = pgTable('charge_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const charges = pgTable('charges', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').references(() => chargeCategories.id).notNull(),
  code: varchar('code', { length: 50 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  standardCharge: integer('standard_charge').notNull(), // in cents
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  categoryIdx: index('charges_category_id_idx').on(table.categoryId),
  codeIdx: uniqueIndex('charges_code_idx').on(table.code),
}));

export const bills = pgTable('bills', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').references(() => patients.id).notNull(),
  opdVisitId: uuid('opd_visit_id'),
  billNumber: varchar('bill_number', { length: 50 }).unique().notNull(),
  totalAmount: integer('total_amount').notNull(), // in cents
  discountPercent: integer('discount_percent').default(0),
  netAmount: integer('net_amount').notNull(), // in cents
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, partial, paid, cancelled
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  patientIdx: index('bills_patient_id_idx').on(table.patientId),
  statusIdx: index('bills_status_idx').on(table.status),
  billNumberIdx: uniqueIndex('bills_bill_number_idx').on(table.billNumber),
}));

export const billItems = pgTable('bill_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  billId: uuid('bill_id').references(() => bills.id).notNull(),
  chargeId: uuid('charge_id').references(() => charges.id).notNull(),
  description: text('description'),
  quantity: integer('quantity').default(1).notNull(),
  unitPrice: integer('unit_price').notNull(), // in cents
  totalPrice: integer('total_price').notNull(), // in cents
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  billIdx: index('bill_items_bill_id_idx').on(table.billId),
  chargeIdx: index('bill_items_charge_id_idx').on(table.chargeId),
}));

export const billTransactions = pgTable('bill_transactions', {
   id: uuid('id').primaryKey().defaultRandom(),
   billId: uuid('bill_id').references(() => bills.id).notNull(),
   amountPaid: integer('amount_paid').notNull(), // in cents
   paymentMethod: varchar('payment_method', { length: 50 }).notNull(), // cash, card, pix, cheque, etc
   transactionRef: varchar('transaction_ref', { length: 100 }),
   paidAt: timestamp('paid_at', { withTimezone: true }).defaultNow(),
   notes: text('notes'),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   billIdx: index('bill_transactions_bill_id_idx').on(table.billId),
   paidAtIdx: index('bill_transactions_paid_at_idx').on(table.paidAt),
}));

// === Laboratory / Pathology ===

export const labCategories = pgTable('lab_categories', {
   id: uuid('id').primaryKey().defaultRandom(),
   name: varchar('name', { length: 255 }).notNull(),
   description: text('description'),
   isActive: boolean('is_active').default(true),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   nameIdx: index('lab_categories_name_idx').on(table.name),
}));

export const labTests = pgTable('lab_tests', {
   id: uuid('id').primaryKey().defaultRandom(),
   categoryId: uuid('category_id').references(() => labCategories.id).notNull(),
   name: varchar('name', { length: 255 }).notNull(),
   shortName: varchar('short_name', { length: 50 }),
   testType: varchar('test_type', { length: 100 }),
   method: varchar('method', { length: 100 }),
   unit: varchar('unit', { length: 50 }),
   normalRange: varchar('normal_range', { length: 100 }),
   chargeCents: integer('charge_cents'),
   turnaroundHours: integer('turnaround_hours'),
   isActive: boolean('is_active').default(true),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   categoryIdx: index('lab_tests_category_id_idx').on(table.categoryId),
   nameIdx: index('lab_tests_name_idx').on(table.name),
}));

export const labParameters = pgTable('lab_parameters', {
   id: uuid('id').primaryKey().defaultRandom(),
   labTestId: uuid('lab_test_id').references(() => labTests.id).notNull(),
   parameterName: varchar('parameter_name', { length: 255 }).notNull(),
   unit: varchar('unit', { length: 50 }),
   normalRange: varchar('normal_range', { length: 100 }),
   sortOrder: integer('sort_order').default(0),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   labTestIdx: index('lab_parameters_lab_test_id_idx').on(table.labTestId),
}));

export const labOrders = pgTable('lab_orders', {
   id: uuid('id').primaryKey().defaultRandom(),
   patientId: uuid('patient_id').references(() => patients.id).notNull(),
   doctorId: uuid('doctor_id').references(() => doctors.id),
   opdVisitId: uuid('opd_visit_id'),
   orderNumber: varchar('order_number', { length: 50 }).unique().notNull(),
   status: varchar('status', { length: 20 }).default('ordered'), // ordered, collected, processing, completed, cancelled
   priority: varchar('priority', { length: 20 }).default('normal'), // normal, urgent
   notes: text('notes'),
   orderedAt: timestamp('ordered_at', { withTimezone: true }).notNull(),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   patientIdx: index('lab_orders_patient_id_idx').on(table.patientId),
   doctorIdx: index('lab_orders_doctor_id_idx').on(table.doctorId),
   statusIdx: index('lab_orders_status_idx').on(table.status),
   orderNumberIdx: uniqueIndex('lab_orders_order_number_idx').on(table.orderNumber),
}));

export const labOrderItems = pgTable('lab_order_items', {
   id: uuid('id').primaryKey().defaultRandom(),
   labOrderId: uuid('lab_order_id').references(() => labOrders.id).notNull(),
   labTestId: uuid('lab_test_id').references(() => labTests.id).notNull(),
   status: varchar('status', { length: 20 }).default('pending'), // pending, collected, processing, completed
   sampleCollectedAt: timestamp('sample_collected_at', { withTimezone: true }),
   resultEnteredAt: timestamp('result_entered_at', { withTimezone: true }),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   labOrderIdx: index('lab_order_items_lab_order_id_idx').on(table.labOrderId),
   labTestIdx: index('lab_order_items_lab_test_id_idx').on(table.labTestId),
   statusIdx: index('lab_order_items_status_idx').on(table.status),
}));

export const labResults = pgTable('lab_results', {
   id: uuid('id').primaryKey().defaultRandom(),
   labOrderItemId: uuid('lab_order_item_id').references(() => labOrderItems.id).notNull(),
   parameterId: uuid('parameter_id').references(() => labParameters.id),
   value: varchar('value', { length: 255 }),
   isAbnormal: boolean('is_abnormal').default(false),
   notes: text('notes'),
   enteredBy: uuid('entered_by').references(() => users.id),
   enteredAt: timestamp('entered_at', { withTimezone: true }).notNull(),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   labOrderItemIdx: index('lab_results_lab_order_item_id_idx').on(table.labOrderItemId),
   parameterIdx: index('lab_results_parameter_id_idx').on(table.parameterId),
}));

// === OPD Visits ===

export const opdVisits = pgTable('opd_visits', {
   id: uuid('id').primaryKey().defaultRandom(),
   patientId: uuid('patient_id').references(() => patients.id).notNull(),
   doctorId: uuid('doctor_id').references(() => doctors.id).notNull(),
   appointmentId: uuid('appointment_id').references(() => appointments.id),
   visitDate: date('visit_date').notNull(),
   caseId: varchar('case_id', { length: 50 }),
   symptoms: text('symptoms'),
   notes: text('notes'),
   status: varchar('status', { length: 20 }).default('waiting'), // waiting, in_progress, completed
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   patientIdx: index('opd_visits_patient_id_idx').on(table.patientId),
   doctorIdx: index('opd_visits_doctor_id_idx').on(table.doctorId),
   statusIdx: index('opd_visits_status_idx').on(table.status),
   visitDateIdx: index('opd_visits_visit_date_idx').on(table.visitDate),
}));

export const opdVitals = pgTable('opd_vitals', {
   id: uuid('id').primaryKey().defaultRandom(),
   opdVisitId: uuid('opd_visit_id').references(() => opdVisits.id).notNull(),
   height: integer('height'), // cm
   weight: integer('weight'), // grams
   bloodPressure: varchar('blood_pressure', { length: 20 }),
   pulse: integer('pulse'),
   temperature: integer('temperature'), // °C * 10
   respirationRate: integer('respiration_rate'),
   recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   opdVisitIdx: index('opd_vitals_opd_visit_id_idx').on(table.opdVisitId),
}));

export const opdDiagnoses = pgTable('opd_diagnoses', {
   id: uuid('id').primaryKey().defaultRandom(),
   opdVisitId: uuid('opd_visit_id').references(() => opdVisits.id).notNull(),
   diagnosisCode: varchar('diagnosis_code', { length: 20 }), // CID-10
   description: text('description'),
   notes: text('notes'),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   opdVisitIdx: index('opd_diagnoses_opd_visit_id_idx').on(table.opdVisitId),
}));

export const opdTimelines = pgTable('opd_timelines', {
   id: uuid('id').primaryKey().defaultRandom(),
   opdVisitId: uuid('opd_visit_id').references(() => opdVisits.id).notNull(),
   title: varchar('title', { length: 255 }).notNull(),
   description: text('description'),
   date: timestamp('date', { withTimezone: true }).defaultNow(),
   createdBy: uuid('created_by').references(() => users.id),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   opdVisitIdx: index('opd_timelines_opd_visit_id_idx').on(table.opdVisitId),
}));

// === Pharmacy ===

export const medicineCategories = pgTable('medicine_categories', {
   id: uuid('id').primaryKey().defaultRandom(),
   name: varchar('name', { length: 255 }).notNull(),
   description: text('description'),
   isActive: boolean('is_active').default(true),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   nameIdx: index('medicine_categories_name_idx').on(table.name),
}));

export const medicineBrands = pgTable('medicine_brands', {
   id: uuid('id').primaryKey().defaultRandom(),
   name: varchar('name', { length: 255 }).notNull(),
   isActive: boolean('is_active').default(true),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   nameIdx: index('medicine_brands_name_idx').on(table.name),
}));

export const medicines = pgTable('medicines', {
   id: uuid('id').primaryKey().defaultRandom(),
   categoryId: uuid('category_id').references(() => medicineCategories.id),
   brandId: uuid('brand_id').references(() => medicineBrands.id),
   name: varchar('name', { length: 255 }).notNull(),
   genericName: varchar('generic_name', { length: 255 }),
   composition: text('composition'),
   unit: varchar('unit', { length: 50 }).default('unidade'),
   sellingPrice: integer('selling_price').notNull(), // centavos
   purchasePrice: integer('purchase_price'), // centavos
   quantity: integer('quantity').default(0),
   alertQuantity: integer('alert_quantity').default(10),
   expiryDate: date('expiry_date'),
   batchNumber: varchar('batch_number', { length: 50 }),
   isActive: boolean('is_active').default(true),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   categoryIdx: index('medicines_category_id_idx').on(table.categoryId),
   brandIdx: index('medicines_brand_id_idx').on(table.brandId),
   nameIdx: index('medicines_name_idx').on(table.name),
}));

export const medicineSales = pgTable('medicine_sales', {
   id: uuid('id').primaryKey().defaultRandom(),
   patientId: uuid('patient_id').references(() => patients.id),
   saleNumber: varchar('sale_number', { length: 50 }).unique().notNull(),
   totalAmount: integer('total_amount').notNull(), // centavos
   discountPercent: integer('discount_percent').default(0),
   netAmount: integer('net_amount').notNull(), // centavos
   paymentMethod: varchar('payment_method', { length: 50 }).default('dinheiro'),
   status: varchar('status', { length: 20 }).default('completed'),
   soldBy: uuid('sold_by').references(() => users.id),
   soldAt: timestamp('sold_at', { withTimezone: true }).defaultNow(),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   patientIdx: index('medicine_sales_patient_id_idx').on(table.patientId),
   saleNumberIdx: uniqueIndex('medicine_sales_sale_number_idx').on(table.saleNumber),
   soldAtIdx: index('medicine_sales_sold_at_idx').on(table.soldAt),
}));

export const medicineSaleItems = pgTable('medicine_sale_items', {
   id: uuid('id').primaryKey().defaultRandom(),
   saleId: uuid('sale_id').references(() => medicineSales.id).notNull(),
   medicineId: uuid('medicine_id').references(() => medicines.id).notNull(),
   quantity: integer('quantity').notNull(),
   unitPrice: integer('unit_price').notNull(), // centavos
   totalPrice: integer('total_price').notNull(), // centavos
   batchNumber: varchar('batch_number', { length: 50 }),
   expiryDate: date('expiry_date'),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   saleIdx: index('medicine_sale_items_sale_id_idx').on(table.saleId),
   medicineIdx: index('medicine_sale_items_medicine_id_idx').on(table.medicineId),
}));
