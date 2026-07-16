-- Destructive ERP reset + construction-material demo data.
-- Intentionally does not touch architecture portfolio tables:
--   arch_clients, arch_projects, arch_project_media, arch_inquiries.

begin;

truncate table
  public.payment_allocations,
  public.payments,
  public.sale_items,
  public.sales,
  public.purchase_items,
  public.purchases,
  public.stock_movements,
  public.products,
  public.contacts,
  public.idempotency_keys
restart identity cascade;

alter sequence public.sale_number_seq restart with 1;
alter sequence public.purchase_number_seq restart with 1;
alter sequence public.payment_number_seq restart with 1;

insert into public.contacts (
  id, name, phone, address, contact_type, opening_balance,
  opening_balance_date, notes, is_active, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'Walk-in Customer',
    null,
    null,
    'walk_in',
    0,
    current_date,
    null,
    true,
    current_date + time '08:00',
    current_date + time '08:00'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    'Ramesh Ji Construction Site',
    '9876543210',
    'Ward No. 20, Near Aadhar Super Market, Bidasar',
    'customer',
    1000,
    current_date,
    'Demo customer for ERP math checks',
    true,
    current_date + time '08:00',
    current_date + time '08:00'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Shree Balaji Building Suppliers',
    '9829012345',
    'Industrial Area, Sujangarh Road, Bidasar',
    'supplier',
    2000,
    current_date,
    'Demo supplier for ERP math checks',
    true,
    current_date + time '08:00',
    current_date + time '08:00'
  );

insert into public.products (
  id, name, sku, unit_name, loose_sale_price, loose_cost_price,
  has_box, box_units, box_sale_price, box_cost_price,
  stock_on_hand, reorder_level, is_active
)
values
  ('30000000-0000-4000-8000-000000000001', 'UltraTech PPC Cement 50kg', 'CEMENT-PPC-50', 'bag', 410, 365, false, null, null, null, 137, 30, true),
  ('30000000-0000-4000-8000-000000000002', 'Ambuja OPC Cement 50kg', 'CEMENT-OPC-50', 'bag', 430, 382, false, null, null, null, 90, 25, true),
  ('30000000-0000-4000-8000-000000000003', 'TMT Steel Bar 12mm', 'TMT-12MM', 'piece', 620, 555, false, null, null, null, 80, 20, true),
  ('30000000-0000-4000-8000-000000000004', 'Red Clay Brick', 'BRICK-RED', 'piece', 9, 7, false, null, null, null, 4900, 1000, true),
  ('30000000-0000-4000-8000-000000000005', 'River Sand 50kg Bag', 'SAND-RIVER-50', 'bag', 75, 58, false, null, null, null, 300, 75, true),
  ('30000000-0000-4000-8000-000000000006', '20mm Aggregate Bag', 'AGG-20MM-50', 'bag', 85, 66, false, null, null, null, 260, 60, true),
  ('30000000-0000-4000-8000-000000000007', 'Tile Adhesive 20kg', 'TILE-ADH-20', 'bag', 380, 315, false, null, null, null, 75, 20, true),
  ('30000000-0000-4000-8000-000000000008', 'Wall Putty 40kg', 'PUTTY-40', 'bag', 820, 710, false, null, null, null, 45, 12, true),
  ('30000000-0000-4000-8000-000000000009', 'PVC Pipe 3/4 inch', 'PVC-PIPE-075', 'piece', 110, 85, true, 25, 2650, 2100, 300, 50, true),
  ('30000000-0000-4000-8000-000000000010', 'CPVC Elbow 3/4 inch', 'CPVC-ELBOW-075', 'piece', 28, 18, true, 50, 1250, 850, 500, 100, true),
  ('30000000-0000-4000-8000-000000000011', 'Exterior Primer 20L', 'PRIMER-EXT-20', 'bucket', 2650, 2200, false, null, null, null, 20, 6, true),
  ('30000000-0000-4000-8000-000000000012', 'Waterproofing Chemical 20L', 'WATERPROOF-20', 'can', 3250, 2750, false, null, null, null, 18, 5, true);

