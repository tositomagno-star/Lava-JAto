# Relatório de finalização — Moto Car Lava-jato

## Escopo e conclusão

Este repositório contém a aplicação de agendamento do lava-jato Moto Car, não
um sistema genérico de gestão de funcionários. A implementação existente foi
preservada. A revisão e as verificações foram feitas localmente; **nenhuma
consulta ao banco de produção, migration, alteração de dados ou deploy foi
executado**.

O app **não deve ser declarado pronto para produção** até o proprietário
verificar o histórico/schema real do Supabase, aplicar de forma autorizada as
migrations que estiverem realmente pendentes e testar a integração no ambiente
de hospedagem.

## Funcionalidades identificadas

- Página inicial e catálogo carregado do Supabase (`services`), com estados de
  carregamento e erro.
- Carrinho persistido localmente, seleção de quantidades (limite de 50 por
  serviço) e cálculo do total exibido.
- Checkout com nome, telefone, veículo, forma de entrega, endereço quando há
  retirada, profissional, data e horário.
- Datas disponíveis de amanhã até sete dias à frente, usando aritmética de
  data em `America/Sao_Paulo`; horários e sua disponibilidade são consultados
  no Supabase e atualizados periodicamente.
- Revalidação do horário no envio. A proteção contra concorrência depende
  também do índice único parcial no banco.
- Painel administrativo protegido por autenticação/papel e pelas políticas
  RLS para dados privados. A tela mostra agenda, clientes, itens, totais,
  profissionais e permite login/logout, atualizar profissionais existentes,
  cadastrar profissionais e editar configurações básicas da empresa.
- Resumo do pedido enviado ao WhatsApp do profissional configurado no Supabase.

## Correções feitas nesta preparação

- O checkout rejeita telefone de cliente em formato inválido.
- O checkout abre uma janela do WhatsApp durante o gesto do usuário **antes**
  das chamadas assíncronas; se o navegador bloquear a janela, não cria o pedido
  nem limpa o carrinho. Em erro, a janela vazia é fechada.
- A solicitação de resumo de pedido passa a usar um token de confirmação
  aleatório, além do UUID. O token fica em `sessionStorage` para que uma
  repetição após recarregar a mesma aba possa recuperar o mesmo pedido. A
  migration local `0004` cria essa capacidade e revoga a chamada pública que
  aceitava somente o UUID.
- Ao adicionar novamente um serviço existente, o carrinho atualiza nome e
  preço do catálogo antes de incrementar a quantidade. Itens persistidos são
  validados antes de serem usados; falhas de leitura/gravação são registradas
  explicitamente.
- O WhatsApp distingue subtotal de serviços e taxa de retirada.
- O catálogo exibe mensagem explícita quando a consulta retorna zero serviços.
- As definições TypeScript foram atualizadas para o novo contrato RPC/coluna.
- O acesso administrativo valida o papel também no servidor por uma Server
  Function autenticada e consulta `has_role` no banco; leituras e gravações
  seguem sujeitas às políticas RLS, sem usar service-role no navegador.
- A tela administrativa agora mostra `settings.schedule` real, valida seu
  formato e não apresenta horários padrão como se fossem dados remotos. A
  inclusão de profissionais usa um UUID gerado e exige nome/WhatsApp antes de
  salvar; não há cadastro público de administradores.
- `supabase/config.toml` agora aponta para o ID do projeto informado pelo
  proprietário. O `vite.config.ts` fixa o preset Nitro `vercel` fora do build
  gerenciado pelo Lovable. A saída Vercel local foi gerada com sucesso.
- O diagnóstico SQL read-only reconhece `0004` e inspeciona tabelas, colunas,
  constraints, índices, triggers, RPCs, grants e políticas sem ler linhas de
  clientes/pedidos.
- Formatação automática corrigiu erros Prettier; também foi corrigido o erro
  `prefer-const` na comunicação de preview de autenticação.
- README atualizado com configuração local, uso do Supabase e cautela sobre
  histórico de migrations.

## Limitações e pendências funcionais

- Serviços, preços, profissionais, disponibilidade, configurações e criação de
  pedidos continuam dependentes do Supabase real; os dados comerciais não são
  substituídos por fixtures locais.
- Embora o código local use token idempotente, isso depende da migration
  `0004` estar instalada no banco antes de liberar o checkout correspondente.
- Status de pedidos/agendamentos são exibidos, mas não há controles para
  cancelar, remarcar ou mudar o status. Valores de pagamento/parcial recebido
  também não têm fluxo de conciliação. Nenhuma transição comercial foi
  inventada nesta revisão.
