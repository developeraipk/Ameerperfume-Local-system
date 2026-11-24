import React, { useState, useEffect } from "react";
import { AttarProduct, CreateAttarPayload, UpdateAttarPayload } from "@/types/database";
import { SystemUser } from "@/types/system";
import { getAttars, createAttar, updateAttar, deleteAttar } from "@/lib/tauri-bridge";
import { formatPaisaToRupees } from "@/lib/formatters";
import { exportAttarsInventoryToCSV } from "@/lib/export-utils";
import { usePOSStore } from "@/store/pos-store";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import {
  Droplet,
  Scale,
  RotateCcw,
  CheckCircle2,
  Layers,
  ArrowRight,
  Plus,
  Trash2,
  Edit3,
  Search,
  Download,
} from "lucide-react";

interface AttarSalesProps {
  currentUser?: SystemUser | null;
  onNavigateToPOS?: () => void;
}

export const AttarSales: React.FC<AttarSalesProps> = ({ currentUser, onNavigateToPOS }) => {
  const [attars, setAttars] = useState<AttarProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const isManagerOrAdmin = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "SHOP_MANAGER";

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark
              key={i}
              className="bg-amber-300 dark:bg-amber-500/50 text-slate-950 dark:text-slate-100 font-extrabold rounded-xs px-0.5"
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const filteredAttars = attars.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.sku.toLowerCase().includes(q) ||
      a.origin_country.toLowerCase().includes(q)
    );
  });

  // Selected Attar for Decanting Station
  const [selectedAttarId, setSelectedAttarId] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<
    "TOLA" | "HALF_TOLA" | "QUARTER_TOLA" | "12ML" | "6ML" | "3ML" | "CUSTOM_ML" | "CUSTOM_GRAM"
  >("TOLA");
  const [dispenseQuantity, setDispenseQuantity] = useState(1);
  const [customMl, setCustomMl] = useState(10);
  const [customGram, setCustomGram] = useState(10);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Add Attar Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newAttarName, setNewAttarName] = useState("");
  const [newAttarSku, setNewAttarSku] = useState("");
  const [isSkuManuallyEdited, setIsSkuManuallyEdited] = useState(false);
  const [newAttarOrigin, setNewAttarOrigin] = useState("Cambodia");
  const newAttarDensity = 1050;
  const newAttarCostRupees = "0";
  const [newAttarSellRupees, setNewAttarSellRupees] = useState("55000");
  const [newAttarWholesaleRupees, setNewAttarWholesaleRupees] = useState("45000");

  // Edit Attar Modal State
  const [editingAttar, setEditingAttar] = useState<AttarProduct | null>(null);
  const [editName, setEditName] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editOrigin, setEditOrigin] = useState("");
  const [editDensity, setEditDensity] = useState(1050);
  const [editCostRupees, setEditCostRupees] = useState("");
  const [editSellRupees, setEditSellRupees] = useState("");
  const [editWholesaleRupees, setEditWholesaleRupees] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const addAttarToCart = usePOSStore((state) => state.addAttarToCart);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getAttars();
      setAttars(data);
      if (data.length > 0 && !selectedAttarId) {
        setSelectedAttarId(data[0].attar_id);
      }
    } catch (err) {
      console.error("Failed to load attars:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAttar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttarName.trim() || !newAttarSku.trim()) {
      alert("Attar Name and SKU are required.");
      return;
    }

    setIsSaving(true);
    try {
      const costPaisa = Math.round((parseFloat(newAttarCostRupees) || 0) * 100);
      const sellPaisa = Math.round((parseFloat(newAttarSellRupees) || 0) * 100);
      const wholesalePaisa = Math.round((parseFloat(newAttarWholesaleRupees) || parseFloat(newAttarSellRupees) || 0) * 100);

      const payload: CreateAttarPayload = {
        name: newAttarName.trim(),
        sku: newAttarSku.trim().toUpperCase(),
        origin_country: newAttarOrigin.trim() || "Artisan Blend",
        density_grams_per_ml: Number(newAttarDensity) || 1050,
        cost_per_tola_paisa: costPaisa,
        selling_price_per_tola_paisa: sellPaisa,
        wholesale_price_per_tola_paisa: wholesalePaisa,
      };

      const created = await createAttar(payload);
      alert(`Attar oil '${newAttarName}' registered successfully!`);
      setIsAddModalOpen(false);
      setNewAttarName("");
      setNewAttarSku("");
      setIsSkuManuallyEdited(false);
      await loadData();
      if (created?.attar_id) setSelectedAttarId(created.attar_id);
    } catch (err: any) {
      alert(`Failed to add attar: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (attar: AttarProduct) => {
    setEditingAttar(attar);
    setEditName(attar.name);
    setEditSku(attar.sku);
    setEditOrigin(attar.origin_country || "Cambodia");
    setEditDensity(attar.density_grams_per_ml || 1050);
    setEditCostRupees((attar.cost_per_tola_paisa / 100).toString());
    setEditSellRupees((attar.selling_price_per_tola_paisa / 100).toString());
    setEditWholesaleRupees(((attar.wholesale_price_per_tola_paisa || attar.selling_price_per_tola_paisa) / 100).toString());
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAttar) return;
    const costPaisa = Math.round((parseFloat(editCostRupees) || 0) * 100);
    const sellPaisa = Math.round((parseFloat(editSellRupees) || 0) * 100);
    const wholesalePaisa = Math.round((parseFloat(editWholesaleRupees) || parseFloat(editSellRupees) || 0) * 100);
    if (sellPaisa <= 0) {
      alert("Selling price must be greater than 0");
      return;
    }
    setIsUpdating(true);
    try {
      const payload: UpdateAttarPayload = {
        attar_id: editingAttar.attar_id,
        name: editName.trim(),
        sku: editSku.trim(),
        origin_country: editOrigin.trim(),
        density_grams_per_ml: Number(editDensity) || 1050,
        cost_per_tola_paisa: costPaisa,
        selling_price_per_tola_paisa: sellPaisa,
        wholesale_price_per_tola_paisa: wholesalePaisa,
      };
      await updateAttar(payload);
      alert(`Attar oil '${editName}' updated successfully!`);
      setIsEditModalOpen(false);
      setEditingAttar(null);
      await loadData();
    } catch (err: any) {
      alert(`Failed to update attar: ${err?.message || err}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAttar = async (attar: AttarProduct) => {
    const ok = window.confirm(
      `Are you sure you want to delete attar oil '${attar.name}'?\n\nThis will remove it from the dispensing station and sales counter.`
    );
    if (!ok) return;

    try {
      await deleteAttar(attar.attar_id);
      if (selectedAttarId === attar.attar_id) {
        setSelectedAttarId("");
      }
      await loadData();
      alert(`Attar oil '${attar.name}' deleted successfully.`);
    } catch (err: any) {
      alert(`Failed to delete attar: ${err?.message || err}`);
    }
  };

  const handleDeleteSelectedAttar = async () => {
    if (!activeAttar) return;
    const ok = window.confirm(
      `Are you sure you want to delete attar oil '${activeAttar.name}'?\n\nThis will remove it from the dispensing station and sales counter.`
    );
    if (!ok) return;

    try {
      await deleteAttar(activeAttar.attar_id);
      setSelectedAttarId("");
      await loadData();
      alert(`Attar oil '${activeAttar.name}' removed successfully.`);
    } catch (err: any) {
      alert(`Failed to delete attar: ${err?.message || err}`);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeAttar = attars.find((a) => a.attar_id === selectedAttarId);

  // Calculation Engine
  let unitSellingPricePaisa = 0;
  let calculatedVolumeMl = 0;
  let calculatedWeightGrams = 0;

  if (activeAttar) {
    const densityRatio = activeAttar.density_grams_per_ml / 1000.0; // e.g. 1.050

    if (selectedUnit === "TOLA") {
      unitSellingPricePaisa = activeAttar.selling_price_per_tola_paisa;
      calculatedWeightGrams = 11.664;
      calculatedVolumeMl = calculatedWeightGrams / densityRatio;
    } else if (selectedUnit === "HALF_TOLA") {
      unitSellingPricePaisa = activeAttar.selling_price_half_tola_paisa;
      calculatedWeightGrams = 5.832;
      calculatedVolumeMl = calculatedWeightGrams / densityRatio;
    } else if (selectedUnit === "QUARTER_TOLA") {
      unitSellingPricePaisa = activeAttar.selling_price_quarter_tola_paisa;
      calculatedWeightGrams = 2.916;
      calculatedVolumeMl = calculatedWeightGrams / densityRatio;
    } else if (selectedUnit === "12ML") {
      calculatedVolumeMl = 12;
      calculatedWeightGrams = 12 * densityRatio;
      unitSellingPricePaisa = Math.round(activeAttar.selling_price_per_ml_paisa * 12);
    } else if (selectedUnit === "6ML") {
      calculatedVolumeMl = 6;
      calculatedWeightGrams = 6 * densityRatio;
      unitSellingPricePaisa = Math.round(activeAttar.selling_price_per_ml_paisa * 6);
    } else if (selectedUnit === "3ML") {
      calculatedVolumeMl = 3;
      calculatedWeightGrams = 3 * densityRatio;
      unitSellingPricePaisa = Math.round(activeAttar.selling_price_per_ml_paisa * 3);
    } else if (selectedUnit === "CUSTOM_ML") {
      unitSellingPricePaisa = activeAttar.selling_price_per_ml_paisa * customMl;
      calculatedVolumeMl = customMl;
      calculatedWeightGrams = customMl * densityRatio;
    } else if (selectedUnit === "CUSTOM_GRAM") {
      unitSellingPricePaisa = activeAttar.selling_price_per_gram_paisa * customGram;
      calculatedWeightGrams = customGram;
      calculatedVolumeMl = customGram / densityRatio;
    }
  }

  const lineTotalPaisa = unitSellingPricePaisa * dispenseQuantity;

  const handleSendToBilling = () => {
    if (!activeAttar) return;

    addAttarToCart(
      activeAttar,
      selectedUnit,
      dispenseQuantity,
      selectedUnit === "CUSTOM_ML" ? customMl : undefined
    );

    setNotification({
      type: "success",
      message: `${dispenseQuantity}x ${activeAttar.name} (${selectedUnit}) added to POS billing cart.`,
    });

    if (onNavigateToPOS) {
      onNavigateToPOS();
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500">
              <Droplet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Attar Bar & Custom Decanting
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Concentrated artisan oils, tola/gram dispensing, density conversion, and high-margin decants
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            onClick={() => exportAttarsInventoryToCSV(attars, "Ameer_Attar_Bar_Registry")}
            className="flex items-center gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-2xs cursor-pointer"
            title="Export all artisan attars inventory to Microsoft Excel (.csv)"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </Button>

          {/* Refresh Button replacing header search */}
          <Button
            variant="outline"
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 shadow-2xs"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {/* Admin & Manager Only Controls (Hidden for Cashiers) */}
          {isManagerOrAdmin && (
            <Button
              variant="primary"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 font-semibold shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Attar Oil</span>
            </Button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            notification.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-400"
              : "bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-400"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-semibold">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Dispensing Station & Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Dispense Control */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-500" />
                Custom Decant Dispensing Bar
              </h2>
              {activeAttar && (
                <Badge variant="gold" className="text-xs">
                  {activeAttar.origin_country}
                </Badge>
              )}
            </div>

            <div className="space-y-4">
              {/* Select Attar Oil */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Select Pure Attar Oil *
                  </label>
                  {activeAttar && isManagerOrAdmin && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(activeAttar)}
                        className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md hover:bg-amber-500/20 flex items-center gap-1 font-semibold cursor-pointer shadow-xs"
                        title="Edit this attar oil's price, name, or properties"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                        <span>✏️ Edit Oil</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteSelectedAttar}
                        className="text-xs bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-md hover:bg-rose-500/20 flex items-center gap-1 font-semibold cursor-pointer shadow-xs"
                        title="Delete this selected attar oil from system"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>🗑️ Delete Oil</span>
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <select
                    value={selectedAttarId}
                    onChange={(e) => setSelectedAttarId(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  >
                    {filteredAttars.length === 0 ? (
                      <option value="">{attars.length === 0 ? 'No attar oils found' : 'No matching attars found'}</option>
                    ) : (
                      filteredAttars.map((a) => (
                        <option key={a.attar_id} value={a.attar_id}>
                          {a.name} ({a.sku}) — Tola: Rs. {Math.round(a.selling_price_per_tola_paisa / 100).toLocaleString()}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Unit Selection Pills */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                  Select Dispensing Measurement Unit *
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUnit("TOLA")}
                    className={`p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer text-center ${
                      selectedUnit === "TOLA"
                        ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                    }`}
                  >
                    1 Tola
                    <span className="block text-[10px] font-normal opacity-80">11.66g</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedUnit("12ML")}
                    className={`p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer text-center ${
                      selectedUnit === "12ML"
                        ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                    }`}
                  >
                    12 ml
                    <span className="block text-[10px] font-normal opacity-80">Bottle</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedUnit("HALF_TOLA")}
                    className={`p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer text-center ${
                      selectedUnit === "HALF_TOLA"
                        ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                    }`}
                  >
                    1/2 Tola
                    <span className="block text-[10px] font-normal opacity-80">5.83g</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedUnit("6ML")}
                    className={`p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer text-center ${
                      selectedUnit === "6ML"
                        ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                    }`}
                  >
                    6 ml
                    <span className="block text-[10px] font-normal opacity-80">Bottle</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedUnit("QUARTER_TOLA")}
                    className={`p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer text-center ${
                      selectedUnit === "QUARTER_TOLA"
                        ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                    }`}
                  >
                    1/4 Tola
                    <span className="block text-[10px] font-normal opacity-80">2.92g</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedUnit("3ML")}
                    className={`p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer text-center ${
                      selectedUnit === "3ML"
                        ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                    }`}
                  >
                    3 ml
                    <span className="block text-[10px] font-normal opacity-80">Mini</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedUnit("CUSTOM_ML")}
                    className={`p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer text-center ${
                      selectedUnit === "CUSTOM_ML"
                        ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                    }`}
                  >
                    Custom ML
                    <span className="block text-[10px] font-normal opacity-80">Volumetric</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedUnit("CUSTOM_GRAM")}
                    className={`p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer text-center ${
                      selectedUnit === "CUSTOM_GRAM"
                        ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                    }`}
                  >
                    Custom Gram
                    <span className="block text-[10px] font-normal opacity-80">Gravimetric</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Inputs for Custom Units */}
              {selectedUnit === "CUSTOM_ML" && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-600 dark:text-slate-400">Volume to Decant:</span>
                    <span className="text-amber-700 dark:text-amber-400 font-mono font-bold">{customMl} ml</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={customMl}
                    onChange={(e) => setCustomMl(parseInt(e.target.value) || 1)}
                    className="w-full accent-amber-500"
                  />
                </div>
              )}

              {selectedUnit === "CUSTOM_GRAM" && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-600 dark:text-slate-400">Weight to Decant:</span>
                    <span className="text-amber-700 dark:text-amber-400 font-mono font-bold">{customGram} grams</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={customGram}
                    onChange={(e) => setCustomGram(parseInt(e.target.value) || 1)}
                    className="w-full accent-amber-500"
                  />
                </div>
              )}

              {/* Quantity of bottles */}
              <div className="w-48">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Bottles / Portions *
                </label>
                <Input
                  type="number"
                  min="1"
                  value={dispenseQuantity}
                  onChange={(e) => setDispenseQuantity(parseInt(e.target.value) || 1)}
                  className="font-mono font-semibold"
                  required
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right 5 Cols: Real-Time Scent & Profitability Card */}
        <div className="lg:col-span-5">
          <Card className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm space-y-5 flex flex-col justify-between h-full">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {activeAttar ? activeAttar.name : "Select Attar"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Density: {activeAttar ? (activeAttar.density_grams_per_ml / 1000).toFixed(3) : "1.000"} g/ml
                  </p>
                </div>
                <Badge variant="gold" className="text-xs font-mono">
                  Custom Decant
                </Badge>
              </div>

              {/* Conversion Specs */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 block font-medium">Calculated Volume</span>
                  <span className="font-mono text-base font-bold text-slate-900 dark:text-slate-100">
                    {calculatedVolumeMl.toFixed(2)} ml
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 block font-medium">Calculated Mass</span>
                  <span className="font-mono text-base font-bold text-slate-900 dark:text-slate-100">
                    {calculatedWeightGrams.toFixed(2)} grams
                  </span>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Unit Selling Price:</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                    {formatPaisaToRupees(unitSellingPricePaisa)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Quantity:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold">
                    {dispenseQuantity} bottle(s)
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-baseline">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Total Sale Price:</span>
                <span className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400">
                  {formatPaisaToRupees(lineTotalPaisa)}
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              onClick={handleSendToBilling}
              disabled={!activeAttar || lineTotalPaisa <= 0}
              className="w-full flex items-center justify-center gap-2 mt-4 font-bold"
            >
              <Droplet className="w-4 h-4" />
              Dispense & Add to POS Cart
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Card>
        </div>
      </div>

      {/* Attar Master Pricing Catalog */}
      <Card className="overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              Master Attar Density & Dispensing Price Grid
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Official retail rates across all standard decant sizes (Tola, 1/2 Tola, 1/4 Tola, ML, Gram)
            </p>
          </div>

          {/* Live Search Input Directly Above Table */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search attar by name, origin, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-slate-950 uppercase font-medium text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">Attar Fragrance</th>
                <th className="p-3">Origin</th>
                <th className="p-3 text-center">Density</th>
                <th className="p-3 text-right">1 Tola (Retail)</th>
                <th className="p-3 text-right">1 Tola (Wholesale)</th>
                <th className="p-3 text-right">1/2 Tola</th>
                <th className="p-3 text-right">1/4 Tola</th>
                <th className="p-3 text-right">Per ML</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900/40">
              {filteredAttars.map((attar) => (
                <tr key={attar.attar_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="p-3">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                      {highlightMatch(attar.name, searchQuery)}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {highlightMatch(attar.sku, searchQuery)}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">
                    {highlightMatch(attar.origin_country, searchQuery)}
                  </td>
                  <td className="p-3 text-center font-mono text-amber-700 dark:text-amber-400 font-semibold">
                    {(attar.density_grams_per_ml / 1000).toFixed(3)} g/ml
                  </td>
                  <td className="p-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {formatPaisaToRupees(attar.selling_price_per_tola_paisa)}
                  </td>
                  <td className="p-3 text-right font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {formatPaisaToRupees(attar.wholesale_price_per_tola_paisa || attar.selling_price_per_tola_paisa)}
                  </td>
                  <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                    {formatPaisaToRupees(attar.selling_price_half_tola_paisa)}
                  </td>
                  <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                    {formatPaisaToRupees(attar.selling_price_quarter_tola_paisa)}
                  </td>
                  <td className="p-3 text-right font-mono text-amber-700 dark:text-amber-500 font-semibold">
                    {formatPaisaToRupees(attar.selling_price_per_ml_paisa)}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedAttarId(attar.attar_id);
                          setSelectedUnit("TOLA");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="text-xs h-7"
                      >
                        Dispense
                      </Button>
                      {/* Edit and Delete reserved exclusively for Shop Manager and Super Admin */}
                      {isManagerOrAdmin && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleStartEdit(attar)}
                            className="text-xs h-7 px-2.5 gap-1 text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 font-semibold"
                            title="Edit attar oil"
                          >
                            <Edit3 className="w-3 h-3 text-amber-500" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDeleteAttar(attar)}
                            className="text-xs h-7 px-2.5 gap-1 text-rose-700 dark:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 font-semibold"
                            title="Delete attar oil"
                          >
                            <Trash2 className="w-3 h-3 text-rose-500" />
                            <span>Delete</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAttars.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                    {attars.length === 0
                      ? "No attar oils registered yet."
                      : `No attar oils found matching "${searchQuery}".`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add New Attar Oil Modal */}
      <Dialog
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="💧 Add New Artisan Pure Attar Oil"
        maxWidth="md"
      >
        <form onSubmit={handleCreateAttar} className="space-y-4">
          <p className="text-xs text-slate-500">
            Register a concentrated artisan perfume oil. Pricing for half-tola, quarter-tola, decant ml, and gram weights is calculated automatically.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Attar Oil Name *
              </label>
              <Input
                placeholder="e.g. Royal Taif Rose Oil"
                value={newAttarName}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewAttarName(val);
                  if (!isSkuManuallyEdited) {
                    if (!val.trim()) {
                      setNewAttarSku("");
                    } else {
                      const words = val.trim().split(/\s+/).filter(Boolean);
                      let code = words.map((w) => w[0]).join("").toUpperCase().slice(0, 4);
                      if (!code) code = val.trim().slice(0, 3).toUpperCase();
                      const existingSkus = new Set(attars.map((a) => a.sku.trim().toUpperCase()));
                      let seq = 1;
                      let candidate = `ATR-${code}-${String(seq).padStart(2, "0")}`;
                      while (existingSkus.has(candidate)) {
                        seq++;
                        candidate = `ATR-${code}-${String(seq).padStart(2, "0")}`;
                      }
                      setNewAttarSku(candidate);
                    }
                  }
                }}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  SKU Code *
                </label>
                <Input
                  placeholder="e.g. ATR-RTR-01"
                  value={newAttarSku}
                  onChange={(e) => {
                    setNewAttarSku(e.target.value);
                    setIsSkuManuallyEdited(true);
                  }}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Origin Country *
                </label>
                <Input
                  placeholder="e.g. Cambodia, Taif, India"
                  value={newAttarOrigin}
                  onChange={(e) => setNewAttarOrigin(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Selling Price per Tola (PKR) *
                </label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={newAttarSellRupees}
                  onChange={(e) => setNewAttarSellRupees(e.target.value)}
                  placeholder="e.g. 55000"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Wholesale Price per Tola (PKR) *
                </label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={newAttarWholesaleRupees}
                  onChange={(e) => setNewAttarWholesaleRupees(e.target.value)}
                  placeholder="e.g. 45000"
                  required
                />
              </div>
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
              <span>{isSaving ? "Saving..." : "Save Attar Oil"}</span>
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Attar Oil Modal */}
      <Dialog
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="✏️ Edit Artisan Attar Oil"
        maxWidth="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <p className="text-xs text-slate-500">
            Update name, SKU code, origin, density, and Tola price. Sub-unit rates (half-tola, quarter-tola, ml) are re-calculated automatically.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Attar Oil Name *
              </label>
              <Input
                placeholder="e.g. Royal Taif Rose Oil"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  SKU Code *
                </label>
                <Input
                  placeholder="e.g. ATR-RTR-01"
                  value={editSku}
                  onChange={(e) => setEditSku(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Origin Country *
                </label>
                <Input
                  placeholder="e.g. Cambodia, Taif, India"
                  value={editOrigin}
                  onChange={(e) => setEditOrigin(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Selling Price per Tola (PKR) *
                </label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={editSellRupees}
                  onChange={(e) => setEditSellRupees(e.target.value)}
                  placeholder="e.g. 55000"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Wholesale Price per Tola (PKR) *
                </label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={editWholesaleRupees}
                  onChange={(e) => setEditWholesaleRupees(e.target.value)}
                  placeholder="e.g. 45000"
                  required
                />
              </div>
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
              <span>{isUpdating ? "Saving Changes..." : "Save Changes"}</span>
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
