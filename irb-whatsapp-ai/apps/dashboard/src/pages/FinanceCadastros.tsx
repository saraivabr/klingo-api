import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Landmark, ListTree, Plus, Search, ShieldCheck, Truck, X } from 'lucide-react';
import { api } from '../services/api';

type TabKey = 'chart' | 'centers' | 'suppliers' | 'banks' | 'insurance';
const INPUT_CLASS = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white';

function Surface({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function FinanceCadastros() {
  const [activeTab, setActiveTab] = useState<TabKey>('chart');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [chartAccounts, setChartAccounts] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<any[]>([]);
  const [composer, setComposer] = useState<'supplier' | 'insurance' | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [supplierForm, setSupplierForm] = useState({
    legalName: '',
    tradeName: '',
    cnpj: '',
    cpf: '',
    email: '',
    phone: '',
    bankName: '',
    bankAgency: '',
    bankAccount: '',
    pixKey: '',
  });
  const [insuranceForm, setInsuranceForm] = useState({
    code: '',
    name: '',
    cnpj: '',
    ansCode: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    paymentTermDays: '30',
  });

  useEffect(() => {
    Promise.all([
      api.getChartOfAccounts(),
      api.getCostCenters(),
      api.getSuppliers(),
      api.getBankAccounts(),
      api.getInsuranceProviders(),
    ]).then(([chart, centers, suppliersResponse, banks, insurers]) => {
      setChartAccounts(chart.items);
      setCostCenters(centers.items);
      setSuppliers(suppliersResponse.items);
      setBankAccounts(banks.items);
      setInsuranceProviders(insurers.items);
      setLoading(false);
    });
  }, []);

  const closeComposer = () => {
    setComposer(null);
    setError('');
  };

  const handleCreateSupplier = async () => {
    if (!supplierForm.legalName.trim()) {
      setError('Nome do fornecedor é obrigatório');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api.createSupplier({
        legalName: supplierForm.legalName.trim(),
        tradeName: supplierForm.tradeName.trim() || undefined,
        cnpj: supplierForm.cnpj.replace(/\D/g, '') || undefined,
        cpf: supplierForm.cpf.replace(/\D/g, '') || undefined,
        email: supplierForm.email.trim() || undefined,
        phone: supplierForm.phone.replace(/\D/g, '') || undefined,
        bankName: supplierForm.bankName.trim() || undefined,
        bankAgency: supplierForm.bankAgency.trim() || undefined,
        bankAccount: supplierForm.bankAccount.trim() || undefined,
        pixKey: supplierForm.pixKey.trim() || undefined,
      });

      const refreshed = await api.getSuppliers();
      setSuppliers(refreshed.items);
      setActiveTab('suppliers');
      setFeedback('Fornecedor criado com sucesso.');
      setSupplierForm({
        legalName: '',
        tradeName: '',
        cnpj: '',
        cpf: '',
        email: '',
        phone: '',
        bankName: '',
        bankAgency: '',
        bankAccount: '',
        pixKey: '',
      });
      closeComposer();
      setTimeout(() => setFeedback(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Falha ao criar fornecedor');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateInsurance = async () => {
    if (!insuranceForm.name.trim()) {
      setError('Nome do convênio é obrigatório');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api.createInsuranceProvider({
        code: insuranceForm.code.trim() || undefined,
        name: insuranceForm.name.trim(),
        cnpj: insuranceForm.cnpj.replace(/\D/g, '') || undefined,
        ansCode: insuranceForm.ansCode.trim() || undefined,
        contactName: insuranceForm.contactName.trim() || undefined,
        contactEmail: insuranceForm.contactEmail.trim() || undefined,
        contactPhone: insuranceForm.contactPhone.replace(/\D/g, '') || undefined,
        paymentTermDays: insuranceForm.paymentTermDays ? Number(insuranceForm.paymentTermDays) : undefined,
      });

      const refreshed = await api.getInsuranceProviders();
      setInsuranceProviders(refreshed.items);
      setActiveTab('insurance');
      setFeedback('Convênio criado com sucesso.');
      setInsuranceForm({
        code: '',
        name: '',
        cnpj: '',
        ansCode: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        paymentTermDays: '30',
      });
      closeComposer();
      setTimeout(() => setFeedback(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Falha ao criar convênio');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { key: 'chart' as const, label: 'Plano de Contas', icon: ListTree, count: chartAccounts.length },
    { key: 'centers' as const, label: 'Centros de Custo', icon: Building2, count: costCenters.length },
    { key: 'suppliers' as const, label: 'Fornecedores', icon: Truck, count: suppliers.length },
    { key: 'banks' as const, label: 'Contas Bancárias', icon: Landmark, count: bankAccounts.length },
    { key: 'insurance' as const, label: 'Convênios', icon: ShieldCheck, count: insuranceProviders.length },
  ];

  const data = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source =
      activeTab === 'chart'
        ? chartAccounts
        : activeTab === 'centers'
          ? costCenters
          : activeTab === 'suppliers'
            ? suppliers
            : activeTab === 'banks'
              ? bankAccounts
              : insuranceProviders;

    if (!term) return source;

    return source.filter((row) =>
      Object.values(row || {}).some((value) => typeof value === 'string' && value.toLowerCase().includes(term)),
    );
  }, [activeTab, bankAccounts, chartAccounts, costCenters, insuranceProviders, search, suppliers]);

  if (loading) {
    return <div className="px-6 py-6 text-sm text-slate-500">Carregando cadastros financeiros...</div>;
  }

  return (
    <div className="space-y-6 px-6 py-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-900 bg-slate-950 text-white shadow-2xl shadow-slate-950/15">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.35fr_0.95fr] lg:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">Cadastros</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight">Base estrutural do financeiro para classificar, pagar, receber e conciliar.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              A navegação agora segue a lógica do módulo `IRB Finance`, centralizando os cadastros que alimentam todas as telas operacionais.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {tabs.slice(0, 4).map((tab) => (
              <div key={tab.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{tab.label}</p>
                <p className="mt-2 text-2xl font-semibold">{tab.count}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 border-t border-white/10 px-6 pb-6 lg:px-8">
          <button
            onClick={() => setComposer('supplier')}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-cyan-50"
          >
            <Plus size={16} />
            Novo fornecedor
          </button>
          <button
            onClick={() => setComposer('insurance')}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            <Plus size={16} />
            Novo convênio
          </button>
        </div>
      </section>

      <Surface title="Estrutura mestra" subtitle="Selecione uma categoria e filtre rapidamente os cadastros importados.">
        {feedback && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {feedback}
          </div>
        )}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === tab.key ? 'bg-white/15 text-white' : 'bg-white text-slate-500'}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filtrar cadastro"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none lg:w-72"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => setComposer('supplier')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <Plus size={15} />
            Adicionar fornecedor
          </button>
          <button
            onClick={() => setComposer('insurance')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <Plus size={15} />
            Adicionar convênio
          </button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                {activeTab === 'chart' ? (
                  <>
                    <th className="pb-3 pr-4 font-medium">Código</th>
                    <th className="pb-3 pr-4 font-medium">Conta</th>
                    <th className="pb-3 pr-4 font-medium">Tipo</th>
                    <th className="pb-3 font-medium">Status</th>
                  </>
                ) : activeTab === 'centers' ? (
                  <>
                    <th className="pb-3 pr-4 font-medium">Código</th>
                    <th className="pb-3 pr-4 font-medium">Centro</th>
                    <th className="pb-3 font-medium">Status</th>
                  </>
                ) : activeTab === 'suppliers' ? (
                  <>
                    <th className="pb-3 pr-4 font-medium">Fornecedor</th>
                    <th className="pb-3 pr-4 font-medium">Documento</th>
                    <th className="pb-3 pr-4 font-medium">Contato</th>
                    <th className="pb-3 font-medium">Banco / Pix</th>
                  </>
                ) : activeTab === 'banks' ? (
                  <>
                    <th className="pb-3 pr-4 font-medium">Banco</th>
                    <th className="pb-3 pr-4 font-medium">Conta</th>
                    <th className="pb-3 pr-4 font-medium">Tipo</th>
                    <th className="pb-3 font-medium text-right">Saldo</th>
                  </>
                ) : (
                  <>
                    <th className="pb-3 pr-4 font-medium">Código</th>
                    <th className="pb-3 pr-4 font-medium">Convênio</th>
                    <th className="pb-3 pr-4 font-medium">Prazo</th>
                    <th className="pb-3 font-medium">Status</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row) => (
                <tr key={row.id}>
                  {activeTab === 'chart' ? (
                    <>
                      <td className="py-3 pr-4 text-slate-500">{row.code || '-'}</td>
                      <td className="py-3 pr-4 font-medium text-slate-900">{row.name}</td>
                      <td className="py-3 pr-4 text-slate-500">{row.type || '-'}</td>
                      <td className="py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${row.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                          {row.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </>
                  ) : activeTab === 'centers' ? (
                    <>
                      <td className="py-3 pr-4 text-slate-500">{row.code || '-'}</td>
                      <td className="py-3 pr-4 font-medium text-slate-900">{row.name}</td>
                      <td className="py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${row.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                          {row.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </>
                  ) : activeTab === 'suppliers' ? (
                    <>
                      <td className="py-3 pr-4 font-medium text-slate-900">{row.legalName}</td>
                      <td className="py-3 pr-4 text-slate-500">{row.cnpj || row.cpf || '-'}</td>
                      <td className="py-3 pr-4 text-slate-500">{row.email || row.phone || '-'}</td>
                      <td className="py-3 text-slate-500">{row.bankName || row.pixKey || '-'}</td>
                    </>
                  ) : activeTab === 'banks' ? (
                    <>
                      <td className="py-3 pr-4 font-medium text-slate-900">{row.bankName}</td>
                      <td className="py-3 pr-4 text-slate-500">{row.nickname || row.accountNumber}</td>
                      <td className="py-3 pr-4 text-slate-500">{row.accountType || '-'}</td>
                      <td className="py-3 text-right font-semibold text-slate-900">
                        {typeof row.currentBalance === 'number' ? `R$ ${(row.currentBalance / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 pr-4 text-slate-500">{row.code || '-'}</td>
                      <td className="py-3 pr-4 font-medium text-slate-900">{row.name}</td>
                      <td className="py-3 pr-4 text-slate-500">{row.paymentTermDays ? `${row.paymentTermDays} dias` : '-'}</td>
                      <td className="py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${row.isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                          {row.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>

      {composer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {composer === 'supplier' ? 'Novo fornecedor' : 'Novo convênio'}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {composer === 'supplier' ? 'Adicionar parceiro operacional' : 'Adicionar convênio à base financeira'}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {composer === 'supplier'
                    ? 'Cadastre quem entra na régua de pagamento com dados mínimos e chave de repasse.'
                    : 'Estruture o convênio para alimentar recebíveis, aging e conciliação.'}
                </p>
              </div>
              <button onClick={closeComposer} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </div>
            )}

            {composer === 'supplier' ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field label="Razão social">
                  <input value={supplierForm.legalName} onChange={(event) => setSupplierForm((current) => ({ ...current, legalName: event.target.value }))} className={INPUT_CLASS} />
                </Field>
                <Field label="Nome fantasia">
                  <input value={supplierForm.tradeName} onChange={(event) => setSupplierForm((current) => ({ ...current, tradeName: event.target.value }))} className={INPUT_CLASS} />
                </Field>
                <Field label="CNPJ">
                  <input value={supplierForm.cnpj} onChange={(event) => setSupplierForm((current) => ({ ...current, cnpj: event.target.value }))} className={INPUT_CLASS} />
                </Field>
                <Field label="CPF">
                  <input value={supplierForm.cpf} onChange={(event) => setSupplierForm((current) => ({ ...current, cpf: event.target.value }))} className={INPUT_CLASS} />
                </Field>
                <Field label="Email">
                  <input value={supplierForm.email} onChange={(event) => setSupplierForm((current) => ({ ...current, email: event.target.value }))} className={INPUT_CLASS} />
                </Field>
                <Field label="Telefone">
                  <input value={supplierForm.phone} onChange={(event) => setSupplierForm((current) => ({ ...current, phone: event.target.value }))} className={INPUT_CLASS} />
                </Field>
                <Field label="Banco">
                  <input value={supplierForm.bankName} onChange={(event) => setSupplierForm((current) => ({ ...current, bankName: event.target.value }))} className={INPUT_CLASS} />
                </Field>
                <Field label="Agência">
                  <input value={supplierForm.bankAgency} onChange={(event) => setSupplierForm((current) => ({ ...current, bankAgency: event.target.value }))} className={INPUT_CLASS} />
                </Field>
                <Field label="Conta">
                  <input value={supplierForm.bankAccount} onChange={(event) => setSupplierForm((current) => ({ ...current, bankAccount: event.target.value }))} className={INPUT_CLASS} />
                </Field>
                <Field label="Pix">
                  <input value={supplierForm.pixKey} onChange={(event) => setSupplierForm((current) => ({ ...current, pixKey: event.target.value }))} className={INPUT_CLASS} />
                </Field>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field label="Nome do convênio">
                  <input value={insuranceForm.name} onChange={(event) => setInsuranceForm((current) => ({ ...current, name: event.target.value }))} className={INPUT_CLASS} />
                </Field>
                <Field label="Código interno">
                  <input value={insuranceForm.code} onChange={(event) => setInsuranceForm((current) => ({ ...current, code: event.target.value }))} className={INPUT_CLASS} />
                </Field>
                <Field label="CNPJ">
                  <input value={insuranceForm.cnpj} onChange={(event) => setInsuranceForm((current) => ({ ...current, cnpj: event.target.value }))} className={INPUT_CLASS} />
                </Field>
                <Field label="Código ANS">
                  <input value={insuranceForm.ansCode} onChange={(event) => setInsuranceForm((current) => ({ ...current, ansCode: event.target.value }))} className={INPUT_CLASS} />
                </Field>
                <Field label="Contato">
                  <input value={insuranceForm.contactName} onChange={(event) => setInsuranceForm((current) => ({ ...current, contactName: event.target.value }))} className={INPUT_CLASS} />
                </Field>
                <Field label="Email do contato">
                  <input value={insuranceForm.contactEmail} onChange={(event) => setInsuranceForm((current) => ({ ...current, contactEmail: event.target.value }))} className={INPUT_CLASS} />
                </Field>
                <Field label="Telefone do contato">
                  <input value={insuranceForm.contactPhone} onChange={(event) => setInsuranceForm((current) => ({ ...current, contactPhone: event.target.value }))} className={INPUT_CLASS} />
                </Field>
                <Field label="Prazo de pagamento (dias)">
                  <input type="number" min="0" value={insuranceForm.paymentTermDays} onChange={(event) => setInsuranceForm((current) => ({ ...current, paymentTermDays: event.target.value }))} className={INPUT_CLASS} />
                </Field>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={composer === 'supplier' ? handleCreateSupplier : handleCreateInsurance}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={16} />
                {saving ? 'Salvando...' : composer === 'supplier' ? 'Salvar fornecedor' : 'Salvar convênio'}
              </button>
              <button onClick={closeComposer} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
