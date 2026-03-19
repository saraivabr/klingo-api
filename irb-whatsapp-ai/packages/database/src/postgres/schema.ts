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
  // UTM tracking
  utmSource: varchar('utm_source', { length: 100 }),
  utmMedium: varchar('utm_medium', { length: 100 }),
  utmCampaign: varchar('utm_campaign', { length: 200 }),
  campaignId: integer('campaign_id').references((): any => campaigns.id),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  role: varchar('role', { length: 20 }).default('attendant'),
  department: varchar('department', { length: 100 }),
  jobTitle: varchar('job_title', { length: 100 }),
  managerName: varchar('manager_name', { length: 100 }),
  accessProfile: varchar('access_profile', { length: 50 }).default('attendant_basic'),
  permissionOverrides: jsonb('permission_overrides').$type<{ allow?: string[]; deny?: string[] }>(),
  accessScope: jsonb('access_scope').$type<{
    allCostCenters?: boolean;
    costCenterIds?: string[];
    units?: string[];
  }>(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
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

// ============================================
// === FINANCIAL MODULE - Accounts Payable ===
// ============================================

// Cost Centers (21 units: Projetos, Bragança, Paraguaçu, SAMU-MG, Nardini, Rondônia, etc.)
export const costCenters = pgTable('cost_centers', {
   id: uuid('id').primaryKey().defaultRandom(),
   code: varchar('code', { length: 20 }).unique().notNull(),
   name: varchar('name', { length: 100 }).notNull(),
   description: text('description'),
   parentId: uuid('parent_id').references((): any => costCenters.id),
   isActive: boolean('is_active').default(true),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   codeIdx: uniqueIndex('cost_centers_code_idx').on(table.code),
   parentIdx: index('cost_centers_parent_id_idx').on(table.parentId),
}));

// Chart of Accounts (25 categories: Pessoal, Impostos, Operacional, etc.)
export const chartOfAccounts = pgTable('chart_of_accounts', {
   id: uuid('id').primaryKey().defaultRandom(),
   code: varchar('code', { length: 20 }).unique().notNull(),
   name: varchar('name', { length: 100 }).notNull(),
   type: varchar('type', { length: 20 }).notNull(), // expense, revenue, asset, liability
   parentId: uuid('parent_id').references((): any => chartOfAccounts.id),
   isActive: boolean('is_active').default(true),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   codeIdx: uniqueIndex('chart_of_accounts_code_idx').on(table.code),
   typeIdx: index('chart_of_accounts_type_idx').on(table.type),
}));

// Suppliers (Fornecedores)
export const suppliers = pgTable('suppliers', {
   id: uuid('id').primaryKey().defaultRandom(),
   cnpj: varchar('cnpj', { length: 18 }).unique(),
   cpf: varchar('cpf', { length: 14 }),
   legalName: varchar('legal_name', { length: 255 }).notNull(), // Razão Social
   tradeName: varchar('trade_name', { length: 255 }), // Nome Fantasia
   email: varchar('email', { length: 255 }),
   phone: varchar('phone', { length: 20 }),
   address: text('address'),
   city: varchar('city', { length: 100 }),
   state: varchar('state', { length: 2 }),
   zipCode: varchar('zip_code', { length: 10 }),
   bankName: varchar('bank_name', { length: 100 }),
   bankAgency: varchar('bank_agency', { length: 20 }),
   bankAccount: varchar('bank_account', { length: 30 }),
   bankAccountType: varchar('bank_account_type', { length: 20 }), // corrente, poupança
   pixKey: varchar('pix_key', { length: 100 }),
   klingoDoctorId: integer('klingo_doctor_id'), // Link to Klingo for medical professionals
   notes: text('notes'),
   isActive: boolean('is_active').default(true),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   cnpjIdx: uniqueIndex('suppliers_cnpj_idx').on(table.cnpj),
   legalNameIdx: index('suppliers_legal_name_idx').on(table.legalName),
   klingoDoctorIdx: index('suppliers_klingo_doctor_id_idx').on(table.klingoDoctorId),
}));

