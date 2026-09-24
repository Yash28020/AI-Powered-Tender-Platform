import * as React from 'react';
import { useState, useEffect } from 'react';
import { SKU, AddItemModalProps } from '../../types';
import { X, Save } from 'lucide-react';

export const AddItemModal: React.FC<AddItemModalProps> = ({ onClose, onSave, existingItem }) => {
  // Pre-fill the form if existingItem is passed, otherwise create blank defaults
  const [formData, setFormData] = useState<Partial<SKU>>({
    skuId: `SKU-${Date.now().toString().slice(-6)}`,
    productName: '',
    productCategory: 'Wires & Cables',
    availableQuantity: 0,
    unitSalesPrice: 0,
    costPrice: 0,
    gstRate: 18,
    warehouseLocation: "Jalandhar, PB",
    warehouseCode: "JAL-01",
    warehouseLat: 31.3260,
    warehouseLon: 75.5762,
    truckType: 'LCV',
    leadTime: 3,
    bulkSalesPrice: 0,
    minMarginPercent: 10,
    isActive: true,
    isCustomMadePossible: false,
    isComplianceReady: true,
    specification: {},
    productSubCategory: 'General',
    oemBrand: 'Internal'
  });

  // If editing, load the existing item data into the form
  useEffect(() => {
    if (existingItem) {
      setFormData(existingItem);
    }
  }, [existingItem]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const isNumber = ['availableQuantity', 'unitSalesPrice', 'costPrice', 'gstRate'].includes(name);
    setFormData(prev => ({ 
      ...prev, 
      [name]: isNumber ? Number(value) : value 
    }));
  };

  const handleSave = () => {
    if (!formData.skuId || !formData.productName) {
      alert("SKU ID and Product Name are required.");
      return;
    }
    // Cast to complete SKU type before passing up
    onSave(formData as SKU);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-8">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-2xl w-full shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-white uppercase tracking-tight">
            {existingItem ? 'Edit Existing SKU' : 'Add New SKU'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="col-span-2 md:col-span-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">SKU ID</label>
            <input 
              type="text" name="skuId" value={formData.skuId} onChange={handleChange}
              disabled={!!existingItem} // Prevent editing SKU ID if it already exists
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Category</label>
            <input 
              type="text" name="productCategory" value={formData.productCategory} onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Product Name</label>
            <input 
              type="text" name="productName" value={formData.productName} onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Stock Qty</label>
            <input 
              type="number" name="availableQuantity" value={formData.availableQuantity} onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Unit Sales Price (₹)</label>
            <input 
              type="number" name="unitSalesPrice" value={formData.unitSalesPrice} onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex gap-4">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
            <Save className="w-4 h-4" /> Save SKU Data
          </button>
        </div>
      </div>
    </div>
  );
};