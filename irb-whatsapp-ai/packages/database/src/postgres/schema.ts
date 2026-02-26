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