// Bank Accounts (7 accounts: Bradesco x3, Unicred, Safra, BB)
export const bankAccounts = pgTable('bank_accounts', {
   id: uuid('id').primaryKey().defaultRandom(),
   bankCode: varchar('bank_code', { length: 10 }).notNull(),
   bankName: varchar('bank_name', { length: 100 }).notNull(),
   agency: varchar('agency', { length: 20 }).notNull(),
   accountNumber: varchar('account_number', { length: 30 }).notNull(),
   accountType: varchar('account_type', { length: 20 }).notNull(), // corrente, poupança, aplicação
   nickname: varchar('nickname', { length: 100 }), // Apelido para identificação
   initialBalance: integer('initial_balance').default(0), // centavos
   currentBalance: integer('current_balance').default(0), // centavos
   overdraftLimit: integer('overdraft_limit').default(0), // cheque especial - centavos
   isActive: boolean('is_active').default(true),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   bankAccountIdx: uniqueIndex('bank_accounts_bank_account_idx').on(table.bankCode, table.agency, table.accountNumber),
}));

// Accounts Payable (Contas a Pagar - 862+ entries)
export const accountsPayable = pgTable('accounts_payable', {
   id: uuid('id').primaryKey().defaultRandom(),
   documentNumber: varchar('document_number', { length: 50 }), // NF number
   documentType: varchar('document_type', { length: 30 }), // NF, Boleto, Fatura, Recibo
   supplierId: uuid('supplier_id').references(() => suppliers.id),
   costCenterId: uuid('cost_center_id').references(() => costCenters.id),
   chartAccountId: uuid('chart_account_id').references(() => chartOfAccounts.id),
   bankAccountId: uuid('bank_account_id').references(() => bankAccounts.id),
   description: text('description').notNull(),
   grossAmount: integer('gross_amount').notNull(), // Valor bruto em centavos
   netAmount: integer('net_amount').notNull(), // Valor líquido em centavos
   // Tax retentions (impostos retidos)
   inssRetention: integer('inss_retention').default(0), // centavos
   irpjRetention: integer('irpj_retention').default(0), // centavos
   csllRetention: integer('csll_retention').default(0), // centavos
   cofinsRetention: integer('cofins_retention').default(0), // centavos
   pisRetention: integer('pis_retention').default(0), // centavos
   issRetention: integer('iss_retention').default(0), // centavos
   // Dates
   issueDate: date('issue_date'), // Data de emissão
   dueDate: date('due_date').notNull(), // Data de vencimento
   paymentDate: date('payment_date'), // Data de pagamento efetivo
   competenceDate: date('competence_date'), // Competência contábil
   // Status and workflow
   status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, approved, paid, cancelled, overdue
   paymentMethod: varchar('payment_method', { length: 30 }), // pix, ted, boleto, cheque, dinheiro
   approvedBy: uuid('approved_by').references(() => users.id),
   approvedAt: timestamp('approved_at', { withTimezone: true }),
   paidBy: uuid('paid_by').references(() => users.id),
   notes: text('notes'),
   attachmentUrl: text('attachment_url'), // URL do comprovante/NF
   barcode: varchar('barcode', { length: 100 }), // Código de barras do boleto
   pixCode: text('pix_code'), // Código PIX copia-e-cola
   createdBy: uuid('created_by').references(() => users.id),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   supplierIdx: index('accounts_payable_supplier_id_idx').on(table.supplierId),
   costCenterIdx: index('accounts_payable_cost_center_id_idx').on(table.costCenterId),
   chartAccountIdx: index('accounts_payable_chart_account_id_idx').on(table.chartAccountId),
   statusIdx: index('accounts_payable_status_idx').on(table.status),
   dueDateIdx: index('accounts_payable_due_date_idx').on(table.dueDate),
   paymentDateIdx: index('accounts_payable_payment_date_idx').on(table.paymentDate),
}));

// Payment Approvals (Aprovações de pagamento - workflow)
export const paymentApprovals = pgTable('payment_approvals', {
   id: uuid('id').primaryKey().defaultRandom(),
   accountPayableId: uuid('account_payable_id').references(() => accountsPayable.id).notNull(),
   requestedBy: uuid('requested_by').references(() => users.id),
   requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow(),
   approvedBy: uuid('approved_by').references(() => users.id),
   approvedAt: timestamp('approved_at', { withTimezone: true }),
   status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, approved, rejected
   rejectionReason: text('rejection_reason'),
   notes: text('notes'),
   notifiedViaWhatsapp: boolean('notified_via_whatsapp').default(false),
   whatsappNotifiedAt: timestamp('whatsapp_notified_at', { withTimezone: true }),
}, (table) => ({
   accountPayableIdx: index('payment_approvals_account_payable_id_idx').on(table.accountPayableId),
   statusIdx: index('payment_approvals_status_idx').on(table.status),
}));

