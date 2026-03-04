# Pharmacy Module - Schema Additions

This document contains the schema definitions needed for the pharmacy module. These should be added to `packages/database/src/postgres/schema.ts` by the SchedulesWorker (who has the reservation).

## Drizzle ORM Table Definitions

Add these table definitions to the end of `packages/database/src/postgres/schema.ts`:

```typescript
// === Pharmacy ===

export const medicineCategories = pgTable('medicine_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const medicineBrands = pgTable('medicine_brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const medicines = pgTable('medicines', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').references(() => medicineCategories.id),
  brandId: uuid('brand_id').references(() => medicineBrands.id),
  name: varchar('name', { length: 255 }).notNull(),
  genericName: varchar('generic_name', { length: 255 }),
  composition: text('composition'),
  unit: varchar('unit', { length: 50 }).notNull(),
  sellingPrice: integer('selling_price').notNull(), // in cents
  purchasePrice: integer('purchase_price').notNull(), // in cents
  quantity: integer('quantity').default(0),
  alertQuantity: integer('alert_quantity').default(10),
  expiryDate: date('expiry_date'),
  batchNumber: varchar('batch_number', { length: 100 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  nameIdx: index('medicines_name_idx').on(table.name),
  categoryIdx: index('medicines_category_id_idx').on(table.categoryId),
  quantityIdx: index('medicines_quantity_idx').on(table.quantity),
}));

export const medicineSales = pgTable('medicine_sales', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').references(() => patients.id),
  saleNumber: varchar('sale_number', { length: 50 }).unique().notNull(),
  totalAmount: integer('total_amount').notNull(), // in cents
  discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).default('0'),
  netAmount: integer('net_amount').notNull(), // in cents
  paymentMethod: varchar('payment_method', { length: 20 }).notNull(), // cash, credit, debit, pix, check
  status: varchar('status', { length: 20 }).default('completed'), // completed, pending, cancelled
  soldBy: varchar('sold_by', { length: 100 }).notNull(),
  soldAt: timestamp('sold_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  patientIdx: index('medicine_sales_patient_id_idx').on(table.patientId),
  saleNumberIdx: uniqueIndex('medicine_sales_number_idx').on(table.saleNumber),
  statusIdx: index('medicine_sales_status_idx').on(table.status),
  soldAtIdx: index('medicine_sales_sold_at_idx').on(table.soldAt),
}));

export const medicineSaleItems = pgTable('medicine_sale_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  saleId: uuid('sale_id').references(() => medicineSales.id).notNull(),
  medicineId: uuid('medicine_id').references(() => medicines.id).notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull(), // in cents
  totalPrice: integer('total_price').notNull(), // in cents
  batchNumber: varchar('batch_number', { length: 100 }),
  expiryDate: date('expiry_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  saleIdx: index('medicine_sale_items_sale_id_idx').on(table.saleId),
  medicineIdx: index('medicine_sale_items_medicine_id_idx').on(table.medicineId),
}));
```

## Instructions

1. **SchedulesWorker** should add these table definitions to `packages/database/src/postgres/schema.ts`
2. Run database migrations to create the tables:
   ```bash
   npm run db:migrate
   ```
3. The routes in `apps/api/src/routes/pharmacy.ts` are already implemented and will work once the schema is added
4. Register the pharmacy routes in `apps/api/src/server.ts` by adding:
   ```typescript
   import { pharmacyRoutes } from './routes/pharmacy.js';
   // ... in the protected routes section:
   await app.register(pharmacyRoutes, { prefix: '/api/pharmacy' });
   ```

## API Endpoints Available

Once schema is added, the following endpoints will be available:

### Medicines
- `GET /api/pharmacy/medicines` - List medicines with filters
- `POST /api/pharmacy/medicines` - Create medicine
- `PUT /api/pharmacy/medicines/:id` - Update medicine
- `GET /api/pharmacy/medicines/low-stock` - Get low stock medicines
- `POST /api/pharmacy/medicines/:id/stock` - Adjust stock

### Categories
- `GET /api/pharmacy/categories` - List categories
- `POST /api/pharmacy/categories` - Create category

### Brands
- `GET /api/pharmacy/brands` - List brands
- `POST /api/pharmacy/brands` - Create brand

### Sales (POS)
- `GET /api/pharmacy/sales` - List sales
- `POST /api/pharmacy/sales` - Create sale
- `GET /api/pharmacy/sales/:id` - Get sale details
- `GET /api/pharmacy/sales/:id/print` - Print receipt

## Dashboard Page

The Pharmacy page is at `/pharmacy` and includes:
- **Inventory Tab**: Browse and manage medicines
- **POS Tab**: Point-of-sale interface for selling medicines
- **Sales Tab**: View sales history
- **Low Stock Tab**: View medicines below alert quantity

All components are already implemented and will work once the schema is added.
