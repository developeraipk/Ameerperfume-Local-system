import React, { useState, useEffect, useMemo } from "react";
import { SystemUser } from "@/types/system";
import {
  OnlineOrder,
  OnlineOrderItem,
  CreateOnlineOrderPayload,
  CollectOnlinePaymentPayload,
  MarkOnlineReturnPayload,
  FinishedProduct,
  AttarProduct,
} from "@/types/database";
import {
  getOnlineOrders,
  createOnlineOrder,
  collectOnlineOrderPayment,
  markOnlineOrderReturn,
  updateOnlineOrderStatus,
  getProducts,
  getAttars,
} from "@/lib/tauri-bridge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Globe,
  MessageSquare,
  Search,
  Plus,
  RefreshCw,
  Printer,
  Truck,
  DollarSign,
  RotateCcw,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  Phone,
  MapPin,
  X,
} from "lucide-react";

interface OnlineOrdersProps {
  currentUser?: SystemUser | null;
}

type ChannelFilter = "ALL" | "WHATSAPP" | "WEBSITE" | "PENDING_COD" | "IN_TRANSIT" | "SETTLED" | "RETURNED";

const COURIER_PARTNERS = [
  "TCS Express",
  "Leopard Courier",
  "Trax Logistics",
  "PostEx",
  "M&P Express",
  "Call Courier",
  "In-House Rider (Local)",
];

