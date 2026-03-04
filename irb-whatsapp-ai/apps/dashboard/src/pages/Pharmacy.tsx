import React, { useEffect, useState } from 'react';
import { Pill, ShoppingCart, AlertCircle, TrendingDown, Package, Plus, Search } from 'lucide-react';
import { api } from '../services/api';
import MedicineForm from '../components/pharmacy/MedicineForm';
import POSSale from '../components/pharmacy/POSSale';

interface Medicine {
  id: string;
  categoryId?: string;
  brandId?: string;
  name: string;
  genericName?: string;
  composition?: string;
  unit: string;
  sellingPrice: number;
  purchasePrice: number;
  quantity: number;
  alertQuantity: number;
  expiryDate?: string;
  batchNumber?: string;
  isActive: boolean;
}

interface Sale {
  id: string;
  patientId: string;
  saleNumber: string;
  totalAmount: number;
  discountPercent: number;
  netAmount: number;
  paymentMethod: string;
  status: string;
  soldBy: string;
  soldAt: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

interface Brand {
  id: string;
  name: string;
  isActive: boolean;
}

type TabType = 'inventory' | 'pos' | 'sales' | 'low-stock';

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

export default function Pharmacy() {
  const [activeTab, setActiveTab] = useState<TabType>('inventory');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [lowStockMedicines, setLowStockMedicines] = useState<Medicine[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showMedicineForm, setShowMedicineForm] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [medRes, catRes, brandRes, salesRes, lowRes] = await Promise.all([
        api.pharmacyGetMedicines(),
        api.pharmacyGetCategories(),
        api.pharmacyGetBrands(),
        api.pharmacyGetSales(),
        api.pharmacyGetLowStock(),
      ]);

      setMedicines(medRes.medicines || []);
      setCategories(catRes.categories || []);
      setBrands(brandRes.brands || []);
      setSales(salesRes.sales || []);
      setLowStockMedicines(lowRes.medicines || []);
    } catch (error) {
      console.error('Erro ao carregar dados da farmácia:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMedicineSubmit = async (data: any) => {
    try {
      if (editingMedicine) {
        await api.pharmacyUpdateMedicine(editingMedicine.id, data);
      } else {
        await api.pharmacyCreateMedicine(data);
      }
      setShowMedicineForm(false);
      setEditingMedicine(null);
      await loadData();
    } catch (error) {
      console.error('Erro ao salvar medicamento:', error);
    }
  };

  const handleSaleComplete = async () => {
    await loadData();
  };

  const filteredMedicines = medicines.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.genericName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const StatCard = ({ icon: Icon, label, value, color }: any) => (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${color}`}><Icon size={20} /></div>
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );

  return (
    <div className="px-6 py-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">Farmácia</h2>
        <button
          onClick={() => {
            setEditingMedicine(null);
            setShowMedicineForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} /> Adicionar Medicamento
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Package}
          label="Total de Medicamentos"
          value={medicines.length}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={AlertCircle}
          label="Estoque Baixo"
          value={lowStockMedicines.length}
          color="bg-orange-50 text-orange-600"
        />
        <StatCard
          icon={ShoppingCart}
          label="Vendas Hoje"
          value={sales.filter(s => s.soldAt?.includes(new Date().toISOString().split('T')[0])).length}
          color="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          icon={TrendingDown}
          label="Total Vendido"
          value={formatCurrency(sales.reduce((acc, s) => acc + s.netAmount, 0))}
          color="bg-purple-50 text-purple-600"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        {(['inventory', 'pos', 'sales', 'low-stock'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium border-b-2 -mb-px transition ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'inventory' && 'Inventário'}
            {tab === 'pos' && 'Venda (POS)'}
            {tab === 'sales' && 'Histórico de Vendas'}
            {tab === 'low-stock' && 'Estoque Baixo'}
          </button>
        ))}
      </div>

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Buscar medicamento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Medicamento</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Genérico</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Quantidade</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Preço Venda</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredMedicines.map(medicine => (
                  <tr key={medicine.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{medicine.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{medicine.genericName || '-'}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">{medicine.quantity}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">{formatCurrency(medicine.sellingPrice)}</td>
                    <td className="px-4 py-3 text-sm">
                      {medicine.quantity < medicine.alertQuantity ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">Baixo</span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => {
                          setEditingMedicine(medicine);
                          setShowMedicineForm(true);
                        }}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* POS Tab */}
      {activeTab === 'pos' && (
        <POSSale medicines={medicines} onSaleComplete={handleSaleComplete} />
      )}

      {/* Sales History Tab */}
      {activeTab === 'sales' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Venda #</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Data</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Total</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Desconto</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Líquido</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(sale => (
                  <tr key={sale.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{sale.saleNumber}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(sale.soldAt)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">{formatCurrency(sale.totalAmount)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600">{sale.discountPercent}%</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">{formatCurrency(sale.netAmount)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{sale.paymentMethod}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Low Stock Tab */}
      {activeTab === 'low-stock' && (
        <div className="space-y-4">
          {lowStockMedicines.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-green-700 font-medium">✓ Todos os medicamentos têm estoque adequado</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Medicamento</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Quantidade</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Mín. Alerta</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Faltam</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockMedicines.map(medicine => (
                    <tr key={medicine.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{medicine.name}</td>
                      <td className="px-4 py-3 text-right text-sm text-red-600 font-medium">{medicine.quantity}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-600">{medicine.alertQuantity}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-red-600">
                        {medicine.alertQuantity - medicine.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Medicine Form Modal */}
      {showMedicineForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">
                {editingMedicine ? 'Editar Medicamento' : 'Novo Medicamento'}
              </h3>
              <button
                onClick={() => {
                  setShowMedicineForm(false);
                  setEditingMedicine(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <MedicineForm
              medicine={editingMedicine || undefined}
              categories={categories}
              brands={brands}
              onSubmit={handleMedicineSubmit}
              onCancel={() => {
                setShowMedicineForm(false);
                setEditingMedicine(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