insert into public.stock_movements (
  product_id, movement_type, quantity_delta, reason, stock_before, stock_after
)
values
  ('30000000-0000-4000-8000-000000000001', 'opening', 120, 'demo opening stock', 0, 120),
  ('30000000-0000-4000-8000-000000000002', 'opening', 90, 'demo opening stock', 0, 90),
  ('30000000-0000-4000-8000-000000000003', 'opening', 80, 'demo opening stock', 0, 80),
  ('30000000-0000-4000-8000-000000000004', 'opening', 5000, 'demo opening stock', 0, 5000),
  ('30000000-0000-4000-8000-000000000005', 'opening', 300, 'demo opening stock', 0, 300),
  ('30000000-0000-4000-8000-000000000006', 'opening', 260, 'demo opening stock', 0, 260),
  ('30000000-0000-4000-8000-000000000007', 'opening', 75, 'demo opening stock', 0, 75),
  ('30000000-0000-4000-8000-000000000008', 'opening', 45, 'demo opening stock', 0, 45),
  ('30000000-0000-4000-8000-000000000009', 'opening', 250, 'demo opening stock', 0, 250),
  ('30000000-0000-4000-8000-000000000010', 'opening', 500, 'demo opening stock', 0, 500),
  ('30000000-0000-4000-8000-000000000011', 'opening', 20, 'demo opening stock', 0, 20),
  ('30000000-0000-4000-8000-000000000012', 'opening', 18, 'demo opening stock', 0, 18);

insert into public.sales (
  id, sale_number, customer_id, sale_date, status, subtotal,
  discount_amount, total_amount, notes, finalized_at
  , created_at, updated_at
)
values (
  '40000000-0000-4000-8000-000000000001',
  'INV-' || lpad(nextval('public.sale_number_seq')::text, 6, '0'),
  '11111111-1111-4111-8111-111111111111',
  current_date,
  'finalized',
  2130,
  30,
  2100,
  'Demo sale: partial customer payment',
  current_date + time '10:00',
  current_date + time '10:00',
  current_date + time '10:00'
);

insert into public.sale_items (
  id, sale_id, product_id, product_name_snapshot, entry_mode,
  entered_quantity, base_units_per_entry, base_quantity,
  price_per_entry, line_total, cost_total_snapshot
)
values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'UltraTech PPC Cement 50kg', 'loose', 3, 1, 3, 410, 1230, 1095),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004', 'Red Clay Brick', 'loose', 100, 1, 100, 9, 900, 700);

insert into public.stock_movements (
  product_id, movement_type, quantity_delta, sale_item_id, reason, stock_before, stock_after
)
values
  ('30000000-0000-4000-8000-000000000001', 'sale', -3, '41000000-0000-4000-8000-000000000001', 'demo sale INV-000001', 120, 117),
  ('30000000-0000-4000-8000-000000000004', 'sale', -100, '41000000-0000-4000-8000-000000000002', 'demo sale INV-000001', 5000, 4900);

insert into public.purchases (
  id, purchase_number, supplier_id, supplier_invoice_number, purchase_date,
  status, subtotal, discount_amount, additional_cost, total_amount,
  notes, finalized_at
  , created_at, updated_at
)
values (
  '50000000-0000-4000-8000-000000000001',
  'PUR-' || lpad(nextval('public.purchase_number_seq')::text, 6, '0'),
  '22222222-2222-4222-8222-222222222222',
  'BALAJI-DEMO-001',
  current_date,
  'finalized',
  11200,
  200,
  100,
  11100,
  'Demo purchase: partial supplier payment',
  current_date + time '10:30',
  current_date + time '10:30',
  current_date + time '10:30'
);

insert into public.purchase_items (
  id, purchase_id, product_id, product_name_snapshot, entry_mode,
  entered_quantity, base_units_per_entry, base_quantity, cost_per_entry, line_total
)
values
  ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'UltraTech PPC Cement 50kg', 'loose', 20, 1, 20, 350, 7000),
  ('51000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000009', 'PVC Pipe 3/4 inch', 'box', 2, 25, 50, 2100, 4200);