- Os horários são exibidos a partir de `settings.schedule`, mas não há edição
  de horários no painel. Confirmar regras/capacidade e política de alteração
  com o proprietário antes de acrescentar essa operação.
- Itens antigos no armazenamento local podem manter preço antigo até serem
  adicionados novamente; o servidor deve ser a fonte final do preço/totais. A
  conferência de valores usa o resumo oficial retornado após criar o pedido.
- Testes de integração com Supabase, login administrativo real, RLS,
  compatibilidade RPC, concorrência no banco e envio real do WhatsApp não foram
  executados.

## Resultados das verificações locais

| Verificação                         | Resultado                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| TypeScript (`npx tsc --noEmit`)     | Passou após as alterações locais                                                                             |
| Testes Vitest                       | 20 testes em 7 arquivos passaram                                                                             |
| Build de produção (`npm run build`) | Passou; Nitro gerou `.vercel/output` com o preset Vercel e função Node.js                                    |
| ESLint (`npm run lint`)             | Passou sem erros; 8 avisos `react-refresh/only-export-components` preexistentes                              |
| Smoke test HTTP local               | `nitro preview` no preset Vercel respondeu HTTP 200 em `/`, `/servicos`, `/carrinho`, `/checkout` e `/admin` |
| Supabase/produção                   | Não consultado nesta revisão                                                                                 |
| Migration/deploy                    | Não executados                                                                                               |

O build Vercel emite um aviso do Vite sobre `vite-tsconfig-paths` e outro sobre
tamanho de chunk; nenhum deles impediu a compilação. O workspace tem `bun.lock`,
mas Bun não estava disponível no PATH. As verificações usaram dependências já
instaladas, via `npm.cmd`; não foi feita instalação/atualização de pacotes.
O bundle público foi verificado por padrões de credenciais: não foram
encontrados tokens/chaves secretas nem a variável de service-role com valor.
O literal `sb_secret_` do código é somente a verificação de prefixo para o
formato de chave Supabase; nenhum valor de chave foi exibido neste relatório.

## Contrato esperado do Supabase (derivado das migrations locais)

Estas definições descrevem o código/migrations do repositório, **não confirmam**
o schema atualmente implantado.

### Tabelas, colunas e constraints

- `public.user_roles`: `id uuid` PK, `user_id uuid` FK para
  `auth.users(id)` com cascade, `role public.app_role`; único por
  `(user_id, role)`. Enum `public.app_role`: `admin`.
- `public.services`: `id uuid` PK, `name text`, `description text`,
  `price numeric(10,2)` não negativo, `image_key text`, `image_url text`,
  `active boolean`, `sort_order int`, `created_at timestamptz`.
- `public.settings`: `id int` PK restrito a `1`, `company_name text`,
  `whatsapp text`, `instagram text`, `contact_info text`, `address text`,
  `timezone text` (padrão `America/Sao_Paulo`), `slot_capacity int` (mínimo 1),
  `pickup_fee numeric(10,2)` (não negativo), `schedule jsonb`,
  `updated_at timestamptz`.
- `public.orders`: `id uuid` PK, `code text` único, `customer_name text`,
  `phone text`, `vehicle_model text`, `plate text`, `delivery_method text`
  (`dropoff`/`pickup`), `cep text`, `street text`, `district text`,
  `complement text`, `reference text`, `notes text`,
  `subtotal numeric(10,2)`, `pickup_fee numeric(10,2)`,
  `total numeric(10,2)`, `status text`
  (`awaiting_send`/`awaiting_confirmation`/`confirmed`/`completed`/`cancelled`),
  `payment_status text` (`unpaid`/`paid`), `paid_amount numeric(10,2)`,
  `created_at timestamptz`, `updated_at timestamptz`.
  Migration `0002` adiciona `professional_name text` e
  `professional_phone text`, ambos nullable. A migration local `0004` adiciona
  `confirmation_token uuid` nullable e índice único parcial para tokens não
  nulos.
- `public.order_items`: `id uuid` PK, `order_id uuid` FK para orders com
  cascade, `service_id uuid` FK para services com `SET NULL`, `service_name
text`, `quantity int` de 1 a 50, `unit_price numeric(10,2)` não negativo,
  `subtotal numeric(10,2)` não negativo.
- `public.bookings`: `id uuid` PK, `order_id uuid` FK para orders com cascade,
  `booking_date date`, `slot_time text`, `status text` (`active`/`cancelled`),
  `created_at timestamptz`. Índice único parcial `bookings_unique_active` em
  `(booking_date, slot_time)` quando `status = 'active'`.
