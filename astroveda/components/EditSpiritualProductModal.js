'use client';
import { useState, useEffect } from 'react';

/**
 * EditSpiritualProductModal
 * Admin modal for editing spiritual product details, including the display priority rank
 * for storefront sequencing.
 */
export default function EditSpiritualProductModal({
  isOpen,
  onClose,
  product,
  onUpdate,
  categories = [],
  activeCategory = '',
  title = '',
}) {
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    category: '',
    price: '',
    compare_price: '',
    stock_quantity: 10,
    certification_status: 'certified',
    publishing_status: 'published',
    thumbnail: '',
    display_rank: 999,
    description: '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImg(true);
    setUploadStatus('Uploading image...');

    try {
      const fd = new FormData();
      fd.append('image', file);

      const res = await fetch('/api/v1/upload-product-image', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setFormData((prev) => ({ ...prev, thumbnail: data.url }));
        setUploadStatus(`✓ ${file.name} uploaded`);
      } else {
        setUploadStatus(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('File upload error:', err);
      setUploadStatus('Upload failed');
    } finally {
      setUploadingImg(false);
    }
  };

  // Re-synchronize form state whenever product changes or modal opens
  useEffect(() => {
    if (product) {
      // Check all possible field names returned by the backend API:
      // display_rank, displayRank, rank, or sort_order.
      const rawRank = product.display_rank ?? product.displayRank ?? product.rank ?? product.sort_order;
      const initialRank = (rawRank !== undefined && rawRank !== null && rawRank !== '' && !isNaN(Number(rawRank)))
        ? Number(rawRank)
        : (product.id ? 1 : 999);

      const resolvedCat = product.category_id || product.category || product.cat || activeCategory || '';

      setFormData({
        name: product.name || product.title || '',
        category_id: resolvedCat,
        category: product.category || resolvedCat,
        price: product.priceNum ?? (typeof product.price === 'number' ? product.price : (parseFloat(String(product.price).replace(/[^0-9.]/g, '')) || '')),
        compare_price: product.compare_price ?? (product.priceOld ? parseFloat(String(product.priceOld).replace(/[^0-9.]/g, '')) : ''),
        stock_quantity: product.stock_quantity ?? 10,
        certification_status: product.certification_status || (product.badge === 'lab' ? 'certified' : 'standard'),
        publishing_status: product.publishing_status || 'published',
        thumbnail: product.thumbnail || (typeof product.img === 'string' && product.img.startsWith('http') ? product.img : ''),
        display_rank: initialRank,
        description: product.description || product.desc || '',
      });
      setError('');
    } else {
      setFormData({
        name: '',
        category_id: activeCategory || '',
        category: activeCategory || '',
        price: '',
        compare_price: '',
        stock_quantity: 10,
        certification_status: 'certified',
        publishing_status: 'published',
        thumbnail: '',
        display_rank: 999,
        description: '',
      });
      setError('');
    }
  }, [product, isOpen, activeCategory]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value,
      };
      if (name === 'category_id' || name === 'category') {
        next.category_id = value;
        next.category = value;
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const rank = Number(formData.display_rank);
    if (isNaN(rank) || rank < 1) {
      setError('Display Rank must be an integer greater than or equal to 1.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        display_rank: Math.max(1, parseInt(formData.display_rank, 10) || 1),
        category: formData.category || formData.category_id,
        category_id: formData.category_id || formData.category,
      };

      if (onUpdate) {
        await onUpdate(payload);
      }
      if (onClose) {
        onClose();
      }
    } catch (err) {
      setError(err?.message || 'Failed to update product. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#1a0f16] border border-[#e0b04a]/30 rounded-2xl shadow-2xl p-6 my-8 text-neutral-800 dark:text-[#f6ecd9]">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-[#e0b04a]/20 mb-5">
          <h3 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-[#f7dc9a] font-serif">
            {title || (product?.id ? 'Edit Spiritual Product' : 'Add Spiritual Product')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Title & Category */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-neutral-600 dark:text-neutral-300">
                Product Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm focus:ring-2 focus:ring-[#e0b04a] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-neutral-600 dark:text-neutral-300">
                Category
              </label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm focus:ring-2 focus:ring-[#e0b04a] focus:outline-none"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id || c.value || c.slug} value={c.id || c.value || c.slug}>
                    {c.name || c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Price, Compare Price, Stock */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-neutral-600 dark:text-neutral-300">
                Price (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                name="price"
                value={formData.price}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm focus:ring-2 focus:ring-[#e0b04a] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-neutral-600 dark:text-neutral-300">
                Compare At Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                name="compare_price"
                value={formData.compare_price}
                onChange={handleChange}
                placeholder="2999.00"
                className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm focus:ring-2 focus:ring-[#e0b04a] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-neutral-600 dark:text-neutral-300">
                Stock Quantity
              </label>
              <input
                type="number"
                name="stock_quantity"
                value={formData.stock_quantity}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm focus:ring-2 focus:ring-[#e0b04a] focus:outline-none"
              />
            </div>
          </div>

          {/* Row 3: 3-column row: Thumbnail Image URL (2 cols) & Display Rank (1 col) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                  Thumbnail Image URL / File
                </label>
                {uploadStatus && (
                  <span className="text-xs text-emerald-600 font-medium">{uploadStatus}</span>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  name="thumbnail"
                  value={formData.thumbnail}
                  onChange={handleChange}
                  placeholder="Paste URL, local file path, or choose from folder"
                  className="w-full rounded-lg border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm focus:ring-2 focus:ring-[#e0b04a] focus:outline-none border"
                />
                <label className="cursor-pointer whitespace-nowrap px-3 py-2 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 transition-colors">
                  {uploadingImg ? 'Uploading...' : '📁 Choose File'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploadingImg}
                  />
                </label>
              </div>
              {formData.thumbnail && (
                <div className="mt-2 flex items-center gap-3 p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <img
                    src={formData.thumbnail}
                    alt="Preview"
                    className="w-10 h-10 object-cover rounded border border-neutral-300 dark:border-neutral-600"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-xs">
                    {formData.thumbnail}
                  </span>
                </div>
              )}
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Choose directly from folder, or paste image URL or file path address.
              </p>
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-neutral-600 dark:text-neutral-300">
                Display Rank
              </label>
              <input
                type="number"
                name="display_rank"
                min="1"
                step="1"
                value={formData.display_rank}
                onChange={handleChange}
                required
                className="w-full rounded-lg border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm focus:ring-2 focus:ring-[#e0b04a] focus:outline-none border"
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Determines position on the website (1 = 1st, 2 = 2nd, etc.)
              </p>
            </div>
          </div>

          {/* Row 4: Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-neutral-600 dark:text-neutral-300">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              placeholder="Spiritual benefits, energized status, chanting guidelines..."
              className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm focus:ring-2 focus:ring-[#e0b04a] focus:outline-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-[#e0b04a]/20">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#e0b04a] to-[#ff8c2b] text-neutral-900 hover:opacity-95 shadow-md transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : (product?.id ? 'Update Product' : 'Add Product')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
