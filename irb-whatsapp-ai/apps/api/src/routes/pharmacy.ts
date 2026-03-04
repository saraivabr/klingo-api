import { FastifyInstance } from 'fastify';
import { db, schema } from '@irb/database';
import { authMiddleware } from '../middleware/auth.js';
import { ilike, desc, eq, and, or, lt } from 'drizzle-orm';
import * as pharmacyWorkflow from '../services/pharmacy-workflow.js';

export async function pharmacyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // ============= MEDICINES =============

  // GET /api/pharmacy/medicines - List medicines with filters
  app.get('/medicines', async (request, reply) => {
    const { 
      search, 
      categoryId, 
      brandId,
      page = 1, 
      limit = 50,
      sortBy = 'name',
      sortOrder = 'asc'
    } = request.query as { 
      search?: string; 
      categoryId?: string;
      brandId?: string;
      page?: number; 
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    };

    const offset = ((+page || 1) - 1) * (+limit || 50);
    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(schema.medicines.name, `%${search}%`),
          ilike(schema.medicines.genericName, `%${search}%`)
        )
      );
    }

    if (categoryId) {
      conditions.push(eq(schema.medicines.categoryId, categoryId));
    }

    if (brandId) {
      conditions.push(eq(schema.medicines.brandId, brandId));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const medicines = await db
      .select({
        id: schema.medicines.id,
        name: schema.medicines.name,
        genericName: schema.medicines.genericName,
        categoryId: schema.medicines.categoryId,
        categoryName: schema.medicineCategories.name,
        brandId: schema.medicines.brandId,
        brandName: schema.medicineBrands.name,
        unit: schema.medicines.unit,
        sellingPrice: schema.medicines.sellingPrice,
        purchasePrice: schema.medicines.purchasePrice,
        quantity: schema.medicines.quantity,
        alertQuantity: schema.medicines.alertQuantity,
        expiryDate: schema.medicines.expiryDate,
        batchNumber: schema.medicines.batchNumber,
        isActive: schema.medicines.isActive,
      })
      .from(schema.medicines)
      .leftJoin(schema.medicineCategories, eq(schema.medicines.categoryId, schema.medicineCategories.id))
      .leftJoin(schema.medicineBrands, eq(schema.medicines.brandId, schema.medicineBrands.id))
      .where(where)
      .orderBy(sortOrder === 'desc' ? desc(schema.medicines.name) : schema.medicines.name)
      .limit(+limit)
      .offset(offset);

    return { medicines, page: +page, limit: +limit, total: medicines.length };
  });

  // GET /api/pharmacy/medicines/:id - Get medicine details
  app.get('/medicines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [medicine] = await db
      .select({
        id: schema.medicines.id,
        name: schema.medicines.name,
        genericName: schema.medicines.genericName,
        composition: schema.medicines.composition,
        categoryId: schema.medicines.categoryId,
        categoryName: schema.medicineCategories.name,
        brandId: schema.medicines.brandId,
        brandName: schema.medicineBrands.name,
        unit: schema.medicines.unit,
        sellingPrice: schema.medicines.sellingPrice,
        purchasePrice: schema.medicines.purchasePrice,
        quantity: schema.medicines.quantity,
        alertQuantity: schema.medicines.alertQuantity,
        expiryDate: schema.medicines.expiryDate,
        batchNumber: schema.medicines.batchNumber,
        isActive: schema.medicines.isActive,
        createdAt: schema.medicines.createdAt,
        updatedAt: schema.medicines.updatedAt,
      })
      .from(schema.medicines)
      .leftJoin(schema.medicineCategories, eq(schema.medicines.categoryId, schema.medicineCategories.id))
      .leftJoin(schema.medicineBrands, eq(schema.medicines.brandId, schema.medicineBrands.id))
      .where(eq(schema.medicines.id, id));

    if (!medicine) {
      return reply.status(404).send({ error: 'Medicamento não encontrado' });
    }

    return { medicine };
  });

  // POST /api/pharmacy/medicines - Add medicine
  app.post('/medicines', async (request, reply) => {
    const {
      categoryId,
      brandId,
      name,
      genericName,
      composition,
      unit,
      sellingPrice,
      purchasePrice,
      quantity,
      alertQuantity,
      expiryDate,
      batchNumber,
    } = request.body as any;

    if (!name || !unit || !sellingPrice || !purchasePrice) {
      return reply.status(400).send({ error: 'name, unit, sellingPrice e purchasePrice são obrigatórios' });
    }

    const [medicine] = await db
      .insert(schema.medicines)
      .values({
        categoryId: categoryId || null,
        brandId: brandId || null,
        name,
        genericName: genericName || null,
        composition: composition || null,
        unit,
        sellingPrice,
        purchasePrice,
        quantity: quantity || 0,
        alertQuantity: alertQuantity || 10,
        expiryDate: expiryDate || null,
        batchNumber: batchNumber || null,
        isActive: true,
      })
      .returning();

    return reply.status(201).send(medicine);
  });

  // PUT /api/pharmacy/medicines/:id - Update medicine
  app.put('/medicines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as Partial<typeof schema.medicines.$inferInsert>;

    const [medicine] = await db
      .update(schema.medicines)
      .set(updates)
      .where(eq(schema.medicines.id, id))
      .returning();

    if (!medicine) {
      return reply.status(404).send({ error: 'Medicamento não encontrado' });
    }

    return medicine;
  });

  // ============= STOCK MANAGEMENT (Workflow) =============

  // GET /api/pharmacy/medicines/low-stock - Get medicines below alert quantity
  app.get('/low-stock', async () => {
    const items = await pharmacyWorkflow.getLowStockItems();
    return { items };
  });

  // GET /api/pharmacy/expiring - Get medicines close to expiry
  app.get('/expiring', async (request) => {
    const { days = 30 } = request.query as { days?: number };
    const items = await pharmacyWorkflow.getExpiringMedicines(+days);
    return { items };
  });

  // POST /api/pharmacy/medicines/:id/stock - Adjust stock
  app.post('/medicines/:id/stock', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { adjustment, reason, batchNumber, expiryDate } = request.body as {
      adjustment: number;
      reason: string;
      batchNumber?: string;
      expiryDate?: string;
    };

    if (typeof adjustment !== 'number' || !reason) {
      return reply.status(400).send({ error: 'adjustment e reason são obrigatórios' });
    }

    const result = await pharmacyWorkflow.adjustStock({
      medicineId: id,
      adjustment,
      reason,
      batchNumber,
      expiryDate,
    });

    if (!result.success) {
      return reply.status(400).send({ error: result.message });
    }

    return result;
  });

  // ============= CATEGORIES =============

  // GET /api/pharmacy/categories - List categories
  app.get('/categories', async (request) => {
    const categories = await db
      .select()
      .from(schema.medicineCategories)
      .where(eq(schema.medicineCategories.isActive, true))
      .orderBy(schema.medicineCategories.name);

    return { categories };
  });

  // POST /api/pharmacy/categories - Add category
  app.post('/categories', async (request, reply) => {
    const { name, description } = request.body as { name: string; description?: string };

    if (!name) {
      return reply.status(400).send({ error: 'name é obrigatório' });
    }

    const [category] = await db
      .insert(schema.medicineCategories)
      .values({
        name,
        description: description || null,
        isActive: true,
      })
      .returning();

    return reply.status(201).send(category);
  });

  // ============= BRANDS =============

  // GET /api/pharmacy/brands - List brands
  app.get('/brands', async (request) => {
    const brands = await db
      .select()
      .from(schema.medicineBrands)
      .where(eq(schema.medicineBrands.isActive, true))
      .orderBy(schema.medicineBrands.name);

    return { brands };
  });

  // POST /api/pharmacy/brands - Add brand
  app.post('/brands', async (request, reply) => {
    const { name } = request.body as { name: string };

    if (!name) {
      return reply.status(400).send({ error: 'name é obrigatório' });
    }

    const [brand] = await db
      .insert(schema.medicineBrands)
      .values({
        name,
        isActive: true,
      })
      .returning();

    return reply.status(201).send(brand);
  });

  // ============= PRESCRIPTIONS (Workflow) =============

  // GET /api/pharmacy/prescriptions - List pending prescriptions
  app.get('/prescriptions', async () => {
    const prescriptions = await pharmacyWorkflow.getPendingPrescriptions();
    return { prescriptions };
  });

  // POST /api/pharmacy/prescriptions/:id/dispense - Dispense prescription
  app.post('/prescriptions/:id/dispense', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { patientId, items, discountPercent, paymentMethod } = request.body as {
      patientId: string;
      items: Array<{ medicineId: string; quantity: number; instructions?: string }>;
      discountPercent?: number;
      paymentMethod?: string;
    };

    if (!patientId || !items || items.length === 0) {
      return reply.status(400).send({ error: 'patientId e items são obrigatórios' });
    }

    const result = await pharmacyWorkflow.dispensePrescription({
      prescriptionId: id,
      patientId,
      items,
      discountPercent,
      paymentMethod,
    });

    if (!result.success) {
      return reply.status(400).send({
        error: result.message,
        stockWarnings: result.stockWarnings,
      });
    }

    return reply.status(201).send(result);
  });

  // ============= SALES (Workflow) =============

  // GET /api/pharmacy/sales - List sales
  app.get('/sales', async (request) => {
    const { page = 1, limit = 50, patientId, status } = request.query as { 
      page?: number; 
      limit?: number;
      patientId?: string;
      status?: string;
    };

    const offset = ((+page || 1) - 1) * (+limit || 50);
    const conditions = [];

    if (patientId) {
      conditions.push(eq(schema.medicineSales.patientId, patientId));
    }

    if (status) {
      conditions.push(eq(schema.medicineSales.status, status));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sales = await db
      .select({
        id: schema.medicineSales.id,
        saleNumber: schema.medicineSales.saleNumber,
        patientId: schema.medicineSales.patientId,
        patientName: schema.patients.name,
        patientPhone: schema.patients.phone,
        totalAmount: schema.medicineSales.totalAmount,
        discountPercent: schema.medicineSales.discountPercent,
        netAmount: schema.medicineSales.netAmount,
        paymentMethod: schema.medicineSales.paymentMethod,
        status: schema.medicineSales.status,
        soldAt: schema.medicineSales.soldAt,
      })
      .from(schema.medicineSales)
      .leftJoin(schema.patients, eq(schema.medicineSales.patientId, schema.patients.id))
      .where(where)
      .orderBy(desc(schema.medicineSales.soldAt))
      .limit(+limit)
      .offset(offset);

    return { sales, page: +page, limit: +limit };
  });

  // POST /api/pharmacy/sales - Create sale (POS)
  app.post('/sales', async (request, reply) => {
    const {
      patientId,
      items,
      discountPercent = 0,
      paymentMethod = 'dinheiro',
    } = request.body as {
      patientId?: string;
      items: Array<{
        medicineId: string;
        quantity: number;
      }>;
      discountPercent?: number;
      paymentMethod?: string;
    };

    if (!items || items.length === 0) {
      return reply.status(400).send({ error: 'items é obrigatório' });
    }

    const result = await pharmacyWorkflow.createSale({
      patientId,
      items,
      discountPercent,
      paymentMethod,
      soldBy: (request.user as any)?.userId,
    });

    if (!result.success) {
      return reply.status(400).send({
        error: result.message,
        stockWarnings: result.stockWarnings,
      });
    }

    return reply.status(201).send(result);
  });

  // GET /api/pharmacy/sales/:id - Get sale details
  app.get('/sales/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [sale] = await db
      .select({
        id: schema.medicineSales.id,
        saleNumber: schema.medicineSales.saleNumber,
        patientId: schema.medicineSales.patientId,
        patientName: schema.patients.name,
        patientPhone: schema.patients.phone,
        totalAmount: schema.medicineSales.totalAmount,
        discountPercent: schema.medicineSales.discountPercent,
        netAmount: schema.medicineSales.netAmount,
        paymentMethod: schema.medicineSales.paymentMethod,
        status: schema.medicineSales.status,
        soldAt: schema.medicineSales.soldAt,
      })
      .from(schema.medicineSales)
      .leftJoin(schema.patients, eq(schema.medicineSales.patientId, schema.patients.id))
      .where(eq(schema.medicineSales.id, id));

    if (!sale) {
      return reply.status(404).send({ error: 'Venda não encontrada' });
    }

    const items = await db
      .select({
        id: schema.medicineSaleItems.id,
        medicineId: schema.medicineSaleItems.medicineId,
        medicineName: schema.medicines.name,
        quantity: schema.medicineSaleItems.quantity,
        unitPrice: schema.medicineSaleItems.unitPrice,
        totalPrice: schema.medicineSaleItems.totalPrice,
        batchNumber: schema.medicineSaleItems.batchNumber,
        expiryDate: schema.medicineSaleItems.expiryDate,
      })
      .from(schema.medicineSaleItems)
      .leftJoin(schema.medicines, eq(schema.medicineSaleItems.medicineId, schema.medicines.id))
      .where(eq(schema.medicineSaleItems.saleId, id));

    return { sale, items };
  });

  // GET /api/pharmacy/sales/:id/print - Print receipt
  app.get('/sales/:id/print', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [sale] = await db
      .select({
        id: schema.medicineSales.id,
        saleNumber: schema.medicineSales.saleNumber,
        patientName: schema.patients.name,
        totalAmount: schema.medicineSales.totalAmount,
        discountPercent: schema.medicineSales.discountPercent,
        netAmount: schema.medicineSales.netAmount,
        paymentMethod: schema.medicineSales.paymentMethod,
        soldAt: schema.medicineSales.soldAt,
      })
      .from(schema.medicineSales)
      .leftJoin(schema.patients, eq(schema.medicineSales.patientId, schema.patients.id))
      .where(eq(schema.medicineSales.id, id));

    if (!sale) {
      return reply.status(404).send({ error: 'Venda não encontrada' });
    }

    const items = await db
      .select({
        medicineId: schema.medicineSaleItems.medicineId,
        medicineName: schema.medicines.name,
        quantity: schema.medicineSaleItems.quantity,
        unitPrice: schema.medicineSaleItems.unitPrice,
        totalPrice: schema.medicineSaleItems.totalPrice,
      })
      .from(schema.medicineSaleItems)
      .leftJoin(schema.medicines, eq(schema.medicineSaleItems.medicineId, schema.medicines.id))
      .where(eq(schema.medicineSaleItems.saleId, id));

    return {
      receipt: {
        saleNumber: sale.saleNumber,
        patientName: sale.patientName || 'Cliente avulso',
        soldAt: sale.soldAt,
        totalAmount: sale.totalAmount,
        discountPercent: sale.discountPercent,
        netAmount: sale.netAmount,
        paymentMethod: sale.paymentMethod,
        items: items.map(i => ({
          name: i.medicineName || 'Medicamento',
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
        })),
      },
    };
  });
}
