-- =====================================================================
-- Patrimoine.ma — schéma Postgres pour Supabase
-- =====================================================================
--
-- BUT
--   Base de données cible de l'application de suivi de portefeuille
--   (actions Bourse de Casablanca + OPCVM, devise MAD), consommée par
--   `src/data/provider/supabase.ts` (SupabaseDataProvider).
--
-- AVERTISSEMENT
--   - Données financières personnelles : testez d'abord sur un projet
--     de développement ; vérifiez les politiques RLS avant toute mise en
--     production.
--   - Les taux fiscaux ne sont PAS stockés en dur ici : ils vivent dans
--     `profiles.settings` (JSONB) et sont modifiables par l'utilisateur.
--
-- EXÉCUTION
--   1. Ouvrir le Dashboard Supabase → votre projet → SQL Editor.
--   2. Coller l'intégralité de ce fichier et exécuter (idempotent :
--      tous les objets utilisent CREATE ... IF NOT EXISTS / OR REPLACE).
--   3. Rien à faire côté rôles : Supabase accorde déjà l'USAGE du schéma
--      `public` aux rôles `anon` / `authenticated` ; c'est le Row Level
--      Security (RLS) qui cloisonne réellement les données par utilisateur.
--
-- CONVENTIONS
--   - snake_case partout (mapping camelCase ↔ snake_case assuré par le
--     provider, voir `toRow` / `mapTx` dans supabase.ts).
--   - `user_id` = propriétaire de la ligne (= auth.uid() pour les writes).
--   - Dates en `date`, horodatages en `timestamptz`.
--
-- TABLE DES MATIÈRES
--   1.  Functions utilitaires (set_updated_at, auth helpers)
--   2.  Table profiles (+ trigger création à l'inscription)
--   3.  Table portfolios
--   4.  Table instruments (ACTION / OPCVM)
--   5.  Table prices (cours & VL, PK instrument_id + date)
--   6.  Table transactions (journal des opérations)
--   7.  Table dividends
--   8.  Table alerts / watchlists
--   9.  Table corporate_events
--   10. Tables indices / index_prices
--   11. Table audit_log (insert-only côté utilisateur) + trigger d'audit
--   12. Vue v_latest_quotes (dernier cours + variation %)
--   13. Function fn_positions + Vue v_positions (PRU / quantité / coût)
--   14. Function set_manual_price (saisie manuelle d'un cours / d'une VL)
--   15. Index
--   16. Row Level Security + policies
--   17. COMMENT ON
-- =====================================================================


-- =====================================================================
-- 1. FUNCTIONS UTILITAIRES
-- =====================================================================

-- Horodatage automatique sur toute table possédant une colonne updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Identifiant de l'utilisateur courant (JWT). Repli sur NULL hors requête
-- authentifiée (tâches SQL, edge functions avec service role).
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.uid()::text, '')::uuid;
$$;


-- =====================================================================
-- 2. PROFILES — 1-1 avec auth.users
-- =====================================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  phone       text,
  -- Préférences utilisateur (UserSettings de src/domain/types.ts) :
  -- { displayCurrency, defaultFeePct, defaultFeeMin,
  --   tax: { capitalGainsRate, dividendWithholdingRate, exemptionThreshold, fiscalYear },
  --   locale, theme, maskAmounts, twoFactor }
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Création automatique du profil à l'inscription (Supabase Auth).
-- Les métadonnées attendues : raw_user_meta_data.full_name (et éventuellement phone).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- =====================================================================
-- 3. PORTEFEUILLES
-- =====================================================================

