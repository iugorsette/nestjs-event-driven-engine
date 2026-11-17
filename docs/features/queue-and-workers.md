# Fila e workers

**Estado: adapter BullMQ/Redis implementado; rota e worker ainda não existem.**

## Objetivo

Separar aceitação HTTP do processamento demorado e absorver picos de volume com concorrência limitada, retries e recuperação após reinício.

## Adapter atual

- Fila: `event-ingestion`; nome do job: `process-event`.
- O adapter salva envelope e fingerprint em Redis via `Queue.add` e usa `eventId` como `jobId`.
- Uma leitura posterior ao `add` compara o fingerprint persistido, cobrindo corridas em que o mesmo ID chega com conteúdo diferente.
- Erros do Redis não são convertidos em aceitação; o port lança `EventAdmissionUnavailableError`.
- Sem worker, os jobs ficam aguardando. Sem rota HTTP, nenhuma requisição externa publica eventos ainda.
- `npm run test:redis` verifica o adapter contra Redis real; a suíte padrão usa um fake.
- A imagem local habilita AOF com `appendfsync everysec`; Redis pode perder cerca de um segundo de gravações após falha abrupta. A configuração não prova durabilidade sem perda.

BullMQ ignora um `jobId` repetido enquanto o registro daquele job ainda existe; quando o job é removido, o mesmo ID pode ser aceito novamente. Por isso, o worker futuro não deve ativar limpeza automática de jobs antes de definir e implementar a retenção do registro de idempotência. [Documentação de job IDs](https://docs.bullmq.io/guide/jobs/job-ids)

## Direção técnica

BullMQ com Redis foi escolhido. A API publicará envelopes validados; workers consumirão assincronamente. A semântica assume entrega pelo menos uma vez: timeout ou perda de confirmação pode levar ao reprocessamento.

## Política a definir

- Concorrência máxima por worker e mecanismo de backpressure.
- Número de tentativas, backoff com jitter e classificação de erros transitórios/permanentes.
- Dead-letter queue, retenção, redrive manual e trilha de auditoria.
- A persistência Redis deve ser escolhida com RPO explícito: AOF `everysec` pode perder cerca de um segundo de gravações após falha abrupta; `always` é mais durável e tem custo de desempenho. [Redis persistence](https://redis.io/docs/latest/management/persistence/)
- Timeout de processamento, encerramento gracioso e reequilíbrio de jobs após queda.
- Segurança de conexão, autenticação, TLS e limites de memória do Redis.

## Critérios de conclusão

- Mensagem aceita pela API sobrevive ao reinício da aplicação dentro da garantia definida.
- Worker idempotente e concorrência configurável.
- Erros permanentes chegam a dead-letter e retries são observáveis.
- Runbook local e operacional documentado.
