# Fila e workers

**Estado: planejado.** Não há Redis, BullMQ nem worker neste momento.

## Objetivo

Separar aceitação HTTP do processamento demorado e absorver picos de volume com concorrência limitada, retries e recuperação após reinício.

## Direção técnica

Avaliar BullMQ com Redis. A API publica envelopes validados; workers consomem assincronamente. A semântica deve assumir entrega pelo menos uma vez: timeout ou perda de confirmação pode levar ao reprocessamento.

## Política a definir

- Concorrência máxima por worker e mecanismo de backpressure.
- Número de tentativas, backoff com jitter e classificação de erros transitórios/permanentes.
- Dead-letter queue, retenção, redrive manual e trilha de auditoria.
- Timeout de processamento, encerramento gracioso e reequilíbrio de jobs após queda.
- Segurança de conexão, autenticação, TLS e limites de memória do Redis.

## Critérios de conclusão

- Mensagem aceita pela API sobrevive ao reinício da aplicação dentro da garantia definida.
- Worker idempotente e concorrência configurável.
- Erros permanentes chegam a dead-letter e retries são observáveis.
- Runbook local e operacional documentado.