- `public.slot_blocks`: `id uuid` PK, `block_date date`, `slot_time text`,
  `reason text`, `created_at timestamptz`; único em `(block_date, slot_time)`.
- `public.professionals` (migration `0003`): `id text` PK, `name text` (1–100
  caracteres após trim), `whatsapp text` no formato `55` + 10 ou 11 dígitos,
  `active boolean`, `updated_at timestamptz`.

### RPCs e segurança

- `has_role(_user_id uuid, _role app_role) -> boolean`: `SECURITY DEFINER`;
  policies a chamam com `auth.uid()`. A migration base não declara
  explicitamente `REVOKE/GRANT` para essa função; confirmar privilégios
  efetivos no projeto.
- `get_availability(_date date) -> (slot_time text, state text)[]`: público
  para `anon` e `authenticated`; a versão de `0003` limita amanhã até o sétimo
  dia e retorna apenas o estado do horário.
- `create_order(_payload jsonb) -> jsonb`: RPC legado; `0003` revoga
  `PUBLIC`, `anon` e `authenticated`.
- `create_order_with_professional(_payload jsonb, _professional_name text,
_professional_phone text) -> jsonb`: versão existente usada pelo checkout;
  retorna `{id, code}` e é pública para o fluxo anônimo. `0004` revoga essa
  assinatura pública.
- `get_order_summary(_id uuid) -> jsonb`: versão anterior permite consultar
  informações pessoais do pedido por UUID sem autenticação/prova de posse.
  A migration `0004` revoga a execução pública dessa assinatura.
- `create_order_with_professional(jsonb, text, text, uuid) -> jsonb`: contrato
  de `0004`; aceita token de confirmação e é idempotente para o mesmo token.
- `get_order_summary(_id uuid, _confirmation_token uuid) -> jsonb`: contrato
  de `0004`; exige o token guardado no pedido para revelar o resumo ao cliente.

O índice único de bookings evita duas reservas ativas concorrentes para a mesma
data/horário. A checagem de disponibilidade feita no navegador, sozinha, não
seria suficiente sem esse constraint.

### RLS e privilégios definidos localmente

Todas as políticas abaixo são as que aparecem nas migrations locais:

- `user_roles`: RLS; `authenticated` pode `SELECT` apenas a própria linha
  (`own roles readable`); `service_role` tem `ALL`.
- `services`: leitura por `anon`/`authenticated` somente de serviços ativos ou
  para admin (`public read active services`); `admin manage services` permite
  gestão a admin; `service_role` tem `ALL`.
- `settings`: `public read settings` permite leitura pública da linha de
  configuração; `admin update settings` permite atualização a admin;
  `service_role` tem `ALL`.
- `orders`: sem grant anônimo; `authenticated` tem `SELECT, UPDATE`, limitado
  às policies `admin read orders` e `admin update orders`; `service_role` tem
  `ALL`.
- `order_items`: `admin read items` limita `SELECT` a admin; `authenticated`
  tem `SELECT`, `service_role` tem `ALL`.
- `bookings`: `admin read bookings` e `admin update bookings`; `authenticated`
  tem `SELECT, UPDATE`, `service_role` tem `ALL`.
- `slot_blocks`: `admin manage blocks`; `authenticated` tem `SELECT, INSERT,
DELETE`, `service_role` tem `ALL`.
- `professionals`: `public read active professionals` permite profissionais
  ativos ou leitura admin; `admin manage professionals` limita gestão a admin;
  `anon, authenticated` têm `SELECT`, `authenticated` tem `INSERT, UPDATE,
DELETE`, `service_role` tem `ALL`.

O RPC UUID-only de resumo é o risco de exposição de dados encontrado na revisão.
O código foi preparado para o token e a migration `0004` revoga a chamada
insegura, mas **a proteção só entra em vigor no banco depois da aplicação
autorizada da migration**. Não aplicar `0004` isoladamente se `0002`/`0003` ou
o ledger não estiverem reconciliados.

## Migrations e histórico

Ordem registrada no journal local:

1. `0000_migration.sql` — schema base, políticas RLS, pedidos e agendamentos.
2. `0001_minas_gerais_timezone.sql` — fuso `America/Sao_Paulo` e função de
   disponibilidade.
3. `0002_order_professional_snapshot.sql` — snapshot de profissional em
   pedidos e resumo do pedido.
