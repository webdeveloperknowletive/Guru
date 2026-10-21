'use client';
import { useState, useMemo } from 'react';
import EditSpiritualProductModal from './EditSpiritualProductModal';

/**
 * SpiritualProductsAdminTable
 * Comprehensive admin table component with:
 * 1. Synchronized useMemo filtered rows to prevent stale category lists on product addition.
 * 2. Case-insensitive and trimmed category matching.
 * 3. Master state update for display_rank so it never resets upon reopening the modal.
 */
export default function SpiritualProductsAdminTable({
  initialProducts = [],
  categories = [],
  onUpdateProduct,
  onCreateProduct,
}) {
  const [products, setProducts] = useState(initialProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [archiveStatus, setArchiveStatus] = useState('active'); // 'all', 'active', 'archived'
  const [publishingStatus, setPublishingStatus] = useState(''); // '', 'published', 'draft'

  // Modal State
  const [editingProduct, setEditingProduct] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Dynamic status counts calculated from master products list
  const counts = useMemo(() => {
    let all = products.length;
    let active = 0;
    let archived = 0;
    products.forEach((p) => {
      const isArchived = Boolean(p.is_archived || p.publishing_status === 'archived');
      if (isArchived) archived++;
      else active++;
    });
    return { all, active, archived };
  }, [products]);

  // Derived filtered products dynamically synced with master state
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameMatch = (p.name || p.title || '').toLowerCase().includes(q);
        const skuMatch = (p.sku || '').toLowerCase().includes(q);
        if (!nameMatch && !skuMatch) return false;
      }

      // 2. Category Filter (Case-insensitive, trimmed, ID and slug/name agnostic)
      if (selectedCategory && selectedCategory !== 'all') {
        const selCatTrimmed = String(selectedCategory).trim().toLowerCase();
        const prodCatId = p.category_id !== undefined && p.category_id !== null ? String(p.category_id).trim() : '';
        const prodCatName = (typeof p.category === 'object' ? p.category?.name : p.category) || p.catLabel || p.cat || '';
        const prodCatSlug = (typeof p.category === 'object' ? p.category?.slug : '') || p.category_slug || '';

        const matchesId = prodCatId && prodCatId === selCatTrimmed;
        const matchesName = prodCatName && prodCatName.trim().toLowerCase() === selCatTrimmed;
        const matchesSlug = prodCatSlug && prodCatSlug.trim().toLowerCase() === selCatTrimmed;
        const matchesPartial = prodCatName && prodCatName.toLowerCase().includes(selCatTrimmed);

        if (!matchesId && !matchesName && !matchesSlug && !matchesPartial) {
          return false;
        }
      }

      // 3. Archive / Active Tab Filter
      const isArchived = Boolean(p.is_archived || p.publishing_status === 'archived');
      if (archiveStatus === 'active' && isArchived) return false;
      if (archiveStatus === 'archived' && !isArchived) return false;

      // 4. Publishing Status Filter
      if (publishingStatus) {
        const pub = (p.publishing_status || 'published').trim().toLowerCase();
        if (pub !== publishingStatus.trim().toLowerCase()) return false;
      }

      return true;
    }).sort((a, b) => {
      const rankA = a.display_rank ?? a.displayRank ?? 999;
      const rankB = b.display_rank ?? b.displayRank ?? 999;
      return rankA - rankB;
    });
  }, [products, searchQuery, selectedCategory, archiveStatus, publishingStatus]);

  // Handlers for modal actions
  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setIsEditModalOpen(true);
  };

  const handleCloseEdit = () => {
    setEditingProduct(null);
    setIsEditModalOpen(false);
  };

  const handleSaveEdit = async (updatedData) => {
    const updatedRank = Number(updatedData.display_rank);

    // Call external API if provided
    if (onUpdateProduct && editingProduct) {
      await onUpdateProduct(editingProduct.id, {
        ...updatedData,
        display_rank: updatedRank,
      });
    }

    // Immediately update master table state with the saved display_rank and fields
    setProducts((prev) =>
      prev
        .map((item) =>
          item.id === editingProduct.id
            ? {
                ...item,
                ...updatedData,
                display_rank: updatedRank,
                displayRank: updatedRank,
              }
            : item
        )
        .sort((a, b) => (Number(a.display_rank ?? 999) - Number(b.display_rank ?? 999)))
    );

    handleCloseEdit();
  };

  const handleSaveAdd = async (newProductData) => {
    const normalizedRank = Number(newProductData.display_rank) || 999;
    const newRecord = {
      id: newProductData.id || Date.now(),
      ...newProductData,
      is_archived: false,
      publishing_status: (newProductData.publishing_status || 'published').toLowerCase(),
      display_rank: normalizedRank,
      displayRank: normalizedRank,
    };

    if (onCreateProduct) {
      const created = await onCreateProduct(newRecord);
      if (created) Object.assign(newRecord, created);
    }

    // Immediately append to master products state and sort by display_rank
    setProducts((prev) =>
      [newRecord, ...prev].sort((a, b) => (Number(a.display_rank ?? 999) - Number(b.display_rank ?? 999)))
    );
    setIsAddModalOpen(false);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 text-neutral-800 dark:text-neutral-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-[#f7dc9a] font-serif">
            Spiritual Products
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Manage Ratna, Rudraksha, Yantra, Bracelets, and Puja Samagri collections.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#e0b04a] to-[#ff8c2b] text-neutral-950 font-semibold text-sm shadow hover:opacity-95 transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Product
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          type="button"
          onClick={() => setArchiveStatus('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition inline-flex items-center gap-2 border ${
            archiveStatus === 'all'
              ? 'bg-[#e0b04a] text-neutral-900 border-[#e0b04a]'
              : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <span>All Products</span>
          <span className="px-1.5 py-0.5 rounded-full bg-black/10 text-[10px]">{counts.all}</span>
        </button>
        <button
          type="button"
          onClick={() => setArchiveStatus('active')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition inline-flex items-center gap-2 border ${
            archiveStatus === 'active'
              ? 'bg-[#e0b04a] text-neutral-900 border-[#e0b04a]'
              : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <span>Active</span>
          <span className="px-1.5 py-0.5 rounded-full bg-black/10 text-[10px]">{counts.active}</span>
        </button>
        <button
          type="button"
          onClick={() => setArchiveStatus('archived')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition inline-flex items-center gap-2 border ${
            archiveStatus === 'archived'
              ? 'bg-[#e0b04a] text-neutral-900 border-[#e0b04a]'
              : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <span>Archived</span>
          <span className="px-1.5 py-0.5 rounded-full bg-black/10 text-[10px]">{counts.archived}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-[#150d12] border border-neutral-200 dark:border-[#e0b04a]/20 rounded-xl p-3 sm:p-4 mb-6 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e0b04a]"
          />
        </div>

        <div className="min-w-[150px]">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e0b04a]"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id || c.value || c.slug} value={c.name || c.slug || c.id}>
                {c.name || c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[140px]">
          <select
            value={publishingStatus}
            onChange={(e) => setPublishingStatus(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e0b04a]"
          >
            <option value="">All Publication States</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#150d12] border border-neutral-200 dark:border-[#e0b04a]/20 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 font-semibold text-xs uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Product Name & Specs</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((prod) => (
                  <tr key={prod.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/60 transition">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-full bg-[#e0b04a]/20 text-[#e0b04a] font-bold text-xs border border-[#e0b04a]/40">
                        #{prod.display_rank ?? prod.displayRank ?? 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
                      {prod.name || prod.title}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-neutral-500">
                      {prod.sku || '-'}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                      {(typeof prod.category === 'object' ? prod.category?.name : prod.category) || prod.catLabel || '-'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-neutral-800 dark:text-[#f7dc9a]">
                      {typeof prod.price === 'number' ? `₹${prod.price.toLocaleString('en-IN')}` : (prod.price || '-')}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-300">
                      {prod.stock_quantity ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                          prod.publishing_status === 'published'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {prod.publishing_status || 'published'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(prod)}
                        className="px-3 py-1 rounded text-xs font-semibold border border-[#e0b04a]/50 text-[#e0b04a] hover:bg-[#e0b04a]/10 transition"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-neutral-500">
                    No spiritual products found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Spiritual Product Modal */}
      <EditSpiritualProductModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEdit}
        product={editingProduct}
        onUpdate={handleSaveEdit}
        categories={categories}
        title="Edit Spiritual Product"
      />

      {/* Add Spiritual Product Modal */}
      <EditSpiritualProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        product={null}
        activeCategory={selectedCategory}
        onUpdate={handleSaveAdd}
        categories={categories}
        title="Add Spiritual Product"
      />
    </div>
  );
}
