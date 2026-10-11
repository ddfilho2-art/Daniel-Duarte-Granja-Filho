-- Lote 12: relatório macro que distingue itens faturáveis, rascunho e faturados.
-- Migration versionada; não aplicar ao Supabase remoto sem autorização.

begin;

create or replace function public.get_occupational_health_billing_macro_report_v2(
  p_clinic_tenant_id uuid, p_period_start date, p_period_end date
) returns table(
  contract_id uuid,
  employer_tenant_id uuid,
  contract_status public.medical_contract_status,
  admission_referrals integer,
  admission_exams_performed integer,
  complementary_requested integer,
  complementary_scheduled integer,
  complementary_performed integer,
  billable_items integer,
  draft_items integer,
  billed_items integer,
  draft_amount numeric,
  billed_amount numeric,
  adjustments_amount numeric,
  amount_with_adjustments numeric,
  draft_cycles integer,
  closed_cycles integer,
  issued_cycles integer,
  paid_cycles integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if p_period_start is null or p_period_end is null or p_period_end <= p_period_start then
    raise exception using errcode = '22023', message = 'invalid_report_period';
  end if;

  if auth.uid() is null or not exists (
    select 1
    from public.tenant_memberships tm
    join public.tenants t on t.id = tm.tenant_id
    where tm.tenant_id = p_clinic_tenant_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
      and t.status = 'active'
      and t.kind = 'occupational_health_provider'
      and tm.roles && array['clinic_admin'::public.tenant_role]
  ) then
    raise exception using errcode = '42501', message = 'clinic_admin_required_for_billing_report';
  end if;

  return query
  select c.id, c.employer_tenant_id, c.status,
    coalesce(adm.referrals, 0)::integer,
    coalesce(adm.performed, 0)::integer,
    coalesce(comp.requested, 0)::integer,
    coalesce(comp.scheduled, 0)::integer,
    coalesce(comp.performed, 0)::integer,
    coalesce(bill.billable_count, 0)::integer,
    coalesce(bill.draft_count, 0)::integer,
    coalesce(bill.billed_count, 0)::integer,
    coalesce(bill.draft_amount, 0)::numeric,
    coalesce(bill.billed_amount, 0)::numeric,
    coalesce(adj.amount, 0)::numeric,
    (coalesce(bill.billed_amount, 0) + coalesce(adj.amount, 0))::numeric,
    coalesce(cycles.draft_count, 0)::integer,
    coalesce(cycles.closed_count, 0)::integer,
    coalesce(cycles.issued_count, 0)::integer,
    coalesce(cycles.paid_count, 0)::integer
  from public.occupational_health_contracts c
  left join lateral (
    select
      count(*) filter (where r.referred_at::date >= p_period_start and r.referred_at::date < p_period_end) as referrals,
      count(*) filter (
        where r.status in ('attended', 'result_reported', 'completed')
          and coalesce(r.completed_at, r.result_reported_at, r.referred_at)::date >= p_period_start
          and coalesce(r.completed_at, r.result_reported_at, r.referred_at)::date < p_period_end
      ) as performed
    from public.medical_referrals r
    where r.contract_id = c.id and r.exam_type = 'admission' and r.status <> 'cancelled'
  ) adm on true
  left join lateral (
    select
      count(*) filter (where e.requested_at::date >= p_period_start and e.requested_at::date < p_period_end) as requested,
      count(*) filter (where e.status = 'scheduled' and e.scheduled_for::date >= p_period_start and e.scheduled_for::date < p_period_end) as scheduled,
      count(*) filter (where e.status = 'performed' and e.performed_at::date >= p_period_start and e.performed_at::date < p_period_end) as performed
    from public.medical_referral_complementary_exams e
    where e.clinic_tenant_id = p_clinic_tenant_id
      and exists (
        select 1 from public.medical_referrals r
        where r.id = e.referral_id and r.contract_id = c.id
      )
  ) comp on true
  left join lateral (
    select
      count(*) filter (where i.status <> 'reversed') as billable_count,
      count(*) filter (where i.status = 'draft') as draft_count,
      count(*) filter (where i.status = 'included') as billed_count,
      sum(i.amount) filter (where i.status = 'draft') as draft_amount,
      sum(i.amount) filter (where i.status = 'included') as billed_amount
    from public.occupational_health_billing_items i
    join public.occupational_health_billing_cycles bc on bc.id = i.billing_cycle_id
    where bc.contract_id = c.id
      and i.service_date >= p_period_start and i.service_date < p_period_end
  ) bill on true
  left join lateral (
    select sum(a.amount) as amount
    from public.occupational_health_billing_adjustments a
    join public.occupational_health_billing_cycles bc on bc.id = a.billing_cycle_id
    where bc.contract_id = c.id
      and a.created_at::date >= p_period_start and a.created_at::date < p_period_end
  ) adj on true
  left join lateral (
    select
      count(*) filter (where bc.status = 'draft') as draft_count,
      count(*) filter (where bc.status = 'closed') as closed_count,
      count(*) filter (where bc.status = 'issued') as issued_count,
      count(*) filter (where bc.status = 'paid') as paid_count
    from public.occupational_health_billing_cycles bc
    where bc.contract_id = c.id
      and bc.period_start < p_period_end and bc.period_end > p_period_start
  ) cycles on true
  where c.clinic_tenant_id = p_clinic_tenant_id
  order by c.employer_tenant_id, c.id;
end;
$function$;

revoke all on function public.get_occupational_health_billing_macro_report_v2(uuid,date,date) from public, anon;
grant execute on function public.get_occupational_health_billing_macro_report_v2(uuid,date,date) to authenticated;

commit;
