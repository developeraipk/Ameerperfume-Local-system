import React, { useState, useEffect } from "react";
import { RawMaterial, Supplier } from "@/types/database";
import { SystemUser } from "@/types/system";
import {
  getRawMaterials,
  getSuppliers,
  createPurchaseInvoice,
} from "@/lib/tauri-bridge";
import { formatPaisaToRupees } from "@/lib/formatters";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Layers,
  Truck,
  RotateCcw,
  CheckCircle2,
  FilePlus,
  TrendingUp,
  Plus,
  Trash2,
} from "lucide-react";

interface ProcurementProps {
  currentUser: SystemUser | null;
}

interface PurchaseLineItem {
  material_id: string;
  quantity: string;
  unit_price_rupees: string;
}

export const Procurement: React.FC<ProcurementProps> = ({ currentUser }) => {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"MATERIALS" | "SUPPLIERS" | "NEW_INVOICE">("MATERIALS");

  // New Purchase Invoice State
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paidRupees, setPaidRupees] = useState("");
  const [lines, setLines] = useState<PurchaseLineItem[]>([
    { material_id: "", quantity: "1", unit_price_rupees: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [mats, supps] = await Promise.all([getRawMaterials(), getSuppliers()]);
      setMaterials(mats);
      setSuppliers(supps);
      if (supps.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(supps[0].supplier_id);
      }
    } catch (err) {
      console.error("Failed to load procurement data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Valuation computations
  const totalRawValuePaisa = materials.reduce(
    (sum, m) => sum + m.current_stock_units * m.weighted_average_cost_paisa,
    0
  );
  const lowStockMaterials = materials.filter(
    (m) => m.current_stock_units <= m.reorder_threshold_units
  ).length;
  const totalSupplierPayablePaisa = suppliers.reduce(
    (sum, s) => sum + s.current_balance_paisa,
    0
  );

  // Parse lines for live total
  const parsedLines = lines.map((l) => {
    const qty = parseFloat(l.quantity) || 0;
    const pricePaisa = Math.round((parseFloat(l.unit_price_rupees) || 0) * 100);
    return {
      material_id: l.material_id,
      quantity_received: qty,
      unit_price_paisa: pricePaisa,
      line_total_paisa: Math.round(qty * pricePaisa),
    };
  });

  const totalInvoicePaisa = parsedLines.reduce((sum, l) => sum + l.line_total_paisa, 0);
  const paidPaisa = Math.round((parseFloat(paidRupees) || 0) * 100);
  const balanceDuePaisa = Math.max(0, totalInvoicePaisa - paidPaisa);

  const handleAddLine = () => {
    setLines([...lines, { material_id: "", quantity: "1", unit_price_rupees: "" }]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleSubmitInvoice = async () => {
    if (!selectedSupplierId || !invoiceNumber.trim() || lines.length === 0 || isSubmitting) return;

    const validLines = parsedLines.filter((l) => l.material_id && l.quantity_received > 0);
    if (validLines.length === 0) {
      alert("Please configure at least one valid material line with quantity!");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        supplier_id: selectedSupplierId,
        invoice_number: invoiceNumber.trim(),
        invoice_date: new Date().toISOString(),
        lines: validLines,
        paid_amount_paisa: paidPaisa,
        received_by_user_id: currentUser?.user_id || "usr_admin",
        notes: "Received via ERP Procurement Module",
      };

      const res = await createPurchaseInvoice(payload);
      setSuccessMessage(
        `Purchase Invoice ${res.invoice_number} recorded! Total: ${formatPaisaToRupees(
          res.total_amount_paisa
        )}. Raw material inventory updated with weighted average cost.`
      );
      setInvoiceNumber("");
      setPaidRupees("");
      setLines([{ material_id: "", quantity: "1", unit_price_rupees: "" }]);
      await loadData();
      setActiveTab("MATERIALS");
    } catch (err) {
      console.error("Purchase invoice recording failed:", err);
      alert(`Purchase invoice failed: ${err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold font-serif text-slate-900 dark:text-slate-100">
              Procurement & Raw Materials
            </h2>
            <Badge variant="gold">Weighted-Average Costing</Badge>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Certified suppliers, French crystal glassware, aroma chemicals, ethanol solvents, and purchase invoices.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("MATERIALS")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "MATERIALS"
                ? "bg-amber-500 text-slate-950 shadow-xs font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Raw Materials ({materials.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("SUPPLIERS")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "SUPPLIERS"
                ? "bg-amber-500 text-slate-950 shadow-xs font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Suppliers ({suppliers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("NEW_INVOICE")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "NEW_INVOICE"
                ? "bg-amber-500 text-slate-950 shadow-xs font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>Receive Purchase</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-100">
            &times;
          </button>
        </div>
      )}

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card variant="accent" className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Raw Material Inventory Value</span>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-300">
            {formatPaisaToRupees(totalRawValuePaisa)}
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-400">
            Weighted average landed acquisition cost
          </div>
        </Card>

        <Card variant="default" className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Low Stock Material Alerts</span>
            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-600 dark:text-rose-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
            {lowStockMaterials} Below Buffer
          </div>
          <div className="text-[11px] text-slate-500">Needs supplier purchase order</div>
        </Card>

        <Card variant="default" className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Accounts Payable (Suppliers)</span>
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {formatPaisaToRupees(totalSupplierPayablePaisa)}
          </div>
          <div className="text-[11px] text-slate-500">Current outstanding credit balance</div>
        </Card>
      </div>

      {/* Tab 1: Raw Materials Inventory Table */}
      {activeTab === "MATERIALS" && (
        <Card variant="elevated" className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Raw Material Inventory Catalog</h3>
            <Button variant="secondary" size="sm" onClick={loadData} className="gap-1.5 text-xs">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800 font-mono">
                <tr>
                  <th className="py-3 px-4">Material Name</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center">Unit</th>
                  <th className="py-3 px-4 text-center">Current Stock</th>
                  <th className="py-3 px-4 text-right">Weighted Cost</th>
                  <th className="py-3 px-4 text-right">Total Valuation</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900/40">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      Loading raw materials from SQLite...
                    </td>
                  </tr>
                ) : (
                  materials.map((m) => {
                  const isLow = m.current_stock_units <= m.reorder_threshold_units;
                  const totalVal = m.current_stock_units * m.weighted_average_cost_paisa;

                  return (
                    <tr key={m.material_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">{m.name}</td>
                      <td className="py-3 px-4 font-mono text-amber-700 dark:text-amber-400 font-semibold">{m.sku}</td>
                      <td className="py-3 px-4">
                        <Badge variant="neutral" className="text-[10px]">
                          {m.material_type}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-600 dark:text-slate-400">
                        {m.unit_of_measure}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            isLow
                              ? "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30"
                              : "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400"
                          }`}
                        >
                          {m.current_stock_units}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                        {formatPaisaToRupees(m.weighted_average_cost_paisa)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                        {formatPaisaToRupees(totalVal)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={isLow ? "warning" : "success"} className="text-[9px]">
                          {isLow ? "REORDER" : "ADEQUATE"}
                        </Badge>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: Suppliers Directory */}
      {activeTab === "SUPPLIERS" && (
        <Card variant="elevated" className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Certified Raw Material Suppliers</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suppliers.map((s) => (
              <div
                key={s.supplier_id}
                className="p-4 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{s.company_name}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{s.contact_person} • {s.city}</p>
                  </div>
                  <Badge variant={s.current_balance_paisa > 0 ? "warning" : "success"}>
                    {s.current_balance_paisa > 0 ? "Balance Due" : "Settled"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                  <div>
                    <span className="block text-slate-500 text-[10px]">Phone</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{s.phone}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-[10px]">Email</span>
                    <span className="text-slate-800 dark:text-slate-200 truncate block">{s.email || "N/A"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Outstanding Balance:</span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400 text-sm">
                    {formatPaisaToRupees(s.current_balance_paisa)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 3: New Purchase Invoice Form */}
      {activeTab === "NEW_INVOICE" && (
        <Card variant="elevated" className="space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Receive Raw Material Purchase Invoice</h3>
            <span className="text-xs text-slate-500 font-mono">
              Updates stock ledger & recalculates weighted-average cost
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Supplier</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs rounded-lg px-3 py-2"
              >
                {suppliers.map((s) => (
                  <option key={s.supplier_id} value={s.supplier_id}>
                    {s.company_name} ({s.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Input
                label="Supplier Invoice #"
                placeholder="e.g. PINV-2026-0041"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>

            <div>
              <Input
                label="Initial Payment Tendered (PKR)"
                placeholder="0"
                type="number"
                value={paidRupees}
                onChange={(e) => setPaidRupees(e.target.value)}
              />
            </div>
          </div>

          {/* Dynamic Lines Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase font-mono">
                Materials Received & Unit Costs
              </h4>
              <Button variant="secondary" size="sm" onClick={handleAddLine} className="gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" />
                <span>Add Material Line</span>
              </Button>
            </div>

            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-3 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl"
                >
                  <div className="md:col-span-5">
                    <select
                      value={line.material_id}
                      onChange={(e) => {
                        const updated = [...lines];
                        updated[idx].material_id = e.target.value;
                        setLines(updated);
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs rounded-lg px-3 py-2"
                    >
                      <option value="">Select Raw Material...</option>
                      {materials.map((m) => (
                        <option key={m.material_id} value={m.material_id}>
                          {m.name} ({m.unit_of_measure})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <Input
                      placeholder="Quantity"
                      type="number"
                      value={line.quantity}
                      onChange={(e) => {
                        const updated = [...lines];
                        updated[idx].quantity = e.target.value;
                        setLines(updated);
                      }}
                    />
                  </div>

                  <div className="md:col-span-3">
                    <Input
                      placeholder="Unit Price (PKR)"
                      type="number"
                      value={line.unit_price_rupees}
                      onChange={(e) => {
                        const updated = [...lines];
                        updated[idx].unit_price_rupees = e.target.value;
                        setLines(updated);
                      }}
                    />
                  </div>

                  <div className="md:col-span-1 text-center">
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals & Submit */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="space-y-1 text-xs">
              <div className="text-slate-600 dark:text-slate-400">
                Total Purchase:{" "}
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400 text-base">
                  {formatPaisaToRupees(totalInvoicePaisa)}
                </span>
              </div>
              <div className="text-slate-500">
                Paid: {formatPaisaToRupees(paidPaisa)} | Balance Due:{" "}
                <span className="text-rose-600 dark:text-rose-400 font-mono font-semibold">
                  {formatPaisaToRupees(balanceDuePaisa)}
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              disabled={isSubmitting || totalInvoicePaisa === 0 || !invoiceNumber.trim()}
              onClick={handleSubmitInvoice}
              className="gap-2 font-bold text-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? "Recording..." : "Post Purchase Invoice & Receive Stock"}</span>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
