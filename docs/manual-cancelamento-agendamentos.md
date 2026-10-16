# Manual de Utilização — Cancelamento de Agendamentos | Moto Car

**Versão do código verificada:** commit `605e683912451868ea8cfaf11853b5a1abaf0338`

**Última verificação:** 16 de outubro de 2026
**Endereço do painel:** `/admin` no domínio oficial do site

## 1. Acessar o painel administrativo

1. Abra o site Moto Car e acrescente `/admin` ao domínio. Por exemplo, no domínio de produção verificado: `https://lava-j-ato.vercel.app/admin`.
2. O servidor verifica se a sessão administrativa está configurada. Se aparecer **“O acesso administrativo ainda não está configurado no servidor.”**, o painel não está pronto para autenticação naquele ambiente; solicite ao responsável técnico a configuração das variáveis privadas do servidor.
3. Quando a configuração estiver ativa, informe a senha administrativa fornecida pelo responsável autorizado e selecione **Entrar**. Não existe login por e-mail neste painel.
4. Depois de entrar, selecione **Agendamentos** para abrir a lista de atendimentos.

Não compartilhe a senha pelo WhatsApp, e-mail ou com pessoas não autorizadas. A sessão é mantida por cookie protegido e expira após oito horas; use **Sair** ao terminar.

## 2. Cancelar um agendamento

1. Na seção **Agendamentos**, escolha a data do atendimento.
2. Localize o registro correto. Confira o nome do cliente, serviço, data e horário exibidos. Se algum dado não estiver disponível, o painel indica que não foi informado.
3. No registro ativo, selecione **Cancelar agendamento**.
4. Revise os dados apresentados na janela e confirme que correspondem ao atendimento que deve ser desmarcado.
5. Se estiver correto, selecione **Confirmar cancelamento**. Para interromper sem alterar o registro, selecione **Voltar**.
6. Aguarde a mensagem de resultado exibida pelo painel.

### Exemplo ilustrativo

> **Exemplo fictício:** Ana precisa desmarcar o atendimento de lavagem marcado para 20/10 às 10:00 por causa de um imprevisto. O administrador abre **Agendamentos**, escolhe 20/10, confere o nome, o serviço e o horário de Ana, seleciona **Cancelar agendamento** e revisa os dados. Só então confirma. Nenhum cancelamento é feito se selecionar **Voltar**.

## 3. O que acontece depois

- O registro de agendamento permanece no histórico com status cancelado; ele não é apagado.
- O painel atualiza o registro e consulta novamente a disponibilidade do horário.
- Se o horário continuar dentro da agenda e das regras de data/hora, e não houver bloqueio independente, pode ficar livre para uma nova reserva.
- Se houver um bloqueio independente, o painel informa **“Agendamento desmarcado, mas o horário continua bloqueado.”** O cancelamento não remove esse bloqueio.
- A mensagem de sucesso quando o banco confirma disponibilidade é **“Agendamento desmarcado. O banco confirmou que o horário está livre.”** Se a agenda ainda não permitir oferecer o horário, o painel apresenta **“Agendamento desmarcado; a disponibilidade atual não permite oferecer o horário.”**
- Se a gravação falhar, o painel mostra uma mensagem de erro e não deve ser tratado como cancelamento concluído. Se o cancelamento for salvo, mas a atualização complementar da tela falhar, o painel informa que o agendamento foi cancelado e que nem todos os dados puderam ser atualizados.
- O sistema não envia notificação automática ao cliente. A empresa deve avisá-lo por um canal de atendimento apropriado.

Para verificar a conclusão, confirme que o registro aparece como **Desmarcado** na lista e leia a mensagem de resultado sobre a disponibilidade. A disponibilidade exibida vem de uma nova consulta ao servidor/banco.

## 4. Diferença entre bloquear e cancelar

**Bloquear horário** impede uma nova reserva em um horário livre. O painel oferece essa ação na seção **Bloquear horários**.

**Cancelar agendamento** desmarca uma reserva que já existia, preservando o registro no histórico. Isso pode liberar o horário, mas não remove um bloqueio independente. São operações diferentes: cancelar não equivale a desbloquear.

## 5. Cuidados importantes

- Confira cliente, serviço, data e horário antes de confirmar.
- Não confirme se os dados não corresponderem ao atendimento desejado.
- Não compartilhe a senha administrativa.
- Se houver erro, anote a mensagem e consulte o estado do agendamento antes de repetir a operação, para evitar tentativas duplicadas.
- O servidor exige sessão administrativa válida e atualiza somente o agendamento selecionado que ainda esteja ativo. Se outro administrador já tiver alterado o registro, a atualização condicional evita repetir o cancelamento.

## 6. Testes e limitações

Na verificação de 16/10/2026, o commit indicado acima estava no `main` do GitHub e havia um status **Vercel — “Deployment has completed”** associado a esse commit. As rotas públicas `/`, `/servicos`, `/carrinho` e `/admin` responderam HTTP 200. A página administrativa pode ser aberta sem autenticação, mas as operações administrativas exigem sessão no servidor.

Os testes automatizados do código passaram: **38 testes**, TypeScript, ESLint, `drizzle-kit check` e build de produção. As mensagens e estados de cancelamento foram revisados no código e nas migrations existentes. Não foi executado um cancelamento real nem uma operação de escrita de teste, pois não havia banco isolado com dados sintéticos confirmado. Portanto, não se declara que o fluxo completo de cancelamento foi exercitado contra dados em produção.

Não havia Vercel CLI instalada nem vínculo local do projeto. O status do GitHub confirma que a Vercel marcou uma implantação como concluída para o commit, mas os logs detalhados de build/runtime e as variáveis remotas não puderam ser inspecionados nesta sessão.

**Escopo deste manual:** descreve o comportamento do código do commit verificado e as evidências remotas disponíveis nessa data. O uso em produção depende de o domínio estar servindo esse commit e de a autenticação administrativa estar configurada. Se a implantação ou a configuração mudar, valide novamente antes de seguir estas instruções.
