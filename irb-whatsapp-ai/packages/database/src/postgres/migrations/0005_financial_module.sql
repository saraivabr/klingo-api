-- Financial Module Migration
-- Created: 2026-03-05
-- Description: Accounts Payable, Accounts Receivable, Cash Flow, Reimbursements, Transport Vouchers

-- ============================================
-- ACCOUNTS PAYABLE TABLES
-- ============================================

-- Cost Centers (21 units: Projetos, Bragança, Paraguaçu, SAMU-MG, Nardini, Rondônia, etc.)
CREATE TABLE IF NOT EXISTS cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES cost_centers(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cost_centers_code_idx ON cost_centers(code);
CREATE INDEX IF NOT EXISTS cost_centers_parent_id_idx ON cost_centers(parent_id);

-- Chart of Accounts (25 categories: Pessoal, Impostos, Operacional, etc.)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL, -- expense, revenue, asset, liability
    parent_id UUID REFERENCES chart_of_accounts(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS chart_of_accounts_code_idx ON chart_of_accounts(code);
CREATE INDEX IF NOT EXISTS chart_of_accounts_type_idx ON chart_of_accounts(type);

-- Suppliers (Fornecedores)
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cnpj VARCHAR(18) UNIQUE,
    cpf VARCHAR(14),
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    bank_name VARCHAR(100),
    bank_agency VARCHAR(20),
    bank_account VARCHAR(30),
    bank_account_type VARCHAR(20),
    pix_key VARCHAR(100),
    klingo_doctor_id INTEGER,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_cnpj_idx ON suppliers(cnpj);
CREATE INDEX IF NOT EXISTS suppliers_legal_name_idx ON suppliers(legal_name);
CREATE INDEX IF NOT EXISTS suppliers_klingo_doctor_id_idx ON suppliers(klingo_doctor_id);

-- Bank Accounts (7 accounts: Bradesco x3, Unicred, Safra, BB)
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_code VARCHAR(10) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    agency VARCHAR(20) NOT NULL,
    account_number VARCHAR(30) NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    nickname VARCHAR(100),
    initial_balance INTEGER DEFAULT 0,
    current_balance INTEGER DEFAULT 0,
    overdraft_limit INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_bank_account_idx ON bank_accounts(bank_code, agency, account_number);

-- Accounts Payable (Contas a Pagar)
CREATE TABLE IF NOT EXISTS accounts_payable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_number VARCHAR(50),
    document_type VARCHAR(30),
    supplier_id UUID REFERENCES suppliers(id),
    cost_center_id UUID REFERENCES cost_centers(id),
    chart_account_id UUID REFERENCES chart_of_accounts(id),
    bank_account_id UUID REFERENCES bank_accounts(id),
    description TEXT NOT NULL,
    gross_amount INTEGER NOT NULL,
    net_amount INTEGER NOT NULL,
    -- Tax retentions
    inss_retention INTEGER DEFAULT 0,
    irpj_retention INTEGER DEFAULT 0,
    csll_retention INTEGER DEFAULT 0,
    cofins_retention INTEGER DEFAULT 0,
    pis_retention INTEGER DEFAULT 0,
    iss_retention INTEGER DEFAULT 0,
    -- Dates
    issue_date DATE,
    due_date DATE NOT NULL,
    payment_date DATE,
    competence_date DATE,
    -- Status and workflow
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    payment_method VARCHAR(30),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    paid_by UUID REFERENCES users(id),
    notes TEXT,
    attachment_url TEXT,
    barcode VARCHAR(100),
    pix_code TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS accounts_payable_supplier_id_idx ON accounts_payable(supplier_id);
CREATE INDEX IF NOT EXISTS accounts_payable_cost_center_id_idx ON accounts_payable(cost_center_id);
CREATE INDEX IF NOT EXISTS accounts_payable_chart_account_id_idx ON accounts_payable(chart_account_id);
CREATE INDEX IF NOT EXISTS accounts_payable_status_idx ON accounts_payable(status);
CREATE INDEX IF NOT EXISTS accounts_payable_due_date_idx ON accounts_payable(due_date);
CREATE INDEX IF NOT EXISTS accounts_payable_payment_date_idx ON accounts_payable(payment_date);

-- Payment Approvals (Workflow de aprovação)
CREATE TABLE IF NOT EXISTS payment_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_payable_id UUID REFERENCES accounts_payable(id) NOT NULL,
    requested_by UUID REFERENCES users(id),
    requested_at TIMESTAMPTZ DEFAULT now(),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    rejection_reason TEXT,
    notes TEXT,
    notified_via_whatsapp BOOLEAN DEFAULT false,
    whatsapp_notified_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS payment_approvals_account_payable_id_idx ON payment_approvals(account_payable_id);
CREATE INDEX IF NOT EXISTS payment_approvals_status_idx ON payment_approvals(status);

-- Credit Card Purchases
CREATE TABLE IF NOT EXISTS credit_card_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_last_digits VARCHAR(4),
    card_holder VARCHAR(100),
    merchant_name VARCHAR(255) NOT NULL,
    purchase_date DATE NOT NULL,
    total_amount INTEGER NOT NULL,
    installments INTEGER DEFAULT 1,
    installment_amount INTEGER NOT NULL,
    current_installment INTEGER DEFAULT 1,
    cost_center_id UUID REFERENCES cost_centers(id),
    chart_account_id UUID REFERENCES chart_of_accounts(id),
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_card_purchases_purchase_date_idx ON credit_card_purchases(purchase_date);
CREATE INDEX IF NOT EXISTS credit_card_purchases_status_idx ON credit_card_purchases(status);
CREATE INDEX IF NOT EXISTS credit_card_purchases_cost_center_id_idx ON credit_card_purchases(cost_center_id);

-- Bank Transactions (Conciliação)
CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID REFERENCES bank_accounts(id) NOT NULL,
    transaction_date DATE NOT NULL,
    type VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL,
    balance INTEGER,
    description TEXT,
    account_payable_id UUID REFERENCES accounts_payable(id),
    account_receivable_id UUID,
    reconciled BOOLEAN DEFAULT false,
    reconciled_at TIMESTAMPTZ,
    reconciled_by UUID REFERENCES users(id),
    external_ref VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bank_transactions_bank_account_id_idx ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS bank_transactions_transaction_date_idx ON bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS bank_transactions_type_idx ON bank_transactions(type);
CREATE INDEX IF NOT EXISTS bank_transactions_reconciled_idx ON bank_transactions(reconciled);

-- ============================================
-- ACCOUNTS RECEIVABLE TABLES
-- ============================================

-- Insurance Providers (Convênios)
CREATE TABLE IF NOT EXISTS insurance_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE,
    name VARCHAR(100) NOT NULL,
    cnpj VARCHAR(18),
    ans_code VARCHAR(20),
    contact_name VARCHAR(100),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    payment_term_days INTEGER DEFAULT 30,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS insurance_providers_code_idx ON insurance_providers(code);
CREATE INDEX IF NOT EXISTS insurance_providers_name_idx ON insurance_providers(name);

-- Accounts Receivable (Contas a Receber)
CREATE TABLE IF NOT EXISTS accounts_receivable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    doctor_id UUID REFERENCES doctors(id),
    insurance_provider_id UUID REFERENCES insurance_providers(id),
    cost_center_id UUID REFERENCES cost_centers(id),
    service_type VARCHAR(20) NOT NULL,
    procedure_code VARCHAR(50),
    procedure_description TEXT,
    guide_number VARCHAR(50),
    authorization_number VARCHAR(50),
    total_amount INTEGER NOT NULL,
    received_amount INTEGER DEFAULT 0,
    glosa_amount INTEGER DEFAULT 0,
    service_date DATE NOT NULL,
    due_date DATE NOT NULL,
    received_date DATE,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    payment_type VARCHAR(20) NOT NULL,
    notes TEXT,
    klingo_voucher_id INTEGER,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS accounts_receivable_patient_id_idx ON accounts_receivable(patient_id);
CREATE INDEX IF NOT EXISTS accounts_receivable_doctor_id_idx ON accounts_receivable(doctor_id);
CREATE INDEX IF NOT EXISTS accounts_receivable_insurance_provider_id_idx ON accounts_receivable(insurance_provider_id);
CREATE INDEX IF NOT EXISTS accounts_receivable_status_idx ON accounts_receivable(status);
CREATE INDEX IF NOT EXISTS accounts_receivable_due_date_idx ON accounts_receivable(due_date);
CREATE INDEX IF NOT EXISTS accounts_receivable_service_date_idx ON accounts_receivable(service_date);
CREATE INDEX IF NOT EXISTS accounts_receivable_klingo_voucher_id_idx ON accounts_receivable(klingo_voucher_id);

-- Receivable Installments
CREATE TABLE IF NOT EXISTS receivable_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_receivable_id UUID REFERENCES accounts_receivable(id) NOT NULL,
    installment_number INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    due_date DATE NOT NULL,
    paid_amount INTEGER DEFAULT 0,
    paid_date DATE,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS receivable_installments_account_receivable_id_idx ON receivable_installments(account_receivable_id);
CREATE INDEX IF NOT EXISTS receivable_installments_due_date_idx ON receivable_installments(due_date);
CREATE INDEX IF NOT EXISTS receivable_installments_status_idx ON receivable_installments(status);

-- Receivable Payments
CREATE TABLE IF NOT EXISTS receivable_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_receivable_id UUID REFERENCES accounts_receivable(id) NOT NULL,
    installment_id UUID REFERENCES receivable_installments(id),
    amount INTEGER NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    bank_account_id UUID REFERENCES bank_accounts(id),
    transaction_ref VARCHAR(100),
    notes TEXT,
    received_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS receivable_payments_account_receivable_id_idx ON receivable_payments(account_receivable_id);
CREATE INDEX IF NOT EXISTS receivable_payments_payment_date_idx ON receivable_payments(payment_date);

-- ============================================
-- REIMBURSEMENTS & TRANSPORT VOUCHERS
-- ============================================

-- Reimbursement Requests
CREATE TABLE IF NOT EXISTS reimbursement_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(30) UNIQUE NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    employee_department VARCHAR(100),
    employee_cpf VARCHAR(14),
    trip_origin VARCHAR(100),
    trip_destination VARCHAR(100),
    trip_start_date DATE NOT NULL,
    trip_end_date DATE NOT NULL,
    trip_purpose TEXT,
    bank_name VARCHAR(100),
    bank_agency VARCHAR(20),
    bank_account VARCHAR(30),
    bank_account_type VARCHAR(20),
    pix_key VARCHAR(100),
    total_amount INTEGER DEFAULT 0,
    approved_amount INTEGER,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    requested_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS reimbursement_requests_request_number_idx ON reimbursement_requests(request_number);
CREATE INDEX IF NOT EXISTS reimbursement_requests_status_idx ON reimbursement_requests(status);
CREATE INDEX IF NOT EXISTS reimbursement_requests_employee_name_idx ON reimbursement_requests(employee_name);

-- Reimbursement Items
CREATE TABLE IF NOT EXISTS reimbursement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reimbursement_request_id UUID REFERENCES reimbursement_requests(id) NOT NULL,
    expense_date DATE NOT NULL,
    expense_type VARCHAR(50) NOT NULL,
    description TEXT,
    receipt_number VARCHAR(50),
    amount INTEGER NOT NULL,
    attachment_url TEXT,
    approved BOOLEAN,
    approved_amount INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reimbursement_items_reimbursement_request_id_idx ON reimbursement_items(reimbursement_request_id);
CREATE INDEX IF NOT EXISTS reimbursement_items_expense_date_idx ON reimbursement_items(expense_date);

-- Transport Vouchers
CREATE TABLE IF NOT EXISTS transport_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_name VARCHAR(255) NOT NULL,
    employee_cpf VARCHAR(14),
    employee_role VARCHAR(100),
    contract_type VARCHAR(20) NOT NULL,
    cost_center_id UUID REFERENCES cost_centers(id),
    monthly_amount INTEGER NOT NULL,
    reference_month VARCHAR(7) NOT NULL,
    work_days INTEGER,
    daily_amount INTEGER,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transport_vouchers_employee_name_idx ON transport_vouchers(employee_name);
CREATE INDEX IF NOT EXISTS transport_vouchers_reference_month_idx ON transport_vouchers(reference_month);
CREATE INDEX IF NOT EXISTS transport_vouchers_status_idx ON transport_vouchers(status);
CREATE INDEX IF NOT EXISTS transport_vouchers_cost_center_id_idx ON transport_vouchers(cost_center_id);

-- ============================================
-- CASH FLOW
-- ============================================

-- Daily Cash Flow Snapshots
CREATE TABLE IF NOT EXISTS cash_flow_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL,
    cost_center_id UUID REFERENCES cost_centers(id),
    opening_balance INTEGER NOT NULL,
    total_credits INTEGER DEFAULT 0,
    total_debits INTEGER DEFAULT 0,
    closing_balance INTEGER NOT NULL,
    revenue_breakdown JSONB,
    expense_breakdown JSONB,
    is_projected BOOLEAN DEFAULT false,
    notes TEXT,
    generated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cash_flow_snapshots_snapshot_date_idx ON cash_flow_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS cash_flow_snapshots_cost_center_id_idx ON cash_flow_snapshots(cost_center_id);
CREATE UNIQUE INDEX IF NOT EXISTS cash_flow_snapshots_date_center_idx ON cash_flow_snapshots(snapshot_date, cost_center_id);

-- ============================================
-- SEED DATA: Cost Centers (21 units)
-- ============================================

INSERT INTO cost_centers (code, name, description) VALUES
    ('ADM', 'Administrativo', 'Sede administrativa'),
    ('PROJ', 'Projetos', 'Gestão de projetos'),
    ('BRAG', 'Bragança', 'Unidade Bragança Paulista'),
    ('PARA', 'Paraguaçu', 'Unidade Paraguaçu Paulista'),
    ('SAMU-MG', 'SAMU Minas Gerais', 'Operação SAMU em MG'),
    ('NARD', 'Nardini', 'Hospital Nardini'),
    ('ROND', 'Rondônia', 'Operação Rondônia'),
    ('PRIME', 'IRB Prime Care', 'Clínica Prime Care'),
    ('TI', 'Tecnologia', 'Departamento de TI'),
    ('RH', 'Recursos Humanos', 'Departamento de RH'),
    ('FIN', 'Financeiro', 'Departamento Financeiro'),
    ('COM', 'Comercial', 'Departamento Comercial'),
    ('MKT', 'Marketing', 'Departamento de Marketing'),
    ('JUR', 'Jurídico', 'Departamento Jurídico'),
    ('CONT', 'Contabilidade', 'Contabilidade'),
    ('COMP', 'Compras', 'Departamento de Compras'),
    ('LOG', 'Logística', 'Logística e Frota'),
    ('QUA', 'Qualidade', 'Gestão da Qualidade'),
    ('FAT', 'Faturamento', 'Faturamento e Cobrança'),
    ('REG', 'Regulação', 'Regulação e Auditoria'),
    ('DIR', 'Diretoria', 'Diretoria Executiva')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- SEED DATA: Chart of Accounts (25 categories)
-- ============================================

INSERT INTO chart_of_accounts (code, name, type) VALUES
    -- Despesas
    ('3.1', 'Pessoal', 'expense'),
    ('3.1.1', 'Salários e Ordenados', 'expense'),
    ('3.1.2', 'Encargos Sociais', 'expense'),
    ('3.1.3', 'Benefícios', 'expense'),
    ('3.1.4', 'Terceirizados', 'expense'),
    ('3.2', 'Impostos e Taxas', 'expense'),
    ('3.2.1', 'INSS', 'expense'),
    ('3.2.2', 'IRPJ/CSLL', 'expense'),
    ('3.2.3', 'PIS/COFINS', 'expense'),
    ('3.2.4', 'ISS', 'expense'),
    ('3.3', 'Operacional', 'expense'),
    ('3.3.1', 'Materiais e Insumos', 'expense'),
    ('3.3.2', 'Medicamentos', 'expense'),
    ('3.3.3', 'Aluguel', 'expense'),
    ('3.3.4', 'Utilidades', 'expense'),
    ('3.3.5', 'Manutenção', 'expense'),
    ('3.4', 'Administrativo', 'expense'),
    ('3.4.1', 'Material de Escritório', 'expense'),
    ('3.4.2', 'Serviços Profissionais', 'expense'),
    ('3.4.3', 'Viagens e Deslocamentos', 'expense'),
    ('3.4.4', 'Seguros', 'expense'),
    ('3.5', 'Financeiro', 'expense'),
    ('3.5.1', 'Juros e Multas', 'expense'),
    ('3.5.2', 'Tarifas Bancárias', 'expense'),
    -- Receitas
    ('4.1', 'Receita Operacional', 'revenue'),
    ('4.1.1', 'Consultas', 'revenue'),
    ('4.1.2', 'Exames', 'revenue'),
    ('4.1.3', 'Procedimentos', 'revenue'),
    ('4.1.4', 'Convênios', 'revenue'),
    ('4.1.5', 'Particular', 'revenue')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- SEED DATA: Insurance Providers (13 convênios)
-- ============================================

INSERT INTO insurance_providers (code, name, payment_term_days) VALUES
    ('PART', 'Particular', 0),
    ('BRAD', 'Bradesco Saúde', 30),
    ('AMIL', 'Amil', 45),
    ('UNIMED', 'Unimed', 30),
    ('SULAM', 'SulAmérica', 45),
    ('HAPV', 'Hapvida', 30),
    ('NDAM', 'NotreDame Intermédica', 30),
    ('PORT', 'Porto Seguro Saúde', 30),
    ('PREV', 'Prevent Senior', 30),
    ('CASS', 'Cassi', 45),
    ('GEAP', 'GEAP', 45),
    ('SUS', 'SUS', 60),
    ('OUTRO', 'Outros Convênios', 30)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- SEED DATA: Bank Accounts (7 contas)
-- ============================================

INSERT INTO bank_accounts (bank_code, bank_name, agency, account_number, account_type, nickname) VALUES
    ('237', 'Bradesco', '0001', '12345-6', 'corrente', 'Bradesco Principal'),
    ('237', 'Bradesco', '0001', '12346-7', 'corrente', 'Bradesco Folha'),
    ('237', 'Bradesco', '0001', '12347-8', 'corrente', 'Bradesco Fornecedores'),
    ('136', 'Unicred', '0101', '54321-0', 'corrente', 'Unicred'),
    ('422', 'Safra', '0001', '98765-4', 'corrente', 'Safra'),
    ('001', 'Banco do Brasil', '3456', '11111-1', 'corrente', 'BB Principal'),
    ('237', 'Bradesco', '0001', '99999-9', 'aplicação', 'Bradesco Aplicações')
ON CONFLICT (bank_code, agency, account_number) DO NOTHING;
