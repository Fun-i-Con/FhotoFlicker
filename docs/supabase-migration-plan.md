# Supabase 移行方針

2026-10-16 時点の方針。写真と分類データを、ブラウザの IndexedDB から Supabase に移す。

## 目的

- 現在はデータが端末のブラウザ（IndexedDB）にしかなく、端末をまたいで使えず、バックアップもない
- iOS Safari は、Safari を使う 7 日の間にそのサイトを一度も開かないと、スクリプトが保存したデータ（IndexedDB を含む）を消すことがあり、写真が失われるおそれがある
  - 7 日は暦の日数ではなく、Safari を使った日の数で数える。ホーム画面に追加した Web アプリは対象外
  - 参考: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/

## サービスの選定

Supabase を採用する。

Supabase は PostgreSQL に、認証・ファイル保存（Storage）・自動生成される API（Data API）・行単位の権限（RLS）を加えたサービスである。GitHub Pages で配信している SPA から直接使えるため、API サーバを自前で用意しなくてよい。

検討した候補:

| サービス | 採用しなかった理由 |
| --- | --- |
| PostgreSQL（単体） | ブラウザから直接接続できず、API サーバの実装と運用が必要になる |
| Firebase | Storage の利用に従量課金の Blaze プラン（クレジットカード登録）が必要（無料枠は Blaze でも残る）。DB が NoSQL で、場所×工程の絞り込みや削除時の整合性を扱いにくい |
| Appwrite Cloud | Console での開発作業が 7 日ないと一時停止し、ユーザーのアクセスは活動に数えられない。一時停止が 90 日続くとプロジェクトが削除される（2026-06-29 から） |
| Cloudflare（Workers + D1 + R2） | API と認証を自前で実装する必要がある。写真の容量が増えたときに、Storage の移行先として再検討する |
| PocketBase | 常時動くサーバを自前で用意する必要がある |
| Neon | PostgreSQL のみで、Storage と認証がない |

無料プランの制限（https://supabase.com/pricing 、https://supabase.com/docs/guides/platform/free-project-pausing ）:

- DB 500MB、Storage 1GB（1 ファイル 50MB まで）、転送量（egress）月 5GB、有効なプロジェクトは 2 つまで
- 1 週間 DB へのリクエストがないとプロジェクトが一時停止する。約 1 週間前に警告メールが届く。停止してもデータは残り、再開できる期間内ならダッシュボードから再開できる（再開できる期間は、ドキュメントの「1 年」と changelog の「90 日」で食い違っており未確認）

## 決めること（未決）

手順 3 より前に決める。特に「データの持ち主」は、後から変えると `user_id`・RLS・Storage のパスをすべて作り直すことになる。

| 項目 | 案 |
| --- | --- |
| データの持ち主 | ユーザーごと（自分の写真だけ見える）。チームで共有する場合は、チームを表すテーブルが追加で必要 |
| ログイン方法 | メールの 6 桁コード（Email OTP）または Google ログイン。マジックリンクは使わない（下記） |
| 新規登録を許すか | 許すと、公開されている publishable キーで誰でもアカウントを作り、Storage を使える。招待したユーザーだけにする案もある |
| 工程を削除したときの写真 | 分類済みのまま「工程なし」として残す（`classified_at` で分類済みかを判定）。工程の削除を禁止する（`on delete restrict`）案もある。docs/current-state.md の確認ポイント 7 への答え |
| 工程の数 | 上下左右の 4 つまで（`direction` は必須）。docs/current-state.md の確認ポイント 5 への答え |
| オフライン対応 | 最初はオンライン専用。ただしアップロードに失敗したときに再送するか、撮影データを一時的に端末に残すかは決めておく |
| 既存データの移行 | 移行しない |
| 開発環境 | Supabase のプロジェクトを開発用と本番用の 2 つ作る。無料プランの有効プロジェクト枠 2 つを使い切る点に注意。手元で `supabase start`（Docker が必要）を使ってもよい |
| Nuxt 4 への更新 | Nuxt 3 は 2026-07-31 でサポート終了（https://nuxt.com/docs/3.x/migration/overview ）。認証を入れる前に Nuxt 4 へ上げるか決める |

マジックリンクを使わない理由:

