-- テーブル・権限・RLS・Storage を 1 つのマイグレーションにまとめている。
-- 分けて反映すると、RLS のないテーブルが公開される時間が生まれるため。

create table public.places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_meters integer not null default 100 check (radius_meters > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  direction text not null check (direction in ('up', 'right', 'down', 'left')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, direction),
  unique (id, user_id)
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  storage_path text not null unique,
  image_type text not null default 'image/jpeg',
  category_id uuid,
  direction text check (direction in ('up', 'right', 'down', 'left')),
  place_id uuid,
  -- category_id は工程の削除で null に戻るため、分類済みかどうかの判定には使えない
  classified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((classified_at is null) = (direction is null)),
  -- Storage のポリシーがこのパスで行とファイルを対応づける
  check (storage_path = user_id::text || '/' || id::text || '.jpg'),
  -- 外部キーのチェックは RLS を通らないので、user_id を組に含めて他人の工程・場所を紐づけられないようにする
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id),
  foreign key (place_id, user_id) references public.places (id, user_id) on delete set null (place_id)
);

create index on public.places (user_id);
create index on public.photos (user_id, created_at desc);
create index on public.photos (category_id, user_id);
create index on public.photos (place_id, user_id);
create index on public.photos (user_id, created_at desc) where classified_at is null;

create extension if not exists moddatetime schema extensions;

create trigger handle_updated_at before update on public.places
  for each row execute procedure extensions.moddatetime(updated_at);
create trigger handle_updated_at before update on public.categories
  for each row execute procedure extensions.moddatetime(updated_at);
create trigger handle_updated_at before update on public.photos
  for each row execute procedure extensions.moddatetime(updated_at);

-- 誰でも登録できるので、1 人が Storage の枠（プロジェクト全体で 1GB）を使い切れないようにする
create function public.enforce_photo_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.photos where user_id = new.user_id) >= 100 then
    raise exception '写真は1人100枚までです。' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger enforce_photo_limit before insert on public.photos
  for each row execute function public.enforce_photo_limit();

-- trigger の中では auth.uid() が使えないので new.id を使う
create function public.seed_default_categories() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.categories (user_id, name, color, direction) values
    (new.id, '上工程', '#2563eb', 'up'),
    (new.id, '右工程', '#16a34a', 'right'),
    (new.id, '下工程', '#f59e0b', 'down'),
    (new.id, '左工程', '#dc2626', 'left')
  on conflict (user_id, direction) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.seed_default_categories();

-- プロジェクトの既定の権限に左右されないよう、いったん外してから必要な分だけ付ける
revoke all on public.places, public.categories, public.photos from anon, authenticated;
grant select, insert, update, delete on public.places, public.categories, public.photos to authenticated;

alter table public.places enable row level security;
alter table public.categories enable row level security;
alter table public.photos enable row level security;

-- update に with check がないと、user_id を他人の id に書き換えられる

create policy "places_select_own" on public.places for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "places_insert_own" on public.places for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "places_update_own" on public.places for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "places_delete_own" on public.places for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "categories_select_own" on public.categories for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "categories_insert_own" on public.categories for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "categories_update_own" on public.categories for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "categories_delete_own" on public.categories for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "photos_select_own" on public.photos for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "photos_insert_own" on public.photos for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "photos_update_own" on public.photos for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "photos_delete_own" on public.photos for delete to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/jpeg']);

create policy "photos_obj_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- photos の行があるパスにだけ置けるようにして、枚数上限を Storage にも効かせる
create policy "photos_obj_insert_own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.photos
      where photos.user_id = (select auth.uid()) and photos.storage_path = name
    )
  );

create policy "photos_obj_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
