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
```

## Rotas

- `/` — página inicial e resumo dos serviços
- `/servicos` — catálogo de serviços e preços
- `/carrinho` — revisão dos serviços escolhidos
- `/checkout` — seleção de data/horário e envio do pedido
- `/admin` — agenda e configurações administrativas; requer usuário autenticado
  com o papel `admin` no Supabase

## Supabase e variáveis de ambiente

O app usa o projeto Supabase existente configurado para o ambiente Lovable. Para
desenvolvimento local, obtenha os valores autorizados do projeto existente e
configure-os no ambiente local, nunca em arquivos versionados:

- `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` para o cliente web.
- `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` para o runtime do servidor.
- `SUPABASE_SERVICE_ROLE_KEY`, somente se uma operação estritamente server-side
  que ignore RLS for necessária. Nunca use prefixo `VITE_` nessa chave.
- `LOVABLE_DB_MIGRATION_URL` somente para uma execução de migration previamente
  revisada e autorizada; não é necessária para iniciar o app.

Não substitua URL, identificador, chaves ou banco de produção durante a
importação para o GitHub. A publicação do código não executa migrations nem
migra dados. Consulte as instruções de segurança abaixo antes de qualquer
operação de banco.

## Implantação

O projeto usa o preset TanStack Start do Lovable para Vite/Nitro; mantenha a
configuração de hospedagem existente ao escolher o destino de implantação.
Este README não configura domínio, secrets de produção ou serviços externos.

## Regional settings

The Moto Car booking calendar operates in Minas Gerais, Brazil, using `pt-BR`,
BRL, 24-hour appointment times, and the `America/Sao_Paulo` timezone. Calendar
dates are handled as date-only values so the selected day and weekday do not
shift when the browser or database host uses UTC or another timezone.

Apply pending SQL files in `drizzle/migrations` when deploying database
changes. The booking-window/professional migrations create shared Supabase
professional records, enforce the tomorrow-through-seven-days booking window,
and save the selected professional snapshot on new orders. They do not modify
opening hours or delete or rewrite existing orders and bookings. Apply the
migrations in order before deploying the corresponding checkout and admin
changes.

Professional names, active flags, and WhatsApp numbers are stored in Supabase
and shared across devices. Existing orders preserve their saved professional
name and destination number; older orders remain unchanged and may not have
either value recorded.

## Production migration safety (2026-10-16)

The read-only production API check confirmed the expected
`America/Sao_Paulo` timezone and weekly schedule. It also confirmed that the
current availability RPC still returns slots outside tomorrow through seven
days ahead. The RPC's date-window fix is in
`drizzle/migrations/0003_booking_window_and_professionals.sql`; the deployed
RPC behaves like the no-window implementations in the baseline/`0001` and
returned availability for dates beyond the allowed range. Production also lacks
`orders.professional_name` and the `professionals` table, so `0002` and `0003`
are not fully present.

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

1. Run the read-only statements in
   [`production_read_only.sql`](./drizzle/diagnostics/production_read_only.sql)
   from the Supabase SQL Editor while connected to the intended production
   project. If the ledger relation is absent, do not query it directly and do
   not run the migration runner yet.
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
4. Confirm which of `0001`, `0002`, and `0003` are safely pending using both
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

Migration `0001` only pins the timezone and replaces availability logic;
`0002` adds nullable order snapshots, preserving existing orders; `0003`
creates and seeds the shared professional directory and applies the date
window, professional validation, and legacy-RPC revocation. These statements
do not delete bookings or rewrite order history. Do not repair any partial
application by replaying these files blindly.

Production readiness still requires a real authorized admin session to load
the agenda and inspect existing reservations. Do not create/cancel real
bookings or send WhatsApp messages just to test the flow.
