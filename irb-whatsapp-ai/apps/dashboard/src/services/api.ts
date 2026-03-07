const API_BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: string; name: string; email: string; role: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getConversations: (params?: { status?: string; page?: number }) =>
    request<{ conversations: any[]; total: number }>(`/conversations?${new URLSearchParams(params as any)}`),

  getConversation: (id: string) => request<any>(`/conversations/${id}`),

  assignConversation: (id: string) =>
    request<any>(`/conversations/${id}/assign`, { method: 'POST' }),

  releaseConversation: (id: string) =>
    request<any>(`/conversations/${id}/release`, { method: 'POST' }),

  closeConversation: (id: string) =>
    request<any>(`/conversations/${id}/close`, { method: 'POST' }),

  getPatientContext: (conversationId: string) =>
    request<import('../types/patient-context').PatientContext>(`/conversations/${conversationId}/context`),

  getMetrics: () => request<any>('/dashboard/metrics'),

  getEscalations: () => request<any[]>('/dashboard/escalations'),

  resolveEscalation: (id: string, notes?: string) =>
    request<any>(`/dashboard/escalations/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),

  getSettings: () => request<Record<string, any>>('/settings'),
  updateSetting: (key: string, value: any) =>
    request<any>(`/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),

  getKnowledgeBase: () => request<any[]>('/settings/knowledge-base'),
  getServices: () => request<any[]>('/settings/services'),

  // Subscriptions
  getSubscriptions: (params?: { status?: string; search?: string; page?: string }) =>
    request<{ subscriptions: any[]; total: number }>(`/subscriptions?${new URLSearchParams(params as any)}`),

  createSubscription: (data: { patientId: string; planId: string; billingType: string; cpf: string; email?: string }) =>
    request<any>('/subscriptions', { method: 'POST', body: JSON.stringify(data) }),

  cancelSubscription: (id: string) =>
    request<any>(`/subscriptions/${id}/cancel`, { method: 'PUT', body: JSON.stringify({}) }),

  getSubscriptionPayments: (id: string) =>
    request<{ payments: any[] }>(`/subscriptions/${id}/payments`),

  // Finance
  getFinanceSummary: () =>
    request<{ activeSubscriptions: number; overdueSubscriptions: number; monthRevenueCents: number; overdueTotalCents: number }>('/finance/summary'),

  getPayments: (params?: { status?: string; from?: string; to?: string; page?: string; limit?: string }) =>
    request<{ payments: any[]; total: number }>(`/finance/payments?${new URLSearchParams(params as any)}`),

  getPlans: () =>
    request<{ plans: any[] }>('/finance/plans'),

  getSubscriptionDetail: (id: string) =>
    request<any>(`/subscriptions/${id}/detail`),

  changeSubscriptionPlan: (id: string, newPlanId: string) =>
    request<any>(`/subscriptions/${id}/change-plan`, { method: 'PUT', body: JSON.stringify({ newPlanId }) }),

  suspendSubscription: (id: string) =>
    request<any>(`/subscriptions/${id}/suspend`, { method: 'PUT', body: JSON.stringify({}) }),

  reactivateSubscription: (id: string) =>
    request<any>(`/subscriptions/${id}/reactivate`, { method: 'PUT', body: JSON.stringify({}) }),

  // Patients
  getPatient: (id: string) =>
    request<any>(`/patients/${id}`),

  updatePatient: (id: string, data: { name?: string; phone?: string; email?: string; birthDate?: string }) =>
    request<any>(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  getPatientAppointments: (id: string) =>
    request<{ appointments: any[] }>(`/patients/${id}/appointments`),

  searchPatients: (search: string) =>
    request<any[]>(`/patients?search=${encodeURIComponent(search)}`),

  searchPatientKlingo: (params: { cpf?: string; phone?: string }) =>
    request<{ found: boolean; patient: any; error?: string }>(
      `/patients/klingo/search?${new URLSearchParams(params as any)}`,
    ),

  ensurePatient: (data: { phone: string; name: string; cpf?: string; klingoId?: number; email?: string }) =>
    request<any>('/patients/ensure', { method: 'POST', body: JSON.stringify(data) }),

  // OPD Visits
  getOPDVisits: (params?: { status?: string; patientId?: string; doctorId?: string; search?: string; page?: string; limit?: string }) =>
    request<{ visits: any[] }>(`/opd?${new URLSearchParams(params as any)}`),

  getOPDVisit: (id: string) =>
    request<any>(`/opd/${id}`),

  createOPDVisit: (data: { patientId: string; doctorId: string; appointmentId?: string; visitDate: string; caseId?: string; symptoms?: string; notes?: string }) =>
    request<any>('/opd', { method: 'POST', body: JSON.stringify(data) }),

  updateOPDVisit: (id: string, data: { symptoms?: string; notes?: string; status?: string }) =>
    request<any>(`/opd/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  completeOPDVisit: (id: string) =>
    request<any>(`/opd/${id}/complete`, { method: 'PUT', body: JSON.stringify({}) }),

  recordOPDVitals: (visitId: string, data: { height?: number; weight?: number; bloodPressure?: string; pulse?: number; temperature?: number; respirationRate?: number }) =>
    request<any>(`/opd/${visitId}/vitals`, { method: 'POST', body: JSON.stringify(data) }),

  addOPDDiagnosis: (visitId: string, data: { diagnosisCode: string; description?: string; notes?: string }) =>
    request<any>(`/opd/${visitId}/diagnosis`, { method: 'POST', body: JSON.stringify(data) }),

  getOPDTimeline: (visitId: string) =>
    request<{ timeline: any[] }>(`/opd/${visitId}/timeline`),

  addOPDTimelineEntry: (visitId: string, data: { title: string; description?: string; createdBy?: string }) =>
    request<any>(`/opd/${visitId}/timeline`, { method: 'POST', body: JSON.stringify(data) }),

  // Lab Tests
  labGetCategories: () =>
    request<any[]>(`/lab/categories`),

  labGetTests: (params?: { categoryId?: string; isActive?: string }) =>
    request<any[]>(`/lab/tests?${new URLSearchParams(params as any)}`),

  labGetTest: (id: string) =>
    request<{ test: any; parameters: any[] }>(`/lab/tests/${id}`),

  labGetOrders: (params?: { patientId?: string; status?: string; priority?: string; page?: string; limit?: string; search?: string }) =>
    request<any[]>(`/lab/orders?${new URLSearchParams(params as any)}`),

  labGetOrder: (id: string) =>
    request<any>(`/lab/orders/${id}`),

  labCreateOrder: (data: { patientId: string; doctorId?: string; opdVisitId?: string; testIds: string[]; priority?: string; notes?: string }) =>
    request<any>('/lab/orders', { method: 'POST', body: JSON.stringify(data) }),

  labCollectSample: (orderId: string, data: { itemIds: string[] }) =>
    request<any>(`/lab/orders/${orderId}/collect`, { method: 'PUT', body: JSON.stringify(data) }),

  labCreateResults: (orderId: string, data: { itemId: string; results: any[] }) =>
    request<any>(`/lab/orders/${orderId}/results`, { method: 'POST', body: JSON.stringify(data) }),

  labCompleteOrder: (id: string) =>
    request<any>(`/lab/orders/${id}/complete`, { method: 'PUT', body: JSON.stringify({}) }),

  labGetReport: (id: string) =>
    request<{ pdfUrl: string }>(`/lab/orders/${id}/report`),

  // Billing
  getBillings: (params?: { status?: string; patientId?: string; search?: string; page?: string; limit?: string }) =>
    request<{ bills: any[]; total: number }>(`/billing?${new URLSearchParams(params as any)}`),

  getBillingDetail: (id: string) =>
    request<{ bill: any; items: any[]; transactions: any[]; paidAmount: number }>(`/billing/${id}`),

  createBilling: (data: { patientId: string; opdVisitId?: string; discountPercent?: number; notes?: string; items: any[] }) =>
    request<any>('/billing', { method: 'POST', body: JSON.stringify(data) }),

  updateBilling: (id: string, data: { status?: string; discountPercent?: number; notes?: string }) =>
    request<any>(`/billing/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteBilling: (id: string) =>
    request<any>(`/billing/${id}`, { method: 'DELETE' }),

  addBillingItem: (billId: string, data: { chargeId: string; quantity?: number; unitPrice?: number }) =>
    request<any>(`/billing/${billId}/items`, { method: 'POST', body: JSON.stringify(data) }),

  removeBillingItem: (billId: string, itemId: string) =>
    request<any>(`/billing/${billId}/items/${itemId}`, { method: 'DELETE' }),

  recordBillingPayment: (billId: string, data: { amountPaid: number; paymentMethod: string; transactionRef?: string; notes?: string }) =>
    request<any>(`/billing/${billId}/pay`, { method: 'POST', body: JSON.stringify(data) }),

  getCharges: (params?: { categoryId?: string; isActive?: string }) =>
    request<{ charges: any[] }>(`/billing/charges?${new URLSearchParams(params as any)}`),

  getChargeCategories: (params?: { isActive?: string }) =>
    request<{ categories: any[] }>(`/billing/categories?${new URLSearchParams(params as any)}`),

  getPatients: (params?: { search?: string; page?: string; limit?: string }) =>
    request<{ patients: any[]; total: number }>(`/patients?${new URLSearchParams(params as any)}`),

  // Pharmacy
  pharmacyGetMedicines: (params?: { categoryId?: string; search?: string; page?: string; limit?: string }) =>
    request<{ medicines: any[] }>(`/pharmacy/medicines?${new URLSearchParams(params as any)}`),

  pharmacyGetMedicine: (id: string) =>
    request<any>(`/pharmacy/medicines/${id}`),

  pharmacyCreateMedicine: (data: any) =>
    request<any>('/pharmacy/medicines', { method: 'POST', body: JSON.stringify(data) }),

  pharmacyUpdateMedicine: (id: string, data: any) =>
    request<any>(`/pharmacy/medicines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  pharmacyGetLowStock: () =>
    request<{ medicines: any[] }>('/pharmacy/medicines/low-stock'),

  pharmacyAdjustStock: (id: string, data: { quantity: number; reason?: string }) =>
    request<any>(`/pharmacy/medicines/${id}/stock`, { method: 'POST', body: JSON.stringify(data) }),

  pharmacyGetCategories: () =>
    request<{ categories: any[] }>('/pharmacy/categories'),

  pharmacyGetBrands: () =>
    request<{ brands: any[] }>('/pharmacy/brands'),

  pharmacyGetSales: (params?: { patientId?: string; page?: string; limit?: string }) =>
    request<{ sales: any[] }>(`/pharmacy/sales?${new URLSearchParams(params as any)}`),

  pharmacyCreateSale: (data: { patientId?: string; items: any[]; discountPercent?: number; paymentMethod: string }) =>
    request<any>('/pharmacy/sales', { method: 'POST', body: JSON.stringify(data) }),

  pharmacyGetSale: (id: string) =>
    request<any>(`/pharmacy/sales/${id}`),

  // Workflow Dashboard
  getWorkflowStats: () =>
    request<any>('/dashboard/workflows'),

  getWorkflowOPD: () =>
    request<any>('/dashboard/workflows/opd'),

  getWorkflowLab: () =>
    request<any>('/dashboard/workflows/lab'),

  getWorkflowBilling: () =>
    request<any>('/dashboard/workflows/billing'),

  // ===========================================
  // ACCOUNTS PAYABLE (Contas a Pagar)
  // ===========================================
  
  getAccountsPayable: (params?: { 
    status?: string; 
    supplierId?: string;
    costCenterId?: string;
    chartAccountId?: string;
    dueDateFrom?: string; 
    dueDateTo?: string;
    search?: string;
    page?: string; 
    limit?: string;
  }) =>
    request<{ items: any[]; total: number; totalGrossCents: number; totalNetCents: number }>(
      `/accounts-payable?${new URLSearchParams(params as any)}`
    ),

  getAccountPayable: (id: string) =>
    request<any>(`/accounts-payable/${id}`),

  createAccountPayable: (data: {
    documentNumber?: string;
    documentType?: string;
    supplierId?: string;
    costCenterId?: string;
    chartAccountId?: string;
    bankAccountId?: string;
    description: string;
    grossAmount: number;
    issueDate?: string;
    dueDate: string;
    competenceDate?: string;
    paymentMethod?: string;
    notes?: string;
    barcode?: string;
    pixCode?: string;
    inssRate?: number;
    irpjRate?: number;
    csllRate?: number;
    cofinsRate?: number;
    pisRate?: number;
    issRate?: number;
  }) =>
    request<any>('/accounts-payable', { method: 'POST', body: JSON.stringify(data) }),

  updateAccountPayable: (id: string, data: any) =>
    request<any>(`/accounts-payable/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  cancelAccountPayable: (id: string) =>
    request<any>(`/accounts-payable/${id}`, { method: 'DELETE' }),

  approvePayment: (id: string, notes?: string) =>
    request<any>(`/accounts-payable/${id}/approve`, { 
      method: 'POST', 
      body: JSON.stringify({ notes }) 
    }),

  rejectPayment: (id: string, reason: string) =>
    request<any>(`/accounts-payable/${id}/reject`, { 
      method: 'POST', 
      body: JSON.stringify({ reason }) 
    }),

  payAccount: (id: string, data: { 
    paymentDate?: string; 
    paymentMethod?: string; 
    bankAccountId?: string;
    notes?: string;
  }) =>
    request<any>(`/accounts-payable/${id}/pay`, { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),

  getDailyPaymentQueue: (date?: string) =>
    request<{ date: string; items: any[]; summary: any }>(
      `/accounts-payable/daily-queue${date ? `?date=${date}` : ''}`
    ),

  getOverduePayables: () =>
    request<{ items: any[]; totalOverdueCents: number; overdueCount: number }>(
      '/accounts-payable/overdue'
    ),

  getPayableSummaryByCostCenter: (params?: { from?: string; to?: string; status?: string }) =>
    request<{ summary: any[] }>(
      `/accounts-payable/summary/by-cost-center?${new URLSearchParams(params as any)}`
    ),

  getPayableSummaryByCategory: (params?: { from?: string; to?: string; status?: string }) =>
    request<{ summary: any[] }>(
      `/accounts-payable/summary/by-category?${new URLSearchParams(params as any)}`
    ),

  // Auxiliary data for accounts payable
  getCostCenters: () =>
    request<{ items: any[] }>('/accounts-payable/cost-centers'),

  getChartOfAccounts: (type?: string) =>
    request<{ items: any[] }>(`/accounts-payable/chart-of-accounts${type ? `?type=${type}` : ''}`),

  getSuppliers: (search?: string) =>
    request<{ items: any[] }>(`/accounts-payable/suppliers${search ? `?search=${search}` : ''}`),

  createSupplier: (data: {
    cnpj?: string;
    cpf?: string;
    legalName: string;
    tradeName?: string;
    email?: string;
    phone?: string;
    bankName?: string;
    bankAgency?: string;
    bankAccount?: string;
    pixKey?: string;
  }) =>
    request<any>('/accounts-payable/suppliers', { method: 'POST', body: JSON.stringify(data) }),

  getBankAccounts: () =>
    request<{ items: any[] }>('/accounts-payable/bank-accounts'),

  // ===========================================
  // ACCOUNTS RECEIVABLE (Contas a Receber)
  // ===========================================

  getAccountsReceivable: (params?: { 
    status?: string; 
    patientId?: string;
    doctorId?: string;
    insuranceProviderId?: string;
    costCenterId?: string;
    paymentType?: string;
    serviceDateFrom?: string; 
    serviceDateTo?: string;
    dueDateFrom?: string;
    dueDateTo?: string;
    search?: string;
    page?: string; 
    limit?: string;
  }) =>
    request<{ items: any[]; total: number; summary: any }>(
      `/accounts-receivable?${new URLSearchParams(params as any)}`
    ),

  getAccountReceivable: (id: string) =>
    request<any>(`/accounts-receivable/${id}`),

  createAccountReceivable: (data: {
    patientId?: string;
    doctorId?: string;
    insuranceProviderId?: string;
    costCenterId?: string;
    serviceType: string;
    procedureCode?: string;
    procedureDescription?: string;
    guideNumber?: string;
    authorizationNumber?: string;
    totalAmount: number;
    serviceDate: string;
    dueDate: string;
    paymentType: string;
    notes?: string;
    installments?: number;
  }) =>
    request<any>('/accounts-receivable', { method: 'POST', body: JSON.stringify(data) }),

  updateAccountReceivable: (id: string, data: any) =>
    request<any>(`/accounts-receivable/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  cancelAccountReceivable: (id: string) =>
    request<any>(`/accounts-receivable/${id}`, { method: 'DELETE' }),

  receivePayment: (id: string, data: { 
    amount: number; 
    paymentDate?: string; 
    paymentMethod: string;
    bankAccountId?: string;
    transactionRef?: string;
    installmentId?: string;
    notes?: string;
  }) =>
    request<any>(`/accounts-receivable/${id}/receive`, { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),

  getOverdueReceivables: () =>
    request<{ items: any[]; totalOverdueCents: number; overdueCount: number }>(
      '/accounts-receivable/overdue'
    ),

  getReceivablesAging: () =>
    request<any>('/accounts-receivable/aging'),

  getReceivablesSummary: (params?: { from?: string; to?: string }) =>
    request<{ byPaymentType: any[]; byServiceType: any[]; byInsurance: any[] }>(
      `/accounts-receivable/summary?${new URLSearchParams(params as any)}`
    ),

  getInsuranceProviders: () =>
    request<{ items: any[] }>('/accounts-receivable/insurance-providers'),

  createInsuranceProvider: (data: {
    code?: string;
    name: string;
    cnpj?: string;
    ansCode?: string;
    paymentTermDays?: number;
  }) =>
    request<any>('/accounts-receivable/insurance-providers', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),

  // ===========================================
  // CASH FLOW (Fluxo de Caixa)
  // ===========================================

  getDailyCashFlow: (date?: string, costCenterId?: string) =>
    request<any>(
      `/cash-flow/daily?${new URLSearchParams({ 
        ...(date && { date }), 
        ...(costCenterId && { costCenterId }) 
      })}`
    ),

  getCashFlowRange: (from: string, to: string, costCenterId?: string) =>
    request<{ positions: any[] }>(
      `/cash-flow/range?${new URLSearchParams({ 
        from, 
        to, 
        ...(costCenterId && { costCenterId }) 
      })}`
    ),

  getMonthlyCashFlow: (year?: number, month?: number, costCenterId?: string) =>
    request<any>(
      `/cash-flow/monthly?${new URLSearchParams({ 
        ...(year && { year: year.toString() }), 
        ...(month && { month: month.toString() }),
        ...(costCenterId && { costCenterId }) 
      })}`
    ),

  getCashFlowProjection: (days?: number, costCenterId?: string) =>
    request<any>(
      `/cash-flow/projection?${new URLSearchParams({ 
        ...(days && { days: days.toString() }),
        ...(costCenterId && { costCenterId }) 
      })}`
    ),

  getBankPosition: (date?: string) =>
    request<any>(`/cash-flow/bank-position${date ? `?date=${date}` : ''}`),

  getBankTransactions: (bankAccountId: string, params?: { from?: string; to?: string; page?: string; limit?: string }) =>
    request<{ transactions: any[]; total: number }>(
      `/cash-flow/bank-transactions/${bankAccountId}?${new URLSearchParams(params as any)}`
    ),

  reconcileBankTransactions: (transactionIds: string[]) =>
    request<{ reconciled: number }>('/cash-flow/reconcile', { 
      method: 'POST', 
      body: JSON.stringify({ transactionIds }) 
    }),

  getCashFlowSnapshots: (params?: { from?: string; to?: string; costCenterId?: string; isProjected?: string }) =>
    request<{ snapshots: any[] }>(
      `/cash-flow/snapshots?${new URLSearchParams(params as any)}`
    ),

  saveCashFlowSnapshot: (data: {
    snapshotDate: string;
    costCenterId?: string;
    openingBalance: number;
    totalCredits: number;
    totalDebits: number;
    closingBalance: number;
    isProjected?: boolean;
    notes?: string;
  }) =>
    request<any>('/cash-flow/snapshots', { method: 'POST', body: JSON.stringify(data) }),

  getCashFlowSummary: () =>
    request<any>('/cash-flow/summary'),

  getDRE: (year?: number, month?: number) =>
    request<any>(
      `/cash-flow/dre?${new URLSearchParams({
        ...(year && { year: year.toString() }),
        ...(month && { month: month.toString() })
      })}`
    ),

  // Users
  getUsers: () =>
    request<{ users: any[] }>('/users'),

  createUser: (data: { name: string; email: string; password: string; role?: string }) =>
    request<any>('/users', { method: 'POST', body: JSON.stringify(data) }),

  updateUser: (id: string, data: { name?: string; email?: string; role?: string; isActive?: boolean; password?: string }) =>
    request<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  changeMyPassword: (currentPassword: string, newPassword: string) =>
    request<any>('/users/me/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),
};