- iOS のホーム画面アプリは Safari とストレージが別で、メールのリンクは Safari で開くため、ホーム画面アプリ側がログインしない
- PKCE フローでは、リンクを開くブラウザがログインを始めたブラウザと同じでないと失敗する
- 参考: https://supabase.com/docs/guides/auth/auth-email-passwordless 、https://supabase.com/docs/guides/auth/sessions/pkce-flow

メールを使う場合の注意: Supabase 標準のメール送信は、プロジェクトのチームメンバー宛てにしか届かず、1 時間に 2 通まで。実運用では独自 SMTP（Resend など）を設定する（https://supabase.com/docs/guides/auth/auth-smtp ）。

## 手順

### 1. 準備

- PR #37（連続撮影）をマージする
- #36 の内容を「未分類写真を一覧で見られるようにする」に絞って書き直す

### 2. Repository への分割（Supabase は使わない）

画面の見た目と動きは変えない。Supabase 版に差し替えるための準備として行う。

- 2-a: 場所判定とフリック方向の判定を純粋な関数に切り出し、Vitest でテストする
  - `utils/geo.ts`、`utils/flick.ts`、`test/unit/`
- 2-b: `usePhotoDb.ts` を Repository のインターフェースと IndexedDB 版の実装に分ける（PR #37 のマージ後に行う）
  - 例: `PhotoRepository`、`CategoryRepository`、`PlaceRepository`
  - 画面は Repository だけを呼ぶようにする
  - 画像の取得は `createObjectUrl(Blob)` ではなく「画像 URL を返す」形にする。Supabase では Storage の URL を返すことになるため

### 3. プロジェクト作成とテーブル設計

- プロジェクトを東京リージョンに作る
- CLI の流れ: `supabase init` → `supabase link` → `supabase migration new <名前>` で `supabase/migrations/` に SQL を書く → `supabase db push` で反映する
- テーブル作成と同じマイグレーションに、GRANT・RLS の有効化・ポリシーまで含める。テーブルだけを先に反映すると、RLS のない状態が生まれるため
  - 2026 年から、public スキーマの新しいテーブルは Data API に自動で公開されなくなった。GRANT がないと supabase-js からのクエリが `permission denied` で拒否される（https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically ）

テーブル定義（案）:

```sql
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
  classified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((classified_at is null) = (direction is null)),
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

grant select, insert, update, delete on public.places, public.categories, public.photos to authenticated;
```

設計のポイント:

- 未分類の写真は `photos.classified_at is null` で表し、`drafts` ストアは廃止する
  - `category_id is null` で判定しないのは、工程を削除したときに分類済みの写真が未分類に戻ってしまうため
  - `created_at` は撮影時刻、`classified_at` は分類した時刻になる。現在の `PhotoItem.createdAt`（分類時刻）とは意味が変わるので、一覧の並び順を確認する
- 工程・場所を削除したときは、写真を残して紐づけだけ外す（`on delete set null (列名)`、PostgreSQL 15 以降）
- 外部キーを `(id, user_id)` の組にしているのは、他人の工程・場所の id を自分の写真に紐づけられないようにするため。外部キーのチェックは RLS を通らない（https://www.postgresql.org/docs/current/ddl-rowsecurity.html ）
- `anon` ロールには何も GRANT しない（ログイン必須のため）

初期の工程データは、ユーザー登録時の trigger で入れる（https://supabase.com/docs/guides/auth/managing-user-data ）。

```sql
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
```

- trigger の中では `auth.uid()` が使えないため、`new.id` を明示する
- trigger が失敗すると新規登録自体が失敗する
- trigger を作る前に登録したユーザーには初期データが入らないので、別途投入する

### 4. ログインと権限（RLS）

- すべてのテーブルで RLS を有効にする
- ポリシーは操作（select / insert / update / delete）ごとに `to authenticated` で分ける。insert には `with check`、update には `using` と `with check` の両方を付ける。update に `using` しかないと、`user_id` を他人の id に書き換えられてしまう

```sql
alter table public.places enable row level security;
alter table public.categories enable row level security;
alter table public.photos enable row level security;

create policy "photos_select_own" on public.photos for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "photos_insert_own" on public.photos for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "photos_update_own" on public.photos for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "photos_delete_own" on public.photos for delete to authenticated
  using ((select auth.uid()) = user_id);
-- places / categories も同様
```

