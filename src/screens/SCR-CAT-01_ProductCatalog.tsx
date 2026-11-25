import React, { useState, useEffect } from "react";
import { FinishedProduct, CreateProductPayload } from "@/types/database";
import { SystemUser } from "@/types/system";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/lib/tauri-bridge";
import { formatPaisaToRupees } from "@/lib/formatters";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import { exportProductsInventoryToCSV } from "@/lib/export-utils";
import {
  Package,
  Search,
  AlertTriangle,
  TrendingUp,
  Barcode,
  Layers,
  RotateCcw,
  Plus,
  Trash2,
  Edit3,
  ShoppingBag,
  Download,
} from "lucide-react";

interface ProductCatalogProps {
  currentUser: SystemUser | null;
  onNavigateToPOS: (product?: FinishedProduct) => void;
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({ currentUser, onNavigateToPOS }) => {
  const isCashier = currentUser?.role === "CASHIER_OPERATOR" || (currentUser?.role as string) === "CASHIER";
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [stockFilter, setStockFilter] = useState<"ALL" | "LOW_STOCK" | "OUT_OF_STOCK" | "IN_STOCK">("ALL");
  const [isLoading, setIsLoading] = useState(true);

  // New Perfume Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSku, setNewSku] = useState("");
  const [isSkuManuallyEdited, setIsSkuManuallyEdited] = useState(false);
  const [newBarcode, setNewBarcode] = useState("");
  const [newCategory, setNewCategory] = useState<"MENS" | "WOMENS" | "UNISEX" | "ORIENTAL_LUXURY" | "LIMITED_EDITION">("MENS");
  const [newSizeMl, setNewSizeMl] = useState(50);
  const [newStockUnits, setNewStockUnits] = useState(100);
  const [newRetailRupees, setNewRetailRupees] = useState("15000");
  const [newWholesaleRupees, setNewWholesaleRupees] = useState("12000");
  const [newCostRupees] = useState("0");
  const [newReorderThreshold, setNewReorderThreshold] = useState(5);

  // Edit Perfume State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<FinishedProduct | null>(null);
  const [editName, setEditName] = useState("");
  const [editBarcode, setEditBarcode] = useState("");
  const [editCategory, setEditCategory] = useState<string>("MENS");
  const [editSizeMl, setEditSizeMl] = useState(50);
  const [editStockUnits, setEditStockUnits] = useState(0);
  const [editRetailRupees, setEditRetailRupees] = useState("");
  const [editWholesaleRupees, setEditWholesaleRupees] = useState("");
  const [editCostRupees, setEditCostRupees] = useState("");
  const [editThreshold, setEditThreshold] = useState(5);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStartEdit = (p: FinishedProduct) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditBarcode(p.barcode || "");
    setEditCategory(p.category);
    setEditSizeMl(p.size_ml);
    setEditStockUnits(p.current_stock_units || 0);
    setEditRetailRupees((p.retail_price_paisa / 100).toString());
    setEditWholesaleRupees((p.wholesale_price_paisa / 100).toString());
    setEditCostRupees(((p.latest_batch_cost_paisa || 0) / 100).toString());
    setEditThreshold(p.reorder_threshold_units || 5);
    setIsEditModalOpen(true);
  };

  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editName.trim()) {
      alert("Please provide perfume name.");
      return;
    }

    const targetSize = Number(editSizeMl) || 50;
    const isDuplicate = products.some(
      (p) =>
        p.is_active &&
        p.product_id !== editingProduct.product_id &&
        p.name.trim().toLowerCase() === editName.trim().toLowerCase() &&
        p.size_ml === targetSize
    );
    if (isDuplicate) {
      alert(
        `⚠️ Cannot update: Another perfume "${editName.trim()}" (${targetSize}ml) already exists in the catalog!\n\nSame perfume with same bottle size cannot be duplicated.`
      );
      return;
    }

    setIsUpdating(true);
    try {
      await updateProduct({
        product_id: editingProduct.product_id,
        name: editName.trim(),
        category: editCategory,
        size_ml: Number(editSizeMl) || 50,
        retail_price_paisa: Math.round(Number(editRetailRupees || 0) * 100),
        wholesale_price_paisa: Math.round(Number(editWholesaleRupees || 0) * 100),
        unit_cost_paisa: Math.round(Number(editCostRupees || 0) * 100),
        reorder_threshold_units: Number(editThreshold) || 5,
        current_stock_units: Number(editStockUnits) || 0,
        barcode: editBarcode.trim() || undefined,
      });
      setIsEditModalOpen(false);
      setEditingProduct(null);
      await loadCatalog();
    } catch (err: any) {
      alert(`Failed to update perfume: ${err?.message || err}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const loadCatalog = async () => {
    setIsLoading(true);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      console.error("Failed to load catalog:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSku.trim()) {
      alert("Perfume Name and SKU are required.");
      return;
    }

    const targetSize = Number(newSizeMl) || 50;
    const isDuplicate = products.some(
      (p) =>
        p.is_active &&
        p.name.trim().toLowerCase() === newName.trim().toLowerCase() &&
        p.size_ml === targetSize
    );
    if (isDuplicate) {
      alert(
        `⚠️ Cannot add duplicate: Perfume "${newName.trim()}" (${targetSize}ml) already exists in the catalog!\n\nYou can add "${newName.trim()}" with a different bottle size (e.g. 30ml, 100ml, 200ml), but same perfume with same ml cannot be added twice.`
      );
      return;
    }

    setIsSaving(true);
    try {
      const retailPaisa = Math.round((parseFloat(newRetailRupees) || 0) * 100);
      const wholesalePaisa = Math.round((parseFloat(newWholesaleRupees) || 0) * 100);
      const costPaisa = Math.round((parseFloat(newCostRupees) || 0) * 100);

      const payload: CreateProductPayload = {
        name: newName.trim(),
        sku: newSku.trim().toUpperCase(),
        barcode: newBarcode.trim() || undefined,
        category: newCategory,
        size_ml: Number(newSizeMl) || 50,
        retail_price_paisa: retailPaisa,
        wholesale_price_paisa: wholesalePaisa,
        unit_cost_paisa: costPaisa,
        initial_stock_units: Number(newStockUnits) || 0,
        reorder_threshold_units: Number(newReorderThreshold) || 5,
      };

      await createProduct(payload);
      alert(`Perfume '${newName}' created successfully! Master BOM formulation generated.`);
      setIsAddModalOpen(false);
      // Reset form
      setNewName("");
      setNewSku("");
      setIsSkuManuallyEdited(false);
      setNewBarcode("");
      await loadCatalog();
    } catch (err: any) {
      console.error("Product creation error:", err);
      alert(`Failed to create perfume: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (product: FinishedProduct) => {
    const ok = window.confirm(
      `Are you sure you want to delete/remove perfume '${product.name}' (${product.sku})?\n\nThis will remove it from the catalog and the POS billing counter.`
    );
    if (!ok) return;

    try {
      await deleteProduct(product.product_id);
      await loadCatalog();
    } catch (err: any) {
      alert(`Failed to delete perfume: ${err?.message || err}`);
    }
  };

  useEffect(() => {
    loadCatalog();
    const handleGlobalRefresh = () => loadCatalog();
    window.addEventListener("app:refresh-data", handleGlobalRefresh);
    return () => window.removeEventListener("app:refresh-data", handleGlobalRefresh);
  }, []);

  const filtered = products.filter((p) => {
    const matchesCat = selectedCategory === "ALL" || p.category === selectedCategory;
    const cleanQ = searchQuery.trim().toLowerCase();
    const matchesQ =
      !cleanQ ||
      p.name.toLowerCase().includes(cleanQ) ||
      p.sku.toLowerCase().includes(cleanQ) ||
      (p.barcode && p.barcode.toLowerCase().includes(cleanQ));

    let matchesStock = true;
    if (stockFilter === "LOW_STOCK") {
      matchesStock = p.current_stock_units <= p.reorder_threshold_units && p.current_stock_units > 0;
    } else if (stockFilter === "OUT_OF_STOCK") {
      matchesStock = p.current_stock_units <= 0;
    } else if (stockFilter === "IN_STOCK") {
      matchesStock = p.current_stock_units > p.reorder_threshold_units;
    }

    return matchesCat && matchesQ && matchesStock;
  });

  // Inventory valuation calculations
  const totalStockUnits = products.reduce((sum, p) => sum + p.current_stock_units, 0);
  const totalRetailValuationPaisa = products.reduce(
    (sum, p) => sum + p.current_stock_units * p.retail_price_paisa,
    0
  );
  const lowStockCount = products.filter(
    (p) => p.current_stock_units <= p.reorder_threshold_units
  ).length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <img
              src="/logo-square.png"
              alt="Ameer Perfumes"
              className="w-8 h-8 rounded-lg object-cover shadow-xs border border-amber-500/30 shrink-0"
            />
            <h2 className="text-2xl font-bold font-serif text-slate-900 dark:text-slate-100">
              Finished Perfume Catalog & Stock
            </h2>
            {isCashier && (
              <Badge variant="neutral" className="text-[11px] font-semibold font-mono">
                View Only
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Artisanal fragrance inventory, SKU barcode registries, batch costs, and retail price tiers.
          </p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          {!isCashier && (
            <Button
              variant="primary"
              onClick={() => setIsAddModalOpen(true)}
              className="gap-2 font-semibold shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Perfume</span>
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => exportProductsInventoryToCSV(products, "Ameer_Perfumes_Catalog")}
            className="gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs cursor-pointer"
            title="Export all perfumes inventory to Microsoft Excel (.csv)"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </Button>

          <Button variant="secondary" onClick={loadCatalog} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card variant="default" className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Active SKUs</span>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {products.length} Products
          </div>
          <div className="text-[11px] text-slate-500">50ml & 100ml Glass Form Factors</div>
        </Card>

        <Card variant="default" className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Stock On-Hand</span>
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {totalStockUnits} Bottles
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Verified against stock ledger</div>
        </Card>

        {!isCashier && (
          <Card variant="accent" className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Inventory Valuation (Retail)</span>
              <div className="p-2 bg-purple-500/10 rounded-lg text-purple-600 dark:text-purple-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-300">
              {formatPaisaToRupees(totalRetailValuationPaisa)}
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400">
              Current Stock Market Selling Potential
            </div>
          </Card>
        )}

        <Card variant="default" className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Reorder Threshold Alerts</span>
            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
            {lowStockCount} Low Stock
          </div>
          <div className="text-[11px] text-slate-500">Below minimum buffer</div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card variant="elevated" className="space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full md:w-96">
            <Input
              placeholder="Filter by perfume name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4 text-amber-500" />}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Category Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {["ALL", "MENS", "WOMENS", "UNISEX", "ORIENTAL_LUXURY", "LIMITED_EDITION"].map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                      selectedCategory === cat
                        ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {cat === "MENS" ? "Men's" : cat === "WOMENS" ? "Women's" : cat.replace("_", " ")}
                  </button>
                )
              )}

              {/* Stock Level Filter Dropdown (Right after Limited Edition) */}
              <div className="flex items-center gap-1.5 pl-1">
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as any)}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-xs"
                  title="Filter products by stock availability"
                >
                  <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-1">
                    All Stock
                  </option>
                  <option value="LOW_STOCK" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-1">
                    ⚠️ Low Stock ({lowStockCount})
                  </option>
                  <option value="IN_STOCK" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-1">
                    ✓ In Stock
                  </option>
                  <option value="OUT_OF_STOCK" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-1">
                    ✕ Out of Stock
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Catalog Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800 font-mono">
              <tr>
                <th className="py-3 px-4">Fragrance Details</th>
                <th className="py-3 px-4">SKU / Barcode</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Size</th>
                <th className="py-3 px-4 text-center">Stock</th>
                <th className="py-3 px-4 text-right">Retail Price</th>
                <th className="py-3 px-4 text-right">Wholesale</th>
                {!isCashier && <th className="py-3 px-4 text-center font-bold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900/40">
              {isLoading ? (
                <tr>
                  <td colSpan={isCashier ? 7 : 8} className="py-8 text-center text-slate-500">
                    Loading inventory catalog from SQLite...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={isCashier ? 7 : 8} className="py-8 text-center text-slate-500">
                    No matching products found.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                const isLow = p.current_stock_units <= p.reorder_threshold_units;

                return (
                  <tr
                    key={p.product_id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{p.name}</div>
                      <div className="text-[11px] text-slate-500">{p.brand}</div>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div className="text-amber-700 dark:text-amber-400 font-semibold">{p.sku}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Barcode className="w-3 h-3 text-slate-400" />
                        <span>{p.barcode || "N/A"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="neutral" className="text-[10px]">
                        {p.category}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-medium">
                      {p.size_ml} ml
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded-full text-xs ${
                          isLow
                            ? "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30"
                            : "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400"
                        }`}
                      >
                        {p.current_stock_units}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                      {formatPaisaToRupees(p.retail_price_paisa)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                      {formatPaisaToRupees(p.wholesale_price_paisa)}
                    </td>
                    {!isCashier && (
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onNavigateToPOS(p)}
                            className="text-xs h-7 px-2 gap-1 font-semibold"
                            title="Create retail bill for this perfume"
                          >
                            <ShoppingBag className="w-3 h-3 text-amber-500" />
                            <span>Bill</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartEdit(p)}
                            className="text-xs h-7 px-2 gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 border-amber-300 dark:border-amber-800 font-semibold"
                            title="Edit perfume details, price, and stock"
                          >
                            <Edit3 className="w-3 h-3 text-amber-500" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteProduct(p)}
                            className="text-xs h-7 px-2 gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-300 dark:border-rose-800 font-semibold"
                            title="Permanently remove / delete this perfume"
                          >
                            <Trash2 className="w-3 h-3 text-rose-500" />
                            <span>Delete</span>
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add New Perfume Modal */}
      <Dialog
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Finished Perfume"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <p className="text-xs text-slate-500">
            Create an artisanal finished fragrance in SQLite. A corresponding Master BOM recipe will automatically be generated for batch manufacturing.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Perfume Name *
              </label>
              <Input
                placeholder="e.g. Royal Oud Intense"
                value={newName}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewName(val);
                  if (!isSkuManuallyEdited) {
                    if (!val.trim()) {
                      setNewSku("");
                    } else {
                      const words = val.trim().split(/\s+/).filter(Boolean);
                      let code = words.map((w) => w[0]).join("").toUpperCase().slice(0, 4);
                      if (!code) code = val.trim().slice(0, 3).toUpperCase();
                      const existingSkus = new Set(products.map((p) => p.sku.trim().toUpperCase()));
                      let candidate = `PR-${code}`;
                      let seq = 1;
                      if (existingSkus.has(candidate)) {
                        while (existingSkus.has(`${candidate}-${String(seq).padStart(2, "0")}`)) {
                          seq++;
                        }
                        candidate = `${candidate}-${String(seq).padStart(2, "0")}`;
                      }
                      setNewSku(candidate);
                    }
                  }
                }}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                SKU Code *
              </label>
              <Input
                placeholder="e.g. PR-ROI-50"
                value={newSku}
                onChange={(e) => {
                  setNewSku(e.target.value);
                  setIsSkuManuallyEdited(true);
                }}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300 h-4 leading-4 truncate">
                  Category *
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                >
                  <option value="MENS">Men's (MENS)</option>
                  <option value="WOMENS">Women's (WOMENS)</option>
                  <option value="UNISEX">Unisex (UNISEX)</option>
                  <option value="ORIENTAL_LUXURY">Oriental Luxury</option>
                  <option value="LIMITED_EDITION">Limited Edition</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300 h-4 leading-4 truncate">
                  Bottle Size (ml) *
                </label>
                <select
                  value={newSizeMl}
                  onChange={(e) => setNewSizeMl(Number(e.target.value))}
                  className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                >
                  <option value={30}>30 ml Bottle</option>
                  <option value={50}>50 ml Standard Bottle</option>
                  <option value={100}>100 ml Full Flacon</option>
                  <option value={200}>200 ml Grand Flacon</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300 h-4 leading-4 truncate">
                  Initial Stock (Units) *
                </label>
                <input
                  type="number"
                  min="0"
                  value={newStockUnits}
                  onChange={(e) => setNewStockUnits(Number(e.target.value))}
                  required
                  className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Retail Price (PKR) *
              </label>
              <Input
                type="number"
                min="0"
                step="any"
                value={newRetailRupees}
                onChange={(e) => setNewRetailRupees(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Wholesale Price (PKR) *
              </label>
              <Input
                type="number"
                min="0"
                step="any"
                value={newWholesaleRupees}
                onChange={(e) => setNewWholesaleRupees(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Reorder Buffer Threshold (Units)
              </label>
              <Input
                type="number"
                min="1"
                value={newReorderThreshold}
                onChange={(e) => setNewReorderThreshold(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving}
              className="text-xs gap-1.5"
            >
              <span>{isSaving ? "Registering Perfume..." : "Save & Register Perfume"}</span>
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Perfume Modal */}
      <Dialog
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="✏️ Edit Product Details"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveProductEdit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Fragrance Title / Name *
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                placeholder="e.g. Oud Royal Eau de Parfum"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300 h-4 leading-4 truncate">
                  Category *
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                >
                  <option value="MENS">Men's (MENS)</option>
                  <option value="WOMENS">Women's (WOMENS)</option>
                  <option value="UNISEX">Unisex (UNISEX)</option>
                  <option value="ORIENTAL_LUXURY">Oriental Luxury</option>
                  <option value="LIMITED_EDITION">Limited Edition</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300 h-4 leading-4 truncate">
                  Bottle Size (ml) *
                </label>
                <select
                  value={editSizeMl}
                  onChange={(e) => setEditSizeMl(Number(e.target.value))}
                  className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                >
                  <option value={30}>30 ml Bottle</option>
                  <option value={50}>50 ml Standard Bottle</option>
                  <option value={100}>100 ml Full Flacon</option>
                  <option value={200}>200 ml Grand Flacon</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300 h-4 leading-4 truncate">
                  Stock Units *
                </label>
                <input
                  type="number"
                  min="0"
                  value={editStockUnits}
                  onChange={(e) => setEditStockUnits(Number(e.target.value))}
                  required
                  className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Retail Price (PKR) *
              </label>
              <Input
                type="number"
                value={editRetailRupees}
                onChange={(e) => setEditRetailRupees(e.target.value)}
                required
                min="0"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Wholesale Price (PKR) *
              </label>
              <Input
                type="number"
                value={editWholesaleRupees}
                onChange={(e) => setEditWholesaleRupees(e.target.value)}
                required
                min="0"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Reorder Buffer Threshold (Units)
              </label>
              <Input
                type="number"
                value={editThreshold}
                onChange={(e) => setEditThreshold(Number(e.target.value))}
                min="0"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isUpdating}
              className="text-xs gap-1.5"
            >
              <span>{isUpdating ? "Saving Changes..." : "Save Perfume Changes"}</span>
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
