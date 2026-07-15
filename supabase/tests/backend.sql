\set ON_ERROR_STOP on

begin;

create or replace function public.test_assert(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'test failed: %', p_message;
  end if;
end;
$$;

create or replace function public.test_expect_error(p_sql text, p_message text)
returns void
language plpgsql
as $$
begin
  execute p_sql;
  raise exception 'test failed: expected error for %', p_message;
exception
  when others then
    if sqlerrm like 'test failed:%' then
      raise;
    end if;
end;
$$;

do $$
declare
  v_customer uuid;
  v_supplier uuid;
  v_product uuid;
  v_sale uuid;
  v_sale2 uuid;
  v_item uuid;
  v_purchase uuid;
  v_payment uuid;
  v_advance uuid;
  v_reverse uuid;
  v_arch_client uuid;
  v_arch_project uuid;
  v_arch_media uuid;
  v_arch_second_media uuid;
  v_replay jsonb;
  v_version integer;
  v_stock integer;
  v_due numeric;
  v_test_date date := date '2040-01-01';
begin
  perform public.test_expect_error(
    $sql$insert into public.contacts(name, contact_type) values ('Bad Type', 'vendor')$sql$,
    'bad contact enum'
  );
  perform public.test_expect_error(
    $sql$insert into public.products(name, loose_sale_price, loose_cost_price, has_box, box_units, box_sale_price, box_cost_price) values ('Bad Box', 1, 1, true, null, 10, 8)$sql$,
    'box fields required'
  );
  perform public.test_expect_error(
    $sql$insert into public.products(name, loose_sale_price, loose_cost_price, stock_on_hand) values ('Negative Stock', 1, 1, -1)$sql$,
    'negative stock'
  );

  v_arch_client := (public.create_arch_client('t-arch-client', jsonb_build_object(
    'name', 'Architecture Client',
    'phone', '97777'
  )) ->> 'id')::uuid;

  v_arch_project := (public.create_arch_project('t-arch-project', jsonb_build_object(
    'client_id', v_arch_client,
    'project_type', 'residential',
    'location', 'Jaipur',
    'description', 'Internal project note',
    'is_public', true,
    'is_featured', true,
    'slug', 'test-residence-jaipur',
    'sort_order', 1,
    'public_title', 'Test Residence',
    'public_description', 'Public portfolio copy'
  )) ->> 'id')::uuid;

  v_arch_media := (public.create_arch_project_media('t-arch-media-cover', v_arch_project, jsonb_build_object(
    'file_path', 'tests/test-residence-cover.webp',
    'caption', 'Cover image',
    'phase', 'after',
    'is_public', true,
    'is_cover', true,
    'sort_order', 0
  )) ->> 'id')::uuid;

  v_arch_second_media := (public.create_arch_project_media('t-arch-media-second', v_arch_project, jsonb_build_object(
    'file_path', 'tests/test-residence-before.webp',
    'caption', 'Before image',
    'phase', 'before',
    'is_public', false,
    'is_cover', true,
    'sort_order', 1
  )) ->> 'id')::uuid;

  perform public.test_assert(
    (select count(*) from public.arch_project_media where project_id = v_arch_project and is_cover) = 1,
    'portfolio keeps one cover image per project'
  );
  perform public.reorder_arch_project_media('t-arch-media-reorder', v_arch_project, array[v_arch_second_media, v_arch_media]);
  perform public.test_assert(
    (select sort_order from public.arch_project_media where id = v_arch_second_media) = 0,
    'portfolio media reorder updates sort order'
  );
  perform public.test_assert(
    exists (
      select 1
      from public.list_public_arch_projects()
      where slug = 'test-residence-jaipur'
        and cover_file_path = 'tests/test-residence-cover.webp'
    ),
    'public portfolio list exposes public project and public cover'
  );
  perform public.test_assert(
    jsonb_array_length(public.get_public_arch_project('test-residence-jaipur') -> 'media') = 1,
    'public portfolio detail hides private media'
  );
  perform public.update_arch_project('t-arch-project-unpublish', v_arch_project, jsonb_build_object('is_public', false));
  perform public.test_assert(
    not exists (select 1 from public.list_public_arch_projects() where slug = 'test-residence-jaipur'),
    'unpublished portfolio project leaves public listing'
  );
  perform public.delete_arch_project('t-arch-project-delete', v_arch_project);
  perform public.delete_arch_client('t-arch-client-delete', v_arch_client);

  v_customer := (public.create_contact('t-contact-customer', jsonb_build_object(
    'name', 'Ramesh Customer',
    'phone', '99999',
    'contact_type', 'customer',
    'opening_balance', 0
  )) ->> 'id')::uuid;

  v_supplier := (public.create_contact('t-contact-supplier', jsonb_build_object(
    'name', 'Sharma Supplier',
    'phone', '88888',
    'contact_type', 'supplier',
    'opening_balance', 0
  )) ->> 'id')::uuid;

  v_product := (public.create_product('t-product', jsonb_build_object(
    'name', 'Parle-G',
    'sku', 'PG',
    'unit_name', 'piece',
    'loose_sale_price', 12,
    'loose_cost_price', 8,
    'has_box', true,
    'box_units', 24,
    'box_sale_price', 260,
    'box_cost_price', 200,
    'opening_stock', 100,
    'reorder_level', 10
  )) ->> 'id')::uuid;

  perform public.test_assert((select stock_on_hand from public.products where id = v_product) = 100, 'opening stock cached');
  perform public.test_assert((select count(*) from public.stock_movements where product_id = v_product and movement_type = 'opening') = 1, 'opening stock movement');

  v_sale := (public.create_draft_sale('t-sale-draft', jsonb_build_object('customer_id', v_customer, 'sale_date', v_test_date)) ->> 'id')::uuid;
  perform public.add_sale_item('t-sale-item-loose', v_sale, v_product, 'loose', 2, null);
  perform public.add_sale_item('t-sale-item-box', v_sale, v_product, 'box', 1, null);
  perform public.finalize_sale('t-sale-finalize', v_sale, 0, null);

  perform public.test_assert((select status from public.sales where id = v_sale) = 'finalized', 'sale finalized');
  perform public.test_assert((select total_amount from public.sales where id = v_sale) = 284, 'sale total from loose and box lines');
  perform public.test_assert((select stock_on_hand from public.products where id = v_product) = 74, 'sale stock decrement');
  perform public.test_assert((select count(*) from public.stock_movements where movement_type = 'sale' and product_id = v_product) = 2, 'sale stock movements');
  perform public.test_assert((select due_amount from public.sale_balances where sale_id = v_sale) = 284, 'sale due before payment');

  v_sale2 := (public.create_draft_sale('t-sale2-draft', jsonb_build_object('customer_id', v_customer, 'sale_date', v_test_date)) ->> 'id')::uuid;
  perform public.add_sale_item('t-sale2-item', v_sale2, v_product, 'loose', 5, null);
  perform public.finalize_sale('t-sale2-finalize', v_sale2, 0, null);

  v_payment := (public.record_payment('t-payment-partial', jsonb_build_object(
    'contact_id', v_customer,
    'direction', 'in',
    'amount', 300,
    'payment_method', 'cash',
    'payment_date', v_test_date,
    'auto_allocate', true
  )) ->> 'id')::uuid;

  perform public.test_assert((select paid_amount from public.sale_balances where sale_id = v_sale) = 284, 'first sale fully paid by auto allocation');
  perform public.test_assert((select paid_amount from public.sale_balances where sale_id = v_sale2) = 16, 'second sale partially paid by same payment');
  perform public.test_assert((select payment_status from public.sale_balances where sale_id = v_sale2) = 'Partially paid', 'partial status');
  perform public.test_assert((select received_amount from public.daily_payment_totals where payment_date = v_test_date and payment_method = 'cash') = 300, 'daily cash received computed');

  v_advance := (public.record_payment('t-payment-advance', jsonb_build_object(
    'contact_id', v_customer,
    'direction', 'in',
    'amount', 50,
    'payment_method', 'upi',
    'payment_date', v_test_date,
    'auto_allocate', false
  )) ->> 'id')::uuid;
  perform public.allocate_payment('t-advance-allocate', v_advance, v_sale2, null, 44);
  perform public.test_assert((select due_amount from public.sale_balances where sale_id = v_sale2) = 0, 'advance applied later');
  perform public.test_assert((select received_amount from public.daily_payment_totals where payment_date = v_test_date and payment_method = 'upi') = 50, 'daily UPI received computed');

  v_reverse := (public.reverse_payment('t-reverse-payment', v_advance, 'wrong advance') ->> 'id')::uuid;
  perform public.test_assert((select reversed_payment_id from public.payments where id = v_reverse) = v_advance, 'reversal payment linked');
  perform public.test_assert((select due_amount from public.sale_balances where sale_id = v_sale2) = 44, 'reversal restores due');
  perform public.test_assert((select sum(case when direction = 'in' then amount else -amount end) from public.payments where id in (v_advance, v_reverse)) = 0, 'UPI reversal nets original payment to zero');
  perform public.test_assert((
    select running_balance
    from public.contact_statement(v_customer)
    order by entry_date desc, entry_type desc, reference_id desc
    limit 1
  ) = 44, 'contact statement running balance computed from underlying records');

  perform public.test_expect_error(
    format($fmt$select public.cancel_sale('t-cancel-paid-sale', '%s', 'paid sale should fail')$fmt$, v_sale),
    'cancel sale with allocations rejected'
  );

  perform public.reverse_payment('t-reverse-partial-payment', v_payment, 'cancel related payment');
  perform public.cancel_sale('t-cancel-sale-after-reversal', v_sale, 'customer returned all items');
  perform public.test_assert((select status from public.sales where id = v_sale) = 'cancelled', 'sale cancelled after payment reversal');
  perform public.test_assert((select stock_on_hand from public.products where id = v_product) = 95, 'sale cancellation restored only the cancelled sale stock');

  v_purchase := (public.create_draft_purchase('t-purchase-draft', jsonb_build_object(
    'supplier_id', v_supplier,
    'supplier_invoice_number', 'SUP-1',
    'purchase_date', v_test_date
  )) ->> 'id')::uuid;
  perform public.add_purchase_item('t-purchase-item', v_purchase, v_product, 'box', 2, 210);
  perform public.finalize_purchase('t-purchase-finalize', v_purchase, 0, 0, null, true);
  perform public.test_assert((select stock_on_hand from public.products where id = v_product) = 143, 'purchase increments stock');
  perform public.test_assert((select due_amount from public.purchase_balances where purchase_id = v_purchase) = 420, 'supplier purchase due');

  perform public.correct_stock('t-correct-stock-down', v_product, 10, 'simulate sold stock before purchase cancellation');
  perform public.test_expect_error(
    format($fmt$select public.cancel_purchase('t-cancel-purchase-negative', '%s', 'cannot reverse')$fmt$, v_purchase),
    'purchase cancellation rejected when stock would go negative'
  );
  perform public.correct_stock('t-correct-stock-up', v_product, 143, 'restore for cancellation');
  perform public.cancel_purchase('t-cancel-purchase-safe', v_purchase, 'supplier bill void');
  perform public.test_assert((select status from public.purchases where id = v_purchase) = 'cancelled', 'purchase cancellation accepted when safe');

  select version into v_version from public.products where id = v_product;
  perform public.update_product('t-version-update-ok', v_product, v_version, jsonb_build_object('loose_sale_price', 13));
  perform public.test_expect_error(
    format($fmt$select public.update_product('t-version-update-stale', '%s', %s, '{"loose_sale_price":14}'::jsonb)$fmt$, v_product, v_version),
    'stale version rejected'
  );

  v_replay := public.finalize_sale('t-sale2-finalize', v_sale2, 0, null);
  perform public.test_assert((v_replay ->> 'idempotent_replay')::boolean, 'same finalize key returns replay');
  perform public.test_expect_error(
    format($fmt$select public.finalize_sale('t-sale2-finalize', '%s', 1, null)$fmt$, v_sale2),
    'same idempotency key with different payload rejected'
  );

  perform public.test_assert((select count(*) from public.reconcile_stock()) = 0, 'stock reconciles after mixed operations');
end;
$$;

drop function public.test_expect_error(text, text);
drop function public.test_assert(boolean, text);

rollback;
