import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  PerfumeRecipe,
  ManufacturingBatch,
  CreateBatchPayload,
  ReleaseBatchPayload,
  FinishedProduct,
} from "@/types/database";
import { SystemUser } from "@/types/system";
import {
  getPerfumeRecipes,
  getManufacturingBatches,
  createManufacturingBatch,
  releaseManufacturingBatch,
  deleteManufacturingBatch,
  updateManufacturingBatch,
  getProducts,
} from "@/lib/tauri-bridge";
import { formatPaisaToRupees } from "@/lib/formatters";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  FlaskConical,
  Boxes,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ClipboardList,
  Scale,
  DollarSign,
  Info,
  Search,
  ChevronDown,
  Filter,
  X,
  Edit2,
  Trash2,
} from "lucide-react";

interface ManufacturingProps {
  currentUser: SystemUser | null;
}

export const Manufacturing: React.FC<ManufacturingProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<"BATCHES" | "RECIPES">("BATCHES");
  const [batches, setBatches] = useState<ManufacturingBatch[]>([]);
  const [recipes, setRecipes] = useState<PerfumeRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Perfume Dropdown Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPerfume, setSelectedPerfume] = useState<string>("ALL");
  const [isPerfumeDropdownOpen, setIsPerfumeDropdownOpen] = useState(false);
  const [perfumeFilterSearch, setPerfumeFilterSearch] = useState("");
  const perfumeDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        perfumeDropdownRef.current &&
        !perfumeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsPerfumeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Modals
  const [newBatchModalOpen, setNewBatchModalOpen] = useState(false);
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [breakdownModalOpen, setBreakdownModalOpen] = useState(false);

  // Selected for modals
  const [selectedBatch, setSelectedBatch] = useState<ManufacturingBatch | null>(null);

  // New Batch Form State
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [batchCategory, setBatchCategory] = useState<string>("MENS");
  const [batchSizeMl, setBatchSizeMl] = useState<number>(50);
  const [batchNumber, setBatchNumber] = useState("");
  const [plannedUnits, setPlannedUnits] = useState(100);
  const [perUnitCostRupees, setPerUnitCostRupees] = useState<number>(500);
  const [sellingPriceRupees, setSellingPriceRupees] = useState<number>(15000);
  const [wholesalePriceRupees, setWholesalePriceRupees] = useState<number>(0);
  const [productionDate, setProductionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [batchNotes, setBatchNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Release Batch Form State
  const [actualProducedUnits, setActualProducedUnits] = useState(100);
  const [releaseNotes, setReleaseNotes] = useState("");

  // Edit Batch Form State
  const [editingBatch, setEditingBatch] = useState<ManufacturingBatch | null>(null);
  const [editPlannedUnits, setEditPlannedUnits] = useState<number>(100);
  const [editProducedUnits, setEditProducedUnits] = useState<number>(0);
  const [editUnitCostRupees, setEditUnitCostRupees] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [products, setProducts] = useState<FinishedProduct[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [recs, bts, prods] = await Promise.all([
        getPerfumeRecipes(),
        getManufacturingBatches(),
        getProducts().catch(() => []),
      ]);
      setRecipes(recs);
      setBatches(bts);
      setProducts(prods);
      if (recs.length > 0 && !selectedRecipeId) {
        const first = recs[0];
        setSelectedRecipeId(first.recipe_id);
        if (first.category) setBatchCategory(first.category);
        if (first.batch_output_units) setPlannedUnits(first.batch_output_units);
        if (first.estimated_unit_cost_paisa) setPerUnitCostRupees(Math.round(first.estimated_unit_cost_paisa / 100));
        if (first.retail_price_paisa) setSellingPriceRupees(Math.round(first.retail_price_paisa / 100));
        if (first.wholesale_price_paisa) setWholesalePriceRupees(Math.round(first.wholesale_price_paisa / 100));
        else setWholesalePriceRupees(0);
        setBatchNumber(`B-${new Date().getFullYear()}-${String(bts.length + 1).padStart(3, "0")}`);
      }
    } catch (err) {
      console.error("Failed to load manufacturing data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveRecipeId = selectedRecipeId || (recipes.length > 0 ? recipes[0].recipe_id : "");
    if (!effectiveRecipeId || !batchNumber || plannedUnits <= 0) {
      setNotification({
        type: "error",
        message: "Please fill all required fields with valid quantities.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const unitCostPaisa = Math.round(perUnitCostRupees * 100);
      const totalCostPaisa = Math.round(perUnitCostRupees * 100 * plannedUnits);

      const payload: CreateBatchPayload = {
        recipe_id: effectiveRecipeId,
        batch_number: batchNumber.trim().toUpperCase(),
        planned_units: plannedUnits,
        production_date: productionDate,
        created_by_user_id: currentUser?.user_id || "usr_admin",
        notes: batchNotes.trim() || undefined,
        category: batchCategory,
        cost_per_unit_paisa: unitCostPaisa,
        total_cost_paisa: totalCostPaisa,
        size_ml: batchSizeMl,
        retail_price_paisa: Math.round(sellingPriceRupees * 100),
        wholesale_price_paisa: wholesalePriceRupees > 0 ? Math.round(wholesalePriceRupees * 100) : undefined,
      };

      await createManufacturingBatch(payload);
      setNotification({
        type: "success",
        message: `Production Batch ${payload.batch_number} created successfully!`,
      });
      setNewBatchModalOpen(false);
      setBatchNotes("");
      loadData();
    } catch (err) {
      setNotification({
        type: "error",
        message: `Failed to create batch: ${String(err)}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = (batch: ManufacturingBatch) => {
    setEditingBatch(batch);
    setEditPlannedUnits(batch.planned_units);
    setEditProducedUnits(batch.produced_units || 0);
    setEditUnitCostRupees(Math.round(batch.cost_per_unit_paisa / 100));
    setEditNotes(batch.notes || "");
    setIsEditModalOpen(true);
  };

  const handleUpdateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;
    setIsSubmitting(true);
    try {
      await updateManufacturingBatch(
        editingBatch.batch_id,
        editPlannedUnits,
        editUnitCostRupees * 100,
        editNotes,
        editProducedUnits
      );
      setNotification({
        type: "success",
        message: `Batch ${editingBatch.batch_number} updated successfully. Produced units & finished stock adjusted.`,
      });
      setIsEditModalOpen(false);
      setEditingBatch(null);
      await loadData();
    } catch (err: any) {
      setNotification({
        type: "error",
        message: String(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBatch = async (batch: ManufacturingBatch) => {
    const isCompleted = batch.status === "COMPLETED";
    const promptMsg = isCompleted
      ? `⚠️ WARNING: Batch ${batch.batch_number} is COMPLETED with ${batch.produced_units} finished units produced.\n\nDeleting will deduct these units from finished perfume inventory.\n\nAre you sure you want to delete batch ${batch.batch_number}?`
      : `Are you sure you want to delete planned batch ${batch.batch_number}?`;
    
    if (!window.confirm(promptMsg)) return;

    try {
      await deleteManufacturingBatch(batch.batch_id);
      setNotification({
        type: "success",
        message: `Batch ${batch.batch_number} has been deleted.`,
      });
      await loadData();
    } catch (err: any) {
      setNotification({
        type: "error",
        message: "Failed to delete batch: " + String(err),
      });
    }
  };

  const handleOpenReleaseModal = (batch: ManufacturingBatch) => {
    setSelectedBatch(batch);
    setActualProducedUnits(batch.planned_units);
    setReleaseNotes("");
    setReleaseModalOpen(true);
  };

  const handleReleaseBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;

    if (actualProducedUnits <= 0) {
      setNotification({
        type: "error",
        message: "Actual produced units must be greater than zero.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: ReleaseBatchPayload = {
        batch_id: selectedBatch.batch_id,
        produced_units: actualProducedUnits,
        authorized_by_user_id: currentUser?.user_id || "usr_admin",
        notes: releaseNotes.trim() || undefined,
      };

      const result = await releaseManufacturingBatch(payload);
      setNotification({
        type: "success",
        message: result.message,
      });
      setReleaseModalOpen(false);
      setSelectedBatch(null);
      loadData();
    } catch (err) {
      setNotification({
        type: "error",
        message: `Failed to release batch: ${String(err)}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Unique Perfumes aggregated from recipes and batches for dropdown filter
  const uniquePerfumes = useMemo(() => {
    const map = new Map<string, { name: string; batchCount: number; recipeCount: number }>();
    
    recipes.forEach((r) => {
      const name = r.finished_product_name?.trim();
      if (!name) return;
      if (!map.has(name)) {
        map.set(name, { name, batchCount: 0, recipeCount: 0 });
      }
      map.get(name)!.recipeCount += 1;
    });

    batches.forEach((b) => {
      const name = b.finished_product_name?.trim();
      if (!name) return;
      if (!map.has(name)) {
        map.set(name, { name, batchCount: 0, recipeCount: 0 });
      }
      map.get(name)!.batchCount += 1;
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [recipes, batches]);

  // Filtered perfumes for the internal search inside the dropdown
  const filteredDropdownPerfumes = useMemo(() => {
    if (!perfumeFilterSearch.trim()) return uniquePerfumes;
    const q = perfumeFilterSearch.toLowerCase().trim();
    return uniquePerfumes.filter((p) => p.name.toLowerCase().includes(q));
  }, [uniquePerfumes, perfumeFilterSearch]);

  // Filtered Batches based on Selected Perfume & Search Query
  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      // 1. Perfume dropdown filter
      if (selectedPerfume !== "ALL") {
        const pNorm = selectedPerfume.toLowerCase().trim();
        const bName = (batch.finished_product_name || "").toLowerCase().trim();
        if (bName !== pNorm && !bName.startsWith(pNorm) && !bName.includes(pNorm)) {
          return false;
        }
      }

      // 2. Global text search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const batchNum = (batch.batch_number || "").toLowerCase();
        const prodName = (batch.finished_product_name || "").toLowerCase();
        const notes = (batch.notes || "").toLowerCase();
        const status = (batch.status || "").toLowerCase();
        const pDate = (batch.production_date || "").toLowerCase();
        if (
          !batchNum.includes(q) &&
          !prodName.includes(q) &&
          !notes.includes(q) &&
          !status.includes(q) &&
          !pDate.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [batches, selectedPerfume, searchQuery]);

  // Filtered Recipes based on Selected Perfume & Search Query
  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      // 1. Perfume dropdown filter
      if (selectedPerfume !== "ALL") {
        const pNorm = selectedPerfume.toLowerCase().trim();
        const rName = (recipe.finished_product_name || "").toLowerCase().trim();
        if (rName !== pNorm && !rName.startsWith(pNorm) && !rName.includes(pNorm)) {
          return false;
        }
      }

      // 2. Global text search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const rName = (recipe.finished_product_name || "").toLowerCase();
        const sku = (recipe.sku || "").toLowerCase();
        const cat = (recipe.category || "").toLowerCase();
        const instr = (recipe.instructions || "").toLowerCase();
        if (
          !rName.includes(q) &&
          !sku.includes(q) &&
          !cat.includes(q) &&
          !instr.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [recipes, selectedPerfume, searchQuery]);

  // Metrics calculated dynamically based on active filter / selected perfume (matches Picture 2)
  const activeBatchesCount = filteredBatches.filter(
    (b) => b.status === "PLANNED" || b.status === "IN_PRODUCTION"
  ).length;
  const completedBatches = filteredBatches.filter((b) => b.status === "COMPLETED");
  const totalProducedUnits = completedBatches.reduce(
    (sum, b) => sum + b.produced_units,
    0
  );
  const totalManufacturingValuationPaisa = completedBatches.reduce(
    (sum, b) => sum + b.total_cost_paisa,
    0
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Perfume Manufacturing & Production Management
              </h1>
              <p className="text-sm text-muted-foreground">
                BOM formulations, production batch control, yield tracking, and retail batch valuation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (recipes.length > 0 && !selectedRecipeId) {
                const first = recipes[0];
                setSelectedRecipeId(first.recipe_id);
                if (first.category) setBatchCategory(first.category);
                if (first.batch_output_units) setPlannedUnits(first.batch_output_units);
                if (first.estimated_unit_cost_paisa) setPerUnitCostRupees(Math.round(first.estimated_unit_cost_paisa / 100));
                if (first.retail_price_paisa) setSellingPriceRupees(Math.round(first.retail_price_paisa / 100));
              }
              setBatchNumber(
                `B-${new Date().getFullYear()}-${String(batches.length + 1).padStart(3, "0")}`
              );
              setNewBatchModalOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Production Batch
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            notification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Row (Dynamic calculation based on active perfume filter / search - Picture 2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Production Batches</p>
              <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100">{activeBatchesCount}</p>
              {selectedPerfume !== "ALL" && (
                <span className="inline-block px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-mono font-semibold mt-1 truncate max-w-[150px]">
                  {selectedPerfume}
                </span>
              )}
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-500 shrink-0">
              <FlaskConical className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Planned or in maceration</p>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Master BOM Recipes</p>
              <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100">{filteredRecipes.length}</p>
              {selectedPerfume !== "ALL" && (
                <span className="inline-block px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] font-mono font-semibold mt-1 truncate max-w-[150px]">
                  {selectedPerfume}
                </span>
              )}
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400 shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Active formulation standards</p>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Output Produced</p>
              <p className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">
                {totalProducedUnits.toLocaleString()} units
              </p>
              {selectedPerfume !== "ALL" && (
                <span className="inline-block px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-mono font-semibold mt-1 truncate max-w-[150px]">
                  {selectedPerfume}
                </span>
              )}
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Saleable bottled perfumes</p>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Mfg Production Valuation</p>
              <p className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-400">
                {formatPaisaToRupees(totalManufacturingValuationPaisa)}
              </p>
              {selectedPerfume !== "ALL" && (
                <span className="inline-block px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-mono font-semibold mt-1 truncate max-w-[150px]">
                  {selectedPerfume}
                </span>
              )}
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Retail batch production valuation</p>
        </Card>
      </div>

      {/* Search & Searchable Perfume Dropdown Filter Toolbar (Picture 1 & 2) */}
      <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: General Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by batch number, perfume name, SKU, or notes..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1 cursor-pointer"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Right: Searchable Perfume Dropdown Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative" ref={perfumeDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsPerfumeDropdownOpen(!isPerfumeDropdownOpen);
                setPerfumeFilterSearch("");
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer select-none ${
                selectedPerfume !== "ALL"
                  ? "bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20 font-bold"
                  : "bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-amber-500/50"
              }`}
            >
              <Filter className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="truncate max-w-[180px]">
                {selectedPerfume === "ALL" ? "All Fragrances" : selectedPerfume}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isPerfumeDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown Popover with internal Search */}
            {isPerfumeDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Search input inside dropdown */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    value={perfumeFilterSearch}
                    onChange={(e) => setPerfumeFilterSearch(e.target.value)}
                    placeholder="Search fragrance in filter..."
                    className="w-full pl-8 pr-7 py-1.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  {perfumeFilterSearch && (
                    <button
                      onClick={() => setPerfumeFilterSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Fragrance Options List */}
                <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                  {/* Option: All Fragrances */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPerfume("ALL");
                      setIsPerfumeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                      selectedPerfume === "ALL"
                        ? "bg-amber-500 text-slate-950 font-bold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-800 dark:hover:text-amber-300"
                    }`}
                  >
                    <span>🌟 All Fragrances (Total)</span>
                    <span className="text-[10px] opacity-75 font-mono">
                      {batches.length} batches
                    </span>
                  </button>

                  <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />

                  {filteredDropdownPerfumes.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 italic">
                      No fragrances match "{perfumeFilterSearch}"
                    </div>
                  ) : (
                    filteredDropdownPerfumes.map((p) => {
                      const isSelected = selectedPerfume.toLowerCase() === p.name.toLowerCase();
                      return (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => {
                            setSelectedPerfume(p.name);
                            setIsPerfumeDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                              : "text-slate-700 dark:text-slate-300 hover:bg-amber-500/10 hover:text-amber-800 dark:hover:text-amber-300"
                          }`}
                        >
                          <span className="truncate pr-2 font-semibold">{p.name}</span>
                          <span className={`text-[10px] shrink-0 font-mono ${isSelected ? "text-slate-950" : "text-slate-400"}`}>
                            {p.batchCount} batch{p.batchCount === 1 ? "" : "es"}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Reset Filters button */}
          {(selectedPerfume !== "ALL" || searchQuery) && (
            <button
              onClick={() => {
                setSelectedPerfume("ALL");
                setSearchQuery("");
              }}
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
              title="Reset all search & fragrance filters"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab("BATCHES")}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === "BATCHES"
              ? "border-amber-500 text-amber-700 dark:text-amber-400 font-bold"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          Production Batches ({filteredBatches.length})
        </button>
        <button
          onClick={() => setActiveTab("RECIPES")}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === "RECIPES"
              ? "border-amber-500 text-amber-700 dark:text-amber-400 font-bold"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Master BOM Recipes ({filteredRecipes.length})
        </button>
      </div>

      {/* TAB 1: BATCHES */}
      {activeTab === "BATCHES" && (
        <div className="space-y-4">
          <Card className="overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-sm p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 dark:bg-slate-950 text-xs uppercase font-medium text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5">Batch Number</th>
                    <th className="p-3.5">Finished Perfume</th>
                    <th className="p-3.5 text-center">Planned</th>
                    <th className="p-3.5 text-center">Produced</th>
                    <th className="p-3.5 text-right">Retail Valuation</th>
                    <th className="p-3.5 text-right">Unit Retail Price</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 bg-white dark:bg-slate-900/40 text-slate-800 dark:text-slate-200">
                  {filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        {batches.length === 0
                          ? "No production batches recorded yet. Click 'New Production Batch' to begin."
                          : `No production batches found matching "${selectedPerfume !== "ALL" ? selectedPerfume : searchQuery}".`}
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((batch) => {
                      const isCompleted = batch.status === "COMPLETED";
                      const yieldPercent =
                        batch.planned_units > 0 && batch.produced_units > 0
                          ? Math.round((batch.produced_units / batch.planned_units) * 100)
                          : null;

                      return (
                        <tr key={batch.batch_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="p-3.5 font-mono font-semibold text-amber-700 dark:text-amber-400">
                            {batch.batch_number}
                            <span className="block text-xs font-sans text-slate-500 font-normal">
                              {batch.production_date}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {batch.finished_product_name}
                              </span>
                              {(() => {
                                const ml = batch.size_ml || products.find((p) => p.product_id === batch.finished_product_id)?.size_ml;
                                return ml ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                    {ml} ml
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            {batch.notes && (
                              <span className="block text-xs text-slate-500 truncate max-w-xs mt-0.5">
                                {batch.notes}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center font-mono">
                            {batch.planned_units}
                          </td>
                          <td className="p-3.5 text-center font-mono font-semibold">
                            {isCompleted ? (
                              <span className="text-emerald-700 dark:text-emerald-400">
                                {batch.produced_units}
                                {yieldPercent !== null && (
                                  <span className="block text-xs text-slate-500">
                                    {yieldPercent}% yield
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-500 italic">Pending</span>
                            )}
                          </td>
                          <td className="p-3.5 text-right font-mono font-medium">
                            {(() => {
                              const linkedProd = products.find((p) => p.product_id === batch.finished_product_id);
                              const linkedRec = recipes.find((r) => r.recipe_id === batch.recipe_id);
                              const unitRetailPaisa = linkedProd?.retail_price_paisa || linkedRec?.retail_price_paisa || 0;
                              const totalRetailPaisa = batch.planned_units * unitRetailPaisa;
                              return totalRetailPaisa > 0 ? (
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {formatPaisaToRupees(totalRetailPaisa)}
                                </span>
                              ) : "—";
                            })()}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-amber-700 dark:text-amber-400">
                            {(() => {
                              const linkedProd = products.find((p) => p.product_id === batch.finished_product_id);
                              const linkedRec = recipes.find((r) => r.recipe_id === batch.recipe_id);
                              const unitRetailPaisa = linkedProd?.retail_price_paisa || linkedRec?.retail_price_paisa || 0;
                              return unitRetailPaisa > 0 ? (
                                <span>{formatPaisaToRupees(unitRetailPaisa)}</span>
                              ) : "—";
                            })()}
                          </td>
                          <td className="p-3.5 text-center">
                            <Badge
                              variant={
                                isCompleted
                                  ? "success"
                                  : batch.status === "PLANNED"
                                  ? "neutral"
                                  : "warning"
                              }
                              className="text-xs"
                            >
                              {batch.status}
                            </Badge>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditModal(batch)}
                                title="Edit Batch Details"
                                className="text-xs h-8 px-2 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span className="ml-1">Edit</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteBatch(batch)}
                                title="Delete Batch"
                                className="text-xs h-8 px-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border-rose-300 dark:border-rose-900 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="ml-1">Delete</span>
                              </Button>
                              {!isCompleted && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleOpenReleaseModal(batch)}
                                  className="text-xs h-8 font-semibold cursor-pointer"
                                >
                                  Release Batch
                                </Button>
                              )}
                              {isCompleted && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedBatch(batch);
                                    setBreakdownModalOpen(true);
                                  }}
                                  className="text-xs h-8 cursor-pointer"
                                >
                                  Details
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: RECIPES */}
      {activeTab === "RECIPES" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredRecipes.length === 0 ? (
            <div className="col-span-full p-8 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              No master BOM recipes found matching "{selectedPerfume !== "ALL" ? selectedPerfume : searchQuery}".
            </div>
          ) : (
            filteredRecipes.map((recipe) => {
              return (
                <Card
                  key={recipe.recipe_id}
                  className="p-5 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          {recipe.finished_product_name}
                          {recipe.size_ml && (
                            <Badge variant="gold" className="text-xs font-mono">
                              {recipe.size_ml}ml
                            </Badge>
                          )}
                          {recipe.sku && (
                            <span className="text-xs font-mono text-slate-400">
                              ({recipe.sku})
                            </span>
                          )}
                          <Badge variant="gold" className="text-xs">
                            v{recipe.recipe_version}.0
                          </Badge>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Formulation Specification & Unit Benchmark
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Unit Retail Price</p>
                        <p className="text-base font-bold text-amber-700 dark:text-amber-400 font-mono">
                          {(() => {
                            const linkedProd = products.find((p) => p.product_id === recipe.finished_product_id);
                            const retailPaisa = linkedProd?.retail_price_paisa || (recipe as any).retail_price_paisa || 0;
                            return retailPaisa > 0 ? formatPaisaToRupees(retailPaisa) : "—";
                          })()}
                        </p>
                      </div>
                    </div>

                    {recipe.instructions && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs text-slate-600 dark:text-slate-300 leading-relaxed border border-slate-200 dark:border-slate-700">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block mb-1">
                          Maceration & Bottling Instructions:
                        </span>
                        {recipe.instructions}
                      </div>
                    )}

                    {/* Standard Per-Unit Formulation Economics */}
                    {(() => {
                      const recipeBatches = batches.filter(
                        (b) => b.recipe_id === recipe.recipe_id || b.finished_product_id === recipe.finished_product_id
                      );
                      const completedRecipeBatches = recipeBatches.filter((b) => b.status === "COMPLETED");
                      const totalProducedForRecipe = completedRecipeBatches.reduce((s, b) => s + b.produced_units, 0);

                      return (
                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5 text-xs">
                          <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-200 dark:border-slate-700/60">
                            <div>
                              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Retail Price</span>
                              <strong className="font-mono text-slate-900 dark:text-slate-100 font-bold text-xs sm:text-sm">
                                {recipe.retail_price_paisa ? formatPaisaToRupees(recipe.retail_price_paisa) : "—"}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold">Wholesale Rate</span>
                              <strong className="font-mono text-blue-600 dark:text-blue-400 font-bold text-xs sm:text-sm">
                                {recipe.wholesale_price_paisa ? formatPaisaToRupees(recipe.wholesale_price_paisa) : "—"}
                              </strong>
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-0.5">
                            {recipeBatches.length > 0 ? (
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                                <span><strong>{recipeBatches.length}</strong> batches scheduled ({totalProducedForRecipe} units produced)</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 italic">
                                <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>
                                <span>No production batches scheduled yet</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral" className="text-[10px]">
                        Master Recipe Standard
                      </Badge>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedRecipeId(recipe.recipe_id);
                        if (recipe.category) setBatchCategory(recipe.category);
                        if (recipe.size_ml) setBatchSizeMl(recipe.size_ml);
                        setPlannedUnits(recipe.batch_output_units);
                        if (recipe.estimated_unit_cost_paisa) {
                          setPerUnitCostRupees(Math.round(recipe.estimated_unit_cost_paisa / 100));
                        }
                        if (recipe.retail_price_paisa) {
                          setSellingPriceRupees(Math.round(recipe.retail_price_paisa / 100));
                        }
                        if (recipe.wholesale_price_paisa) {
                          setWholesalePriceRupees(Math.round(recipe.wholesale_price_paisa / 100));
                        } else {
                          setWholesalePriceRupees(0);
                        }
                        setBatchNumber(
                          `B-${new Date().getFullYear()}-${String(batches.length + 1).padStart(3, "0")}`
                        );
                        setNewBatchModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Produce Batch
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* MODAL 1: NEW PRODUCTION BATCH */}
      {newBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border-border/60 shadow-2xl overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border/40 p-5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-foreground">
                  Create Production Batch
                </h2>
              </div>
              <button
                onClick={() => setNewBatchModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form id="create-batch-form" onSubmit={handleCreateBatch} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Perfume Formulation / Recipe *
                </label>
                <select
                  value={selectedRecipeId}
                  onChange={(e) => {
                    const recId = e.target.value;
                    setSelectedRecipeId(recId);
                    const rec = recipes.find((r) => r.recipe_id === recId);
                    if (rec) {
                      setPlannedUnits(rec.batch_output_units);
                      if (rec.category) setBatchCategory(rec.category);
                      if (rec.size_ml) setBatchSizeMl(rec.size_ml);
                      if (rec.estimated_unit_cost_paisa) {
                        setPerUnitCostRupees(Math.round(rec.estimated_unit_cost_paisa / 100));
                      }
                      if (rec.retail_price_paisa) {
                        setSellingPriceRupees(Math.round(rec.retail_price_paisa / 100));
                      }
                      if (rec.wholesale_price_paisa) {
                        setWholesalePriceRupees(Math.round(rec.wholesale_price_paisa / 100));
                      } else {
                        setWholesalePriceRupees(0);
                      }
                    }
                  }}
                  className="w-full bg-input border border-border/50 rounded-lg p-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                  required
                >
                  {recipes.map((r) => (
                    <option key={r.recipe_id} value={r.recipe_id}>
                      {r.finished_product_name} {r.size_ml ? `- ${r.size_ml}ml` : ""} {r.sku ? `(${r.sku})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Bottle Size Form Factor *
                  </label>
                  <select
                    value={batchSizeMl}
                    onChange={(e) => setBatchSizeMl(Number(e.target.value))}
                    className="w-full h-10 bg-input border border-border/50 rounded-lg px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value={30}>30 ml Pocket Spray</option>
                    <option value={50}>50 ml Standard Bottle</option>
                    <option value={100}>100 ml Full Flacon</option>
                    <option value={200}>200 ml Grand Flacon</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Fragrance Category *
                  </label>
                  <select
                    value={batchCategory}
                    onChange={(e) => setBatchCategory(e.target.value)}
                    className="w-full h-10 bg-input border border-border/50 rounded-lg px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="MENS">Men's (MENS)</option>
                    <option value="WOMENS">Women's (WOMENS)</option>
                    <option value="UNISEX">Unisex (UNISEX)</option>
                    <option value="ORIENTAL_LUXURY">Oriental Luxury (ORIENTAL_LUXURY)</option>
                    <option value="LIMITED_EDITION">Limited Edition (LIMITED_EDITION)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Batch Identifier *
                  </label>
                  <Input
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="B-2026-002"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Planned Output Units *
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={plannedUnits}
                    onChange={(e) => setPlannedUnits(parseInt(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Production Scheduled Date *
                </label>
                <Input
                  type="date"
                  value={productionDate}
                  onChange={(e) => setProductionDate(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div className="flex flex-col justify-end">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 min-h-[34px] flex items-end">
                    Selling Price / Retail Unit (PKR) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={sellingPriceRupees}
                    onChange={(e) => setSellingPriceRupees(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 15000"
                    required
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 min-h-[34px] flex items-end">
                    Wholesale Rate / Unit (PKR)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={wholesalePriceRupees || ""}
                    onChange={(e) => setWholesalePriceRupees(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 10000"
                  />
                </div>
              </div>

              {/* Dynamic Financial Valuation Card */}
              {(() => {
                const totalRetailValue = sellingPriceRupees * plannedUnits;
                const totalWholesaleValue = wholesalePriceRupees > 0 ? wholesalePriceRupees * plannedUnits : 0;

                return (
                  <div className="p-3.5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-blue-500/10 border border-amber-500/30 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                      <span className="font-semibold">Total Retail Production Value:</span>
                      <strong className="font-mono text-amber-700 dark:text-amber-400 text-sm">
                        Rs. {Math.round(totalRetailValue).toLocaleString()}
                      </strong>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-amber-500/15">
                      <div className="text-slate-600 dark:text-slate-400">
                        <span className="block text-[10px]">Retail Price / Unit:</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          Rs. {Math.round(sellingPriceRupees).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-400">
                        <span className="block text-[10px]">Planned Units:</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {plannedUnits} units
                        </span>
                      </div>
                    </div>
                    {wholesalePriceRupees > 0 && (
                      <div className="flex justify-between items-center pt-1.5 border-t border-amber-500/15 text-slate-600 dark:text-slate-400">
                        <div>
                          <span className="block font-medium">Wholesale Rate / Unit:</span>
                          <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                            Rs. {Math.round(wholesalePriceRupees).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px]">Total Wholesale Value:</span>
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            Rs. {Math.round(totalWholesaleValue).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Production Notes & Batch Instructions
                </label>
                <textarea
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  placeholder="e.g. Maceration started in stainless steel tank #3 at 18°C"
                  rows={3}
                  className="w-full bg-input border border-border/50 rounded-lg p-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </form>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-border/40 bg-slate-50 dark:bg-slate-900/80 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewBatchModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" form="create-batch-form" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Confirm & Schedule Batch"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 2: RELEASE / COMPLETE BATCH (ABSORPTION ENGINE) */}
      {releaseModalOpen && selectedBatch && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border-border/60 shadow-2xl overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border/40 p-5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Release Production Batch: {selectedBatch.batch_number}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedBatch.finished_product_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReleaseModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form id="release-batch-form" onSubmit={handleReleaseBatch} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/30 rounded-lg border border-border/30">
                  <span className="text-xs text-muted-foreground block">Planned Output</span>
                  <span className="text-lg font-bold font-mono text-foreground">
                    {selectedBatch.planned_units} units
                  </span>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Actual Saleable Units Produced *
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max={selectedBatch.planned_units * 2}
                    value={actualProducedUnits}
                    onChange={(e) => setActualProducedUnits(parseInt(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>

              {/* Yield & Loss Analysis */}
              {actualProducedUnits > 0 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-400">
                    <span className="flex items-center gap-1.5">
                      <Scale className="w-4 h-4" />
                      Yield & Cost Absorption Invariant:
                    </span>
                    <span>
                      {Math.round((actualProducedUnits / selectedBatch.planned_units) * 100)}% Yield
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Evaporation/Defect Loss:{" "}
                    <span className="font-semibold text-foreground font-mono">
                      {Math.max(0, selectedBatch.planned_units - actualProducedUnits)} units
                    </span>
                    . In accordance with luxury perfume manufacturing ERP rules, 100% of raw material
                    consumption costs will be absorbed into the{" "}
                    <span className="text-amber-400 font-semibold">{actualProducedUnits}</span>{" "}
                    saleable units.
                  </p>
                  <p className="text-xs text-amber-500 font-medium">
                    ⚡ This batch cost per unit will permanently lock in historical costing records.
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Release Authorization Notes
                </label>
                <textarea
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  placeholder="e.g. Multi-stage filtration passed. Clarity and scent profile verified."
                  rows={2}
                  className="w-full bg-input border border-border/50 rounded-lg p-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </form>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-border/40 bg-slate-50 dark:bg-slate-900/80 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReleaseModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" form="release-batch-form" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? "Processing Release..." : "Confirm Release & Lock Cost"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 3: BATCH COST & COMPLETE FINANCIAL BREAKDOWN */}
      {breakdownModalOpen && selectedBatch && (() => {
        const linkedProduct = products.find((p) => p.product_id === selectedBatch.finished_product_id);
        const linkedRecipe = recipes.find((r) => r.recipe_id === selectedBatch.recipe_id);
        const unitSellingPricePaisa = linkedProduct?.retail_price_paisa ?? linkedRecipe?.retail_price_paisa ?? Math.round(selectedBatch.cost_per_unit_paisa * 1.6);
        const unitsProduced = selectedBatch.produced_units > 0 ? selectedBatch.produced_units : selectedBatch.planned_units;
        const totalSellingPricePaisa = unitSellingPricePaisa * unitsProduced;
        const yieldPercent = selectedBatch.planned_units > 0 ? ((unitsProduced / selectedBatch.planned_units) * 100) : 100;

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border-border/60 shadow-2xl overflow-hidden p-0">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/40 p-5 shrink-0 bg-slate-50 dark:bg-slate-950/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500 border border-amber-500/20">
                    <FlaskConical className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        Batch Details: {selectedBatch.batch_number}
                      </h2>
                      <Badge variant={selectedBatch.status === "COMPLETED" ? "success" : "gold"} className="text-[10px]">
                        {selectedBatch.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedBatch.finished_product_name || linkedProduct?.name || "Finished Fragrance EDP"}
                      {selectedBatch.size_ml || linkedProduct?.size_ml ? ` (${selectedBatch.size_ml || linkedProduct?.size_ml} ml)` : ""} • Produced on {selectedBatch.production_date}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setBreakdownModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                {/* 1. Production Units & Yield */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">Planned Output</span>
                    <span className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100 mt-1 block">
                      {selectedBatch.planned_units} units
                    </span>
                  </div>
                  <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-500/30">
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium block">Produced Saleable Units</span>
                    <span className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                      {unitsProduced} units
                    </span>
                  </div>
                  <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-500/30">
                    <span className="text-[11px] text-blue-700 dark:text-blue-400 font-medium block">Batch Production Yield</span>
                    <span className="font-mono text-lg font-bold text-blue-600 dark:text-blue-400 mt-1 block">
                      {yieldPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* 2. Comprehensive Financial Metrics (Retail & Wholesale Valuation) */}
                <div className="p-4 bg-slate-50/80 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                    <DollarSign className="w-4 h-4 text-amber-500" />
                    Batch Retail & Wholesale Valuation Breakdown
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                    {/* Unit Retail Selling Price */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Retail Selling Price / Unit</span>
                      <span className="font-mono text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">
                        Rs. {formatPaisaToRupees(unitSellingPricePaisa)}
                      </span>
                    </div>

                    {/* Total Units Selling Price */}
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Total Retail Batch Value</span>
                      <span className="font-mono text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">
                        Rs. {formatPaisaToRupees(totalSellingPricePaisa)}
                      </span>
                    </div>

                    {/* Wholesale Rate / Unit if available */}
                    {linkedProduct?.wholesale_price_paisa ? (
                      <>
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-blue-500/30 shadow-2xs">
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-semibold block">Wholesale Rate / Unit</span>
                          <span className="font-mono text-base font-bold text-blue-700 dark:text-blue-400 mt-0.5 block">
                            Rs. {formatPaisaToRupees(linkedProduct.wholesale_price_paisa)}
                          </span>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-blue-500/30 shadow-2xs">
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-semibold block">Total Wholesale Batch Value</span>
                          <span className="font-mono text-base font-bold text-blue-700 dark:text-blue-400 mt-0.5 block">
                            Rs. {formatPaisaToRupees(linkedProduct.wholesale_price_paisa * selectedBatch.planned_units)}
                          </span>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* 3. Formulation & Notes */}
                {selectedBatch.notes && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="font-medium text-slate-800 dark:text-slate-200 block mb-0.5">Production Notes:</span>
                    <p className="text-slate-600 dark:text-slate-400">{selectedBatch.notes}</p>
                  </div>
                )}

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-800 dark:text-blue-300 flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    This batch has locked absorbed cost basis. All unit costs, retail valuations, and batch profits are historical records protected from raw material price fluctuations.
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end p-4 border-t border-border/40 bg-slate-50 dark:bg-slate-900/80 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setBreakdownModalOpen(false)}
                >
                  Close Details
                </Button>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Edit Manufacturing Batch Dialog */}
      {isEditModalOpen && editingBatch && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-card border-border shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-slate-50 dark:bg-slate-900/80 shrink-0">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    Edit Batch: {editingBatch.batch_number}
                  </h3>
                  <span className="text-xs text-muted-foreground font-medium">
                    {editingBatch.finished_product_name}
                    {(() => {
                      const ml = editingBatch.size_ml || products.find((p) => p.product_id === editingBatch.finished_product_id)?.size_ml;
                      return ml ? ` • ${ml} ml` : "";
                    })()}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingBatch(null);
                }}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateBatch} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground min-h-[32px] flex items-end pb-1">
                    Planned Production Units *
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={editPlannedUnits}
                    onChange={(e) => setEditPlannedUnits(parseInt(e.target.value) || 0)}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground min-h-[32px] flex items-end pb-1">
                    Produced Units (Stock) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={editProducedUnits}
                    onChange={(e) => setEditProducedUnits(parseInt(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>

              <div className="p-2.5 bg-muted/20 border border-border/40 rounded-lg text-[11px] text-muted-foreground">
                <span>💡 Changing <strong>Produced Units</strong> will automatically synchronize the finished perfume boxed inventory stock.</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Batch Notes (Optional)
                </label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Adjusted batch sizing, maceration notes"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingBatch(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting || editPlannedUnits <= 0}
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
