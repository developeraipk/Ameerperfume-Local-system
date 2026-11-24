// Ameer Perfumes ERP — Approved Phase 2.3.1 SQLite DDL Schema (46 Tables, 105 Indexes, 16 Triggers)
// Production Master Schema for Local POS Terminals (POS-01 & POS-02)

pub const SQLITE_INIT_SCHEMA: &str = r#"-- ============================================================================
-- AMEER PERFUMES ERP — COMPLETE PRODUCTION SQLITE 3 WORKSTATION DDL
-- Specification Version: 2.3.1 (Production Master)
-- Dialect: SQLite 3.35+ (Foreign Keys & Strict Triggers Enabled)
-- Total Operational Tables: 46
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- MODULE 1: AUTHENTICATION, USERS & AUDIT LOGS (4 TABLES)
-- ----------------------------------------------------------------------------

CREATE TABLE users (
    user_id TEXT PRIMARY KEY NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    pin_salt_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('OWNER', 'SUPER_ADMIN', 'SHOP_MANAGER', 'CASHIER_OPERATOR')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE salespersons (
    salesperson_id TEXT PRIMARY KEY NOT NULL,
    employee_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE cashier_assignments (
    assignment_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    assigned_role TEXT NOT NULL CHECK(assigned_role IN ('PRIMARY_CASHIER', 'SECONDARY_OPERATOR', 'AUDITOR')),
    assignment_type TEXT NOT NULL DEFAULT 'PERMANENT' CHECK(assignment_type IN ('TEMPORARY', 'PERMANENT')),
    authorized_by_admin_id TEXT REFERENCES users(user_id) ON DELETE RESTRICT,
    reason_for_change TEXT,
    valid_from TEXT NOT NULL,
    valid_until TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL
);

CREATE TABLE audit_logs (
    log_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    previous_state TEXT,
    new_state TEXT,
    ip_address TEXT NOT NULL,
    client_terminal_id TEXT NOT NULL,
    timestamp TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- MODULE 10: DOUBLE-ENTRY GENERAL LEDGER & CHART OF ACCOUNTS (3 TABLES)
-- ----------------------------------------------------------------------------

CREATE TABLE chart_of_accounts (
    account_id TEXT PRIMARY KEY NOT NULL,
    account_code TEXT UNIQUE NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK(account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    account_category TEXT NOT NULL CHECK(account_category IN (
        'CASH', 'BANK', 'ACCOUNTS_RECEIVABLE', 'INVENTORY_RAW_MATERIALS', 'INVENTORY_WIP',
        'INVENTORY_FINISHED_GOODS', 'EQUIPMENT_ASSETS', 'ACCOUNTS_PAYABLE', 
        'CUSTOMER_STORE_CREDIT_LIABILITY', 'CAPITAL', 'SALES_REVENUE', 
        'SALES_RETURNS_ALLOWANCES', 'DISCOUNT_GIVEN', 'COST_OF_GOODS_SOLD', 
        'SHOP_EXPENSE', 'SALARIES_COMMISSIONS', 'INVENTORY_ADJUSTMENT_EXPENSE'
    )),
    normal_balance TEXT NOT NULL CHECK(normal_balance IN ('DEBIT', 'CREDIT')),
    parent_account_id TEXT REFERENCES chart_of_accounts(account_id) ON DELETE RESTRICT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE journal_vouchers (
    voucher_id TEXT PRIMARY KEY NOT NULL,
    voucher_number TEXT UNIQUE NOT NULL,
    voucher_date TEXT NOT NULL,
    voucher_type TEXT NOT NULL CHECK(voucher_type IN ('STANDARD', 'PURCHASE', 'SALES', 'PAYMENT', 'RECEIPT', 'REVERSAL', 'CORRECTION', 'CLOSING')),
    source_module TEXT NOT NULL CHECK(source_module IN ('GL', 'PURCHASE', 'SALE_INVOICE', 'SALE_RETURN', 'WHOLESALE_INVOICE', 'WHOLESALE_RETURN', 'PAYMENT', 'PETTY_CASH', 'INVENTORY_ADJUSTMENT')),
    source_document_id TEXT NOT NULL,
    description TEXT NOT NULL,
    is_posted INTEGER NOT NULL DEFAULT 0 CHECK(is_posted IN (0, 1)),
    is_immutable INTEGER NOT NULL DEFAULT 0 CHECK(is_immutable IN (0, 1)),
    posted_by_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL
);

CREATE TABLE financial_ledger_entries (
    entry_id TEXT PRIMARY KEY NOT NULL,
    voucher_id TEXT NOT NULL REFERENCES journal_vouchers(voucher_id) ON DELETE RESTRICT,
    account_id TEXT NOT NULL REFERENCES chart_of_accounts(account_id) ON DELETE RESTRICT,
    entry_side TEXT NOT NULL CHECK(entry_side IN ('DEBIT', 'CREDIT')),
    debit_paisa INTEGER NOT NULL DEFAULT 0 CHECK(debit_paisa >= 0),
    credit_paisa INTEGER NOT NULL DEFAULT 0 CHECK(credit_paisa >= 0),
    currency TEXT NOT NULL DEFAULT 'PKR',
    memo TEXT,
    created_at TEXT NOT NULL,
    CHECK ((entry_side = 'DEBIT' AND debit_paisa > 0 AND credit_paisa = 0) OR
           (entry_side = 'CREDIT' AND credit_paisa > 0 AND debit_paisa = 0))
);

-- ----------------------------------------------------------------------------
-- MODULE 2: PROCUREMENT & RAW MATERIALS (6 TABLES)
-- ----------------------------------------------------------------------------

CREATE TABLE suppliers (
    supplier_id TEXT PRIMARY KEY NOT NULL,
    company_name TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    city TEXT NOT NULL,
    current_balance_paisa INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE raw_materials (
    material_id TEXT PRIMARY KEY NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    material_type TEXT NOT NULL CHECK(material_type IN ('EMPTY_BOTTLE', 'CAP', 'COLLAR', 'PUMP', 'BOX', 'AROMA_CHEMICAL', 'ETHANOL', 'PACKAGING')),
    unit_of_measure TEXT NOT NULL CHECK(unit_of_measure IN ('PIECE', 'ML', 'GRAM', 'KG', 'LITER')),
    current_stock_units REAL NOT NULL DEFAULT 0,
    weighted_average_cost_paisa INTEGER NOT NULL DEFAULT 0 CHECK(weighted_average_cost_paisa >= 0),
    reorder_threshold_units REAL NOT NULL DEFAULT 0 CHECK(reorder_threshold_units >= 0),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE supplier_purchase_invoices (
    invoice_id TEXT PRIMARY KEY NOT NULL,
    supplier_id TEXT NOT NULL REFERENCES suppliers(supplier_id) ON DELETE RESTRICT,
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_date TEXT NOT NULL,
    delivery_date TEXT,
    total_amount_paisa INTEGER NOT NULL CHECK(total_amount_paisa >= 0),
    paid_amount_paisa INTEGER NOT NULL DEFAULT 0 CHECK(paid_amount_paisa >= 0),
    balance_due_paisa INTEGER NOT NULL CHECK(balance_due_paisa >= 0),
    payment_status TEXT NOT NULL CHECK(payment_status IN ('PAID', 'PARTIALLY_PAID', 'UNPAID')),
    status TEXT NOT NULL CHECK(status IN ('RECEIVED', 'VERIFIED', 'VOIDED')),
    received_by_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (total_amount_paisa = paid_amount_paisa + balance_due_paisa)
);

CREATE TABLE supplier_purchase_lines (
    line_id TEXT PRIMARY KEY NOT NULL,
    invoice_id TEXT NOT NULL REFERENCES supplier_purchase_invoices(invoice_id) ON DELETE CASCADE,
    material_id TEXT NOT NULL REFERENCES raw_materials(material_id) ON DELETE RESTRICT,
    quantity_received REAL NOT NULL CHECK(quantity_received > 0),
    unit_price_paisa INTEGER NOT NULL CHECK(unit_price_paisa >= 0),
    line_total_paisa INTEGER NOT NULL CHECK(line_total_paisa >= 0),
    created_at TEXT NOT NULL
);

CREATE TABLE supplier_payments (
    payment_id TEXT PRIMARY KEY NOT NULL,
    supplier_id TEXT NOT NULL REFERENCES suppliers(supplier_id) ON DELETE RESTRICT,
    purchase_invoice_id TEXT REFERENCES supplier_purchase_invoices(invoice_id) ON DELETE RESTRICT,
    payment_date TEXT NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER', 'CHEQUE', 'DIGITAL_WALLET', 'BANK')),
    amount_paid_paisa INTEGER NOT NULL CHECK(amount_paid_paisa > 0),
    reference_number TEXT,
    paid_from_account_id TEXT NOT NULL REFERENCES chart_of_accounts(account_id) ON DELETE RESTRICT,
    notes TEXT,
    created_by_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL
);

CREATE TABLE supplier_ledger (
    ledger_entry_id TEXT PRIMARY KEY NOT NULL,
    supplier_id TEXT NOT NULL REFERENCES suppliers(supplier_id) ON DELETE RESTRICT,
    transaction_timestamp TEXT NOT NULL,
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('PURCHASE_INVOICE', 'PAYMENT', 'PURCHASE_RETURN', 'ADJUSTMENT')),
    reference_type TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    debit_paisa INTEGER NOT NULL DEFAULT 0 CHECK(debit_paisa >= 0),
    credit_paisa INTEGER NOT NULL DEFAULT 0 CHECK(credit_paisa >= 0),
    running_balance_paisa INTEGER NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    CHECK ((debit_paisa > 0 AND credit_paisa = 0) OR (credit_paisa > 0 AND debit_paisa = 0))
);

-- ----------------------------------------------------------------------------
-- MODULE 3 & 4: FINISHED PRODUCTS, RECIPES & MANUFACTURING (6 TABLES)
-- ----------------------------------------------------------------------------

CREATE TABLE finished_products (
    product_id TEXT PRIMARY KEY NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT UNIQUE,
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT 'Ameer Perfumes',
    size_ml INTEGER NOT NULL CHECK(size_ml > 0),
    category TEXT NOT NULL CHECK(category IN ('MENS', 'WOMENS', 'UNISEX', 'ORIENTAL_LUXURY', 'LIMITED_EDITION')),
    current_stock_units INTEGER NOT NULL DEFAULT 0,
    retail_price_paisa INTEGER NOT NULL CHECK(retail_price_paisa >= 0),
    wholesale_price_paisa INTEGER NOT NULL CHECK(wholesale_price_paisa >= 0),
    latest_batch_cost_paisa INTEGER NOT NULL DEFAULT 0 CHECK(latest_batch_cost_paisa >= 0),
    reorder_threshold_units INTEGER NOT NULL DEFAULT 0 CHECK(reorder_threshold_units >= 0),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE perfume_recipes (
    recipe_id TEXT PRIMARY KEY NOT NULL,
    finished_product_id TEXT NOT NULL REFERENCES finished_products(product_id) ON DELETE RESTRICT,
    recipe_version INTEGER NOT NULL DEFAULT 1,
    batch_output_units INTEGER NOT NULL CHECK(batch_output_units > 0),
    instructions TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(finished_product_id, recipe_version)
);

CREATE TABLE perfume_recipe_items (
    item_id TEXT PRIMARY KEY NOT NULL,
    recipe_id TEXT NOT NULL REFERENCES perfume_recipes(recipe_id) ON DELETE CASCADE,
    raw_material_id TEXT NOT NULL REFERENCES raw_materials(material_id) ON DELETE RESTRICT,
    quantity_required REAL NOT NULL CHECK(quantity_required > 0),
    created_at TEXT NOT NULL,
    UNIQUE(recipe_id, raw_material_id)
);

CREATE TABLE manufacturing_batches (
    batch_id TEXT PRIMARY KEY NOT NULL,
    batch_number TEXT UNIQUE NOT NULL,
    recipe_id TEXT NOT NULL REFERENCES perfume_recipes(recipe_id) ON DELETE RESTRICT,
    finished_product_id TEXT NOT NULL REFERENCES finished_products(product_id) ON DELETE RESTRICT,
    planned_units INTEGER NOT NULL CHECK(planned_units > 0),
    produced_units INTEGER NOT NULL DEFAULT 0 CHECK(produced_units >= 0),
    total_cost_paisa INTEGER NOT NULL DEFAULT 0 CHECK(total_cost_paisa >= 0),
    cost_per_unit_paisa INTEGER NOT NULL DEFAULT 0 CHECK(cost_per_unit_paisa >= 0),
    status TEXT NOT NULL CHECK(status IN ('PLANNED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED')),
    production_date TEXT NOT NULL,
    completed_date TEXT,
    created_by_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE manufacturing_batch_consumptions (
    consumption_id TEXT PRIMARY KEY NOT NULL,
    batch_id TEXT NOT NULL REFERENCES manufacturing_batches(batch_id) ON DELETE CASCADE,
    raw_material_id TEXT NOT NULL REFERENCES raw_materials(material_id) ON DELETE RESTRICT,
    quantity_consumed REAL NOT NULL CHECK(quantity_consumed > 0),
    unit_cost_paisa INTEGER NOT NULL CHECK(unit_cost_paisa >= 0),
    total_cost_paisa INTEGER NOT NULL CHECK(total_cost_paisa >= 0),
    consumed_at TEXT NOT NULL
);

CREATE TABLE stock_movements (
    movement_id TEXT PRIMARY KEY NOT NULL,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('RAW_MATERIAL', 'FINISHED_PERFUME')),
    material_id TEXT REFERENCES raw_materials(material_id) ON DELETE RESTRICT,
    finished_product_id TEXT REFERENCES finished_products(product_id) ON DELETE RESTRICT,
    batch_id TEXT REFERENCES manufacturing_batches(batch_id) ON DELETE RESTRICT,
    movement_type TEXT NOT NULL CHECK(movement_type IN (
        'PURCHASE_RECEIPT', 'MANUFACTURING_CONSUMPTION', 'MANUFACTURING_OUTPUT',
        'RETAIL_SALE', 'WHOLESALE_SALE', 'RETURN_RESTOCK', 'RETURN_DAMAGED',
        'TESTER_DISPOSITION', 'STOCK_ADJUSTMENT', 'SALE_VOID_REVERSAL', 'OPENING_STOCK'
    )),
    delta_quantity INTEGER NOT NULL,
    unit_cost_paisa INTEGER NOT NULL CHECK(unit_cost_paisa >= 0),
    running_balance_after INTEGER NOT NULL,
    reference_document_type TEXT NOT NULL CHECK(reference_document_type IN (
        'PURCHASE_INVOICE', 'MANUFACTURING_BATCH', 'SALES_INVOICE', 'WHOLESALE_INVOICE', 'RETURN_VOUCHER', 'ADJUSTMENT_VOUCHER', 'INITIAL_SETUP'
    )),
    reference_document_id TEXT NOT NULL,
    shortage_oversell_flag INTEGER NOT NULL DEFAULT 0 CHECK(shortage_oversell_flag IN (0, 1)),
    notes TEXT,
    authorized_by_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    occurred_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CHECK ((entity_type = 'RAW_MATERIAL' AND material_id IS NOT NULL AND finished_product_id IS NULL) OR
           (entity_type = 'FINISHED_PERFUME' AND finished_product_id IS NOT NULL AND material_id IS NULL))
);

-- ----------------------------------------------------------------------------
-- MODULE 7: ATTAR PRODUCTS (STOCKLESS) (1 TABLE)
-- ----------------------------------------------------------------------------

CREATE TABLE attar_products (
    attar_id TEXT PRIMARY KEY NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    origin_country TEXT NOT NULL,
    density_grams_per_ml INTEGER NOT NULL DEFAULT 1000 CHECK(density_grams_per_ml > 0),
    cost_per_tola_paisa INTEGER NOT NULL CHECK(cost_per_tola_paisa >= 0),
    selling_price_per_tola_paisa INTEGER NOT NULL CHECK(selling_price_per_tola_paisa >= 0),
    cost_per_half_tola_paisa INTEGER NOT NULL CHECK(cost_per_half_tola_paisa >= 0),
    selling_price_half_tola_paisa INTEGER NOT NULL CHECK(selling_price_half_tola_paisa >= 0),
    cost_per_quarter_tola_paisa INTEGER NOT NULL CHECK(cost_per_quarter_tola_paisa >= 0),
    selling_price_quarter_tola_paisa INTEGER NOT NULL CHECK(selling_price_quarter_tola_paisa >= 0),
    cost_per_ml_paisa INTEGER NOT NULL CHECK(cost_per_ml_paisa >= 0),
    selling_price_per_ml_paisa INTEGER NOT NULL CHECK(selling_price_per_ml_paisa >= 0),
    cost_per_gram_paisa INTEGER NOT NULL CHECK(cost_per_gram_paisa >= 0),
    selling_price_per_gram_paisa INTEGER NOT NULL CHECK(selling_price_per_gram_paisa >= 0),
    cost_per_bottle_paisa INTEGER NOT NULL CHECK(cost_per_bottle_paisa >= 0),
    selling_price_bottle_paisa INTEGER NOT NULL CHECK(selling_price_bottle_paisa >= 0),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- MODULE 9: CASH REGISTER SHIFTS & MOVEMENTS (5 TABLES)
-- ----------------------------------------------------------------------------

CREATE TABLE cash_register_shifts (
    shift_id TEXT PRIMARY KEY NOT NULL,
    cashier_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    terminal_id TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    opening_cash_float_paisa INTEGER NOT NULL CHECK(opening_cash_float_paisa >= 0),
    closed_at TEXT,
    system_expected_cash_paisa INTEGER DEFAULT 0 CHECK(system_expected_cash_paisa >= 0),
    actual_counted_cash_paisa INTEGER CHECK(actual_counted_cash_paisa >= 0),
    shift_status TEXT NOT NULL DEFAULT 'OPEN' CHECK(shift_status IN ('OPEN', 'CLOSED', 'AUDITED')),
    created_at TEXT NOT NULL
);

CREATE TABLE cash_shift_denominations (
    denomination_id TEXT PRIMARY KEY NOT NULL,
    shift_id TEXT NOT NULL REFERENCES cash_register_shifts(shift_id) ON DELETE CASCADE,
    count_type TEXT NOT NULL CHECK(count_type IN ('OPENING', 'CLOSING')),
    note_5000 INTEGER NOT NULL DEFAULT 0 CHECK(note_5000 >= 0),
    note_1000 INTEGER NOT NULL DEFAULT 0 CHECK(note_1000 >= 0),
    note_500 INTEGER NOT NULL DEFAULT 0 CHECK(note_500 >= 0),
    note_100 INTEGER NOT NULL DEFAULT 0 CHECK(note_100 >= 0),
    note_50 INTEGER NOT NULL DEFAULT 0 CHECK(note_50 >= 0),
    note_20 INTEGER NOT NULL DEFAULT 0 CHECK(note_20 >= 0),
    note_10 INTEGER NOT NULL DEFAULT 0 CHECK(note_10 >= 0),
    coins_total_paisa INTEGER NOT NULL DEFAULT 0 CHECK(coins_total_paisa >= 0),
    calculated_total_paisa INTEGER NOT NULL CHECK(calculated_total_paisa >= 0),
    created_at TEXT NOT NULL,
    UNIQUE(shift_id, count_type)
);

CREATE TABLE cash_shift_audit (
    audit_id TEXT PRIMARY KEY NOT NULL,
    shift_id TEXT UNIQUE NOT NULL REFERENCES cash_register_shifts(shift_id) ON DELETE CASCADE,
    system_expected_cash_paisa INTEGER NOT NULL CHECK(system_expected_cash_paisa >= 0),
    physical_counted_cash_paisa INTEGER NOT NULL CHECK(physical_counted_cash_paisa >= 0),
    cash_variance_paisa INTEGER NOT NULL,
    variance_status TEXT NOT NULL CHECK(variance_status IN ('MATCHED', 'EXCESS', 'SHORTAGE')),
    discrepancy_reason TEXT,
    manager_action_taken TEXT CHECK(manager_action_taken IN ('ACCEPTED_AS_IS', 'RECOUNT_CONFIRMED', 'SECURITY_ESCALATED', 'DEDUCT_FROM_SALARY')),
    audited_by_manager_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    audited_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE petty_expenses (
    expense_id TEXT PRIMARY KEY NOT NULL,
    shift_id TEXT REFERENCES cash_register_shifts(shift_id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK(category IN ('CHAI_REFRESHMENTS', 'CLEANING_SUPPLIES', 'UTILITIES_MISC', 'OFFICE_STATIONERY', 'REPAIR_MAINTENANCE', 'TRAVEL_CONVEYANCE', 'OTHER')),
    expense_date TEXT NOT NULL,
    amount_paisa INTEGER NOT NULL CHECK(amount_paisa > 0),
    description TEXT NOT NULL,
    recipient_payee TEXT NOT NULL,
    authorized_by_manager_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    authorized_by_name TEXT,
    brought_by_name TEXT,
    created_by_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL
);

CREATE TABLE employee_salary_payouts (
    payout_id TEXT PRIMARY KEY NOT NULL,
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    employee_role TEXT NOT NULL DEFAULT 'SALES_STAFF',
    payout_type TEXT NOT NULL CHECK(payout_type IN ('DAILY_WAGE', 'WEEKLY_PAYOUT', 'MONTHLY_SALARY', 'ADVANCE_PAYMENT', 'COMMISSION')),
    amount_paisa INTEGER NOT NULL CHECK(amount_paisa > 0),
    payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'EASYPAISA', 'JAZZCASH')),
    disbursed_by_user_id TEXT NOT NULL,
    disbursed_by_name TEXT NOT NULL,
    notes TEXT,
    payout_date TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE cash_movements (
    cash_movement_id TEXT PRIMARY KEY NOT NULL,
    shift_id TEXT NOT NULL REFERENCES cash_register_shifts(shift_id) ON DELETE RESTRICT,
    movement_type TEXT NOT NULL CHECK(movement_type IN (
        'RETAIL_CASH_IN', 'ATTAR_CASH_IN', 'WHOLESALE_IMMEDIATE_CASH_IN',
        'WHOLESALE_RECEIVABLE_CASH_IN', 'RETAIL_RECEIVABLE_CASH_IN', 'CAPITAL_CASH_IN',
        'RETAIL_REFUND_CASH_OUT', 'WHOLESALE_RETURN_CASH_OUT', 'SUPPLIER_PURCHASE_CASH_OUT',
        'SHOP_EXPENSE_CASH_OUT', 'PETTY_CASH_OUT', 'BANK_DEPOSIT_CASH_OUT',
        'OWNER_DRAWING_CASH_OUT', 'OTHER_CASH_OUT'
    )),
    amount_paisa INTEGER NOT NULL CHECK(amount_paisa > 0),
    reference_document_type TEXT NOT NULL CHECK(reference_document_type IN (
        'SALES_INVOICE', 'RETURN_VOUCHER', 'WHOLESALE_PAYMENT', 'SUPPLIER_PAYMENT',
        'PETTY_EXPENSE', 'BANK_DEPOSIT', 'OWNER_DRAWING', 'CAPITAL_INJECTION', 'INITIAL_FLOAT', 'OTHER'
    )),
    reference_document_id TEXT NOT NULL,
    notes TEXT,
    created_by_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- MODULE 5: RETAIL POS, STORE CREDITS & INVOICING (6 TABLES)
-- ----------------------------------------------------------------------------

CREATE TABLE customer_store_credits (
    credit_id TEXT PRIMARY KEY NOT NULL,
    customer_phone TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    current_credit_balance_paisa INTEGER NOT NULL DEFAULT 0 CHECK(current_credit_balance_paisa >= 0),
    last_updated_at TEXT NOT NULL
);

CREATE TABLE customer_store_credit_movements (
    movement_id TEXT PRIMARY KEY NOT NULL,
    customer_phone TEXT NOT NULL REFERENCES customer_store_credits(customer_phone) ON DELETE RESTRICT,
    movement_type TEXT NOT NULL CHECK(movement_type IN ('CREDIT_ISSUED_RETURN', 'CREDIT_REDEEMED_POS', 'CREDIT_ADJUSTMENT')),
    amount_paisa INTEGER NOT NULL CHECK(amount_paisa > 0),
    reference_document_type TEXT NOT NULL,
    reference_document_id TEXT NOT NULL,
    running_balance_after_paisa INTEGER NOT NULL CHECK(running_balance_after_paisa >= 0),
    notes TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE sales_invoices (
    invoice_id TEXT PRIMARY KEY NOT NULL,
    invoice_number TEXT UNIQUE NOT NULL,
    shift_id TEXT NOT NULL REFERENCES cash_register_shifts(shift_id) ON DELETE RESTRICT,
    terminal_id TEXT NOT NULL,
    order_source TEXT NOT NULL DEFAULT 'WALK_IN' CHECK(order_source IN ('WALK_IN', 'WHATSAPP', 'WEBSITE')),
    customer_phone TEXT NOT NULL,
    salesperson_id TEXT NOT NULL REFERENCES salespersons(salesperson_id) ON DELETE RESTRICT,
    cashier_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    invoice_date TEXT NOT NULL,
    gross_total_paisa INTEGER NOT NULL CHECK(gross_total_paisa >= 0),
    item_discount_paisa INTEGER NOT NULL DEFAULT 0 CHECK(item_discount_paisa >= 0),
    special_discount_paisa INTEGER NOT NULL DEFAULT 0 CHECK(special_discount_paisa >= 0),
    special_discount_authorized_by_id TEXT REFERENCES users(user_id) ON DELETE RESTRICT,
    net_payable_paisa INTEGER NOT NULL CHECK(net_payable_paisa >= 0),
    is_voided INTEGER NOT NULL DEFAULT 0 CHECK(is_voided IN (0, 1)),
    voided_by_user_id TEXT REFERENCES users(user_id) ON DELETE RESTRICT,
    voided_reason TEXT,
    created_at TEXT NOT NULL,
    CHECK (gross_total_paisa - item_discount_paisa - special_discount_paisa = net_payable_paisa)
);

CREATE TABLE sales_invoice_items (
    invoice_item_id TEXT PRIMARY KEY NOT NULL,
    invoice_id TEXT NOT NULL REFERENCES sales_invoices(invoice_id) ON DELETE RESTRICT,
    item_type TEXT NOT NULL CHECK(item_type IN ('PERFUME', 'ATTAR')),
    finished_product_id TEXT REFERENCES finished_products(product_id) ON DELETE RESTRICT,
    attar_id TEXT REFERENCES attar_products(attar_id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    measurement_unit TEXT NOT NULL CHECK(measurement_unit IN ('BOTTLE', 'TOLA', 'HALF_TOLA', 'QUARTER_TOLA', 'CUSTOM_ML', 'CUSTOM_GRAM')),
    measurement_quantity INTEGER NOT NULL CHECK(measurement_quantity > 0),
    density_grams_per_ml INTEGER NOT NULL DEFAULT 1000 CHECK(density_grams_per_ml > 0),
    calculated_total_ml INTEGER NOT NULL CHECK(calculated_total_ml > 0),
    batch_id TEXT REFERENCES manufacturing_batches(batch_id) ON DELETE RESTRICT,
    unit_cost_paisa INTEGER NOT NULL CHECK(unit_cost_paisa >= 0),
    unit_selling_price_paisa INTEGER NOT NULL CHECK(unit_selling_price_paisa >= 0),
    discount_amount_paisa INTEGER NOT NULL DEFAULT 0 CHECK(discount_amount_paisa >= 0),
    line_total_paisa INTEGER NOT NULL CHECK(line_total_paisa >= 0),
    line_profit_paisa INTEGER NOT NULL,
    returned_quantity INTEGER NOT NULL DEFAULT 0 CHECK(returned_quantity >= 0 AND returned_quantity <= quantity),
    shortage_warning_acknowledged INTEGER NOT NULL DEFAULT 0 CHECK(shortage_warning_acknowledged IN (0, 1)),
    created_at TEXT NOT NULL,
    CHECK ((item_type = 'PERFUME' AND finished_product_id IS NOT NULL AND attar_id IS NULL) OR
           (item_type = 'ATTAR' AND attar_id IS NOT NULL AND finished_product_id IS NULL AND batch_id IS NULL))
);

CREATE TABLE sales_invoice_payments (
    payment_id TEXT PRIMARY KEY NOT NULL,
    invoice_id TEXT NOT NULL REFERENCES sales_invoices(invoice_id) ON DELETE RESTRICT,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'BANK_TRANSFER', 'DIGITAL_WALLET', 'CUSTOMER_CREDIT')),
    amount_paisa INTEGER NOT NULL CHECK(amount_paisa > 0),
    reference_transaction_code TEXT,
    bank_account_id TEXT REFERENCES chart_of_accounts(account_id) ON DELETE RESTRICT,
    is_cash_drawer_tender INTEGER NOT NULL CHECK(is_cash_drawer_tender IN (0, 1)),
    received_by_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL,
    CHECK ((payment_method = 'CASH' AND is_cash_drawer_tender = 1) OR 
           (payment_method != 'CASH' AND is_cash_drawer_tender = 0))
);

CREATE TABLE stock_reconciliation_queue (
    queue_id TEXT PRIMARY KEY NOT NULL,
    finished_product_id TEXT NOT NULL REFERENCES finished_products(product_id) ON DELETE RESTRICT,
    sales_invoice_id TEXT NOT NULL REFERENCES sales_invoices(invoice_id) ON DELETE RESTRICT,
    batch_id TEXT REFERENCES manufacturing_batches(batch_id) ON DELETE RESTRICT,
    oversold_quantity INTEGER NOT NULL CHECK(oversold_quantity > 0),
    recorded_negative_balance INTEGER NOT NULL,
    resolution_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(resolution_status IN ('PENDING', 'RECONCILED', 'WRITTEN_OFF')),
    resolving_batch_id TEXT REFERENCES manufacturing_batches(batch_id) ON DELETE RESTRICT,
    resolved_at TEXT,
    created_at TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- MODULE 6: WHOLESALE OPERATIONS & CUSTOMER LEDGER (5 TABLES)
-- ----------------------------------------------------------------------------

CREATE TABLE wholesale_customers (
    customer_id TEXT PRIMARY KEY NOT NULL,
    business_name TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    city TEXT NOT NULL,
    credit_limit_paisa INTEGER NOT NULL DEFAULT 0 CHECK(credit_limit_paisa >= 0),
    current_balance_paisa INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE wholesale_invoices (
    wholesale_invoice_id TEXT PRIMARY KEY NOT NULL,
    invoice_number TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL REFERENCES wholesale_customers(customer_id) ON DELETE RESTRICT,
    invoice_date TEXT NOT NULL,
    order_source TEXT NOT NULL DEFAULT 'DIRECT' CHECK(order_source IN ('DIRECT', 'WHATSAPP', 'PHONE')),
    salesperson_id TEXT NOT NULL REFERENCES salespersons(salesperson_id) ON DELETE RESTRICT,
    subtotal_paisa INTEGER NOT NULL CHECK(subtotal_paisa >= 0),
    discount_paisa INTEGER NOT NULL DEFAULT 0 CHECK(discount_paisa >= 0),
    net_total_paisa INTEGER NOT NULL CHECK(net_total_paisa >= 0),
    paid_amount_paisa INTEGER NOT NULL DEFAULT 0 CHECK(paid_amount_paisa >= 0),
    balance_due_paisa INTEGER NOT NULL CHECK(balance_due_paisa >= 0),
    payment_status TEXT NOT NULL CHECK(payment_status IN ('PAID', 'PARTIALLY_PAID', 'UNPAID')),
    is_voided INTEGER NOT NULL DEFAULT 0 CHECK(is_voided IN (0, 1)),
    voided_by_user_id TEXT REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL,
    CHECK (subtotal_paisa - discount_paisa = net_total_paisa),
    CHECK (net_total_paisa = paid_amount_paisa + balance_due_paisa)
);

CREATE TABLE wholesale_invoice_items (
    wholesale_item_id TEXT PRIMARY KEY NOT NULL,
    wholesale_invoice_id TEXT NOT NULL REFERENCES wholesale_invoices(wholesale_invoice_id) ON DELETE RESTRICT,
    item_type TEXT NOT NULL CHECK(item_type IN ('PERFUME', 'ATTAR')),
    finished_product_id TEXT REFERENCES finished_products(product_id) ON DELETE RESTRICT,
    attar_id TEXT REFERENCES attar_products(attar_id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    batch_id TEXT REFERENCES manufacturing_batches(batch_id) ON DELETE RESTRICT,
    unit_cost_paisa INTEGER NOT NULL CHECK(unit_cost_paisa >= 0),
    agreed_wholesale_price_paisa INTEGER NOT NULL CHECK(agreed_wholesale_price_paisa >= 0),
    line_total_paisa INTEGER NOT NULL CHECK(line_total_paisa >= 0),
    returned_quantity INTEGER NOT NULL DEFAULT 0 CHECK(returned_quantity >= 0 AND returned_quantity <= quantity),
    created_at TEXT NOT NULL,
    CHECK ((item_type = 'PERFUME' AND finished_product_id IS NOT NULL AND attar_id IS NULL) OR
           (item_type = 'ATTAR' AND attar_id IS NOT NULL AND finished_product_id IS NULL AND batch_id IS NULL))
);

CREATE TABLE wholesale_payments (
    wholesale_payment_id TEXT PRIMARY KEY NOT NULL,
    customer_id TEXT NOT NULL REFERENCES wholesale_customers(customer_id) ON DELETE RESTRICT,
    wholesale_invoice_id TEXT REFERENCES wholesale_invoices(wholesale_invoice_id) ON DELETE RESTRICT,
    payment_date TEXT NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER', 'CHEQUE', 'DIGITAL_WALLET', 'BANK')),
    amount_paid_paisa INTEGER NOT NULL CHECK(amount_paid_paisa > 0),
    reference_number TEXT,
    received_by_account_id TEXT NOT NULL REFERENCES chart_of_accounts(account_id) ON DELETE RESTRICT,
    notes TEXT,
    received_by_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL
);

CREATE TABLE wholesale_customer_ledger (
    ledger_entry_id TEXT PRIMARY KEY NOT NULL,
    customer_id TEXT NOT NULL REFERENCES wholesale_customers(customer_id) ON DELETE RESTRICT,
    transaction_timestamp TEXT NOT NULL,
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('WHOLESALE_INVOICE', 'PAYMENT', 'WHOLESALE_RETURN', 'ADJUSTMENT')),
    reference_type TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    debit_paisa INTEGER NOT NULL DEFAULT 0 CHECK(debit_paisa >= 0),
    credit_paisa INTEGER NOT NULL DEFAULT 0 CHECK(credit_paisa >= 0),
    running_balance_paisa INTEGER NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    CHECK ((debit_paisa > 0 AND credit_paisa = 0) OR (credit_paisa > 0 AND debit_paisa = 0))
);

-- ----------------------------------------------------------------------------
-- MODULE 8: RETURNS, EXCHANGES & QUARANTINE (3 TABLES)
-- ----------------------------------------------------------------------------

CREATE TABLE return_vouchers (
    return_id TEXT PRIMARY KEY NOT NULL,
    return_voucher_number TEXT UNIQUE NOT NULL,
    original_sales_invoice_id TEXT REFERENCES sales_invoices(invoice_id) ON DELETE RESTRICT,
    original_wholesale_invoice_id TEXT REFERENCES wholesale_invoices(wholesale_invoice_id) ON DELETE RESTRICT,
    invoice_type TEXT NOT NULL CHECK(invoice_type IN ('RETAIL', 'WHOLESALE')),
    customer_id TEXT REFERENCES wholesale_customers(customer_id) ON DELETE RESTRICT,
    return_type TEXT NOT NULL CHECK(return_type IN ('FULL_REFUND', 'EXCHANGE')),
    condition_status TEXT NOT NULL CHECK(condition_status IN ('UNDAMAGED_NORMAL', 'DAMAGED_RUINED')),
    total_refund_amount_paisa INTEGER NOT NULL CHECK(total_refund_amount_paisa >= 0),
    refund_settlement_method TEXT NOT NULL CHECK(refund_settlement_method IN ('CASH', 'EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER', 'CUSTOMER_CREDIT', 'EXCHANGE_OFFSET')),
    replacement_invoice_id TEXT REFERENCES sales_invoices(invoice_id) ON DELETE RESTRICT,
    exchange_price_difference_paisa INTEGER NOT NULL DEFAULT 0,
    cashier_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    terminal_id TEXT NOT NULL,
    return_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CHECK ((invoice_type = 'RETAIL' AND original_sales_invoice_id IS NOT NULL AND original_wholesale_invoice_id IS NULL) OR
           (invoice_type = 'WHOLESALE' AND original_wholesale_invoice_id IS NOT NULL AND original_sales_invoice_id IS NULL))
);

CREATE TABLE return_voucher_items (
    return_item_id TEXT PRIMARY KEY NOT NULL,
    return_id TEXT NOT NULL REFERENCES return_vouchers(return_id) ON DELETE CASCADE,
    original_retail_item_id TEXT REFERENCES sales_invoice_items(invoice_item_id) ON DELETE RESTRICT,
    original_wholesale_item_id TEXT REFERENCES wholesale_invoice_items(wholesale_item_id) ON DELETE RESTRICT,
    item_type TEXT NOT NULL CHECK(item_type IN ('PERFUME', 'ATTAR')),
    finished_product_id TEXT REFERENCES finished_products(product_id) ON DELETE RESTRICT,
    attar_id TEXT REFERENCES attar_products(attar_id) ON DELETE RESTRICT,
    quantity_returned INTEGER NOT NULL CHECK(quantity_returned > 0),
    original_unit_price_paisa INTEGER NOT NULL CHECK(original_unit_price_paisa >= 0),
    original_unit_cost_paisa INTEGER NOT NULL CHECK(original_unit_cost_paisa >= 0),
    refund_line_total_paisa INTEGER NOT NULL CHECK(refund_line_total_paisa >= 0),
    condition_notes TEXT,
    inspection_status TEXT NOT NULL CHECK(inspection_status IN ('RESTOCKED_SALEABLE', 'QUARANTINED', 'INSPECTED_SCRAP', 'INSPECTED_TESTER', 'INSPECTED_VENDOR_RETURN')),
    disposition_authorized_by_id TEXT REFERENCES users(user_id) ON DELETE RESTRICT,
    disposition_at TEXT,
    created_at TEXT NOT NULL,
    CHECK ((original_retail_item_id IS NOT NULL AND original_wholesale_item_id IS NULL) OR
           (original_retail_item_id IS NULL AND original_wholesale_item_id IS NOT NULL)),
    CHECK ((item_type = 'PERFUME' AND finished_product_id IS NOT NULL AND attar_id IS NULL) OR
           (item_type = 'ATTAR' AND attar_id IS NOT NULL AND finished_product_id IS NULL))
);

CREATE TABLE damaged_inventory_quarantine (
    quarantine_id TEXT PRIMARY KEY NOT NULL,
    return_item_id TEXT NOT NULL REFERENCES return_voucher_items(return_item_id) ON DELETE CASCADE,
    finished_product_id TEXT REFERENCES finished_products(product_id) ON DELETE RESTRICT,
    attar_id TEXT REFERENCES attar_products(attar_id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_cost_paisa INTEGER NOT NULL CHECK(unit_cost_paisa >= 0),
    damage_reason TEXT NOT NULL,
    admin_disposition TEXT CHECK(admin_disposition IN ('SCRAP_WRITE_OFF', 'CONVERT_TO_TESTER', 'RETURN_TO_SUPPLIER')),
    discretionary_refund_approved_paisa INTEGER DEFAULT 0 CHECK(discretionary_refund_approved_paisa >= 0),
    admin_notes TEXT,
    authorized_by_admin_id TEXT REFERENCES users(user_id) ON DELETE RESTRICT,
    authorized_at TEXT,
    created_at TEXT NOT NULL,
    CHECK ((finished_product_id IS NOT NULL AND attar_id IS NULL) OR
           (finished_product_id IS NULL AND attar_id IS NOT NULL))
);

-- ----------------------------------------------------------------------------
-- MODULE 11: ANALYTICS & DAILY SUMMARIES (1 TABLE)
-- ----------------------------------------------------------------------------

CREATE TABLE daily_financial_summaries (
    summary_id TEXT PRIMARY KEY NOT NULL,
    summary_date TEXT UNIQUE NOT NULL,
    total_retail_sales_paisa INTEGER NOT NULL DEFAULT 0 CHECK(total_retail_sales_paisa >= 0),
    total_wholesale_sales_paisa INTEGER NOT NULL DEFAULT 0 CHECK(total_wholesale_sales_paisa >= 0),
    total_cogs_paisa INTEGER NOT NULL DEFAULT 0 CHECK(total_cogs_paisa >= 0),
    total_gross_profit_paisa INTEGER NOT NULL DEFAULT 0,
    total_operating_expenses_paisa INTEGER NOT NULL DEFAULT 0 CHECK(total_operating_expenses_paisa >= 0),
    net_operating_profit_paisa INTEGER NOT NULL DEFAULT 0,
    cash_drawer_expected_paisa INTEGER NOT NULL DEFAULT 0 CHECK(cash_drawer_expected_paisa >= 0),
    cash_drawer_actual_paisa INTEGER NOT NULL DEFAULT 0 CHECK(cash_drawer_actual_paisa >= 0),
    cash_drawer_variance_paisa INTEGER NOT NULL DEFAULT 0,
    generated_at TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- MODULE 12: DECENTRALIZED SYNCHRONIZATION (4 TABLES)
-- ----------------------------------------------------------------------------

CREATE TABLE sync_outbox (
    event_id TEXT PRIMARY KEY NOT NULL,
    device_id TEXT NOT NULL,
    local_sequence_number INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation_type TEXT NOT NULL CHECK(operation_type IN ('INSERT', 'UPDATE', 'DELETE')),
    payload_json TEXT NOT NULL,
    is_synced INTEGER NOT NULL DEFAULT 0 CHECK(is_synced IN (0, 1)),
    created_at TEXT NOT NULL,
    UNIQUE(device_id, local_sequence_number)
);

CREATE TABLE sync_inbox_journal (
    inbox_id TEXT PRIMARY KEY NOT NULL,
    origin_device_id TEXT NOT NULL,
    origin_sequence_number INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    received_at TEXT NOT NULL,
    is_applied INTEGER NOT NULL DEFAULT 0 CHECK(is_applied IN (0, 1)),
    applied_at TEXT,
    UNIQUE(origin_device_id, origin_sequence_number)
);

CREATE TABLE sync_watermarks (
    source_device_id TEXT NOT NULL,
    target_device_id TEXT NOT NULL,
    last_replicated_sequence INTEGER NOT NULL DEFAULT 0,
    last_sync_timestamp TEXT NOT NULL,
    PRIMARY KEY (source_device_id, target_device_id)
);

CREATE TABLE sync_conflict_quarantine (
    conflict_id TEXT PRIMARY KEY NOT NULL,
    event_id TEXT NOT NULL REFERENCES sync_outbox(event_id) ON DELETE CASCADE,
    conflict_reason TEXT NOT NULL,
    local_state_snapshot TEXT NOT NULL,
    incoming_state_snapshot TEXT NOT NULL,
    resolution_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(resolution_status IN ('PENDING', 'RESOLVED_LOCAL', 'RESOLVED_INCOMING', 'RESOLVED_MANUAL')),
    resolved_by_user_id TEXT REFERENCES users(user_id) ON DELETE RESTRICT,
    resolved_at TEXT,
    created_at TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- MODULE 13: BACKUP MANAGEMENT & RESTORE AUDIT (2 TABLES)
-- ----------------------------------------------------------------------------

CREATE TABLE backup_archive_manifest (
    archive_id TEXT PRIMARY KEY NOT NULL,
    archive_name TEXT UNIQUE NOT NULL,
    backup_tier TEXT NOT NULL CHECK(backup_tier IN ('LOCAL_DAILY_FULL', 'LOCAL_HOURLY_INCREMENTAL', 'MANUAL_ON_DEMAND', 'CLOUD_ENCRYPTED_NIGHTLY')),
    sha256_checksum TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL CHECK(file_size_bytes > 0),
    is_compressed INTEGER NOT NULL DEFAULT 1 CHECK(is_compressed IN (0, 1)),
    is_encrypted INTEGER NOT NULL DEFAULT 1 CHECK(is_encrypted IN (0, 1)),
    encryption_algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
    storage_path TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('COMPLETED', 'FAILED', 'VERIFIED')),
    created_at TEXT NOT NULL
);

CREATE TABLE backup_restore_audit (
    restore_id TEXT PRIMARY KEY NOT NULL,
    archive_id TEXT NOT NULL REFERENCES backup_archive_manifest(archive_id) ON DELETE RESTRICT,
    attempted_at TEXT NOT NULL,
    target_environment TEXT NOT NULL,
    restore_status TEXT NOT NULL CHECK(restore_status IN ('IN_PROGRESS', 'SUCCESS', 'FAILED', 'CORRUPT_CHECKSUM_REJECTED', 'INTERRUPTED_ROLLED_BACK')),
    verification_errors TEXT,
    executed_by_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT
);

-- ============================================================================
-- PERFORMANCE INDEXES (ALL MODULES - EXACTLY 105 MATCHING INDEXES)
-- ============================================================================

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_name, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);

CREATE INDEX idx_coa_parent ON chart_of_accounts(parent_account_id);
CREATE INDEX idx_coa_type ON chart_of_accounts(account_type);

CREATE INDEX idx_jv_date ON journal_vouchers(voucher_date);
CREATE INDEX idx_jv_source ON journal_vouchers(source_module, source_document_id);
CREATE INDEX idx_jv_posted ON journal_vouchers(is_posted);

CREATE INDEX idx_fle_voucher ON financial_ledger_entries(voucher_id);
CREATE INDEX idx_fle_account ON financial_ledger_entries(account_id);
CREATE INDEX idx_fle_created ON financial_ledger_entries(created_at);

CREATE INDEX idx_suppliers_phone ON suppliers(phone);
CREATE INDEX idx_suppliers_active ON suppliers(is_active);

CREATE INDEX idx_raw_materials_type ON raw_materials(material_type);
CREATE INDEX idx_raw_materials_active ON raw_materials(is_active);

CREATE INDEX idx_spi_supplier ON supplier_purchase_invoices(supplier_id);
CREATE INDEX idx_spi_date ON supplier_purchase_invoices(invoice_date);

CREATE INDEX idx_spl_invoice ON supplier_purchase_lines(invoice_id);
CREATE INDEX idx_spl_material ON supplier_purchase_lines(material_id);

CREATE INDEX idx_sp_supplier ON supplier_payments(supplier_id);
CREATE INDEX idx_sp_date ON supplier_payments(payment_date);
CREATE INDEX idx_sp_invoice ON supplier_payments(purchase_invoice_id);

CREATE INDEX idx_sl_supplier ON supplier_ledger(supplier_id, transaction_timestamp);
CREATE INDEX idx_sl_ref ON supplier_ledger(reference_type, reference_id);

CREATE INDEX idx_fp_category ON finished_products(category);
CREATE INDEX idx_fp_active ON finished_products(is_active);

CREATE INDEX idx_pr_product ON perfume_recipes(finished_product_id);
CREATE INDEX idx_pri_recipe ON perfume_recipe_items(recipe_id);
CREATE INDEX idx_pri_material ON perfume_recipe_items(raw_material_id);

CREATE INDEX idx_mb_product ON manufacturing_batches(finished_product_id);
CREATE INDEX idx_mb_status ON manufacturing_batches(status);
CREATE INDEX idx_mb_date ON manufacturing_batches(production_date);

CREATE INDEX idx_mbc_batch ON manufacturing_batch_consumptions(batch_id);
CREATE INDEX idx_mbc_material ON manufacturing_batch_consumptions(raw_material_id);

CREATE INDEX idx_sm_created ON stock_movements(created_at);
CREATE INDEX idx_sm_type ON stock_movements(movement_type);
CREATE INDEX idx_sm_ref ON stock_movements(reference_document_type, reference_document_id);
CREATE INDEX idx_sm_product ON stock_movements(finished_product_id);
CREATE INDEX idx_sm_material ON stock_movements(material_id);
CREATE INDEX idx_sm_batch ON stock_movements(batch_id);

CREATE INDEX idx_srq_status ON stock_reconciliation_queue(resolution_status);
CREATE INDEX idx_srq_product ON stock_reconciliation_queue(finished_product_id);
CREATE INDEX idx_srq_invoice ON stock_reconciliation_queue(sales_invoice_id);

CREATE INDEX idx_attar_active ON attar_products(is_active);
CREATE INDEX idx_attar_name ON attar_products(name);

CREATE INDEX idx_crs_cashier ON cash_register_shifts(cashier_user_id);
CREATE INDEX idx_crs_status ON cash_register_shifts(shift_status);
CREATE INDEX idx_crs_opened ON cash_register_shifts(opened_at);

CREATE INDEX idx_csd_shift ON cash_shift_denominations(shift_id, count_type);
CREATE INDEX idx_csa_shift ON cash_shift_audit(shift_id);

CREATE INDEX idx_pe_shift ON petty_expenses(shift_id);
CREATE INDEX idx_pe_date ON petty_expenses(expense_date);
CREATE INDEX idx_pe_category ON petty_expenses(category);

CREATE INDEX idx_cm_shift ON cash_movements(shift_id);
CREATE INDEX idx_cm_type ON cash_movements(movement_type);
CREATE INDEX idx_cm_time ON cash_movements(created_at);
CREATE INDEX idx_cm_user ON cash_movements(created_by_user_id);

CREATE INDEX idx_csc_phone ON customer_store_credits(customer_phone);
CREATE INDEX idx_cscm_credit ON customer_store_credit_movements(customer_phone);
CREATE INDEX idx_cscm_time ON customer_store_credit_movements(created_at);

CREATE INDEX idx_si_date ON sales_invoices(invoice_date);
CREATE INDEX idx_si_phone ON sales_invoices(customer_phone);
CREATE INDEX idx_si_cashier ON sales_invoices(cashier_user_id);
CREATE INDEX idx_si_salesperson ON sales_invoices(salesperson_id);
CREATE INDEX idx_si_shift ON sales_invoices(shift_id);
CREATE INDEX idx_si_voided ON sales_invoices(is_voided);

CREATE INDEX idx_sii_invoice ON sales_invoice_items(invoice_id);
CREATE INDEX idx_sii_product ON sales_invoice_items(finished_product_id);
CREATE INDEX idx_sii_attar ON sales_invoice_items(attar_id);

CREATE INDEX idx_sip_invoice ON sales_invoice_payments(invoice_id);
CREATE INDEX idx_sip_method ON sales_invoice_payments(payment_method);

CREATE INDEX idx_wc_phone ON wholesale_customers(phone);
CREATE INDEX idx_wc_active ON wholesale_customers(is_active);

CREATE INDEX idx_wi_customer ON wholesale_invoices(customer_id);
CREATE INDEX idx_wi_date ON wholesale_invoices(invoice_date);
CREATE INDEX idx_wi_status ON wholesale_invoices(payment_status);
CREATE INDEX idx_wi_salesperson ON wholesale_invoices(salesperson_id);

CREATE INDEX idx_wii_invoice ON wholesale_invoice_items(wholesale_invoice_id);
CREATE INDEX idx_wii_product ON wholesale_invoice_items(finished_product_id);
CREATE INDEX idx_wii_attar ON wholesale_invoice_items(attar_id);

CREATE INDEX idx_wp_customer ON wholesale_payments(customer_id);
CREATE INDEX idx_wp_invoice ON wholesale_payments(wholesale_invoice_id);
CREATE INDEX idx_wp_date ON wholesale_payments(payment_date);

CREATE INDEX idx_wcl_customer ON wholesale_customer_ledger(customer_id, transaction_timestamp);
CREATE INDEX idx_wcl_ref ON wholesale_customer_ledger(reference_type, reference_id);

CREATE INDEX idx_rv_date ON return_vouchers(return_date);
CREATE INDEX idx_rv_sales_inv ON return_vouchers(original_sales_invoice_id);
CREATE INDEX idx_rv_wholesale_inv ON return_vouchers(original_wholesale_invoice_id);
CREATE INDEX idx_rv_type ON return_vouchers(return_type);

CREATE INDEX idx_rvi_voucher ON return_voucher_items(return_id);
CREATE INDEX idx_rvi_retail_item ON return_voucher_items(original_retail_item_id);
CREATE INDEX idx_rvi_wholesale_item ON return_voucher_items(original_wholesale_item_id);

CREATE INDEX idx_diq_status ON damaged_inventory_quarantine(admin_disposition);
CREATE INDEX idx_diq_product ON damaged_inventory_quarantine(finished_product_id);
CREATE INDEX idx_diq_attar ON damaged_inventory_quarantine(attar_id);
CREATE INDEX idx_diq_date ON damaged_inventory_quarantine(created_at);

CREATE INDEX idx_so_device_seq ON sync_outbox(device_id, local_sequence_number);
CREATE INDEX idx_so_synced ON sync_outbox(is_synced);
CREATE INDEX idx_so_entity ON sync_outbox(entity_type, entity_id);

CREATE INDEX idx_sij_device_seq ON sync_inbox_journal(origin_device_id, origin_sequence_number);
CREATE INDEX idx_sij_applied ON sync_inbox_journal(is_applied);

CREATE INDEX idx_scq_status ON sync_conflict_quarantine(resolution_status);
CREATE INDEX idx_scq_event ON sync_conflict_quarantine(event_id);

CREATE INDEX idx_bam_date ON backup_archive_manifest(created_at);
CREATE INDEX idx_bra_date ON backup_restore_audit(attempted_at);

-- ============================================================================
-- SQLITE TRIGGERS (INTEGRITY & IMMUTABILITY)
-- ============================================================================

-- 0. Owner Read-Only Role Enforcement Triggers
CREATE TRIGGER trg_verify_cashier_role_sales
BEFORE INSERT ON sales_invoices
WHEN (SELECT role FROM users WHERE user_id = NEW.cashier_user_id) = 'OWNER'
BEGIN
    SELECT RAISE(ABORT, 'SECURITY VIOLATION: Owner account is read-only and cannot record sales.');
END;

CREATE TRIGGER trg_verify_cashier_role_shift
BEFORE INSERT ON cash_register_shifts
WHEN (SELECT role FROM users WHERE user_id = NEW.cashier_user_id) = 'OWNER'
BEGIN
    SELECT RAISE(ABORT, 'SECURITY VIOLATION: Owner account is read-only and cannot open register shifts.');
END;

-- 1. Voucher Balancing Before Post
CREATE TRIGGER trg_verify_voucher_balance_before_post
BEFORE UPDATE OF is_posted ON journal_vouchers
WHEN NEW.is_posted = 1 AND OLD.is_posted = 0
BEGIN
    SELECT CASE 
        WHEN (SELECT SUM(debit_paisa) - SUM(credit_paisa) FROM financial_ledger_entries WHERE voucher_id = NEW.voucher_id) != 0
        THEN RAISE(ABORT, 'FINANCIAL VIOLATION: Cannot post unbalanced journal voucher.')
        WHEN (SELECT COUNT(*) FROM financial_ledger_entries WHERE voucher_id = NEW.voucher_id) < 2
        THEN RAISE(ABORT, 'FINANCIAL VIOLATION: Journal voucher must contain at least two entries.')
    END;
END;

CREATE TRIGGER trg_set_voucher_immutable_after_post
AFTER UPDATE OF is_posted ON journal_vouchers
WHEN NEW.is_posted = 1 AND OLD.is_posted = 0
BEGIN
    UPDATE journal_vouchers SET is_immutable = 1 WHERE voucher_id = NEW.voucher_id;
END;

-- 2. Voucher Immutability After Post
CREATE TRIGGER trg_prevent_voucher_update
BEFORE UPDATE ON journal_vouchers
WHEN OLD.is_immutable = 1
BEGIN
    SELECT RAISE(ABORT, 'CRITICAL ERROR: Finalized accounting vouchers are strictly immutable.');
END;

CREATE TRIGGER trg_prevent_voucher_delete
BEFORE DELETE ON journal_vouchers
BEGIN
    SELECT RAISE(ABORT, 'CRITICAL ERROR: Deleting accounting vouchers is strictly prohibited.');
END;

-- 3. Prevent Unposting
CREATE TRIGGER trg_prevent_unposting
BEFORE UPDATE OF is_posted ON journal_vouchers
WHEN OLD.is_posted = 1 AND NEW.is_posted = 0
BEGIN
    SELECT RAISE(ABORT, 'FINANCIAL VIOLATION: Posted vouchers cannot be unposted.');
END;

-- 4. Prevent Ledger Entries Modification on Posted Vouchers
CREATE TRIGGER trg_prevent_ledger_entry_mutation
BEFORE UPDATE ON financial_ledger_entries
WHEN (SELECT is_immutable FROM journal_vouchers WHERE voucher_id = OLD.voucher_id) = 1
BEGIN
    SELECT RAISE(ABORT, 'FINANCIAL VIOLATION: Ledger entries of posted vouchers cannot be modified.');
END;

CREATE TRIGGER trg_prevent_ledger_entry_deletion
BEFORE DELETE ON financial_ledger_entries
WHEN (SELECT is_immutable FROM journal_vouchers WHERE voucher_id = OLD.voucher_id) = 1
BEGIN
    SELECT RAISE(ABORT, 'FINANCIAL VIOLATION: Ledger entries of posted vouchers cannot be deleted.');
END;

CREATE TRIGGER trg_prevent_ledger_entry_insertion_on_posted
BEFORE INSERT ON financial_ledger_entries
WHEN (SELECT is_posted FROM journal_vouchers WHERE voucher_id = NEW.voucher_id) = 1
BEGIN
    SELECT RAISE(ABORT, 'FINANCIAL VIOLATION: Cannot add entries to an already posted voucher.');
END;

-- 5. Stock Movements Immutability
CREATE TRIGGER trg_prevent_stock_movement_mutation
BEFORE UPDATE ON stock_movements
BEGIN
    SELECT RAISE(ABORT, 'CRITICAL ERROR: Stock movements are strictly append-only.');
END;

CREATE TRIGGER trg_prevent_stock_movement_deletion
BEFORE DELETE ON stock_movements
BEGIN
    SELECT RAISE(ABORT, 'CRITICAL ERROR: Deleting stock movements is strictly prohibited.');
END;

-- 6. Anti-Over-Return Protection (Retail)
CREATE TRIGGER trg_validate_retail_return_quantity
BEFORE INSERT ON return_voucher_items
WHEN NEW.original_retail_item_id IS NOT NULL
BEGIN
    SELECT CASE 
        WHEN (SELECT (returned_quantity + NEW.quantity_returned) > quantity 
              FROM sales_invoice_items WHERE invoice_item_id = NEW.original_retail_item_id)
        THEN RAISE(ABORT, 'FRAUD VIOLATION: Cannot return more quantity than purchased on retail invoice line.')
        WHEN (SELECT is_voided FROM sales_invoices WHERE invoice_id = (SELECT invoice_id FROM sales_invoice_items WHERE invoice_item_id = NEW.original_retail_item_id)) = 1
        THEN RAISE(ABORT, 'FRAUD VIOLATION: Cannot return against a voided invoice.')
    END;
END;

CREATE TRIGGER trg_update_retail_returned_quantity
AFTER INSERT ON return_voucher_items
WHEN NEW.original_retail_item_id IS NOT NULL
BEGIN
    UPDATE sales_invoice_items 
    SET returned_quantity = returned_quantity + NEW.quantity_returned
    WHERE invoice_item_id = NEW.original_retail_item_id;
END;

-- 7. Anti-Over-Return Protection (Wholesale)
CREATE TRIGGER trg_validate_wholesale_return_quantity
BEFORE INSERT ON return_voucher_items
WHEN NEW.original_wholesale_item_id IS NOT NULL
BEGIN
    SELECT CASE 
        WHEN (SELECT (returned_quantity + NEW.quantity_returned) > quantity 
              FROM wholesale_invoice_items WHERE wholesale_item_id = NEW.original_wholesale_item_id)
        THEN RAISE(ABORT, 'FRAUD VIOLATION: Cannot return more quantity than purchased on wholesale invoice line.')
        WHEN (SELECT is_voided FROM wholesale_invoices WHERE wholesale_invoice_id = (SELECT wholesale_invoice_id FROM wholesale_invoice_items WHERE wholesale_item_id = NEW.original_wholesale_item_id)) = 1
        THEN RAISE(ABORT, 'FRAUD VIOLATION: Cannot return against a voided invoice.')
    END;
END;

CREATE TRIGGER trg_update_wholesale_returned_quantity
AFTER INSERT ON return_voucher_items
WHEN NEW.original_wholesale_item_id IS NOT NULL
BEGIN
    UPDATE wholesale_invoice_items 
    SET returned_quantity = returned_quantity + NEW.quantity_returned
    WHERE wholesale_item_id = NEW.original_wholesale_item_id;
END;
"#;