- リダイレクト設定（https://supabase.com/docs/guides/auth/redirect-urls ）
  - Site URL（1 つだけ）: `https://<owner>.github.io/FhotoFlicker/`
  - Redirect URLs（許可する一覧）: 本番の URL と、開発用の `http://localhost:3000/**`
  - `signInWithOtp` / `signInWithOAuth` の `redirectTo` には baseURL（`/FhotoFlicker/`）を含めた URL を渡す
  - GitHub Pages では深いパスが 404.html 経由で表示される（HTTP ステータスは 404）ため、戻り先はルートの `/FhotoFlicker/` にする
- Google ログインを使う場合は、Google Cloud で OAuth クライアントを作り、`https://<project-ref>.supabase.co/auth/v1/callback` を登録する
- メールの 6 桁コードを使う場合は、メールテンプレートに `{{ .Token }}` を入れ、`signInWithOtp` の後に `verifyOtp` を呼ぶ
- ログイン画面を作り、ログインしていない場合はログイン画面へ移動させる
- 2 つのアカウントで、相手のデータが見えない・書き換えられないことを確認する

### 5. 写真の保存（Storage）

- 公開しない（private）バケット `photos` を作り、保存先のパスを `{user_id}/{photo_id}.jpg` にする
- バケットとポリシーもマイグレーションで管理する（https://supabase.com/docs/guides/storage/security/access-control ）

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg']);

create policy "photos_obj_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos_obj_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos_obj_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
```

- 表示には期限付きの URL を使う。一覧では `createSignedUrls` でまとめて発行する（発行には select ポリシーが必要）
- 上書き（upsert）をする場合は、update ポリシーも必要になる
- アップロード前に canvas で長い辺を 1600px 程度に縮小して JPEG に変換する
  - Supabase の画像変換は Pro プラン以上でしか使えないため、ブラウザ側で縮小する
  - 再エンコードで EXIF の位置情報も落ちる
- 写真を削除するときは、`storage.from('photos').remove()` と行の削除の両方を行う。SQL で `storage.objects` の行を消しても実ファイルは消えない。どちらかが失敗したときに残ったファイルをどう扱うかも決める
- アカウントを削除するときは、先にそのユーザーの Storage のファイルを消す。ファイルが残っているとユーザーを削除できない

### 6. アプリへの組み込みと公開

- SPA なので `@supabase/supabase-js` を直接使う
  - `@nuxtjs/supabase` を使う場合は `useSsrCookies: false` にし、`redirectOptions` の login / callback を Redirect URLs と揃える（既定値は SSR 向けのため。https://supabase.nuxtjs.org/getting-started/introduction ）
- `supabase gen types typescript --project-id <ref>`（手元なら `--local`）でテーブルの型を `types/database.types.ts` に生成する
- 2 で作った Repository の Supabase 版を実装して差し替える
- `.github/workflows/` のビルドのステップに、Supabase の URL と publishable キー（`sb_publishable_...`）を環境変数として渡す
  - publishable キーは公開してよいキーなので、GitHub の Secrets でなく Variables でもよい
- secret キー（`sb_secret_...`）はフロントエンドと GitHub に置かない。このキーは RLS を無視して全データにアクセスできる（ブラウザから使うと 401 で拒否される）
- 旧 anon / service_role キーは 2026 年末までに廃止予定のため、新しいキーを使う（https://supabase.com/docs/guides/api/api-keys ）

### 7. 運用

- デモや発表の前に、プロジェクトが一時停止していないか確認する
- ダッシュボードで Storage の使用量（1GB）と転送量（月 5GB）を確認する。写真の表示はすべて転送量に数えられる

## 進み具合

| 手順 | 状況 |
| --- | --- |
| 方針決め | 未着手（チームで決める） |
| 1. 準備 | PR #37 レビュー中 |
| 2-a. 純粋な関数の切り出し | 実装済み（ブランチ `refactor-pure-functions`） |
| 2-b. Repository への分割 | PR #37 のマージ待ち |
| 3〜7 | 未着手 |
