# Moto Car — Lava-jato

Aplicação web de agendamento para o lava-jato Moto Car. O cliente consulta
serviços, escolhe uma data e um horário disponíveis, monta um pedido e continua
o atendimento pelo WhatsApp. A área administrativa autenticada permite
acompanhar a agenda, gerenciar profissionais e configurações.

## Tecnologias

- React 19, TypeScript e TanStack Start/Router
- Vite, Tailwind CSS e componentes Radix UI
- Supabase para autenticação, dados, disponibilidade e agendamentos
- Drizzle ORM/Kit para o esquema e as migrations PostgreSQL
- Bun como gerenciador de pacotes (o repositório inclui `bun.lock`)

## Desenvolvimento local

Instale o [Bun](https://bun.sh/) e configure as variáveis de ambiente do projeto
(consulte [Supabase e variáveis de ambiente](#supabase-e-variáveis-de-ambiente)).
Os arquivos `.env` são ignorados pelo Git.

```sh
git clone <URL-DO-REPOSITORIO>
cd <PASTA-DO-REPOSITORIO>
bun install
bun run dev
```

Comandos disponíveis:

```sh
bun run test
bun run lint
bun run build
bun run preview
```

Run `bun run preview` after a production build to preview the generated Nitro
deployment output locally.

## Rotas

- `/` — página inicial e resumo dos serviços
- `/servicos` — catálogo de serviços e preços
- `/carrinho` — revisão dos serviços escolhidos
- `/checkout` — seleção de data/horário e envio do pedido
- `/admin` — painel administrativo protegido por senha, com agenda, pedidos e
  configurações

## Supabase e variáveis de ambiente

O projeto Supabase pretendido é `jbrxnnzkewipjpixcbfa`. O campo
`project_id` em `supabase/config.toml` identifica o alvo do Supabase CLI; ele
não configura as URLs usadas pela aplicação. Para desenvolvimento local,
configure os valores autorizados do mesmo projeto no ambiente local, nunca em
arquivos versionados:

- `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` para o cliente web.
- `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` para o runtime do servidor.
- `SUPABASE_SERVICE_ROLE_KEY`, somente se uma operação estritamente server-side
  que ignore RLS for necessária. Nunca use prefixo `VITE_` nessa chave.
- `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`,
  `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` para habilitar o painel
  administrativo. São variáveis privadas de runtime; não use prefixo `VITE_`.
- `LOVABLE_DB_MIGRATION_URL` somente para uma execução de migration previamente
  revisada e autorizada; não é necessária para iniciar o app.

Antes de iniciar ou implantar o app, confirme que as URLs de frontend e SSR,
as chaves públicas correspondentes e o projeto selecionado no painel Supabase
pertencem todos ao ID acima. A alteração do `project_id` local não altera nem
valida as variáveis de runtime. Não troque URLs ou chaves por valores
presumidos. A publicação do código não executa migrations nem migra dados;
consulte as instruções de segurança abaixo antes de qualquer operação de
banco.

Gere `ADMIN_PASSWORD_HASH` sem gravar a senha em arquivo usando
`node .\scripts\generate-admin-password-hash.mjs` em um terminal privado. A
senha deve ter pelo menos 12 caracteres. Configure também um
`ADMIN_SESSION_SECRET` aleatório com pelo menos 32 caracteres e credenciais
HTTPS do Upstash Redis para limitar tentativas de login. O painel só será
habilitado quando essas variáveis, `SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY` estiverem configuradas no servidor. A chave de
service role nunca deve ser enviada ao navegador.
As sessões administrativas têm validade de 8 horas e são revogadas no Redis ao
sair do painel; se o armazenamento de sessão estiver indisponível, as operações
administrativas falham de forma fechada.

## Implantação

O projeto usa TanStack Start com Nitro e fixa o preset `vercel` para builds
fora do ambiente de build do Lovable. Na Vercel, configure as variáveis de
runtime adequadas para Production, Preview e Development sem expor
`SUPABASE_SERVICE_ROLE_KEY` ao cliente. O build local não valida secrets,
domínios, autenticação, banco ou comportamento na infraestrutura da Vercel;
valide primeiro em Preview/Staging.

## Regional settings

The Moto Car booking calendar operates in Minas Gerais, Brazil, using `pt-BR`,
BRL, 24-hour appointment times, and the `America/Sao_Paulo` timezone. Calendar
dates are handled as date-only values so the selected day and weekday do not
shift when the browser or database host uses UTC or another timezone.

Apply only migrations confirmed pending after reconciling the database ledger
and schema with `drizzle/migrations`. The booking-window/professional
migrations create shared Supabase professional records, enforce the
tomorrow-through-seven-days booking window, and save the selected professional
snapshot on new orders. They do not modify opening hours or delete or rewrite
existing orders and bookings. Follow the operator procedure below before
coordinating database and application releases.

Professional names, active flags, and WhatsApp numbers are stored in Supabase
and shared across devices. Existing orders preserve their saved professional
name and destination number; older orders remain unchanged and may not have
either value recorded.

Migration `0004_checkout_confirmation_token.sql` adds an opaque confirmation
token to new orders, makes checkout summary requests prove possession of that
token, and removes anonymous execution of the UUID-only summary RPC. It must be
reviewed and applied only after the database owner verifies the migration
ledger/schema and approves the coordinated checkout deployment. This project
does not apply migrations automatically.

Migration `0005_atomic_admin_slot_blocks.sql` serializes new reservations and
administrative slot-block changes with the same transaction-level lock, and
adds an RPC executable only by `service_role`. It does not create tables,
relax RLS, or modify existing rows. Reconcile the migration ledger and schema
and obtain explicit approval before applying it; the local code cannot use the
RPC until the migration is present remotely.

## Production migration safety (2026-10-16)

The production observations below are a dated record from an earlier check and
were not independently re-verified during the local code review. They are not
evidence of the current state of project `jbrxnnzkewipjpixcbfa`; verify the
dashboard project and rerun the read-only diagnostics before relying on them.

The earlier read-only API check reported the expected
`America/Sao_Paulo` timezone and weekly schedule. It also confirmed that the
availability RPC at that time still returned slots outside tomorrow through
seven days ahead. The RPC's date-window fix is in
`drizzle/migrations/0003_booking_window_and_professionals.sql`; the deployed
RPC reported then behaved like the no-window implementations in the
baseline/`0001`. The earlier check also reported missing
`orders.professional_name` and `professionals`, suggesting `0002` and `0003`
were not fully present at that time. None of these observations should be
treated as a current production finding.

The public Supabase API cannot read Drizzle's internal migration ledger. An
authorized database operator must inspect it in the Supabase SQL Editor using
the first two sections of
[`production_read_only.sql`](./drizzle/diagnostics/production_read_only.sql).
This project's PostgreSQL Drizzle runner uses
`drizzle.__drizzle_migrations`; the `created_at` values map to migration names
in the diagnostic query. The local journal is
[`_journal.json`](./drizzle/migrations/meta/_journal.json). The fact that the
database timezone is correct does not establish whether `0001` was recorded:
the initial schema already used that timezone.

### Authorized operator procedure

1. Confirm that the Supabase dashboard is connected to project
   `jbrxnnzkewipjpixcbfa`, then run sections 1-3 of
   [`production_read_only.sql`](./drizzle/diagnostics/production_read_only.sql)
   from the Supabase SQL Editor. The script cannot identify its project from
   SQL metadata alone. If the ledger relation is absent, do not query it
   directly and do not run the migration runner yet.
2. Compare ledger `created_at` values with the diagnostic's journal mapping and
   `hash` values with local migration files. The following computes hashes
   using the same UTF-8 migration text as Drizzle:

   ```powershell
   node -e "const fs=require('node:fs'),crypto=require('node:crypto'); for (const f of fs.readdirSync('drizzle/migrations').filter(f=>/^\d.*\.sql$/.test(f))) console.log(f,crypto.createHash('sha256').update(fs.readFileSync('drizzle/migrations/'+f,'utf8')).digest('hex'))"
   ```

3. Confirm `0000_migration` is recorded and its baseline schema matches. If the
   baseline is missing while its schema exists, the ledger is absent, a hash is
   unexpected, or the schema is only partially migrated, **stop**. Have the
   database owner reconcile the ledger/schema before invoking any runner; do
   not replay `0000`, use `drizzle-kit push`, or manually rerun a migration.
4. Confirm which of `0001` through `0005` are safely pending using both
   the ledger and schema/function diagnostics. This guards against partial or
   manually applied SQL that the ledger alone cannot detect.
5. Only after that review and explicit change approval, set
   `LOVABLE_DB_MIGRATION_URL` in a protected operator environment and run the
   project's Drizzle migration runner from the repository root. To enter the
   URL without echoing it in PowerShell history or terminal output:

   ```powershell
   $secureUrl = Read-Host "Authorized production migration URL" -AsSecureString
   try {
     $env:LOVABLE_DB_MIGRATION_URL = [System.Net.NetworkCredential]::new("", $secureUrl).Password
     npx.cmd drizzle-kit migrate
     if ($LASTEXITCODE -ne 0) { throw "Drizzle migration runner failed; stop and inspect the database before retrying." }
   } finally {
     Remove-Item Env:LOVABLE_DB_MIGRATION_URL -ErrorAction SilentlyContinue
     $secureUrl.Dispose()
   }
   ```

   The runner applies entries absent from its ledger in journal order. Never
   run this command while `0000` is unrecorded or when the ledger/schema differ
   unexpectedly. Do not print the connection URL or include it in shell logs.

6. Rerun the read-only diagnostic. Confirm both professionals match their
   expected configured values, the two order snapshot columns exist, the RPC
   returns zero slots at offsets -1, 0 and 8 and the configured schedule for
   offsets 1 through 7, the unique active-booking index is present, and the
   expected admin-only RLS policies and grants are installed.

   If applying `0005`, also confirm `public.admin_set_slot_block(date, text,
   boolean)` exists, is executable by `service_role` only, and the reservation
   and administrative blocking paths use the same advisory transaction lock.

Migration `0001` only pins the timezone and replaces availability logic;
`0002` adds nullable order snapshots, preserving existing orders; `0003`
creates and seeds the shared professional directory and applies the date
window, professional validation, and legacy-RPC revocation. These statements
do not delete bookings or rewrite order history. Do not repair any partial
application by replaying these files blindly.

Production readiness still requires a real authorized admin session to load
the agenda and inspect existing reservations. Do not create/cancel real
bookings or send WhatsApp messages just to test the flow.
