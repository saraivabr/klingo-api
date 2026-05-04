import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Plus, Minus, Trash2, CreditCard, QrCode, FileText, ShoppingCart, User, CheckCircle2, Clock, AlertCircle, Copy, RefreshCw, X, ChevronDown, Star } from 'lucide-react';
import { api } from '../services/api';

type PaymentMode = 'procedure' | 'plan';
type BillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD';

interface Patient {
  id: string;
  name: string;
  phone: string;
  cpfHash?: string;
  email?: string;
}

interface Charge {
  id: string;
  code: string;
  name: string;
  standardCharge: number;
  categoryId: string;
  categoryName: string;
}

interface CartItem {
  chargeId: string;
  name: string;
  code: string;
  unitPrice: number;
  quantity: number;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  description: string;
  features: string[];
}

interface PaymentResult {
  billId?: string;
  billNumber?: string;
  subscriptionId?: string;
  asaasPaymentId: string;
  status: string;
  value: number;
  billingType: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  planName?: string;
  pix?: {
    qrCodeImage: string;
    qrCodePayload: string;
    expirationDate: string;
  };
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatReais(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PDV() {
  const [mode, setMode] = useState<PaymentMode>('procedure');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');

  // Procedure mode
  const [charges, setCharges] = useState<Charge[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [chargeSearch, setChargeSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);

  // Plan mode
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  // Payment
  const [billingType, setBillingType] = useState<BillingType>('PIX');
  const [installments, setInstallments] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load charges and categories on mount
  useEffect(() => {
    loadCharges();
    loadCategories();
    loadPlans();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function loadCharges() {
    try {
      const data = await api.pdvGetCharges();
      setCharges(data.charges);
    } catch { /* ignore */ }
  }

  async function loadCategories() {
    try {
      const data = await api.pdvGetCategories();
      setCategories(data.categories);
    } catch { /* ignore */ }
  }

  async function loadPlans() {
    try {
      const data = await api.pdvGetPlans();
      setPlans(data.plans);
    } catch { /* ignore */ }
  }

  // Patient search with debounce
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (patientSearch.length < 2) {
      setPatientResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearchingPatients(true);
      try {
        const data = await api.pdvSearchPatients(patientSearch);
        setPatientResults(data.patients);
      } catch { setPatientResults([]); }
      setSearchingPatients(false);
    }, 300);
  }, [patientSearch]);

  function selectPatient(p: Patient) {
    setPatient(p);
    setPatientSearch('');
    setPatientResults([]);
    if (p.email) setEmail(p.email);
  }

  function addToCart(charge: Charge) {
    const existing = cart.find(c => c.chargeId === charge.id);
    if (existing) {
      setCart(cart.map(c => c.chargeId === charge.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, {
        chargeId: charge.id,
        name: charge.name,
        code: charge.code,
        unitPrice: charge.standardCharge,
        quantity: 1,
      }]);
    }
  }

  function updateQuantity(chargeId: string, delta: number) {
    setCart(prev => prev.map(c => {
      if (c.chargeId !== chargeId) return c;
      const qty = Math.max(1, c.quantity + delta);
      return { ...c, quantity: qty };
    }));
  }

  function removeFromCart(chargeId: string) {
    setCart(prev => prev.filter(c => c.chargeId !== chargeId));
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const cartNet = Math.round(cartTotal * (1 - discount / 100));

  const filteredCharges = charges.filter(c => {
    const matchSearch = !chargeSearch || c.name.toLowerCase().includes(chargeSearch.toLowerCase()) || c.code.toLowerCase().includes(chargeSearch.toLowerCase());
    const matchCat = !selectedCategory || c.categoryId === selectedCategory;
    return matchSearch && matchCat;
  });

  async function handlePayment() {
    if (!patient || !cpf) return;
    setProcessing(true);

    try {
      let result: any;

      if (mode === 'procedure') {
        if (cart.length === 0) return;
        result = await api.pdvCreateCharge({
          patientId: patient.id,
          items: cart.map(i => ({ chargeId: i.chargeId, quantity: i.quantity, unitPrice: i.unitPrice, name: i.name })),
          billingType,
          discountPercent: discount,
          installmentCount: billingType === 'CREDIT_CARD' ? installments : undefined,
          cpf,
          email: email || undefined,
        });
      } else {
        if (!selectedPlan) return;
        result = await api.pdvCreateSubscriptionCharge({
          patientId: patient.id,
          planId: selectedPlan.id,
          billingType,
          cpf,
          email: email || undefined,
        });
      }

      setPaymentResult(result);
      setPaymentStatus(result.status);

      // Start polling for payment status
      if (result.asaasPaymentId && ['PENDING', 'AWAITING_RISK_ANALYSIS'].includes(result.status)) {
        startPolling(result.asaasPaymentId);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao criar cobrança');
    } finally {
      setProcessing(false);
    }
  }

  const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  function startPolling(asaasPaymentId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    const startedAt = Date.now();
    pollRef.current = setInterval(async () => {
      // Stop polling after 10 minutes
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        if (pollRef.current) clearInterval(pollRef.current);
        setPaymentStatus('TIMEOUT');
        return;
      }

      try {
        const status = await api.pdvGetPaymentStatus(asaasPaymentId);
        setPaymentStatus(status.status);

        if (status.pix && (!paymentResult?.pix)) {
          setPaymentResult(prev => prev ? { ...prev, pix: status.pix } : prev);
        }

        if (['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(status.status)) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch { /* ignore */ }
    }, 3000);
  }

  function copyPix() {
    if (paymentResult?.pix?.qrCodePayload) {
      navigator.clipboard.writeText(paymentResult.pix.qrCodePayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function resetTransaction() {
    if (pollRef.current) clearInterval(pollRef.current);
    setPaymentResult(null);
    setPaymentStatus('');
    setCart([]);
    setSelectedPlan(null);
    setDiscount(0);
    setInstallments(1);
    setCopied(false);
  }

  function fullReset() {
    resetTransaction();
    setPatient(null);
    setCpf('');
    setEmail('');
  }

  const isPaid = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(paymentStatus);
  const isTimedOut = paymentStatus === 'TIMEOUT';

  // === PAYMENT RESULT SCREEN ===
  if (paymentResult) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-lg mx-auto">
          {/* Status Header */}
          <div className={`rounded-2xl p-8 text-center mb-6 ${isPaid ? 'bg-emerald-50 border-2 border-emerald-200' : isTimedOut ? 'bg-red-50 border-2 border-red-200' : 'bg-amber-50 border-2 border-amber-200'}`}>
            {isPaid ? (
              <>
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
                <h2 className="text-2xl font-bold text-emerald-700">Pagamento Confirmado!</h2>
                <p className="text-emerald-600 mt-1">{formatReais(paymentResult.value)}</p>
              </>
            ) : isTimedOut ? (
              <>
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-3" />
                <h2 className="text-2xl font-bold text-red-700">Tempo Esgotado</h2>
                <p className="text-red-600 mt-1">{formatReais(paymentResult.value)}</p>
                <p className="text-sm text-red-500 mt-2">
                  Tempo esgotado. Verifique o status manualmente.
                </p>
              </>
            ) : (
              <>
                <Clock className="w-16 h-16 text-amber-500 mx-auto mb-3 animate-pulse" />
                <h2 className="text-2xl font-bold text-amber-700">Aguardando Pagamento</h2>
                <p className="text-amber-600 mt-1">{formatReais(paymentResult.value)}</p>
                <p className="text-sm text-amber-500 mt-2 flex items-center justify-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Verificando automaticamente...
                </p>
              </>
            )}
          </div>

          {/* PIX QR Code */}
          {paymentResult.pix && !isPaid && !isTimedOut && (
            <div className="bg-white rounded-2xl shadow-sm border p-6 mb-4 text-center">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center justify-center gap-2">
                <QrCode className="w-5 h-5" /> PIX - Escaneie o QR Code
              </h3>
              <img
                src={`data:image/png;base64,${paymentResult.pix.qrCodeImage}`}
                alt="PIX QR Code"
                className="w-64 h-64 mx-auto rounded-lg border"
              />
              <div className="mt-4">
                <button
                  onClick={copyPix}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    copied
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado!' : 'Copiar Pix Copia e Cola'}
                </button>
              </div>
            </div>
          )}

          {/* Invoice/Boleto link */}
          {paymentResult.invoiceUrl && (
            <a
              href={paymentResult.invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white rounded-2xl shadow-sm border p-4 mb-4 text-center text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <FileText className="w-5 h-5 inline mr-2" />
              {paymentResult.billingType === 'BOLETO' ? 'Ver Boleto' : 'Ver Fatura'}
            </a>
          )}

          {/* Details */}
          <div className="bg-white rounded-2xl shadow-sm border p-4 mb-6">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Paciente</span>
                <span className="font-medium">{patient?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tipo</span>
                <span className="font-medium">{paymentResult.billingType}</span>
              </div>
              {paymentResult.billNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Fatura</span>
                  <span className="font-mono text-xs">{paymentResult.billNumber}</span>
                </div>
              )}
              {paymentResult.planName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Plano</span>
                  <span className="font-medium">{paymentResult.planName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`font-medium ${isPaid ? 'text-emerald-600' : isTimedOut ? 'text-red-600' : 'text-amber-600'}`}>
                  {isPaid ? 'Pago' : isTimedOut ? 'Tempo esgotado' : paymentStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={resetTransaction}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Nova Cobranca
            </button>
            <button
              onClick={fullReset}
              className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
            >
              Novo Paciente
            </button>
          </div>
        </div>
      </div>
    );
  }

  // === MAIN PDV SCREEN ===
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-800">PDV - Ponto de Venda</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMode('procedure')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'procedure' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Procedimentos
            </button>
            <button
              onClick={() => setMode('plan')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'plan' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Planos
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* LEFT PANEL: Products/Procedures */}
        <div className="flex-1 p-4 overflow-y-auto">
          {/* Patient Selection */}
          {!patient ? (
            <div className="bg-white rounded-xl border p-4 mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                <User className="w-4 h-4 inline mr-1" /> Selecionar Paciente
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou telefone..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  autoFocus
                />
              </div>
              {searchingPatients && <p className="text-xs text-gray-400 mt-2">Buscando...</p>}
              {patientResults.length > 0 && (
                <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto">
                  {patientResults.map(p => (
                    <button
                      key={p.id}
                      onClick={() => selectPatient(p)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b last:border-b-0"
                    >
                      <span className="font-medium text-sm">{p.name || 'Sem nome'}</span>
                      <span className="text-xs text-gray-500 ml-2">{p.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-3 mb-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-blue-800">{patient.name || 'Sem nome'}</p>
                <p className="text-xs text-blue-600">{patient.phone}</p>
              </div>
              <button onClick={() => { setPatient(null); setCpf(''); setEmail(''); }} className="text-blue-400 hover:text-blue-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* CPF + Email (show when patient selected) */}
          {patient && (
            <div className="bg-white rounded-xl border p-4 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">CPF (obrigatorio)</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value.replace(/[^\d.-]/g, ''))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Email (opcional)</label>
                  <input
                    type="email"
                    placeholder="email@exemplo.com"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* PROCEDURE MODE: Charge catalog */}
          {mode === 'procedure' && patient && (
            <>
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar procedimento..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                    value={chargeSearch}
                    onChange={(e) => setChargeSearch(e.target.value)}
                  />
                </div>
                <select
                  className="border rounded-lg px-3 py-2 text-sm bg-white"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">Todas categorias</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredCharges.map(charge => (
                  <button
                    key={charge.id}
                    onClick={() => addToCart(charge)}
                    className="bg-white border rounded-xl p-3 text-left hover:border-blue-300 hover:shadow-sm transition-all group"
                  >
                    <p className="text-sm font-medium text-gray-800 truncate">{charge.name}</p>
                    <p className="text-xs text-gray-400">{charge.code}</p>
                    <p className="text-sm font-bold text-blue-600 mt-1">{formatCents(charge.standardCharge)}</p>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="w-4 h-4 text-blue-500 mt-1" />
                    </div>
                  </button>
                ))}
                {filteredCharges.length === 0 && (
                  <p className="col-span-full text-center text-sm text-gray-400 py-8">Nenhum procedimento encontrado</p>
                )}
              </div>
            </>
          )}

          {/* PLAN MODE: Plan cards */}
          {mode === 'plan' && patient && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {plans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={`border rounded-xl p-4 text-left transition-all ${
                    selectedPlan?.id === plan.id
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'bg-white hover:border-blue-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-gray-800">{plan.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
                    </div>
                    {selectedPlan?.id === plan.id && (
                      <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-lg font-bold text-blue-600 mt-2">{formatCents(plan.priceCents)}<span className="text-xs font-normal text-gray-500">/mes</span></p>
                  {Array.isArray(plan.features) && plan.features.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {plan.features.slice(0, 4).map((f: any, i: number) => (
                        <li key={i} className="text-xs text-gray-600 flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-400" /> {typeof f === 'string' ? f : String(f)}
                        </li>
                      ))}
                    </ul>
                  )}
                </button>
              ))}
              {plans.length === 0 && (
                <p className="col-span-full text-center text-sm text-gray-400 py-8">Nenhum plano cadastrado</p>
              )}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Cart / Checkout */}
        <div className="w-96 bg-white border-l flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              {mode === 'procedure' ? 'Carrinho' : 'Assinatura'}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {mode === 'procedure' ? (
              <>
                {cart.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Adicione procedimentos ao carrinho</p>
                ) : (
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.chargeId} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">{formatCents(item.unitPrice)} x {item.quantity}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQuantity(item.chargeId, -1)} className="p-1 hover:bg-gray-200 rounded">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.chargeId, 1)} className="p-1 hover:bg-gray-200 rounded">
                            <Plus className="w-3 h-3" />
                          </button>
                          <button onClick={() => removeFromCart(item.chargeId)} className="p-1 hover:bg-red-100 rounded text-red-500 ml-1">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-sm font-bold w-20 text-right">{formatCents(item.unitPrice * item.quantity)}</p>
                      </div>
                    ))}

                    {/* Discount */}
                    <div className="flex items-center gap-2 pt-2">
                      <label className="text-xs text-gray-500">Desconto %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={discount}
                        onChange={(e) => setDiscount(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                        className="w-16 border rounded px-2 py-1 text-sm text-center"
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {!selectedPlan ? (
                  <p className="text-sm text-gray-400 text-center py-8">Selecione um plano</p>
                ) : (
                  <div className="bg-blue-50 rounded-xl p-4">
                    <h3 className="font-bold text-blue-800">{selectedPlan.name}</h3>
                    <p className="text-xs text-gray-600 mt-1">{selectedPlan.description}</p>
                    <p className="text-xl font-bold text-blue-600 mt-3">{formatCents(selectedPlan.priceCents)}<span className="text-sm font-normal">/mes</span></p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Payment method + Total */}
          <div className="border-t p-4 space-y-3">
            {/* Payment Method */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">Forma de Pagamento</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'PIX', icon: QrCode, label: 'PIX' },
                  { key: 'CREDIT_CARD', icon: CreditCard, label: 'Cartao' },
                  { key: 'BOLETO', icon: FileText, label: 'Boleto' },
                ] as const).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setBillingType(key)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-all ${
                      billingType === key
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Installments (credit card only, procedure mode) */}
            {billingType === 'CREDIT_CARD' && mode === 'procedure' && cartNet > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Parcelas</label>
                <select
                  value={installments}
                  onChange={(e) => setInstallments(parseInt(e.target.value))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                    <option key={n} value={n}>
                      {n}x de {formatCents(Math.round(cartNet / n))}
                      {n === 1 ? ' (a vista)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Total */}
            <div className="bg-gray-50 rounded-xl p-3">
              {mode === 'procedure' ? (
                <>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Subtotal</span>
                    <span>{formatCents(cartTotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>Desconto ({discount}%)</span>
                      <span>-{formatCents(cartTotal - cartNet)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold mt-1 pt-1 border-t">
                    <span>Total</span>
                    <span className="text-blue-600">{formatCents(cartNet)}</span>
                  </div>
                </>
              ) : selectedPlan ? (
                <div className="flex justify-between text-lg font-bold">
                  <span>Mensalidade</span>
                  <span className="text-blue-600">{formatCents(selectedPlan.priceCents)}</span>
                </div>
              ) : null}
            </div>

            {/* Pay Button */}
            <button
              onClick={handlePayment}
              disabled={
                processing ||
                !patient ||
                !cpf ||
                (mode === 'procedure' ? cart.length === 0 : !selectedPlan)
              }
              className={`w-full py-3 rounded-xl font-bold text-lg transition-all ${
                processing || !patient || !cpf || (mode === 'procedure' ? cart.length === 0 : !selectedPlan)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
              }`}
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" /> Processando...
                </span>
              ) : (
                `Cobrar ${mode === 'procedure' ? formatCents(cartNet) : selectedPlan ? formatCents(selectedPlan.priceCents) : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