// Credit Card Purchases (Compras no cartão corporativo)
export const creditCardPurchases = pgTable('credit_card_purchases', {
   id: uuid('id').primaryKey().defaultRandom(),
   cardLastDigits: varchar('card_last_digits', { length: 4 }),
   cardHolder: varchar('card_holder', { length: 100 }),
   merchantName: varchar('merchant_name', { length: 255 }).notNull(),
   purchaseDate: date('purchase_date').notNull(),
   totalAmount: integer('total_amount').notNull(), // centavos
   installments: integer('installments').default(1),
   installmentAmount: integer('installment_amount').notNull(), // centavos
   currentInstallment: integer('current_installment').default(1),
   costCenterId: uuid('cost_center_id').references(() => costCenters.id),
   chartAccountId: uuid('chart_account_id').references(() => chartOfAccounts.id),
   description: text('description'),
   status: varchar('status', { length: 20 }).default('active').notNull(), // active, paid, cancelled
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   purchaseDateIdx: index('credit_card_purchases_purchase_date_idx').on(table.purchaseDate),
   statusIdx: index('credit_card_purchases_status_idx').on(table.status),
   costCenterIdx: index('credit_card_purchases_cost_center_id_idx').on(table.costCenterId),
}));

// Bank Transactions (Movimentações bancárias para conciliação)
export const bankTransactions = pgTable('bank_transactions', {
   id: uuid('id').primaryKey().defaultRandom(),
   bankAccountId: uuid('bank_account_id').references(() => bankAccounts.id).notNull(),
   transactionDate: date('transaction_date').notNull(),
   type: varchar('type', { length: 20 }).notNull(), // credit, debit, transfer_in, transfer_out
   amount: integer('amount').notNull(), // centavos (positivo)
   balance: integer('balance'), // saldo após transação
   description: text('description'),
   accountPayableId: uuid('account_payable_id').references(() => accountsPayable.id),
   accountReceivableId: uuid('account_receivable_id'), // será referenciado depois
   reconciled: boolean('reconciled').default(false),
   reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
   reconciledBy: uuid('reconciled_by').references(() => users.id),
   externalRef: varchar('external_ref', { length: 100 }), // ID do extrato bancário
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   bankAccountIdx: index('bank_transactions_bank_account_id_idx').on(table.bankAccountId),
   transactionDateIdx: index('bank_transactions_transaction_date_idx').on(table.transactionDate),
   typeIdx: index('bank_transactions_type_idx').on(table.type),
   reconciledIdx: index('bank_transactions_reconciled_idx').on(table.reconciled),
}));

// ============================================
// === FINANCIAL MODULE - Accounts Receivable ===
// ============================================

// Insurance Providers (Convênios - 13 cadastrados)
export const insuranceProviders = pgTable('insurance_providers', {
   id: uuid('id').primaryKey().defaultRandom(),
   code: varchar('code', { length: 20 }).unique(),
   name: varchar('name', { length: 100 }).notNull(),
   cnpj: varchar('cnpj', { length: 18 }),
   ansCode: varchar('ans_code', { length: 20 }), // Código ANS
   contactName: varchar('contact_name', { length: 100 }),
   contactEmail: varchar('contact_email', { length: 255 }),
   contactPhone: varchar('contact_phone', { length: 20 }),
   paymentTermDays: integer('payment_term_days').default(30), // Prazo de pagamento
   notes: text('notes'),
   isActive: boolean('is_active').default(true),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   codeIdx: uniqueIndex('insurance_providers_code_idx').on(table.code),
   nameIdx: index('insurance_providers_name_idx').on(table.name),
}));