export const OnlineOrders: React.FC<OnlineOrdersProps> = ({ currentUser }) => {
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [attars, setAttars] = useState<AttarProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filters & Search
  const [filterTab, setFilterTab] = useState<ChannelFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OnlineOrder | null>(null);

  // New Order Form State
  const [newChannel, setNewChannel] = useState<"WHATSAPP" | "WEBSITE">("WHATSAPP");
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custCity, setCustCity] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [orderItems, setOrderItems] = useState<OnlineOrderItem[]>([]);
  const [deliveryCharges, setDeliveryCharges] = useState("200");
  const [discountRupees, setDiscountRupees] = useState("0");
  const [advancePaidRupees, setAdvancePaidRupees] = useState("0");
  const [courierPartner, setCourierPartner] = useState(COURIER_PARTNERS[0]);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [custodian, setCustodian] = useState<"COURIER" | "STAFF_HANDLER">("COURIER");
  const [orderNotes, setOrderNotes] = useState("");

  // Item Picker in Modal
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItemType, setSelectedItemType] = useState<"PERFUME" | "ATTAR">("PERFUME");

  // Payment Collection Form State
  const [collectAmountRupees, setCollectAmountRupees] = useState("");
  const [collectMethod, setCollectMethod] = useState("CASH");
  const [collectReference, setCollectReference] = useState("");
  const [collectNotes, setCollectNotes] = useState("");

  // Return Form State
  const [returnReason, setReturnReason] = useState("Customer refused delivery / unreachable");

  // Status Update State
  const [updateDeliveryStatus, setUpdateDeliveryStatus] = useState("DISPATCHED");
  const [updateTracking, setUpdateTracking] = useState("");
  const [updateCourier, setUpdateCourier] = useState(COURIER_PARTNERS[0]);

  const loadData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [orderList, prods, atts] = await Promise.all([
        getOnlineOrders(),
        getProducts(),
        getAttars(),
      ]);
      setOrders(orderList || []);
      setProducts(prods || []);
      setAttars(atts || []);
    } catch (err: any) {
      console.error("Failed to load online orders:", err);
      setFeedback({
        type: "error",
        text: typeof err === "string" ? err : err.message || "Failed to load orders",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleGlobalRefresh = () => loadData();
    window.addEventListener("app:refresh-data", handleGlobalRefresh);
    return () => window.removeEventListener("app:refresh-data", handleGlobalRefresh);
  }, []);

  const formatRs = (paisa: number) => {
    return (paisa / 100).toLocaleString("en-PK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // KPI Calculations
  const waOrders = orders.filter((o) => o.channel === "WHATSAPP");
  const webOrders = orders.filter((o) => o.channel === "WEBSITE");

  const waPendingPaisa = waOrders.reduce((sum, o) => sum + (o.payment_status !== "RETURNED" ? o.cod_balance_paisa : 0), 0);
  const webPendingPaisa = webOrders.reduce((sum, o) => sum + (o.payment_status !== "RETURNED" ? o.cod_balance_paisa : 0), 0);
  const totalPendingPaisa = waPendingPaisa + webPendingPaisa;

  const waCollectedPaisa = waOrders.reduce((sum, o) => sum + o.advance_paid_paisa, 0);
  const webCollectedPaisa = webOrders.reduce((sum, o) => sum + o.advance_paid_paisa, 0);
  const totalCollectedPaisa = waCollectedPaisa + webCollectedPaisa;

  // Custodian split of pending money
  const courierCodPaisa = orders
    .filter((o) => o.payment_custodian === "COURIER" && o.payment_status !== "RETURNED")
    .reduce((sum, o) => sum + o.cod_balance_paisa, 0);

  const staffPendingPaisa = orders
    .filter((o) => o.payment_custodian === "STAFF_HANDLER" && o.payment_status !== "RETURNED")
    .reduce((sum, o) => sum + o.cod_balance_paisa, 0);

  const returnedOrders = orders.filter((o) => o.delivery_status === "RETURNED_RTO" || o.payment_status === "RETURNED");

  // Filtering
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Channel / Status filter
      if (filterTab === "WHATSAPP" && o.channel !== "WHATSAPP") return false;
      if (filterTab === "WEBSITE" && o.channel !== "WEBSITE") return false;
      if (filterTab === "PENDING_COD" && (o.cod_balance_paisa <= 0 || o.payment_status === "RETURNED")) return false;
      if (filterTab === "IN_TRANSIT" && o.delivery_status !== "DISPATCHED") return false;
      if (filterTab === "SETTLED" && (o.payment_status !== "PAID" || o.cod_balance_paisa > 0)) return false;
      if (filterTab === "RETURNED" && o.delivery_status !== "RETURNED_RTO" && o.payment_status !== "RETURNED") return false;

      // Search Query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.customer_phone.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.city.toLowerCase().includes(q) ||
        (o.courier_partner && o.courier_partner.toLowerCase().includes(q)) ||
        (o.tracking_number && o.tracking_number.toLowerCase().includes(q))
      );
    });
  }, [orders, filterTab, searchQuery]);

  // Handle Item Addition in New Order Modal
  const handleAddItem = (prod: FinishedProduct | AttarProduct, type: "PERFUME" | "ATTAR") => {
    if (type === "PERFUME") {
      const p = prod as FinishedProduct;
      const existing = orderItems.find((it) => it.product_id === p.product_id);
      if (existing) {
        setOrderItems(
          orderItems.map((it) =>
            it.product_id === p.product_id
              ? {
                  ...it,
                  quantity: it.quantity + 1,
                  line_total_paisa: (it.quantity + 1) * it.unit_price_paisa,
                }
              : it
          )
        );
      } else {
        setOrderItems([
          ...orderItems,
          {
            product_id: p.product_id,
            name: `${p.name} (${p.size_ml}ml)`,
            item_type: "PERFUME",
            quantity: 1,
            size_ml: p.size_ml,
            unit_price_paisa: p.retail_price_paisa,
            line_total_paisa: p.retail_price_paisa,
          },
        ]);
      }
    } else {
      const a = prod as AttarProduct;
      const existing = orderItems.find((it) => it.attar_id === a.attar_id);
      if (existing) {
        setOrderItems(
          orderItems.map((it) =>
            it.attar_id === a.attar_id
              ? {
                  ...it,
                  quantity: it.quantity + 1,
                  line_total_paisa: (it.quantity + 1) * it.unit_price_paisa,
                }
              : it
          )
        );
      } else {
        setOrderItems([
          ...orderItems,
          {
            attar_id: a.attar_id,
            name: `${a.name} (1 Tola / 12ml)`,
            item_type: "ATTAR",
            quantity: 1,
            unit_price_paisa: a.selling_price_per_tola_paisa,
            line_total_paisa: a.selling_price_per_tola_paisa,
            grams: 12.0,
          },
        ]);
      }
    }
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, idx) => idx !== index));
  };

  const handleUpdateItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    setOrderItems(
      orderItems.map((it, idx) =>
        idx === index
          ? {
              ...it,
              quantity: newQty,
              line_total_paisa: newQty * it.unit_price_paisa,
            }
          : it
      )
    );
  };

  // Computations for New Order
  const newOrderSubtotalPaisa = orderItems.reduce((sum, it) => sum + it.line_total_paisa, 0);
  const deliveryPaisa = Math.max(0, Math.round((parseFloat(deliveryCharges) || 0) * 100));
  const discountPaisa = Math.max(0, Math.round((parseFloat(discountRupees) || 0) * 100));
  const newOrderTotalPaisa = Math.max(0, newOrderSubtotalPaisa + deliveryPaisa - discountPaisa);
  const advancePaisa = Math.min(newOrderTotalPaisa, Math.max(0, Math.round((parseFloat(advancePaidRupees) || 0) * 100)));
  const codBalancePaisa = Math.max(0, newOrderTotalPaisa - advancePaisa);

  // Submit New Order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custPhone.trim()) {
      alert("Customer mobile phone is required for online shipping!");
      return;
    }
    if (orderItems.length === 0) {
      alert("Please add at least one product to the order!");
      return;
    }

    try {
      setLoading(true);
      const payload: CreateOnlineOrderPayload = {
        channel: newChannel,
        customer_name: custName.trim() || "Valued Online Customer",
        customer_phone: custPhone.trim(),
        shipping_address: custAddress.trim() || "Address pending dispatch",
        city: custCity.trim() || "Pakistan",
        items_json: JSON.stringify(orderItems),
        subtotal_paisa: newOrderSubtotalPaisa,
        delivery_charges_paisa: deliveryPaisa,
        discount_paisa: discountPaisa,
        total_amount_paisa: newOrderTotalPaisa,
        advance_paid_paisa: advancePaisa,
        cod_balance_paisa: codBalancePaisa,
        payment_custodian: codBalancePaisa > 0 ? custodian : "COURIER",
        courier_partner: courierPartner,
        tracking_number: trackingNumber.trim() || undefined,
        notes: orderNotes.trim() || undefined,
        created_by_user_id: currentUser?.user_id || "usr_online_mgr",
      };

      const created = await createOnlineOrder(payload);
      setFeedback({
        type: "success",
        text: `✓ Order ${created.order_number} booked successfully! COD Amount: Rs. ${formatRs(created.cod_balance_paisa)}`,
      });
      setIsNewOrderModalOpen(false);
      resetNewOrderForm();
      await loadData();
    } catch (err: any) {
      console.error("Failed to create online order:", err);
      setFeedback({
        type: "error",
        text: typeof err === "string" ? err : err.message || "Failed to create order",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetNewOrderForm = () => {
    setCustName("");
    setCustPhone("");
    setCustCity("");
    setCustAddress("");
    setOrderItems([]);
    setDeliveryCharges("200");
    setDiscountRupees("0");
    setAdvancePaidRupees("0");
    setTrackingNumber("");
    setOrderNotes("");
  };

  // Open Collect Modal
  const openCollectPaymentModal = (order: OnlineOrder) => {
    setSelectedOrder(order);
    setCollectAmountRupees((order.cod_balance_paisa / 100).toString());
    setCollectMethod("CASH");
    setCollectReference("");
    setCollectNotes("");
    setIsCollectModalOpen(true);
  };

  // Execute Collect Payment
  const handleExecuteCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const amountPaisa = Math.round((parseFloat(collectAmountRupees) || 0) * 100);
    if (amountPaisa <= 0) {
      alert("Please enter a valid payment collection amount!");
      return;
    }

    try {
      setLoading(true);
      const payload: CollectOnlinePaymentPayload = {
        order_id: selectedOrder.order_id,
        amount_paid_paisa: amountPaisa,
        payment_method: collectMethod,
        reference_number: collectReference.trim() || undefined,
        collected_by: currentUser?.full_name || currentUser?.username || "Online Cashier",
        notes: collectNotes.trim() || undefined,
      };

      await collectOnlineOrderPayment(payload);
      setFeedback({
        type: "success",
        text: `✓ Payment of Rs. ${(amountPaisa / 100).toLocaleString()} collected for Order ${selectedOrder.order_number}! Settled into treasury.`,
      });
      setIsCollectModalOpen(false);
      setSelectedOrder(null);
      await loadData();
    } catch (err: any) {
      console.error("Failed to collect online payment:", err);
      setFeedback({
        type: "error",
        text: typeof err === "string" ? err : err.message || "Failed to collect payment",
      });
    } finally {
      setLoading(false);
    }
  };

  // Open Return / RTO Modal
  const openReturnModal = (order: OnlineOrder) => {
    setSelectedOrder(order);
    setReturnReason("Customer refused parcel / Address unreachable");
    setIsReturnModalOpen(true);
  };

  // Execute Return / RTO
  const handleExecuteReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      setLoading(true);
      const payload: MarkOnlineReturnPayload = {
        order_id: selectedOrder.order_id,
        return_reason: returnReason.trim(),
        user_id: currentUser?.user_id || "usr_online_mgr",
      };

      await markOnlineOrderReturn(payload);
      setFeedback({
        type: "success",
        text: `✓ Order ${selectedOrder.order_number} marked as Returned (RTO). Stock restocked into inventory & pending COD balance cleared!`,
      });
      setIsReturnModalOpen(false);
      setSelectedOrder(null);
      await loadData();
    } catch (err: any) {
      console.error("Failed to mark order return:", err);
      setFeedback({
        type: "error",
        text: typeof err === "string" ? err : err.message || "Failed to mark return",
      });
    } finally {
      setLoading(false);
    }
  };

  // Open Status Update Modal
  const openStatusModal = (order: OnlineOrder) => {
    setSelectedOrder(order);
    setUpdateDeliveryStatus(order.delivery_status || "DISPATCHED");
    setUpdateTracking(order.tracking_number || "");
    setUpdateCourier(order.courier_partner || COURIER_PARTNERS[0]);
    setIsStatusModalOpen(true);
  };

  const handleExecuteStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      setLoading(true);
      await updateOnlineOrderStatus(
        selectedOrder.order_id,
        updateDeliveryStatus,
        updateTracking.trim() || undefined,
        updateCourier
      );
      setFeedback({
        type: "success",
        text: `✓ Order ${selectedOrder.order_number} status updated to ${updateDeliveryStatus}!`,
      });
      setIsStatusModalOpen(false);
      setSelectedOrder(null);
      await loadData();
    } catch (err: any) {
      console.error("Failed to update status:", err);
      setFeedback({
        type: "error",
        text: typeof err === "string" ? err : err.message || "Failed to update status",
      });
    } finally {
      setLoading(false);
    }
  };

  // PRINTING: Thermal 80mm & A4 Shipping Dispatch Slip
  const handlePrintShippingSlip = (order: OnlineOrder, format: "THERMAL_80MM" | "A4") => {
    const printArea = document.getElementById("print-area");
    if (!printArea) return;

    let items: OnlineOrderItem[] = [];
    try {
      items = JSON.parse(order.items_json);
    } catch {
      items = [];
    }

    if (format === "THERMAL_80MM") {
      printArea.innerHTML = `
        <div style="width: 76mm; margin: 0 auto; padding: 4mm 2mm; font-family: monospace; font-size: 11px; color: #000; line-height: 1.35;">
          <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 8px;">
            <div style="font-size: 16px; font-weight: 900; letter-spacing: 1px;">AMEER PERFUMES</div>
            <div style="font-size: 9px; text-transform: uppercase;">Haute Parfumerie & Luxury Attars</div>
            <div style="font-size: 9px;">Sports Complex, Bannu • Cell: 03100988522</div>
            <div style="margin-top: 5px; font-weight: bold; font-size: 13px; background: #000; color: #fff; padding: 2px 4px; display: inline-block;">
              ${order.channel === "WHATSAPP" ? "💬 WHATSAPP ORDER" : "🌐 WEBSITE ORDER"}
            </div>
          </div>

          <div style="border-bottom: 1px solid #000; padding-bottom: 6px; margin-bottom: 6px;">
            <div><strong>ORDER NO:</strong> <span style="font-size: 13px; font-weight: 900;">${order.order_number}</span></div>
            <div><strong>DATE:</strong> ${order.created_at}</div>
            <div><strong>COURIER:</strong> ${order.courier_partner}</div>
            ${order.tracking_number ? `<div><strong>TRACKING #:</strong> ${order.tracking_number}</div>` : ""}
          </div>

          <!-- PROMINENT CUSTOMER BOX FOR COURIER RIDER -->
          <div style="border: 2px solid #000; padding: 6px; margin-bottom: 8px; background: #fdfdfd;">
            <div style="font-size: 9px; text-transform: uppercase; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 2px; margin-bottom: 4px;">Recipient Details (Consignee):</div>
            <div style="font-size: 13px; font-weight: 900;">${order.customer_name}</div>
            <div style="font-size: 15px; font-weight: 900; letter-spacing: 0.5px; margin: 4px 0; color: #000;">
              📞 PHONE: ${order.customer_phone}
            </div>
            <div style="font-size: 11px;"><strong>CITY:</strong> ${order.city}</div>
            <div style="font-size: 11px; margin-top: 2px;"><strong>ADDRESS:</strong> ${order.shipping_address}</div>
          </div>

          <!-- ITEMS SUMMARY -->
          <div style="border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
            <div style="font-weight: bold; font-size: 10px; margin-bottom: 4px;">PACKAGE CONTENTS:</div>
            ${items
              .map(
                (it) => `
              <div style="display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 2px;">
                <span>${it.quantity}x ${it.name}</span>
                <span>Rs. ${(it.line_total_paisa / 100).toLocaleString()}</span>
              </div>
            `
              )
              .join("")}
          </div>

          <!-- FINANCIAL & COD SUMMARY -->
          <div style="border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 10px;">
              <span>Subtotal:</span>
              <span>Rs. ${(order.subtotal_paisa / 100).toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 10px;">
              <span>Delivery Charges:</span>
              <span>Rs. ${(order.delivery_charges_paisa / 100).toLocaleString()}</span>
            </div>
            ${
              order.discount_paisa > 0
                ? `
            <div style="display: flex; justify-content: space-between; font-size: 10px;">
              <span>Discount:</span>
              <span>-Rs. ${(order.discount_paisa / 100).toLocaleString()}</span>
            </div>`
                : ""
            }
            <div style="display: flex; justify-content: space-between; font-size: 10px;">
              <span>Total Order Value:</span>
              <span>Rs. ${(order.total_amount_paisa / 100).toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #333;">
              <span>Advance Paid:</span>
              <span>Rs. ${(order.advance_paid_paisa / 100).toLocaleString()}</span>
            </div>

            <!-- PROMINENT CASH ON DELIVERY BOX -->
            <div style="margin-top: 6px; border: 2px solid #000; padding: 6px; text-align: center; background: #eee;">
              <div style="font-size: 10px; font-weight: bold; text-transform: uppercase;">CASH ON DELIVERY (COD):</div>
              <div style="font-size: 20px; font-weight: 900; letter-spacing: 1px;">
                Rs. ${(order.cod_balance_paisa / 100).toLocaleString()}
              </div>
              <div style="font-size: 9px; font-weight: bold;">(Rider to collect exact cash from customer)</div>
            </div>
          </div>

          <div style="text-align: center; font-size: 9px; color: #555;">
            Thank you for choosing Ameer Perfumes!<br/>
            Complaints & Support: 0310 0988522
          </div>
        </div>
      `;
    } else {
      // A4 Comprehensive Packing Invoice
      printArea.innerHTML = `
        <div style="width: 100%; max-width: 800px; margin: 0 auto; padding: 24px; font-family: sans-serif; color: #1e293b;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px;">
            <div>
              <h1 style="font-size: 24px; font-weight: 800; color: #d97706; margin: 0;">AMEER PERFUMES</h1>
              <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 0;">Haute Parfumerie & Concentrated Perfume Oils</p>
              <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 0;">Main Sports Complex, Bannu • Cell: 03100988522</p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 18px; font-weight: 800; color: #0f172a;">ONLINE SHIPPING DISPATCH SLIP</div>
              <div style="font-size: 13px; font-weight: bold; color: #d97706; margin-top: 2px;">${order.order_number}</div>
              <div style="font-size: 11px; color: #64748b;">Channel: <strong>${order.channel}</strong></div>
              <div style="font-size: 11px; color: #64748b;">Date: ${order.created_at}</div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; background: #f8fafc;">
              <h3 style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; margin: 0 0 8px 0;">Customer (Consignee) Details</h3>
              <div style="font-size: 16px; font-weight: 700; color: #0f172a;">${order.customer_name}</div>
              <div style="font-size: 15px; font-weight: 800; color: #b45309; margin: 4px 0;">📞 ${order.customer_phone}</div>
              <div style="font-size: 12px; color: #334155;"><strong>City:</strong> ${order.city}</div>
              <div style="font-size: 12px; color: #334155; margin-top: 2px;"><strong>Address:</strong> ${order.shipping_address}</div>
            </div>

            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; background: #f8fafc;">
              <h3 style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; margin: 0 0 8px 0;">Logistics & Dispatch Information</h3>
              <div style="font-size: 14px; font-weight: 700; color: #0f172a;">Courier: ${order.courier_partner}</div>
              <div style="font-size: 12px; color: #334155; margin: 4px 0;">Tracking Number: <strong>${order.tracking_number || "To be issued"}</strong></div>
              <div style="font-size: 12px; color: #334155;">Payment Custodian: <strong>${order.payment_custodian}</strong></div>
              <div style="font-size: 12px; color: #334155;">Delivery Status: <strong>${order.delivery_status}</strong></div>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
                <th style="padding: 10px;">Item Description</th>
                <th style="padding: 10px; text-align: center;">Type</th>
                <th style="padding: 10px; text-align: center;">Qty</th>
                <th style="padding: 10px; text-align: right;">Unit Rate</th>
                <th style="padding: 10px; text-align: right;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (it) => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px; font-weight: 600;">${it.name}</td>
                  <td style="padding: 10px; text-align: center;">${it.item_type}</td>
                  <td style="padding: 10px; text-align: center; font-weight: 700;">${it.quantity}</td>
                  <td style="padding: 10px; text-align: right;">Rs. ${(it.unit_price_paisa / 100).toLocaleString()}</td>
                  <td style="padding: 10px; text-align: right; font-weight: 700;">Rs. ${(it.line_total_paisa / 100).toLocaleString()}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <div style="display: flex; justify-content: flex-end; margin-bottom: 24px;">
            <div style="width: 320px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; background: #fff;">
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                <span>Subtotal:</span>
                <span>Rs. ${(order.subtotal_paisa / 100).toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                <span>Delivery Charges:</span>
                <span>Rs. ${(order.delivery_charges_paisa / 100).toLocaleString()}</span>
              </div>
              ${
                order.discount_paisa > 0
                  ? `
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; color: #e11d48;">
                <span>Discount:</span>
                <span>-Rs. ${(order.discount_paisa / 100).toLocaleString()}</span>
              </div>`
                  : ""
              }
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 4px;">
                <span>Total Order Value:</span>
                <span>Rs. ${(order.total_amount_paisa / 100).toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; color: #059669; margin: 4px 0;">
                <span>Advance Paid:</span>
                <span>Rs. ${(order.advance_paid_paisa / 100).toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #b45309; border-top: 2px solid #b45309; padding-top: 8px; margin-top: 6px;">
                <span>CASH ON DELIVERY (COD):</span>
                <span>Rs. ${(order.cod_balance_paisa / 100).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8;">
            <div>Ameer Perfumes ERP • Official E-Commerce Shipping Dispatch Document</div>
            <div>Support: 0310 0988522 • Software by Global Tech</div>
          </div>
        </div>
      `;
    }

    document.body.classList.add("printing-reports-a4");
    setTimeout(() => {
      window.print();
      const cleanUp = () => {
        document.body.classList.remove("printing-reports-a4");
        if (printArea) printArea.innerHTML = "";
        window.removeEventListener("afterprint", cleanUp);
      };
      window.addEventListener("afterprint", cleanUp);
    }, 80);
  };

  // Export Orders to CSV
  const handleExportCSV = () => {
    const header = "Order No,Channel,Customer Name,Customer Phone,City,Address,Total (PKR),Advance Paid (PKR),COD Balance (PKR),Payment Status,Custodian,Courier,Tracking No,Delivery Status,Date\n";
    const rows = filteredOrders
      .map(
        (o) =>
          `"${o.order_number}","${o.channel}","${o.customer_name}","${o.customer_phone}","${o.city}","${o.shipping_address.replace(/"/g, '""')}",${o.total_amount_paisa / 100},${o.advance_paid_paisa / 100},${o.cod_balance_paisa / 100},"${o.payment_status}","${o.payment_custodian}","${o.courier_partner}","${o.tracking_number}","${o.delivery_status}","${o.created_at}"`
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Ameer_Online_Orders_${filterTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback({
      type: "success",
      text: `✓ Online orders (${filteredOrders.length} records) exported to Excel successfully! Check your Downloads folder.`,
    });
  };

  return (
    <div className="flex-1 p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col gap-6 select-none overflow-y-auto">
      {/* Screen Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-serif text-slate-900 dark:text-slate-100 tracking-wide flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-500" />
              Online & Social Commerce Hub (WhatsApp & Website)
            </h1>
            <Badge variant="gold" className="text-[11px] font-bold">
              Dispatch & COD Center
            </Badge>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Dedicated order management, courier COD reconciliation, staff custodian tracking, instant payment collection, and RTO return logistics.
          </p>
        </div>

        {/* Global Primary Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs whitespace-nowrap px-3 py-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Orders (Excel)</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              resetNewOrderForm();
              setIsNewOrderModalOpen(true);
            }}
            className="flex items-center gap-1.5 text-xs font-bold cursor-pointer bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Book New Online Order</span>
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="font-bold underline ml-3 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* EXECUTIVE KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Orders */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 uppercase font-mono">
            <span>Total Online Orders</span>
            <Globe className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1 block">
            {orders.length} Orders
          </span>
          <span className="text-[11px] text-slate-500 font-mono mt-0.5 block truncate">
            💬 WA: {waOrders.length} | 🌐 Web: {webOrders.length}
          </span>
        </div>

        {/* Card 2: Pending Receivables (Pending COD & Balances) */}
        <div className="bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/30 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 uppercase font-mono font-bold">
            <span>Pending Receivables</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 block">
            Rs. {formatRs(totalPendingPaisa)}
          </span>
          <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80 font-mono mt-0.5 block truncate">
            💬 WA: Rs. {formatRs(waPendingPaisa)} | 🌐 Web: Rs. {formatRs(webPendingPaisa)}
          </span>
        </div>

        {/* Card 3: Custodian Breakdown (Where is the Pending Money?) */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 uppercase font-mono">
            <span>Pending Custodian Split</span>
            <Truck className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-1 flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
              <span className="flex items-center gap-1">🚚 Courier COD:</span>
              <span className="text-indigo-600 dark:text-indigo-400">Rs. {formatRs(courierCodPaisa)}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
              <span className="flex items-center gap-1">👤 Staff Handler:</span>
              <span className="text-amber-600 dark:text-amber-400">Rs. {formatRs(staffPendingPaisa)}</span>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block">
            Money pending with riders vs online staff
          </span>
        </div>

        {/* Card 4: Realized Cash Received (Net Collections) */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 uppercase font-mono">
            <span>Realized Collections</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
            Rs. {formatRs(totalCollectedPaisa)}
          </span>
          <span className="text-[11px] text-slate-500 font-mono mt-0.5 block truncate">
            💬 WA: Rs. {formatRs(waCollectedPaisa)} | 🌐 Web: Rs. {formatRs(webCollectedPaisa)}
          </span>
        </div>

        {/* Card 5: Returns / RTOs */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 uppercase font-mono">
            <span>Returns / RTOs</span>
            <RotateCcw className="w-4 h-4 text-rose-500" />
          </div>
          <span className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 block">
            {returnedOrders.length} Parcels
          </span>
          <span className="text-[11px] text-slate-500 font-mono mt-0.5 block truncate">
            Restocked & COD cleared
          </span>
        </div>
      </div>

      {/* FILTER TABS & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: "ALL", label: `All Orders (${orders.length})` },
            { id: "WHATSAPP", label: `💬 WhatsApp (${waOrders.length})` },
            { id: "WEBSITE", label: `🌐 Website (${webOrders.length})` },
            { id: "PENDING_COD", label: `⏳ Pending COD (${orders.filter((o) => o.cod_balance_paisa > 0 && o.payment_status !== "RETURNED").length})` },
            { id: "IN_TRANSIT", label: `🚚 In Transit (${orders.filter((o) => o.delivery_status === "DISPATCHED").length})` },
            { id: "SETTLED", label: `✅ Fully Settled (${orders.filter((o) => o.payment_status === "PAID").length})` },
            { id: "RETURNED", label: `↩️ Returns / RTO (${returnedOrders.length})` },
          ].map((tab) => {
            return (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id as ChannelFilter)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                  filterTab === tab.id
                    ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900"
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="w-full sm:w-80">
          <Input
            placeholder="Search order #, customer phone, name, city, courier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="w-4 h-4 text-emerald-500" />}
            className="h-9 text-xs"
          />
        </div>
      </div>

      {/* ORDERS MASTER AUDIT TABLE */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/40 shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 font-mono uppercase text-[10px]">
              <th className="py-2.5 px-3">Order # & Date</th>
              <th className="py-2.5 px-3">Channel</th>
              <th className="py-2.5 px-3">Customer & Mobile #</th>
              <th className="py-2.5 px-3">Courier & Tracking</th>
              <th className="py-2.5 px-3">Pending Custodian</th>
              <th className="py-2.5 px-3 text-right">Order Total</th>
              <th className="py-2.5 px-3 text-right">Advance Paid</th>
              <th className="py-2.5 px-3 text-right">Pending COD</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
            {filteredOrders.map((o) => (
              <tr key={o.order_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                {/* 1. Order Number & Date */}
                <td className="py-2.5 px-3">
                  <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    {o.order_number}
                  </div>
                  <div className="text-[10px] text-slate-400 font-sans">{o.created_at}</div>
                </td>

                {/* 2. Channel Badge */}
                <td className="py-2.5 px-3">
                  {o.channel === "WHATSAPP" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      💬 WhatsApp
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                      🌐 Website
                    </span>
                  )}
                </td>

                {/* 3. Customer & Mobile Number */}
                <td className="py-2.5 px-3 font-sans">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                    {o.customer_name}
                  </div>
                  <div className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    <span>{o.customer_phone}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate max-w-[180px]" title={o.shipping_address}>
                    {o.city} • {o.shipping_address}
                  </div>
                </td>

                {/* 4. Courier & Tracking */}
                <td className="py-2.5 px-3 font-sans">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-slate-400" />
                    <span>{o.courier_partner}</span>
                  </div>
                  {o.tracking_number ? (
                    <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-md font-bold">
                      {o.tracking_number}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">No Tracking</span>
                  )}
                </td>

                {/* 5. Pending Custodian */}
                <td className="py-2.5 px-3">
                  {o.payment_status === "RETURNED" ? (
                    <span className="text-rose-500 text-[10px] font-bold">↩️ RTO Cancelled</span>
                  ) : o.cod_balance_paisa <= 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Treasury Settled
                    </span>
                  ) : o.payment_custodian === "COURIER" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                      🚚 With Courier (COD)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      👤 Online Staff Handler
                    </span>
                  )}
                </td>

                {/* 6. Order Total */}
                <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                  Rs. {formatRs(o.total_amount_paisa)}
                </td>

                {/* 7. Advance Paid */}
                <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                  Rs. {formatRs(o.advance_paid_paisa)}
                </td>

                {/* 8. Pending COD */}
                <td className="py-2.5 px-3 text-right font-bold">
                  {o.cod_balance_paisa > 0 && o.payment_status !== "RETURNED" ? (
                    <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md font-mono font-bold">
                      Rs. {formatRs(o.cod_balance_paisa)}
                    </span>
                  ) : (
                    <span className="text-slate-400">Rs. 0</span>
                  )}
                </td>

                {/* 9. Status Badges */}
                <td className="py-2.5 px-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        o.payment_status === "PAID"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : o.payment_status === "PARTIAL"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          : o.payment_status === "RETURNED"
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                          : "bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30"
                      }`}
                    >
                      {o.payment_status}
                    </span>
                    <span className="text-[9px] font-sans text-slate-500 font-semibold uppercase">
                      {o.delivery_status}
                    </span>
                  </div>
                </td>

                {/* 10. Actions */}
                <td className="py-2.5 px-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {/* Collect Payment Button */}
                    {o.cod_balance_paisa > 0 && o.payment_status !== "RETURNED" && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openCollectPaymentModal(o)}
                        className="h-7 px-2 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                        title="Collect pending COD balance into treasury"
                      >
                        <DollarSign className="w-3 h-3" />
                        <span>Collect</span>
                      </Button>
                    )}

                    {/* Print Slip (Thermal & A4) */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintShippingSlip(o, "THERMAL_80MM")}
                      className="h-7 px-2 text-[11px] font-semibold border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                      title="Print 80mm Thermal Dispatch Slip with Customer Phone & COD"
                    >
                      <Printer className="w-3 h-3" />
                      <span>Thermal</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintShippingSlip(o, "A4")}
                      className="h-7 px-2 text-[11px] font-semibold border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Print A4 Packing Slip"
                    >
                      <span>A4</span>
                    </Button>

                    {/* Status Update Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openStatusModal(o)}
                      className="h-7 px-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                      title="Update Delivery & Tracking Status"
                    >
                      <Truck className="w-3.5 h-3.5" />
                    </Button>

                    {/* Return / RTO Button */}
                    {o.delivery_status !== "RETURNED_RTO" && o.payment_status !== "RETURNED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openReturnModal(o)}
                        className="h-7 px-1.5 text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        title="Mark Parcel Return / RTO (Restocks Inventory & Clears COD)"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-500 font-sans">
                  No online orders found matching current filters. Click "+ Book New Online Order" to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: BOOK NEW ONLINE ORDER */}
      {/* ========================================================================= */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-emerald-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Book New Online / Social Commerce Order
                </h2>
              </div>
              <button
                onClick={() => setIsNewOrderModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateOrder} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Channel Selector */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Select Channel / Source:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewChannel("WHATSAPP")}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                      newChannel === "WHATSAPP"
                        ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>💬 WhatsApp Order</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewChannel("WEBSITE")}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                      newChannel === "WEBSITE"
                        ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    <span>🌐 Website Order</span>
                  </button>
                </div>
              </div>

              {/* Customer Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Customer Mobile Number *
                  </label>
                  <Input
                    placeholder="e.g. 0300 1234567"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    required
                    icon={<Phone className="w-4 h-4 text-emerald-500" />}
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Customer Name
                  </label>
                  <Input
                    placeholder="e.g. Muhammad Adnan"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Destination City
                  </label>
                  <Input
                    placeholder="e.g. Peshawar, Lahore, Islamabad, Bannu"
                    value={custCity}
                    onChange={(e) => setCustCity(e.target.value)}
                    icon={<MapPin className="w-4 h-4 text-amber-500" />}
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Complete Shipping Address
                  </label>
                  <Input
                    placeholder="House/Shop #, Street, Area"
                    value={custAddress}
                    onChange={(e) => setCustAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* Products Picker */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span>Package Items:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                      ({orderItems.length} items added)
                    </span>
                  </label>

                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedItemType("PERFUME")}
                      className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                        selectedItemType === "PERFUME"
                          ? "bg-amber-500 text-slate-950 font-bold"
                          : "text-slate-500"
                      }`}
                    >
                      Perfumes
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedItemType("ATTAR")}
                      className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                        selectedItemType === "ATTAR"
                          ? "bg-amber-500 text-slate-950 font-bold"
                          : "text-slate-500"
                      }`}
                    >
                      Attars
                    </button>
                  </div>
                </div>

                {/* Quick Item Search & Select */}
                <div className="flex gap-2">
                  <Input
                    placeholder={`Search ${selectedItemType.toLowerCase()} to add...`}
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    icon={<Search className="w-3.5 h-3.5 text-slate-400" />}
                    className="h-8 text-xs flex-1"
                  />
                </div>

                {/* Products Grid to click & add */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/40">
                  {selectedItemType === "PERFUME"
                    ? products
                        .filter((p) => !itemSearch.trim() || p.name.toLowerCase().includes(itemSearch.toLowerCase()))
                        .slice(0, 12)
                        .map((p) => (
                          <button
                            key={p.product_id}
                            type="button"
                            onClick={() => handleAddItem(p, "PERFUME")}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between"
                          >
                            <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {p.name}
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-mono mt-1 text-slate-500">
                              <span>{p.size_ml}ml</span>
                              <span className="font-bold text-amber-600 dark:text-amber-400">
                                Rs. {formatRs(p.retail_price_paisa)}
                              </span>
                            </div>
                          </button>
                        ))
                    : attars
                        .filter((a) => !itemSearch.trim() || a.name.toLowerCase().includes(itemSearch.toLowerCase()))
                        .slice(0, 12)
                        .map((a) => (
                          <button
                            key={a.attar_id}
                            type="button"
                            onClick={() => handleAddItem(a, "ATTAR")}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between"
                          >
                            <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {a.name}
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-mono mt-1 text-slate-500">
                              <span>1 Tola</span>
                              <span className="font-bold text-amber-600 dark:text-amber-400">
                                Rs. {formatRs(a.selling_price_per_tola_paisa)}
                              </span>
                            </div>
                          </button>
                        ))}
                </div>

                {/* Selected Items Table */}
                {orderItems.length > 0 && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 text-[10px]">
                        <tr>
                          <th className="p-2">Item</th>
                          <th className="p-2 text-center">Qty</th>
                          <th className="p-2 text-right">Unit Price</th>
                          <th className="p-2 text-right">Total</th>
                          <th className="p-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {orderItems.map((it, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-sans font-semibold">{it.name}</td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(idx, it.quantity - 1)}
                                  className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-800 font-bold cursor-pointer"
                                >
                                  -
                                </button>
                                <span>{it.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(idx, it.quantity + 1)}
                                  className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-800 font-bold cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="p-2 text-right">Rs. {formatRs(it.unit_price_paisa)}</td>
                            <td className="p-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              Rs. {formatRs(it.line_total_paisa)}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Courier, Custodian & Financial Splits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="space-y-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Courier Partner
                    </label>
                    <select
                      value={courierPartner}
                      onChange={(e) => setCourierPartner(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold"
                    >
                      {COURIER_PARTNERS.map((cp) => (
                        <option key={cp} value={cp}>
                          {cp}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Tracking / Consignment ID (Optional)
                    </label>
                    <Input
                      placeholder="e.g. 1029384756"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Pending Cash Custodian
                    </label>
                    <select
                      value={custodian}
                      onChange={(e) => setCustodian(e.target.value as any)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold"
                    >
                      <option value="COURIER">🚚 Courier COD (Pending with Rider/Courier)</option>
                      <option value="STAFF_HANDLER">👤 Online Staff Handler (Advance / Online Wallet)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Order Notes / Instructions
                    </label>
                    <Input
                      placeholder="e.g. Call before delivery, gift wrap"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                    />
                  </div>
                </div>

                {/* Financial Summary Card */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between font-mono space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-sans">Items Subtotal:</span>
                    <span className="font-bold">Rs. {formatRs(newOrderSubtotalPaisa)}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-sans">Delivery Charges:</span>
                    <div className="w-24">
                      <Input
                        type="number"
                        value={deliveryCharges}
                        onChange={(e) => setDeliveryCharges(e.target.value)}
                        className="h-7 text-xs text-right font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-sans">Special Discount:</span>
                    <div className="w-24">
                      <Input
                        type="number"
                        value={discountRupees}
                        onChange={(e) => setDiscountRupees(e.target.value)}
                        className="h-7 text-xs text-right font-mono text-rose-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-sm font-bold border-t border-slate-200 dark:border-slate-800 pt-2">
                    <span className="font-sans">Total Order Value:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">Rs. {formatRs(newOrderTotalPaisa)}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="text-slate-500 font-sans">Advance Received:</span>
                    <div className="w-28">
                      <Input
                        type="number"
                        value={advancePaidRupees}
                        onChange={(e) => setAdvancePaidRupees(e.target.value)}
                        className="h-7 text-xs text-right font-mono font-bold text-emerald-600 dark:text-emerald-400"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Cash on Delivery Highlight */}
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 font-sans">
                        Pending Cash on Delivery (COD)
                      </div>
                      <div className="text-xs text-slate-500 font-sans">Payable by customer to rider</div>
                    </div>
                    <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                      Rs. {formatRs(codBalancePaisa)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNewOrderModalOpen(false)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading || orderItems.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  Confirm & Dispatch Order
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: COLLECT PAYMENT */}
      {/* ========================================================================= */}
      {isCollectModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Collect Payment for {selectedOrder.order_number}
                </h2>
              </div>
              <button
                onClick={() => setIsCollectModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteCollectPayment} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Total Order Value:</span>
                  <span className="font-bold">Rs. {formatRs(selectedOrder.total_amount_paisa)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Advance Already Paid:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    Rs. {formatRs(selectedOrder.advance_paid_paisa)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-amber-500/20 pt-1 text-amber-700 dark:text-amber-400">
                  <span className="font-sans">Pending Balance to Collect:</span>
                  <span>Rs. {formatRs(selectedOrder.cod_balance_paisa)}</span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Collection Amount (PKR) *
                </label>
                <Input
                  type="number"
                  value={collectAmountRupees}
                  onChange={(e) => setCollectAmountRupees(e.target.value)}
                  required
                  className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Payment Method *
                </label>
                <select
                  value={collectMethod}
                  onChange={(e) => setCollectMethod(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold"
                >
                  <option value="CASH">💵 Cash (Disbursed by Courier / Received in Hand)</option>
                  <option value="EASYPAISA">📱 EasyPaisa</option>
                  <option value="JAZZCASH">📱 JazzCash</option>
                  <option value="BANK_TRANSFER">🏦 Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Courier Cheque / Slip / TID Reference (Optional)
                </label>
                <Input
                  placeholder="e.g. TCS-DISB-9981 or TID: 98127391"
                  value={collectReference}
                  onChange={(e) => setCollectReference(e.target.value)}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Notes
                </label>
                <Input
                  placeholder="e.g. Received weekly courier COD settlement"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCollectModalOpen(false)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  Confirm Collection
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: MARK RETURN / RTO */}
      {/* ========================================================================= */}
      {isReturnModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-rose-500/10">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <RotateCcw className="w-5 h-5" />
                <h2 className="text-sm font-bold">
                  Mark Order Return / RTO ({selectedOrder.order_number})
                </h2>
              </div>
              <button
                onClick={() => setIsReturnModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteReturn} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-700 dark:text-rose-300">
                <p className="font-semibold mb-1">⚠️ Return & Restock Action:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  <li>All perfume bottles and attars will be restocked back into inventory.</li>
                  <li>The pending COD receivable of <strong>Rs. {formatRs(selectedOrder.cod_balance_paisa)}</strong> will be cleared to 0.</li>
                  <li>Order status will be updated to <strong>RETURNED_RTO</strong>.</li>
                </ul>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Reason for Return / RTO *
                </label>
                <Input
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  disabled={loading}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                >
                  Confirm Return & Restock
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: UPDATE DELIVERY STATUS */}
      {/* ========================================================================= */}
      {isStatusModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Update Logistics Status ({selectedOrder.order_number})
                </h2>
              </div>
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteStatusUpdate} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Delivery Status
                </label>
                <select
                  value={updateDeliveryStatus}
                  onChange={(e) => setUpdateDeliveryStatus(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold"
                >
                  <option value="BOOKED">BOOKED (Label Created, Awaiting Pickup)</option>
                  <option value="DISPATCHED">DISPATCHED (Handed to Courier / In Transit)</option>
                  <option value="DELIVERED">DELIVERED (Successfully Handed to Customer)</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Courier Partner
                </label>
                <select
                  value={updateCourier}
                  onChange={(e) => setUpdateCourier(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold"
                >
                  {COURIER_PARTNERS.map((cp) => (
                    <option key={cp} value={cp}>
                      {cp}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Tracking Number
                </label>
                <Input
                  value={updateTracking}
                  onChange={(e) => setUpdateTracking(e.target.value)}
                  placeholder="e.g. 1029384756"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                >
                  Save Status
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