create table if not exists public.portfolios (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  -- Informatif : 'CTO', 'PEA', 'ENFANTS'… (kind dans le domaine)
  kind       text not null default 'CTO',
  color      text not null default '#d13c18',
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists portfolios_set_updated_at on public.portfolios;
create trigger portfolios_set_updated_at
  before update on public.portfolios
  for each row execute function public.set_updated_at();


-- =====================================================================
-- 4. INSTRUMENTS — référentiel commun (lecture seule côté client)
-- =====================================================================

create table if not exists public.instruments (
  id                text primary key,          -- ticker ('ATW') ou id fonds ('OPC_ATQ')
  type              text not null check (type in ('ACTION', 'OPCVM')),
  ticker            text not null,
  name              text not null,
  sector            text,                      -- actions
  currency          text not null default 'MAD' check (currency = 'MAD'),
  isin              text,
  market            text default 'CASABLANCA',
  lot_size          integer,
  -- Colonnes OPCVM -------------------------------------------------
  management_company text,                     -- société de gestion
  category          text check (category in (
                      'ACTIONS', 'OBLIGATAIRE_CT', 'OBLIGATAIRE_MLT',
                      'MONETAIRE', 'DIVERSIFIE', 'CONTRACTUEL')),
  benchmark         text,
  risk_level        smallint check (risk_level between 1 and 7), -- SRRI
  fees              jsonb,                     -- { entry, exit, management } en %
  policy            text,                      -- mention sur la politique d'investissement
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists instruments_set_updated_at on public.instruments;
create trigger instruments_set_updated_at
  before update on public.instruments
  for each row execute function public.set_updated_at();


-- =====================================================================
-- 5. PRICES — cours (actions) & VL (OPCVM)
--    PK (instrument_id, date) : UN seul prix par instrument et par date.
--    source : 'market' (fournisseur de marché), 'manual' (saisie
--    utilisateur via set_manual_price), 'nav' (VL publiée OPCVM).
-- =====================================================================

create table if not exists public.prices (
  instrument_id       text not null references public.instruments (id) on delete cascade,
  date                date not null,
  close               numeric(14, 4) not null check (close > 0),
  source              text not null default 'market'
                        check (source in ('market', 'manual', 'nav')),
  -- Auteur de la ligne quand source = 'manual' (NULL sinon) ; sert de
  -- support au cloisonnement RLS des saisies manuelles.
  user_id             uuid references auth.users (id) on delete cascade,
  volume              bigint,
  market_cap          numeric(20, 2),
  per                 numeric(10, 2),
  dividend_per_share  numeric(10, 4),
  dividend_yield      numeric(8, 4),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (instrument_id, date)
);

-- Contrainte d'unicité explicite (instrument, date) : protège l'intégrité
-- de la PK contre toute réécriture future de la table.
create unique index if not exists prices_instrument_id_date_key
  on public.prices (instrument_id, date);

drop trigger if exists prices_set_updated_at on public.prices;
create trigger prices_set_updated_at
  before update on public.prices
  for each row execute function public.set_updated_at();


-- =====================================================================
-- 6. TRANSACTIONS — journal des opérations
--    Les 12 types du domaine (src/domain/types.ts) :
--    ACHAT, VENTE, SOUSCRIPTION, RACHAT, DIVIDENDE, COUPON, DEPOT,
--    RETRAIT, FRAIS, SPLIT, ATTRIBUTION_GRATUITE, AUGMENTATION_CAPITAL
-- =====================================================================

create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid not null references public.portfolios (id) on delete cascade,
  -- Copie du propriétaire : permet une policy RLS directe sans join.
  user_id       uuid not null references auth.users (id) on delete cascade,
  -- NULL uniquement pour DEPOT / RETRAIT / FRAIS (voir CHECK ci-dessous).
  instrument_id text references public.instruments (id) on delete restrict,
  type          text not null check (type in (
                  'ACHAT', 'VENTE', 'SOUSCRIPTION', 'RACHAT',
                  'DIVIDENDE', 'COUPON', 'DEPOT', 'RETRAIT', 'FRAIS',
                  'SPLIT', 'ATTRIBUTION_GRATUITE', 'AUGMENTATION_CAPITAL')),
  date          date not null,
  quantity      numeric(18, 6),               -- ratio pour SPLIT (ex. 2 = « 2 pour 1 »)
  price         numeric(14, 4),               -- cours ou VL unitaire
  fees          numeric(14, 2) default 0,     -- frais de courtage
  taxes         numeric(14, 2) default 0,     -- droits de timbre / retenue
  amount        numeric(18, 2),               -- brut (dividendes, coupons, dépôts…)
  comment       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Les opérations de trésorerie n'ont pas d'instrument ; toutes les
  -- autres en ont un obligatoirement.
  constraint transactions_instrument_required check (
    (type in ('DEPOT', 'RETRAIT', 'FRAIS') and instrument_id is null)
    or (type not in ('DEPOT', 'RETRAIT', 'FRAIS') and instrument_id is not null)
  ),
  constraint transactions_quantity_positive check (quantity is null or quantity > 0),
  constraint transactions_price_positive     check (price is null or price >= 0)
);

-- Remplit user_id à partir du portefeuille cible (l'appelant ne peut
-- cibler qu'un portefeuille qui lui appartient, grâce à la RLS).
create or replace function public.set_transaction_user()
returns trigger
language plpgsql
as $$
begin
  new.user_id := coalesce(
    new.user_id,
    (select p.user_id from public.portfolios p where p.id = new.portfolio_id)
  );
  if new.user_id is null then
    raise exception 'portfolio_id inconnu ou non appartenant à l''utilisateur';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_set_user on public.transactions;
create trigger transactions_set_user
  before insert on public.transactions
  for each row execute function public.set_transaction_user();

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();


-- =====================================================================
-- 7. DIVIDENDES — suivi déclaré (le journal reste la source de vérité
--    pour les calculs ; cette table sert aux rappels / exports).
-- =====================================================================

create table if not exists public.dividends (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  portfolio_id  uuid references public.portfolios (id) on delete cascade,
  instrument_id text not null references public.instruments (id) on delete cascade,
  ex_date       date not null,                -- date de détachement
  pay_date      date,                         -- date de paiement
  gross_amount  numeric(18, 2) not null,      -- dividende brut total
  withholding   numeric(18, 2) not null default 0,  -- retenue à la source
  net_amount    numeric(18, 2) generated always as (gross_amount - withholding) stored,
  comment       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists dividends_set_updated_at on public.dividends;
create trigger dividends_set_updated_at
  before update on public.dividends
  for each row execute function public.set_updated_at();


-- =====================================================================
-- 8. ALERTS & WATCHLISTS
-- =====================================================================

create table if not exists public.alerts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  portfolio_id  uuid references public.portfolios (id) on delete cascade,
  instrument_id text not null references public.instruments (id) on delete cascade,
  type          text not null check (type in (
                  'PRICE_ABOVE', 'PRICE_BELOW', 'DAY_CHANGE',
                  'VL_PUBLISHED', 'DIVIDEND_DETACH')),
  threshold     numeric(14, 4) not null default 0,
  active        boolean not null default true,
  -- Canaux de notification : 'IN_APP', 'EMAIL'
  channels      jsonb not null default '["IN_APP"]'::jsonb,
  created_at    timestamptz not null default now(),
  triggered_at  timestamptz,
  updated_at    timestamptz not null default now()
);

drop trigger if exists alerts_set_updated_at on public.alerts;
create trigger alerts_set_updated_at
  before update on public.alerts
  for each row execute function public.set_updated_at();

create table if not exists public.watchlists (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  -- NULL = liste globale de l'utilisateur
  portfolio_id  uuid references public.portfolios (id) on delete cascade,
  instrument_id text not null references public.instruments (id) on delete cascade,
  created_at    timestamptz not null default now()
);


-- =====================================================================
-- 9. CORPORATE_EVENTS — détachements, AG, publications de VL à venir
--    (référentiel marché, lecture seule côté client)
-- =====================================================================

create table if not exists public.corporate_events (
  id            uuid primary key default gen_random_uuid(),
  instrument_id text not null references public.instruments (id) on delete cascade,
  type          text not null check (type in (
                  'DIVIDEND_DETACH', 'AG', 'VL_PUBLISHED', 'MATURITY', 'CAPITAL')),
  date          date not null,
  label         text not null,
  amount        numeric(14, 4),               -- montant par action/parts si connu
  created_at    timestamptz not null default now()
);


-- =====================================================================
-- 10. INDICES & INDEX_PRICES — MASI, MSI20, MASI Banques
-- =====================================================================

create table if not exists public.indices (
  code        text primary key check (code in ('MASI', 'MSI20', 'MASI_BANQUES')),
  name        text not null,
  value       numeric(14, 4) not null,
  change_pct  numeric(10, 4) not null default 0,
  updated_at  timestamptz not null default now()
);

drop trigger if exists indices_set_updated_at on public.indices;
create trigger indices_set_updated_at
  before update on public.indices
  for each row execute function public.set_updated_at();

create table if not exists public.index_prices (
  code     text not null references public.indices (code) on delete cascade,
  date     date not null,
  close    numeric(14, 4) not null,
  primary key (code, date)
);


-- =====================================================================
-- 11. AUDIT_LOG — journal d'écriture des opérations
--     Politique insert-only pour l'utilisateur (voir section 16).
-- =====================================================================

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  table_name  text not null,
  record_id   text,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);

-- Trigger d'audit sur le journal des opérations : enregistre chaque
-- INSERT / UPDATE / DELETE. Les lignes d'audit sont ensuite verrouillées
-- (pas de policy UPDATE/DELETE pour l'utilisateur).
create or replace function public.audit_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if tg_op = 'INSERT' then
    v_user := new.user_id;
  elsif tg_op = 'UPDATE' then
    v_user := new.user_id;
  else
    v_user := old.user_id;
  end if;

  insert into public.audit_log (user_id, table_name, record_id, action, old_data, new_data)
  values (
    v_user,
    tg_table_name,
    (case when tg_op = 'DELETE' then old.id else new.id end)::text,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists transactions_audit on public.transactions;
create trigger transactions_audit
  after insert or update or delete on public.transactions
  for each row execute function public.audit_transaction();


-- =====================================================================
-- 12. VUE v_latest_quotes — dernier cours / VL + variation %
--     (alimente SupabaseDataProvider.getQuotes)
--     Le champ `source` permet de distinguer un cours de marché d'une
--     saisie manuelle ou d'une VL publiée.
-- =====================================================================

create or replace view public.v_latest_quotes as
with ranked as (
  select
    p.*,
    lag(p.close) over (partition by p.instrument_id order by p.date) as prev_close,
    row_number() over (partition by p.instrument_id order by p.date desc) as rn
  from public.prices p
)
select
  r.instrument_id,
  r.date,
  r.close,
  case
    when r.prev_close is null or r.prev_close = 0 then 0
    else round((r.close - r.prev_close) / r.prev_close * 100, 4)
  end as change_pct,
  r.volume,
  r.market_cap,
  r.per,
  r.dividend_per_share,
  r.dividend_yield,
  r.source
from ranked r
where r.rn = 1;


-- =====================================================================
-- 13. POSITIONS EN SQL — fn_positions + vue v_positions
--
--     Réimplémente en SQL les règles du moteur TypeScript
--     (src/domain/calc/positions.ts) pour permettre des requêtes serveur
--     (exports, rapports, tests d'intégration). Le front continue de
--     calculer via le moteur TS ; cette vue sert de source secondaire
--     vérifiable et de documentation exécutable des règles.
--
--     Règles rejouées dans l'ordre (date, created_at) :
--       ACHAT / SOUSCRIPTION / AUGMENTATION_CAPITAL
--           quantité += q ; coût += q*p + frais + taxes
--       VENTE / RACHAT
--           PRU = coût / quantité ; plus-value réalisée =
--           (q*p − frais − taxes) − PRU*q ; coût résiduel diminué
--       SPLIT               quantité *= ratio (PRU ÷ ratio automatique)
--       ATTRIBUTION_GRATUITE quantité += q ; coût inchangé (PRU ↓)
--       DIVIDENDE / COUPON   revenus nets += montant − taxes
--       DEPOT / RETRAIT / FRAIS : trésorerie uniquement (hors positions)
-- =====================================================================

create or replace function public.fn_positions(p_user_id uuid default null)
returns table (
  portfolio_id    uuid,
  instrument_id   text,
  instrument_type text,
  quantity        numeric,
  pru             numeric,
  cost            numeric,
  last_price      numeric,
  price_date      date,
  market_value    numeric,
  unrealized_pnl  numeric,
  realized_pnl    numeric,
  income          numeric,
  invested        numeric
)
language plpgsql
stable
as $$
declare
  eps constant numeric := 1e-6;
  cur_port   uuid := null;
  cur_inst   text := null;
  cur_type   text := null;
  cur_qty    numeric := 0;
  cur_cost   numeric := 0;
  cur_real   numeric := 0;
  cur_income numeric := 0;
  cur_invest numeric := 0;
  v_pru      numeric;
  v_sell     numeric;
  v_removed  numeric;
  v_last     numeric;
  v_lastdate date;
begin
  for rec in
    select
      t.portfolio_id, t.instrument_id,
      coalesce(i.type, 'ACTION') as itype,
      t.type as ttype, t.quantity, t.price,
      coalesce(t.fees, 0) as fees,
      coalesce(t.taxes, 0) as taxes,
      coalesce(t.amount, 0) as amount
    from public.transactions t
    left join public.instruments i on i.id = t.instrument_id
    where t.instrument_id is not null
      and (p_user_id is null or t.user_id = p_user_id)
    order by t.portfolio_id, t.instrument_id, t.date, t.created_at
  loop
    -- Changement de ligne → émission du résultat précédent
    if cur_inst is not null and (rec.portfolio_id <> cur_port or rec.instrument_id <> cur_inst) then
      select p.close, p.date into v_last, v_lastdate
        from public.prices p
       where p.instrument_id = cur_inst
       order by p.date desc
       limit 1;
      portfolio_id    := cur_port;
      instrument_id   := cur_inst;
      instrument_type := cur_type;
      quantity        := round(cur_qty, 6);
      pru             := case when cur_qty > eps then round(cur_cost / cur_qty, 6) else 0 end;
      cost            := round(cur_cost, 2);
      last_price      := coalesce(v_last, case when cur_qty > eps then round(cur_cost / cur_qty, 6) else 0 end);
      price_date      := v_lastdate;
      market_value    := round(coalesce(v_last, 0) * cur_qty, 2);
      unrealized_pnl  := round(coalesce(v_last, 0) * cur_qty - cur_cost, 2);
      realized_pnl    := round(cur_real, 2);
      income          := round(cur_income, 2);
      invested        := round(cur_invest, 2);
      return next;
    end if;

    if cur_inst is null
       or rec.portfolio_id <> cur_port
       or rec.instrument_id <> cur_inst then
      cur_port := rec.portfolio_id;
      cur_inst := rec.instrument_id;
      cur_type := rec.itype;
      cur_qty := 0; cur_cost := 0; cur_real := 0; cur_income := 0; cur_invest := 0;
    end if;

    case rec.ttype
      when 'ACHAT' then
        cur_qty    := cur_qty + coalesce(rec.quantity, 0);
        cur_cost   := cur_cost + coalesce(rec.quantity, 0) * coalesce(rec.price, 0) + rec.fees + rec.taxes;
        cur_invest := cur_invest + coalesce(rec.quantity, 0) * coalesce(rec.price, 0) + rec.fees + rec.taxes;
      when 'SOUSCRIPTION' then
        cur_qty    := cur_qty + coalesce(rec.quantity, 0);
        cur_cost   := cur_cost + coalesce(rec.quantity, 0) * coalesce(rec.price, 0) + rec.fees + rec.taxes;
        cur_invest := cur_invest + coalesce(rec.quantity, 0) * coalesce(rec.price, 0) + rec.fees + rec.taxes;
      when 'AUGMENTATION_CAPITAL' then
        cur_qty    := cur_qty + coalesce(rec.quantity, 0);
        cur_cost   := cur_cost + coalesce(rec.quantity, 0) * coalesce(rec.price, 0) + rec.fees + rec.taxes;
        cur_invest := cur_invest + coalesce(rec.quantity, 0) * coalesce(rec.price, 0) + rec.fees + rec.taxes;
      when 'VENTE' then
        v_pru     := case when cur_qty > eps then cur_cost / cur_qty else 0 end;
        v_sell    := least(coalesce(rec.quantity, 0), cur_qty);
        v_removed := round(v_pru * v_sell, 6);
        cur_real  := cur_real + round((v_sell * coalesce(rec.price, 0) - rec.fees - rec.taxes) - v_removed, 6);
        cur_qty   := round(cur_qty - v_sell, 6);
        cur_cost  := greatest(0, round(cur_cost - v_removed, 6));
      when 'RACHAT' then
        v_pru     := case when cur_qty > eps then cur_cost / cur_qty else 0 end;
        v_sell    := least(coalesce(rec.quantity, 0), cur_qty);
        v_removed := round(v_pru * v_sell, 6);
        cur_real  := cur_real + round((v_sell * coalesce(rec.price, 0) - rec.fees - rec.taxes) - v_removed, 6);
        cur_qty   := round(cur_qty - v_sell, 6);
        cur_cost  := greatest(0, round(cur_cost - v_removed, 6));
      when 'SPLIT' then
        cur_qty := round(cur_qty * coalesce(rec.quantity, 1), 6);   -- quantity = ratio
      when 'ATTRIBUTION_GRATUITE' then
        cur_qty := round(cur_qty + coalesce(rec.quantity, 0), 6);   -- coût inchangé
      when 'DIVIDENDE' then
        cur_income := cur_income + rec.amount - rec.taxes;
      when 'COUPON' then
        cur_income := cur_income + rec.amount - rec.taxes;
      else
        null;  -- DEPOT / RETRAIT / FRAIS : trésorerie hors positions
    end case;
  end loop;

  -- Émission de la dernière ligne
  if cur_inst is not null then
    select p.close, p.date into v_last, v_lastdate
      from public.prices p
     where p.instrument_id = cur_inst
     order by p.date desc
     limit 1;
    portfolio_id    := cur_port;
    instrument_id   := cur_inst;
    instrument_type := cur_type;
    quantity        := round(cur_qty, 6);
    pru             := case when cur_qty > eps then round(cur_cost / cur_qty, 6) else 0 end;
    cost            := round(cur_cost, 2);
    last_price      := coalesce(v_last, case when cur_qty > eps then round(cur_cost / cur_qty, 6) else 0 end);
    price_date      := v_lastdate;
    market_value    := round(coalesce(v_last, 0) * cur_qty, 2);
    unrealized_pnl  := round(coalesce(v_last, 0) * cur_qty - cur_cost, 2);
    realized_pnl    := round(cur_real, 2);
    income          := round(cur_income, 2);
    invested        := round(cur_invest, 2);
    return next;
  end if;
end;
$$;

-- Vue explicite (RLS-friendly : passer p_user_id = auth.uid() dans les
-- requêtes applicatives, ou laisser NULL pour l'ensemble visible).
-- NOTE : il s'agit d'une vue (pas matérialisée) pour rester fraîche à
-- chaque lecture ; pour un usage « matérialisé », exécuter périodiquement
--   REFRESH MATERIALIZED VIEW public.mv_positions;
-- avec la définition équivalente (voir bas de fichier).
create or replace view public.v_positions as
select * from public.fn_positions(null);


-- =====================================================================
-- 14. SET_MANUAL_PRICE — saisie manuelle d'un cours / d'une VL
--     Utilisée par SupabaseDataProvider.updateQuote (source 'manual').
--     Sécurisée : exige un prix positif, date valide, et trace l'auteur.
-- =====================================================================

create or replace function public.set_manual_price(
  p_instrument_id text,
  p_price         numeric,
  p_date          date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_price is null or p_price <= 0 then
    raise exception 'Le prix doit être strictement positif.';
  end if;
  if p_date is null then
    raise exception 'La date est obligatoire.';
  end if;

  insert into public.prices (instrument_id, date, close, source, user_id)
  values (p_instrument_id, p_date, p_price, 'manual', auth.uid())
  on conflict (instrument_id, date)
  do update set
    close      = excluded.close,
    source     = 'manual',
    user_id    = excluded.user_id,
    updated_at = now();
end;
$$;


-- =====================================================================
-- 15. INDEX
-- =====================================================================

create index if not exists idx_portfolios_user        on public.portfolios (user_id);
create index if not exists idx_transactions_portfolio on public.transactions (portfolio_id, date);
create index if not exists idx_transactions_user      on public.transactions (user_id, date);
create index if not exists idx_transactions_instrument on public.transactions (instrument_id, date);
create index if not exists idx_prices_date            on public.prices (date);
create index if not exists idx_dividends_user         on public.dividends (user_id, ex_date);
create index if not exists idx_dividends_instrument   on public.dividends (instrument_id, ex_date);
create index if not exists idx_alerts_user            on public.alerts (user_id, active);
create index if not exists idx_alerts_instrument      on public.alerts (instrument_id);
create index if not exists idx_watchlists_user        on public.watchlists (user_id);
create index if not exists idx_corporate_events_date  on public.corporate_events (date);
create index if not exists idx_corporate_events_instr on public.corporate_events (instrument_id, date);
create index if not exists idx_index_prices_date      on public.index_prices (date);
create index if not exists idx_audit_log_user         on public.audit_log (user_id, created_at desc);


-- =====================================================================
-- 16. ROW LEVEL SECURITY
--     Toutes les tables applicatives activent la RLS ; la policy par
--     défaut est `auth.uid() = user_id`. Les tables de référentiel
--     marché (instruments, indices, corporate_events, prices 'market')
--     sont en lecture publique authentifiée mais non modifiables par
--     l'utilisateur (writes limités à `set_manual_price` / service role).
-- =====================================================================

alter table public.profiles        enable row level security;
alter table public.portfolios      enable row level security;
alter table public.instruments     enable row level security;
alter table public.prices          enable row level security;
alter table public.transactions    enable row level security;
alter table public.dividends       enable row level security;
alter table public.alerts          enable row level security;
alter table public.watchlists      enable row level security;
alter table public.corporate_events enable row level security;
alter table public.indices         enable row level security;
alter table public.index_prices    enable row level security;
alter table public.audit_log       enable row level security;

-- PROFILES : 1-1 avec auth.users.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- PORTEFEUILLES
drop policy if exists portfolios_crud_own on public.portfolios;
create policy portfolios_crud_own on public.portfolios
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- INSTRUMENTS : lecture seule pour tous les authentifiés (référentiel
-- marché partagé) ; écriture réservée au service role (RLS bloqué).
drop policy if exists instruments_select_all on public.instruments;
create policy instruments_select_all on public.instruments
  for select to authenticated using (true);

-- PRICES : lecture ouverte (cours partagés) ; écriture manuelle exige
-- auth.uid() = user_id (les lignes 'market'/'nav' sont insérées par le
-- service role qui contourne la RLS).
drop policy if exists prices_select_all on public.prices;
create policy prices_select_all on public.prices
  for select to authenticated using (true);
drop policy if exists prices_insert_manual on public.prices;
create policy prices_insert_manual on public.prices
  for insert to authenticated with check (user_id is null or auth.uid() = user_id);
-- NB : la saisie recommandée passe par set_manual_price() (SECURITY
-- DEFINER) qui remplace proprement la valeur du jour et stamp l'auteur ;
-- cette policy tolère aussi un INSERT direct du client (source='manual',
-- user_id NULL), utilisé par SupabaseDataProvider.updateQuote.

-- TRANSACTIONS
drop policy if exists transactions_crud_own on public.transactions;
create policy transactions_crud_own on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- DIVIDENDES
drop policy if exists dividends_crud_own on public.dividends;
create policy dividends_crud_own on public.dividends
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ALERTS
drop policy if exists alerts_crud_own on public.alerts;
create policy alerts_crud_own on public.alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- WATCHLISTS
drop policy if exists watchlists_crud_own on public.watchlists;
create policy watchlists_crud_own on public.watchlists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- CORPORATE_EVENTS : lecture seule pour les authentifiés.
drop policy if exists corporate_events_select_all on public.corporate_events;
create policy corporate_events_select_all on public.corporate_events
  for select to authenticated using (true);

-- INDICES / INDEX_PRICES : lecture seule pour les authentifiés.
drop policy if exists indices_select_all on public.indices;
create policy indices_select_all on public.indices
  for select to authenticated using (true);
drop policy if exists index_prices_select_all on public.index_prices;
create policy index_prices_select_all on public.index_prices
  for select to authenticated using (true);

-- AUDIT_LOG : INSERT-ONLY pour l'utilisateur — il peut insérer et lire
-- ses propres lignes, mais ni les modifier ni les supprimer (aucune
-- policy UPDATE/DELETE n'existe pour le rôle `authenticated`).
drop policy if exists audit_log_insert_own on public.audit_log;
create policy audit_log_insert_own on public.audit_log
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists audit_log_select_own on public.audit_log;
create policy audit_log_select_own on public.audit_log
  for select to authenticated using (auth.uid() = user_id);
-- Pas de policy UPDATE ni DELETE : les lignes d'audit sont immuables
-- côté utilisateur. Seul le service role (postgres) peut les purger.


-- =====================================================================
-- 17. COMMENTAIRES
-- =====================================================================

comment on schema public is 'Patrimoine.ma — application de suivi de portefeuille (MAD, marché marocain).';

comment on table public.profiles is 'Profil 1-1 avec auth.users : identité + préférences (settings JSONB).';
comment on column public.profiles.settings is 'UserSettings : devise d''affichage, taux de courtage par défaut, paramètres fiscaux, locale, thème, masque des montants, 2FA.';

comment on table public.portfolios is 'Portefeuilles utilisateur (CTO, PEA, Enfants…).';
comment on column public.portfolios.kind is 'Type informatif du compte (ex. CTO, PEA, assurance-vie).';

comment on table public.instruments is 'Référentiel commun : actions cotées (type=ACTION) et OPCVM (type=OPCVM). Lecture seule côté client.';
comment on column public.instruments.management_company is 'Société de gestion (OPCVM).';
comment on column public.instruments.category is 'Catégorie réglementaire OPCVM (mono-poches…).';
comment on column public.instruments.risk_level is 'SRRI 1..7 (niveau de risque global du fonds).';
comment on column public.instruments.fees is 'Frais du fonds en % : { entry, exit, management }.';
comment on column public.instruments.policy is 'Mention de la politique d''investissement du fonds.';

comment on table public.prices is 'Cours (actions) et VL (OPCVM) par date. PK (instrument_id, date) : un seul point par instrument et par séance.';
comment on column public.prices.source is 'market = fournisseur de marché ; nav = VL publiée (OPCVM) ; manual = saisie utilisateur (set_manual_price).';
comment on column public.prices.user_id is 'Auteur de la saisie manuelle ; NULL pour les lignes market/nav.';

comment on table public.transactions is 'Journal des opérations : 12 types (achat, vente, souscription, rachat, dividende, coupon, dépôt, retrait, frais, split, attribution gratuite, augmentation de capital).';
comment on column public.transactions.quantity is 'Quantité (ou ratio pour un SPLIT, ex. 2 pour « 2 pour 1 »).';
comment on column public.transactions.price is 'Cours ou VL unitaire en MAD.';
comment on column public.transactions.amount is 'Montant brut pour les opérations de revenu ou de trésorerie (dividendes, coupons, dépôts, retraits, frais).';

comment on table public.dividends is 'Suivi déclaré des dividendes (brut, retenue, net) — le journal transactions reste la source de vérité pour les calculs.';

comment on table public.alerts is 'Alertes utilisateur : seuil de cours, variation journalière, publication de VL, détachement.';
comment on table public.watchlists is 'Listes de suivi (portfolio_id NULL = liste globale).';

comment on table public.corporate_events is 'Événements à venir : détachements, AG, publications de VL, maturités, opérations sur capital.';

comment on table public.indices is 'Indices de référence : MASI, MSI20, MASI Banques.';
comment on table public.index_prices is 'Historique de clôture des indices.';

comment on table public.audit_log is 'Journal d''audit insert-only côté utilisateur : toute création/modification/suppression d''opération y est tracée.';

comment on view public.v_latest_quotes is 'Dernier cours / VL par instrument + variation % (alimente getQuotes).';
comment on view public.v_positions is 'Positions recalculées en SQL depuis transactions (PRU, quantité, coût, valorisation, plus-values).';
comment on function public.fn_positions(uuid) is 'Moteur de positions SQL (miroir de src/domain/calc/positions.ts) : PRU, plus-value réalisée, split, attribution gratuite, dividendes nets.';
comment on function public.set_manual_price(text, numeric, date) is 'Upsert d''un cours / VL saisi manuellement (source = manual, auteur = auth.uid()).';


-- =====================================================================
-- FIN — après exécution, vérifier :
--   * s'inscrire via l'app → ligne créée dans public.profiles ;
--   * SELECT * FROM public.v_latest_quotes ; → cours + variation ;
--   * SELECT * FROM public.v_positions ;     → positions calculées.
-- =====================================================================