// Accounts Receivable (Contas a Receber)
export const accountsReceivable = pgTable('accounts_receivable', {
   id: uuid('id').primaryKey().defaultRandom(),
   patientId: uuid('patient_id').references(() => patients.id),
   doctorId: uuid('doctor_id').references(() => doctors.id),
   insuranceProviderId: uuid('insurance_provider_id').references(() => insuranceProviders.id),
   costCenterId: uuid('cost_center_id').references(() => costCenters.id),
   // Service info
   serviceType: varchar('service_type', { length: 20 }).notNull(), // medical, dental, exam, procedure
   procedureCode: varchar('procedure_code', { length: 50 }), // TUSS code
   procedureDescription: text('procedure_description'),
   guideNumber: varchar('guide_number', { length: 50 }), // Número da guia
   authorizationNumber: varchar('authorization_number', { length: 50 }), // Autorização
   // Amounts
   totalAmount: integer('total_amount').notNull(), // Valor total em centavos
   receivedAmount: integer('received_amount').default(0), // Valor recebido em centavos
   glosaAmount: integer('glosa_amount').default(0), // Valor glosado em centavos
   // Dates
   serviceDate: date('service_date').notNull(), // Data do atendimento
   dueDate: date('due_date').notNull(), // Data de vencimento
   receivedDate: date('received_date'), // Data do recebimento
   // Status
   status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, partial, received, overdue, glosa, cancelled
   paymentType: varchar('payment_type', { length: 20 }).notNull(), // particular, insurance
   notes: text('notes'),
   klingoVoucherId: integer('klingo_voucher_id'), // Link to Klingo appointment
   createdBy: uuid('created_by').references(() => users.id),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   patientIdx: index('accounts_receivable_patient_id_idx').on(table.patientId),
   doctorIdx: index('accounts_receivable_doctor_id_idx').on(table.doctorId),
   insuranceIdx: index('accounts_receivable_insurance_provider_id_idx').on(table.insuranceProviderId),
   statusIdx: index('accounts_receivable_status_idx').on(table.status),
   dueDateIdx: index('accounts_receivable_due_date_idx').on(table.dueDate),
   serviceDateIdx: index('accounts_receivable_service_date_idx').on(table.serviceDate),
   klingoIdx: index('accounts_receivable_klingo_voucher_id_idx').on(table.klingoVoucherId),
}));

// Receivable Installments (Parcelas a receber)
export const receivableInstallments = pgTable('receivable_installments', {
   id: uuid('id').primaryKey().defaultRandom(),
   accountReceivableId: uuid('account_receivable_id').references(() => accountsReceivable.id).notNull(),
   installmentNumber: integer('installment_number').notNull(),
   amount: integer('amount').notNull(), // centavos
   dueDate: date('due_date').notNull(),
   paidAmount: integer('paid_amount').default(0),
   paidDate: date('paid_date'),
   status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, paid, overdue, cancelled
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   accountReceivableIdx: index('receivable_installments_account_receivable_id_idx').on(table.accountReceivableId),
   dueDateIdx: index('receivable_installments_due_date_idx').on(table.dueDate),
   statusIdx: index('receivable_installments_status_idx').on(table.status),
}));

// Receivable Payments (Pagamentos recebidos)
export const receivablePayments = pgTable('receivable_payments', {
   id: uuid('id').primaryKey().defaultRandom(),
   accountReceivableId: uuid('account_receivable_id').references(() => accountsReceivable.id).notNull(),
   installmentId: uuid('installment_id').references(() => receivableInstallments.id),
   amount: integer('amount').notNull(), // centavos
   paymentDate: date('payment_date').notNull(),
   paymentMethod: varchar('payment_method', { length: 30 }).notNull(), // pix, ted, boleto, dinheiro, cheque, cartao
   bankAccountId: uuid('bank_account_id').references(() => bankAccounts.id),
   transactionRef: varchar('transaction_ref', { length: 100 }),
   notes: text('notes'),
   receivedBy: uuid('received_by').references(() => users.id),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   accountReceivableIdx: index('receivable_payments_account_receivable_id_idx').on(table.accountReceivableId),
   paymentDateIdx: index('receivable_payments_payment_date_idx').on(table.paymentDate),
}));

// ============================================
// === FINANCIAL MODULE - Reimbursements & VT ===
// ============================================

// Reimbursement Requests (Solicitações de reembolso de viagem)
export const reimbursementRequests = pgTable('reimbursement_requests', {
   id: uuid('id').primaryKey().defaultRandom(),
   requestNumber: varchar('request_number', { length: 30 }).unique().notNull(),
   employeeName: varchar('employee_name', { length: 255 }).notNull(),
   employeeDepartment: varchar('employee_department', { length: 100 }),
   employeeCpf: varchar('employee_cpf', { length: 14 }),
   // Trip info
   tripOrigin: varchar('trip_origin', { length: 100 }),
   tripDestination: varchar('trip_destination', { length: 100 }),
   tripStartDate: date('trip_start_date').notNull(),
   tripEndDate: date('trip_end_date').notNull(),
   tripPurpose: text('trip_purpose'),
   // Bank info for deposit
   bankName: varchar('bank_name', { length: 100 }),
   bankAgency: varchar('bank_agency', { length: 20 }),
   bankAccount: varchar('bank_account', { length: 30 }),
   bankAccountType: varchar('bank_account_type', { length: 20 }),
   pixKey: varchar('pix_key', { length: 100 }),
   // Totals
   totalAmount: integer('total_amount').default(0), // centavos (sum of items)
   approvedAmount: integer('approved_amount'), // centavos
   // Status
   status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, approved, rejected, paid
   requestedBy: uuid('requested_by').references(() => users.id),
   approvedBy: uuid('approved_by').references(() => users.id),
   approvedAt: timestamp('approved_at', { withTimezone: true }),
   paidAt: timestamp('paid_at', { withTimezone: true }),
   rejectionReason: text('rejection_reason'),
   notes: text('notes'),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   requestNumberIdx: uniqueIndex('reimbursement_requests_request_number_idx').on(table.requestNumber),
   statusIdx: index('reimbursement_requests_status_idx').on(table.status),
   employeeIdx: index('reimbursement_requests_employee_name_idx').on(table.employeeName),
}));

