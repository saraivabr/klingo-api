import React, { useState } from 'react';
import { Trash2, Plus, Minus, ShoppingCart, Search } from 'lucide-react';
import { api } from '../../services/api';

interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  quantity: number;
  sellingPrice: number;
  unit: string;
}

interface CartItem {
  medicineId: string;
  medicineName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

interface POSSaleProps {
  medicines: Medicine[];
  onSaleComplete: () => void;
}

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

export default function POSSale({ medicines, onSaleComplete }: POSSaleProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [patientId, setPatientId] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const filteredMedicines = medicines.filter(
    m =>
      (m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.genericName?.toLowerCase().includes(searchTerm.toLowerCase())) &&
      m.quantity > 0
  );

  const addToCart = (medicine: Medicine) => {
    const existing = cart.find(item => item.medicineId === medicine.id);

    if (existing) {
      if (existing.quantity < medicine.quantity) {
        setCart(
          cart.map(item =>
            item.medicineId === medicine.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  totalPrice: (item.quantity + 1) * item.unitPrice,
                }
              : item
          )
        );
      }
    } else {
      setCart([
        ...cart,
        {
          medicineId: medicine.id,
          medicineName: medicine.name,
          unitPrice: medicine.sellingPrice,
          quantity: 1,
          totalPrice: medicine.sellingPrice,
        },
      ]);
    }
    setError('');
  };

  const removeFromCart = (medicineId: string) => {
    setCart(cart.filter(item => item.medicineId !== medicineId));
  };

  const updateQuantity = (medicineId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(medicineId);
      return;
    }

    const medicine = medicines.find(m => m.id === medicineId);
    if (medicine && newQuantity > medicine.quantity) {
      setError(`Quantidade máxima disponível: ${medicine.quantity}`);
      return;
    }

    setCart(
      cart.map(item =>
        item.medicineId === medicineId
          ? {
              ...item,
              quantity: newQuantity,
              totalPrice: newQuantity * item.unitPrice,
            }
          : item
      )
    );
    setError('');
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((acc, item) => acc + item.totalPrice, 0);
    const discount = (subtotal * discountPercent) / 100;
    const total = subtotal - discount;
    return { subtotal, discount, total };
  };

  const handleCheckout = async () => {
    if (!patientId.trim()) {
      setError('Selecione um paciente');
      return;
    }

    if (cart.length === 0) {
      setError('Carrinho vazio');
      return;
    }

    setLoading(true);
    try {
      await api.pharmacyCreateSale({
        patientId,
        items: cart.map(item => ({
          medicineId: item.medicineId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        discountPercent,
        paymentMethod,
      });

      setCart([]);
      setPatientId('');
      setDiscountPercent(0);
      setPaymentMethod('cash');
      setError('');
      onSaleComplete();
      alert('Venda registrada com sucesso!');
    } catch (err) {
      setError('Erro ao registrar venda');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, discount, total } = calculateTotals();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Medicine List */}
      <div className="lg:col-span-2 space-y-4">
        {/* Search */}
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

        {/* Medicine Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
          {filteredMedicines.map(medicine => (
            <div key={medicine.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 text-sm">{medicine.name}</h3>
                  {medicine.genericName && (
                    <p className="text-xs text-slate-500">{medicine.genericName}</p>
                  )}
                </div>
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">
                  {medicine.quantity} {medicine.unit}
                </span>
              </div>

              <div className="flex justify-between items-center mb-3">
                <p className="font-bold text-slate-900">{formatCurrency(medicine.sellingPrice)}</p>
                <button
                  onClick={() => addToCart(medicine)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Summary */}
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          {/* Patient Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Paciente *
            </label>
            <input
              type="text"
              placeholder="ID do paciente"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Cart Items */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <ShoppingCart size={18} />
              Carrinho ({cart.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">Carrinho vazio</p>
              ) : (
                cart.map(item => (
                  <div key={item.medicineId} className="bg-slate-50 p-2 rounded">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.medicineName}</p>
                        <p className="text-xs text-slate-500">{formatCurrency(item.unitPrice)} un</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.medicineId)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex gap-1">
                        <button
                          onClick={() => updateQuantity(item.medicineId, item.quantity - 1)}
                          className="px-2 py-0.5 bg-slate-200 rounded text-xs hover:bg-slate-300"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateQuantity(item.medicineId, parseInt(e.target.value) || 0)
                          }
                          className="w-10 text-center text-sm border border-slate-300 rounded"
                        />
                        <button
                          onClick={() => updateQuantity(item.medicineId, item.quantity + 1)}
                          className="px-2 py-0.5 bg-slate-200 rounded text-xs hover:bg-slate-300"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatCurrency(item.totalPrice)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Discount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Desconto (%)
            </label>
            <input
              type="number"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Math.max(0, parseFloat(e.target.value) || 0))}
              min="0"
              max="100"
              step="0.1"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Forma de Pagamento
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="cash">Dinheiro</option>
              <option value="credit">Crédito</option>
              <option value="debit">Débito</option>
              <option value="pix">Pix</option>
              <option value="check">Cheque</option>
            </select>
          </div>

          {/* Totals */}
          <div className="border-t border-slate-200 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Subtotal:</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Desconto ({discountPercent}%):</span>
                <span className="font-medium">-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold bg-blue-50 p-2 rounded">
              <span>Total:</span>
              <span className="text-blue-600">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            disabled={loading || cart.length === 0}
            className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {loading ? 'Processando...' : 'Finalizar Venda'}
          </button>
        </div>
      </div>
    </div>
  );
}
