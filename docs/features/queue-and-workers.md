# Fila e workers

**Estado: adapter BullMQ/Redis, consumidor NestJS e rota de ingresso implementados; processamento de negócio persistente ainda não existe.**

## Objetivo

Separar aceitação HTTP do processamento demorado e absorver picos de volume com concorrência limitada, retries e recuperação após reinício.

## Adapter atual

- Fila: `event-ingestion`; nome do job: `process-event`.
- O adapter salva envelope e fingerprint em Redis via `Queue.add` e usa `eventId` como `jobId`.
- Uma leitura posterior ao `add` compara o fingerprint persistido, cobrindo corridas em que o mesmo ID chega com conteúdo diferente.
- Erros do Redis não são convertidos em aceitação; o port lança `EventAdmissionUnavailableError`.
- A API e o worker são processos independentes: `npm run start:dev` sobe a API e `npm run start:worker:dev` sobe o consumidor. A separação permite escalar cada papel de forma independente.
- O consumidor `EventIngestionWorker` aceita apenas o nome de job esperado, revalida envelope e fingerprint e rejeita payloads inválidos como falhas permanentes, sem gastar tentativas de retry.
- `WORKER_CONCURRENCY` configura o limite por processo (padrão 5; faixa aceita de 1 a 100). O padrão é uma hipótese didática, não um resultado de benchmark. Concorrência total cresce com o número de processos.
- Jobs são adicionados com até 5 tentativas e backoff exponencial com jitter. Falhas do handler são relançadas para o BullMQ controlar retry; o log inclui metadados técnicos, sem payload ou mensagem da exceção.
- O Nest recebe sinais de encerramento e fecha o contexto do worker para permitir que jobs ativos terminem antes da saída. Em encerramento abrupto, o BullMQ pode recuperar jobs stalled, então o processamento continua exigindo idempotência.
- O handler atual (`DemoEventProcessor`) só registra metadados demonstrativos. Job concluído significa que esse handler de demonstração terminou; não significa que um efeito de negócio foi persistido.
- `POST /events` publica eventos autenticados após validação, rate limit e confirmação do adapter; o worker os consome assincronamente.
- `npm run test:redis` verifica o adapter contra Redis real; a suíte padrão usa um fake.
- A imagem local habilita AOF com `appendfsync everysec`; Redis pode perder cerca de um segundo de gravações após falha abrupta. A configuração não prova durabilidade sem perda.
- Jobs concluídos e falhos permanecem no Redis. A retenção indefinida preserva a deduplicação atual por `jobId`, mas consome memória; tamanho, retenção e expurgo precisam de uma estratégia explícita antes de operação contínua.

BullMQ ignora um `jobId` repetido enquanto o registro daquele job ainda existe; quando o job é removido, o mesmo ID pode ser aceito novamente. Por isso, a limpeza automática de jobs deve esperar uma política de retenção que preserve a idempotência pelo período definido. [Documentação de job IDs](https://docs.bullmq.io/guide/jobs/job-ids)

## Direção técnica

BullMQ com Redis foi escolhido. A API publicará envelopes validados; workers consumirão assincronamente. A semântica assume entrega pelo menos uma vez: falha, perda de confirmação ou encerramento abrupto pode levar ao reprocessamento.

O worker usa `@Processor`/`WorkerHost` do Nest e executa em um application context sem servidor HTTP. A concorrência local melhora o aproveitamento em tarefas com I/O; aumentar réplicas oferece paralelismo e disponibilidade, mas eleva a concorrência agregada e a pressão sobre Redis e dependências. O valor precisa ser medido com a carga real. [NestJS queues](https://docs.nestjs.com/techniques/queues), [BullMQ concurrency](https://docs.bullmq.io/guide/workers/concurrency)

O retry atual tem cinco tentativas totais, backoff exponencial iniciado em um segundo e jitter de 50%. Entradas inválidas usam `UnrecoverableError`; erros transitórios do processador seguem o retry comum. Após esgotar tentativas, BullMQ mantém o job no estado `failed`. Isso é uma área de falhas consultável, ainda não uma DLQ separada com redrive e auditoria. [BullMQ retries](https://docs.bullmq.io/guide/retrying-failing-jobs)

O encerramento gracioso permite que jobs ativos terminem durante `close`; não há timeout de negócio forçado, pois interromper uma operação sem cancelamento cooperativo poderia deixá-la parcialmente executada. [BullMQ graceful shutdown](https://docs.bullmq.io/guide/workers/graceful-shutdown)

## Política a definir

- Medir throughput, latência e memória para calibrar `WORKER_CONCURRENCY`; definir backpressure de entrada com base na capacidade sustentável do worker.
- Tornar número de tentativas e backoff configuráveis; classificar erros do domínio como transitórios ou permanentes.
- Criar DLQ dedicada, retenção, redrive manual e trilha de auditoria; hoje falhas esgotadas permanecem no conjunto `failed` do BullMQ.
- Definir timeout e cancelamento cooperativo para handlers com efeitos externos.
- Implementar idempotência do efeito de negócio em persistência durável; a idempotência de admissão por `jobId` não torna o handler exatamente uma vez.
- A persistência Redis deve ser escolhida com RPO explícito: AOF `everysec` pode perder cerca de um segundo de gravações após falha abrupta; `always` é mais durável e tem custo de desempenho. [Redis persistence](https://redis.io/docs/latest/management/persistence/)
- Reequilíbrio de jobs stalled após queda e limites operacionais para jobs de longa duração.
- Segurança de conexão, autenticação, TLS e limites de memória do Redis.

## Critérios de conclusão

- Mensagem aceita pela API sobrevive ao reinício da aplicação dentro da garantia definida.
- Worker idempotente com efeito persistido e concorrência configurável, ajustada por evidência de carga.
- Erros transitórios e permanentes têm políticas distintas; falhas permanentes chegam a DLQ com redrive auditável.
- Runbook local e operacional documentado.

## Como executar localmente

```bash
docker compose up -d redis
npm run start:worker:dev
```

O processo do worker inicia sem endpoint HTTP próprio e aguarda jobs na fila. A API de ingestão já pode publicar; o handler continua demonstrativo e não deve ser apresentado como processamento de negócio persistido.