4. `0003_booking_window_and_professionals.sql` — cadastro compartilhado de
   profissionais, janela de reservas e restrição da RPC legada.
5. `0004_checkout_confirmation_token.sql` — migration nova desta revisão para
   proteger o resumo e permitir confirmação idempotente.

O README preserva um **registro histórico** datado que alegava ausência de
partes de `0002`/`0003` na produção. Esse estado não foi reconsultado; é
essencial verificar o ledger `drizzle.__drizzle_migrations`, hashes e schema
antes de qualquer aplicação. `drizzle/schema.ts` e o snapshot Drizzle são
incompletos/vazios em comparação com as migrations SQL manuais: não usar
`drizzle-kit push` nem executar migrations às cegas. Nenhuma migration foi
executada nesta tarefa; a sintaxe de `0004` não foi executada nem validada por
um servidor PostgreSQL nesta máquina.

## Variáveis de ambiente e alvo Supabase

Variáveis referenciadas pelo código/documentação (nenhum valor secreto é
incluído neste relatório):

- Browser: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Runtime/SSR: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.
- Cliente server-only que ignora RLS: `SUPABASE_SERVICE_ROLE_KEY`; nunca usar
  prefixo `VITE_` nem expor no bundle do navegador.
- Migration manual autorizada: `LOVABLE_DB_MIGRATION_URL`.
- Autenticação de cron: `LOVABLE_CRON_SECRET` e, opcionalmente,
  `LOVABLE_CRON_SECRET_PREVIOUS`.

`SUPABASE_PROJECT_ID` e `VITE_SUPABASE_PROJECT_ID` também constam no `.env`
local, mas não foram identificadas como necessárias pelo contrato RPC/tabela
descrito acima. A análise local confirmou que os IDs nas URLs de runtime e
esses IDs declarados não correspondem ao projeto pretendido
`jbrxnnzkewipjpixcbfa`. As variáveis necessárias existem localmente, mas os
valores não foram exibidos nem alterados. Atualize as URLs e as chaves públicas
correspondentes no ambiente local e na Vercel após obter os valores oficiais
do projeto. `SUPABASE_SERVICE_ROLE_KEY` e `LOVABLE_DB_MIGRATION_URL` não estão
configuradas localmente e não são necessárias para o fluxo atual do cliente
público; não adicione essas credenciais ao bundle. `.env` permanece ignorado e
fora do versionamento.

## Próximas ações manuais — Supabase e Vercel

### Supabase

1. No projeto correto, um operador autorizado deve executar as consultas
   **read-only** de `drizzle/diagnostics/production_read_only.sql` e comparar o
   ledger/hashes com o journal local e o schema real.
2. Resolver qualquer divergência ou aplicação parcial antes de rodar qualquer
   migration. Não recriar banco, repetir baseline, usar `drizzle-kit push` ou
   reexecutar SQL manualmente.
3. Depois de aprovação explícita, aplicar as migrations realmente pendentes na
   ordem reconciliada, incluindo `0004` após `0002` e `0003`. Coordenar o
   deploy do checkout com a alteração das assinaturas RPC.
4. Verificar RLS, grants, constraints de booking, janela de datas,
   profissionais, RPCs e que `get_order_summary(uuid)` não é executável por
   `anon`/`authenticated`.
5. Confirmar política de cadastro/login de usuários e bootstrap do primeiro
   admin: a migration base atribui admin ao primeiro usuário criado se ainda
   não houver papel; não deixar sign-up público aberto sem decisão do operador.
6. Validar checkout e painel com credenciais admin autorizadas, sem criar ou
   cancelar reservas reais apenas para teste.

### Vercel

- Não foi encontrado `vercel.json`. O `vite.config.ts` seleciona o preset
  Vercel do Nitro fora do build gerenciado pelo Lovable; `npm run build` gerou
  `.vercel/output` com uma função Node.js e recursos estáticos. `npm run preview`
  usa `nitro preview`; `vite preview` não é compatível com esse diretório de
  saída. Isso verifica o artefato local, mas não uma implantação Vercel.
- Configurar e conferir as variáveis por ambiente no painel da Vercel para
  Production, Preview e Development, sem commitar `.env`.
- Garantir que somente valores publicáveis `VITE_*` cheguem ao navegador e que
  `SUPABASE_SERVICE_ROLE_KEY` e `LOVABLE_DB_MIGRATION_URL` permaneçam em
  ambiente server/operator protegido.
- Após configurar, validar SSR, funções de servidor, autenticação e o fluxo
  público usando um ambiente de staging antes de promover a produção.
