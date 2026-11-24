import React, { useState, useEffect } from "react";
import { SystemUser, WorkstationStatus } from "@/types/system";
import {
  testReceiptPrinter,
} from "@/lib/tauri-bridge";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Printer,
  CheckCircle2,
  AlertTriangle,
  Receipt,
} from "lucide-react";

interface HardwareSettingsProps {
  currentUser?: SystemUser | null;
  status: WorkstationStatus;
}

export const HardwareSettings: React.FC<HardwareSettingsProps> = ({
  currentUser: _currentUser,
  status: _status,
}) => {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Thermal receipt branch details states
  const [receiptSubtitle, setReceiptSubtitle] = useState("Haute Parfumerie & Pure Concentrated Oils");
  const [receiptAddress, setReceiptAddress] = useState("Main Branch Sports Complex Bannu");
  const [receiptPhone, setReceiptPhone] = useState("WhatsApp: 03100988522");
  const [receiptPolicy, setReceiptPolicy] = useState("Exchange acceptable within 7 days in original condition.");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ameer_receipt_settings") || "{}");
      if (saved.subtitle) setReceiptSubtitle(saved.subtitle);
      if (saved.address && !saved.address.includes("Lahore") && !saved.address.includes("Luxury")) {
        setReceiptAddress(saved.address);
      } else {
        setReceiptAddress("Main Branch Sports Complex Bannu");
      }
      if (saved.phone && !saved.phone.includes("0300-1234567") && !saved.phone.includes("3578")) {
        setReceiptPhone(saved.phone);
      } else {
        setReceiptPhone("WhatsApp: 03100988522");
      }
      if (saved.policy) setReceiptPolicy(saved.policy);
    } catch {}
  }, []);

  const handleSaveReceiptDetails = (e: React.FormEvent) => {
    e.preventDefault();
    const settings = {
      subtitle: receiptSubtitle.trim() || "Haute Parfumerie & Pure Concentrated Oils",
      address: receiptAddress.trim() || "Main Branch Sports Complex Bannu",
      phone: receiptPhone.trim() || "WhatsApp: 03100988522",
      policy: receiptPolicy.trim() || "Exchange acceptable within 7 days in original condition.",
    };
    localStorage.setItem("ameer_receipt_settings", JSON.stringify(settings));
    setFeedback({
      type: "success",
      text: "Thermal receipt & branch details saved successfully! All receipts and invoices will now use these updated details.",
    });
  };

  const handleTestPrint = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await testReceiptPrinter();
      setFeedback({
        type: "success",
        text: `Receipt spooled successfully (${res.bytes_spooled} bytes). Owner Decision A Privacy verified.`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: typeof err === "string" ? err : err.message || "Failed to test receipt printer",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col gap-6 select-none overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-serif text-slate-900 dark:text-slate-100 tracking-wide">
              Store & Receipt Printing Configuration
            </h1>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Configure 80mm thermal receipt headers, store branch address, customer contact details, and invoice footer policies.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Thermal Receipt & Store Branch Details Editor */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm dark:shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Store & 80mm Thermal Receipt Branch Configuration
              </h3>
              <p className="text-[11px] text-slate-500">
                Customise the branch address, contact phone, and footer policy printed on thermal slips and A4 invoices.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestPrint}
              disabled={loading}
              className="text-xs py-1.5 px-3 flex items-center gap-1.5 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Test Ticket</span>
            </Button>
            <Badge variant="gold" className="text-xs">
              Live Thermal Header
            </Badge>
          </div>
        </div>

        <form onSubmit={handleSaveReceiptDetails} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Brand Subtitle / Tagline
              </label>
              <input
                type="text"
                value={receiptSubtitle}
                onChange={(e) => setReceiptSubtitle(e.target.value)}
                placeholder="Haute Parfumerie & Pure Concentrated Oils"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                WhatsApp & Contact Telephone *
              </label>
              <input
                type="text"
                value={receiptPhone}
                onChange={(e) => setReceiptPhone(e.target.value)}
                placeholder="WhatsApp: 03100988522"
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Branch Location & Address *
              </label>
              <input
                type="text"
                value={receiptAddress}
                onChange={(e) => setReceiptAddress(e.target.value)}
                placeholder="Main Branch Sports Complex Bannu"
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Receipt Policy / Return Footer Note
              </label>
              <input
                type="text"
                value={receiptPolicy}
                onChange={(e) => setReceiptPolicy(e.target.value)}
                placeholder="Exchange acceptable within 7 days in original condition."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 px-5"
            >
              Save Thermal Receipt Details
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default HardwareSettings;