// Reimbursement Items (Itens do reembolso)
export const reimbursementItems = pgTable('reimbursement_items', {
   id: uuid('id').primaryKey().defaultRandom(),
   reimbursementRequestId: uuid('reimbursement_request_id').references(() => reimbursementRequests.id).notNull(),
   expenseDate: date('expense_date').notNull(),
   expenseType: varchar('expense_type', { length: 50 }).notNull(), // alimentacao, transporte, hospedagem, combustivel, pedagio, outros
   description: text('description'),
   receiptNumber: varchar('receipt_number', { length: 50 }), // Cupom fiscal
   amount: integer('amount').notNull(), // centavos
   attachmentUrl: text('attachment_url'),
   approved: boolean('approved'),
   approvedAmount: integer('approved_amount'), // centavos (pode ser diferente do solicitado)
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   reimbursementRequestIdx: index('reimbursement_items_reimbursement_request_id_idx').on(table.reimbursementRequestId),
   expenseDateIdx: index('reimbursement_items_expense_date_idx').on(table.expenseDate),
}));

// Transport Vouchers (Vale-transporte CLTs)
export const transportVouchers = pgTable('transport_vouchers', {
   id: uuid('id').primaryKey().defaultRandom(),
   employeeName: varchar('employee_name', { length: 255 }).notNull(),
   employeeCpf: varchar('employee_cpf', { length: 14 }),
   employeeRole: varchar('employee_role', { length: 100 }),
   contractType: varchar('contract_type', { length: 20 }).notNull(), // clt, pj, estagiario
   costCenterId: uuid('cost_center_id').references(() => costCenters.id),
   // Monthly values
   monthlyAmount: integer('monthly_amount').notNull(), // centavos
   referenceMonth: varchar('reference_month', { length: 7 }).notNull(), // YYYY-MM
   workDays: integer('work_days'), // dias trabalhados
   dailyAmount: integer('daily_amount'), // valor diário em centavos
   // Status
   status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, paid
   paidAt: timestamp('paid_at', { withTimezone: true }),
   notes: text('notes'),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   employeeIdx: index('transport_vouchers_employee_name_idx').on(table.employeeName),
   referenceMonthIdx: index('transport_vouchers_reference_month_idx').on(table.referenceMonth),
   statusIdx: index('transport_vouchers_status_idx').on(table.status),
   costCenterIdx: index('transport_vouchers_cost_center_id_idx').on(table.costCenterId),
}));

// ============================================
// === FINANCIAL MODULE - Cash Flow ===
// ============================================

// Daily Cash Flow Snapshots (Posição diária consolidada)
export const cashFlowSnapshots = pgTable('cash_flow_snapshots', {
   id: uuid('id').primaryKey().defaultRandom(),
   snapshotDate: date('snapshot_date').notNull(),
   costCenterId: uuid('cost_center_id').references(() => costCenters.id),
   // Balances
   openingBalance: integer('opening_balance').notNull(), // Saldo inicial em centavos
   totalCredits: integer('total_credits').default(0), // Total de entradas
   totalDebits: integer('total_debits').default(0), // Total de saídas
   closingBalance: integer('closing_balance').notNull(), // Saldo final
   // Breakdown by category
   revenueBreakdown: jsonb('revenue_breakdown'), // { "particular": 1000, "convenio": 2000, ... }
   expenseBreakdown: jsonb('expense_breakdown'), // { "pessoal": 5000, "impostos": 2000, ... }
   // Metadata
   isProjected: boolean('is_projected').default(false), // true = projeção, false = realizado
   notes: text('notes'),
   generatedBy: uuid('generated_by').references(() => users.id),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   snapshotDateIdx: index('cash_flow_snapshots_snapshot_date_idx').on(table.snapshotDate),
   costCenterIdx: index('cash_flow_snapshots_cost_center_id_idx').on(table.costCenterId),
   dateAndCenterIdx: uniqueIndex('cash_flow_snapshots_date_center_idx').on(table.snapshotDate, table.costCenterId),
}));

