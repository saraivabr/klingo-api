import React, { useState } from 'react';

interface Medicine {
  id?: string;
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
}

interface Category {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

interface MedicineFormProps {
  medicine?: Medicine;
  categories: Category[];
  brands: Brand[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export default function MedicineForm({
  medicine,
  categories,
  brands,
  onSubmit,
  onCancel,
}: MedicineFormProps) {
  const [formData, setFormData] = useState<Medicine>(
    medicine || {
      name: '',
      unit: 'unit',
      sellingPrice: 0,
      purchasePrice: 0,
      quantity: 0,
      alertQuantity: 10,
    }
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (!formData.unit.trim()) {
      newErrors.unit = 'Unidade é obrigatória';
    }

    if (formData.sellingPrice < 0) {
      newErrors.sellingPrice = 'Preço de venda não pode ser negativo';
    }

    if (formData.purchasePrice < 0) {
      newErrors.purchasePrice = 'Preço de compra não pode ser negativo';
    }

    if (formData.quantity < 0) {
      newErrors.quantity = 'Quantidade não pode ser negativa';
    }

    if (formData.alertQuantity < 0) {
      newErrors.alertQuantity = 'Quantidade de alerta não pode ser negativa';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    onSubmit(formData);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'number' ? parseFloat(value) : value,
    });
    // Clear error for this field
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: '',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Nome do Medicamento *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.name ? 'border-red-500' : 'border-slate-300'
            }`}
            placeholder="ex: Dipirona 500mg"
          />
          {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
        </div>

        {/* Generic Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Nome Genérico
          </label>
          <input
            type="text"
            name="genericName"
            value={formData.genericName || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="ex: Paracetamol"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Categoria
          </label>
          <select
            name="categoryId"
            value={formData.categoryId || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Nenhuma</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Brand */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Marca
          </label>
          <select
            name="brandId"
            value={formData.brandId || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Nenhuma</option>
            {brands.map(brand => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>

        {/* Unit */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Unidade *
          </label>
          <select
            name="unit"
            value={formData.unit}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.unit ? 'border-red-500' : 'border-slate-300'
            }`}
          >
            <option value="unit">Unidade</option>
            <option value="mg">mg</option>
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="l">l</option>
            <option value="tablet">Comprimido</option>
            <option value="capsule">Cápsula</option>
            <option value="bottle">Frasco</option>
          </select>
          {errors.unit && <p className="text-red-600 text-xs mt-1">{errors.unit}</p>}
        </div>

        {/* Composition */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Composição
          </label>
          <input
            type="text"
            name="composition"
            value={formData.composition || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="ex: 500mg por comprimido"
          />
        </div>

        {/* Selling Price */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Preço de Venda (R$) *
          </label>
          <input
            type="number"
            name="sellingPrice"
            value={formData.sellingPrice}
            onChange={handleInputChange}
            step="0.01"
            min="0"
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.sellingPrice ? 'border-red-500' : 'border-slate-300'
            }`}
            placeholder="0.00"
          />
          {errors.sellingPrice && <p className="text-red-600 text-xs mt-1">{errors.sellingPrice}</p>}
        </div>

        {/* Purchase Price */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Preço de Compra (R$) *
          </label>
          <input
            type="number"
            name="purchasePrice"
            value={formData.purchasePrice}
            onChange={handleInputChange}
            step="0.01"
            min="0"
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.purchasePrice ? 'border-red-500' : 'border-slate-300'
            }`}
            placeholder="0.00"
          />
          {errors.purchasePrice && <p className="text-red-600 text-xs mt-1">{errors.purchasePrice}</p>}
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Quantidade em Estoque *
          </label>
          <input
            type="number"
            name="quantity"
            value={formData.quantity}
            onChange={handleInputChange}
            min="0"
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.quantity ? 'border-red-500' : 'border-slate-300'
            }`}
            placeholder="0"
          />
          {errors.quantity && <p className="text-red-600 text-xs mt-1">{errors.quantity}</p>}
        </div>

        {/* Alert Quantity */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Quantidade Mínima de Alerta
          </label>
          <input
            type="number"
            name="alertQuantity"
            value={formData.alertQuantity}
            onChange={handleInputChange}
            min="0"
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.alertQuantity ? 'border-red-500' : 'border-slate-300'
            }`}
            placeholder="10"
          />
          {errors.alertQuantity && <p className="text-red-600 text-xs mt-1">{errors.alertQuantity}</p>}
        </div>

        {/* Expiry Date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Data de Vencimento
          </label>
          <input
            type="date"
            name="expiryDate"
            value={formData.expiryDate || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Batch Number */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Número do Lote
          </label>
          <input
            type="text"
            name="batchNumber"
            value={formData.batchNumber || ''}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="ex: 12345ABC"
          />
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex gap-3 justify-end pt-6 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {medicine ? 'Atualizar' : 'Adicionar'}
        </button>
      </div>
    </form>
  );
}
