-- Destructive ERP-only reset.
-- Intentionally does not touch architecture portfolio production tables:
--   arch_clients, arch_projects, arch_project_media, arch_inquiries.
-- Also leaves shop_settings and idempotency_keys intact.

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
  public.contacts
restart identity cascade;

alter sequence public.sale_number_seq restart with 1;
alter sequence public.purchase_number_seq restart with 1;
alter sequence public.payment_number_seq restart with 1;

do $$
declare
  v_erp_count integer;
  v_arch_clients integer;
  v_arch_projects integer;
  v_arch_media integer;
  v_arch_inquiries integer;
begin
  select
    (select count(*) from public.contacts)
    + (select count(*) from public.products)
    + (select count(*) from public.sales)
    + (select count(*) from public.sale_items)
    + (select count(*) from public.purchases)
    + (select count(*) from public.purchase_items)
    + (select count(*) from public.payments)
    + (select count(*) from public.payment_allocations)
    + (select count(*) from public.stock_movements)
  into v_erp_count;

  if v_erp_count <> 0 then
    raise exception 'ERP reset failed; remaining ERP rows: %', v_erp_count;
  end if;

  if to_regclass('public.arch_clients') is not null then
    select count(*) into v_arch_clients from public.arch_clients;
    if v_arch_clients is null then
      raise exception 'arch_clients check failed';
    end if;
  end if;

  if to_regclass('public.arch_projects') is not null then
    select count(*) into v_arch_projects from public.arch_projects;
    if v_arch_projects is null then
      raise exception 'arch_projects check failed';
    end if;
  end if;

  if to_regclass('public.arch_project_media') is not null then
    select count(*) into v_arch_media from public.arch_project_media;
    if v_arch_media is null then
      raise exception 'arch_project_media check failed';
    end if;
  end if;

  if to_regclass('public.arch_inquiries') is not null then
    select count(*) into v_arch_inquiries from public.arch_inquiries;
    if v_arch_inquiries is null then
      raise exception 'arch_inquiries check failed';
    end if;
  end if;
end $$;

commit;