// ============================================
// === CRM MODULE - Campaigns, Pipeline & Leads ===
// ============================================

// Marketing Campaigns
export const campaigns = pgTable('campaigns', {
   id: serial('id').primaryKey(),
   name: varchar('name', { length: 200 }).notNull(),
   code: varchar('code', { length: 50 }).unique().notNull(),
   channel: varchar('channel', { length: 50 }), // google_ads, meta_ads, site, indicacao, organico
   medium: varchar('medium', { length: 50 }), // cpc, cpm, social, organic, referral
   landingPage: varchar('landing_page', { length: 500 }),
   status: varchar('status', { length: 20 }).default('active'), // active, paused, ended
   budget: integer('budget'), // monthly budget in cents
   startDate: timestamp('start_date', { withTimezone: true }),
   endDate: timestamp('end_date', { withTimezone: true }),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   codeIdx: uniqueIndex('campaigns_code_idx').on(table.code),
   statusIdx: index('campaigns_status_idx').on(table.status),
   channelIdx: index('campaigns_channel_idx').on(table.channel),
}));

// Sales Pipeline Stages
export const pipelineStages = pgTable('pipeline_stages', {
   id: serial('id').primaryKey(),
   name: varchar('name', { length: 100 }).notNull(),
   order: integer('order').notNull(),
   color: varchar('color', { length: 7 }), // hex color for kanban
   isDefault: boolean('is_default').default(false),
   isClosed: boolean('is_closed').default(false),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Sales Leads
export const leads = pgTable('leads', {
   id: serial('id').primaryKey(),
   patientId: uuid('patient_id').references(() => patients.id),
   campaignId: integer('campaign_id').references(() => campaigns.id),
   stageId: integer('stage_id').references(() => pipelineStages.id).notNull(),
   name: varchar('name', { length: 200 }).notNull(),
   phone: varchar('phone', { length: 20 }).notNull(),
   email: varchar('email', { length: 200 }),
   source: varchar('source', { length: 50 }), // google_ads, meta_ads, site, whatsapp_organic, indicacao
   utmSource: varchar('utm_source', { length: 100 }),
   utmMedium: varchar('utm_medium', { length: 100 }),
   utmCampaign: varchar('utm_campaign', { length: 200 }),
   utmContent: varchar('utm_content', { length: 200 }),
   utmTerm: varchar('utm_term', { length: 200 }),
   firstMessage: text('first_message'),
   interest: varchar('interest', { length: 200 }), // e.g. "ortodontia"
   assignedTo: uuid('assigned_to').references(() => users.id),
   value: integer('value'), // estimated deal value in cents
   status: varchar('status', { length: 20 }).default('open'), // open, won, lost
   lostReason: varchar('lost_reason', { length: 200 }),
   convertedAt: timestamp('converted_at', { withTimezone: true }),
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   patientIdx: index('leads_patient_id_idx').on(table.patientId),
   campaignIdx: index('leads_campaign_id_idx').on(table.campaignId),
   stageIdx: index('leads_stage_id_idx').on(table.stageId),
   phoneIdx: index('leads_phone_idx').on(table.phone),
   statusIdx: index('leads_status_idx').on(table.status),
   sourceIdx: index('leads_source_idx').on(table.source),
   assignedToIdx: index('leads_assigned_to_idx').on(table.assignedTo),
   createdAtIdx: index('leads_created_at_idx').on(table.createdAt),
}));

// Lead Activity Log
export const leadActivities = pgTable('lead_activities', {
   id: serial('id').primaryKey(),
   leadId: integer('lead_id').references(() => leads.id).notNull(),
   userId: uuid('user_id').references(() => users.id),
   type: varchar('type', { length: 50 }).notNull(), // note, call, whatsapp, email, stage_change, assignment
   description: text('description'),
   metadata: text('metadata'), // JSON for extra data
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
   leadIdx: index('lead_activities_lead_id_idx').on(table.leadId),
   typeIdx: index('lead_activities_type_idx').on(table.type),
   createdAtIdx: index('lead_activities_created_at_idx').on(table.createdAt),
}));