insert into public.stock_movements (
  product_id, movement_type, quantity_delta, purchase_item_id, reason, stock_before, stock_after
)
values
  ('30000000-0000-4000-8000-000000000001', 'purchase', 20, '51000000-0000-4000-8000-000000000001', 'demo purchase PUR-000001', 117, 137),
  ('30000000-0000-4000-8000-000000000009', 'purchase', 50, '51000000-0000-4000-8000-000000000002', 'demo purchase PUR-000001', 250, 300);

insert into public.payments (
  id, payment_number, contact_id, direction, amount, payment_method, reference_number, notes, created_at
)
values
  ('60000000-0000-4000-8000-000000000001', 'PAY-' || lpad(nextval('public.payment_number_seq')::text, 6, '0'), '11111111-1111-4111-8111-111111111111', 'in', 600, 'cash', 'CASH-DEMO-001', 'Initial customer payment on demo invoice', current_date + time '11:00'),
  ('60000000-0000-4000-8000-000000000002', 'PAY-' || lpad(nextval('public.payment_number_seq')::text, 6, '0'), '11111111-1111-4111-8111-111111111111', 'in', 400, 'upi', 'UPI-DEMO-002', 'Later customer payment on demo invoice', current_date + time '12:00'),
  ('60000000-0000-4000-8000-000000000003', 'PAY-' || lpad(nextval('public.payment_number_seq')::text, 6, '0'), '22222222-2222-4222-8222-222222222222', 'out', 5000, 'bank', 'BANK-DEMO-003', 'Initial supplier payment on demo purchase', current_date + time '11:30'),
  ('60000000-0000-4000-8000-000000000004', 'PAY-' || lpad(nextval('public.payment_number_seq')::text, 6, '0'), '22222222-2222-4222-8222-222222222222', 'out', 1000, 'upi', 'UPI-DEMO-004', 'Later supplier payment on demo purchase', current_date + time '12:30');

insert into public.payment_allocations (
  payment_id, sale_id, purchase_id, allocated_amount
)
values
  ('60000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', null, 600),
  ('60000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', null, 400),
  ('60000000-0000-4000-8000-000000000003', null, '50000000-0000-4000-8000-000000000001', 5000),
  ('60000000-0000-4000-8000-000000000004', null, '50000000-0000-4000-8000-000000000001', 1000);

do $$
declare
  v_product_count integer;
  v_arch_count integer;
  v_sale_due numeric;
  v_purchase_due numeric;
  v_customer_balance numeric;
  v_supplier_balance numeric;
  v_stock_mismatches integer;
begin
  select count(*) into v_product_count from public.products;
  if v_product_count <> 12 then
    raise exception 'expected 12 construction products, got %', v_product_count;
  end if;

  if to_regclass('public.arch_projects') is not null then
    select count(*) into v_arch_count from public.arch_projects;
    if v_arch_count is null then
      raise exception 'arch project table check failed';
    end if;
  end if;

  select due_amount into v_sale_due
  from public.sale_balances
  where sale_id = '40000000-0000-4000-8000-000000000001';
  if v_sale_due <> 1100 then
    raise exception 'expected demo sale due 1100, got %', v_sale_due;
  end if;

  select due_amount into v_purchase_due
  from public.purchase_balances
  where purchase_id = '50000000-0000-4000-8000-000000000001';
  if v_purchase_due <> 5100 then
    raise exception 'expected demo purchase due 5100, got %', v_purchase_due;
  end if;

  select customer_balance into v_customer_balance
  from public.contact_balances
  where contact_id = '11111111-1111-4111-8111-111111111111';
  if v_customer_balance <> 2100 then
    raise exception 'expected demo customer balance 2100, got %', v_customer_balance;
  end if;

  select supplier_balance into v_supplier_balance
  from public.contact_balances
  where contact_id = '22222222-2222-4222-8222-222222222222';
  if v_supplier_balance <> 7100 then
    raise exception 'expected demo supplier balance 7100, got %', v_supplier_balance;
  end if;

  select count(*) into v_stock_mismatches
  from public.stock_reconciliation
  where is_mismatch;
  if v_stock_mismatches <> 0 then
    raise exception 'expected no stock mismatches, got %', v_stock_mismatches;
  end if;
end $$;

commit;
