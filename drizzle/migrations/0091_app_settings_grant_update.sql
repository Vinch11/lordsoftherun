-- 0090 granted SELECT on app_settings to authenticated but forgot UPDATE —
-- Postgres rejects the UPDATE at the privilege level before RLS even gets
-- a chance to evaluate public.is_admin(), so the toggle failed for every
-- admin, not just before the table synced. Table-level grants and RLS
-- policies are both required here (see profiles, which needed the same
-- fix in 0010/0011): the grant says who may attempt the statement at all,
-- the policy says which rows it actually affects.
GRANT UPDATE ON public.app_settings TO authenticated;
