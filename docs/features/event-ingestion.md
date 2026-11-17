# Ingestão de eventos

**Estado: contrato, caso de uso, adapter BullMQ, worker e `POST /events` implementados.** A rota exige chave de produtor, aplica limite distribuído por IP e só responde `202` depois da confirmação do job no Redis. O handler atual é demonstrativo e não persiste efeitos de negócio.

## Objetivo

Receber eventos de produtores autenticados, validar o contrato e colocá-los em uma fila durável sem manter a conexão HTTP aberta durante o processamento.

## Envelope inicial

O envelope aceito pelo DTO contém:

| Campo | Regra |
| --- | --- |
| `eventId` | UUID v4 estável para identificar o evento. |
| `eventType` | Nome de até 128 caracteres, em minúsculas, como `order.created`. |
| `schemaVersion` | Inteiro a partir de 1. |
| `occurredAt` | Timestamp ISO 8601 estrito com timezone explícito. |
| `payload` | Objeto JSON definido pelo schema do tipo de evento. |

Exemplo válido:

```json
{
  "eventId": "5fd55d2a-4506-4cd5-9314-2f0a00a43167",
  "eventType": "order.created",
  "schemaVersion": 1,
  "occurredAt": "2026-11-17T12:30:00Z",
  "payload": {
    "orderId": "ord-123",
    "totalCents": 4200
  }
}
```

Campos desconhecidos são rejeitados pela `ValidationPipe` global. A rota autentica o produtor pelo header `Authorization: Bearer <INGEST_API_KEY>`; a identidade do produtor/tenant não é aceita no payload. A chave deve ter de 32 a 256 caracteres imprimíveis; em produção ela é obrigatória e deve vir de um secret manager.

Gere uma chave de desenvolvimento com `openssl rand -hex 32` e configure `INGEST_API_KEY` no `.env` local. Para o exemplo `curl`, exporte a mesma chave no terminal como `INGEST_API_KEY`. Nunca use uma chave real no `.env.example`, README, logs ou Git.

## Semântica de aceitação

- `202 Accepted` só depois de a fila confirmar publicação durável.
- Erro de validação deve identificar o campo sem ecoar segredos ou payloads sensíveis.
- `eventId` é a identidade estável de idempotência; não será necessário um segundo header `Idempotency-Key` no contrato inicial.
- Reenvio do mesmo `eventId` com o mesmo envelope é duplicata e deve devolver a confirmação original sem publicar de novo.
- Reenvio do mesmo `eventId` com conteúdo diferente é conflito HTTP `409` e não deve publicar.
- A aplicação não pode responder como aceitação antes de o adaptador confirmar publicação durável.
- Indisponibilidade da fila deverá retornar erro retryable (`503`) e nunca confirmação de aceitação.
- Limite inicial: até 30 requisições por IP em 60 segundos, seguido de bloqueio de 60 segundos (`429`). O estado fica no Redis para compartilhar o limite entre réplicas; falha do Redis de rate limit retorna `503` (fail-closed).
- O storage usa janela fixa atômica em Lua e armazena no Redis apenas um hash do tracker, sem o IP em texto claro. A janela fixa pode permitir rajadas na borda entre janelas; revisar a estratégia com tráfego medido.
- Requisições repetidas idênticas devolvem `202` sem criar outro job; `eventId` repetido com conteúdo diferente devolve `409`.

## Decisões em aberto

- O limite atual é 256 KiB para o corpo JSON completo; o teste confirma o limite exato e uma requisição maior.
- Chaves múltiplas, rotação sem downtime e identidade/quotas por produtor além do limite por IP.
- Retenção e compatibilidade de versões do schema.
- Período de retenção das identidades aceitas; precisa cobrir a janela de retry/replay suportada pelo serviço.
- Janela de retenção de jobs/idempotência e regra de limpeza após processamento.

O caso de uso chama a porta de admissão com o evento e seu fingerprint. O adapter BullMQ usa `eventId` como `jobId` e confere o fingerprint do job persistido após a publicação para tratar IDs repetidos e concorrentes. O controlador mapeia indisponibilidade da fila para `503` e conflito de identidade para `409`.

O `202` significa que Redis confirmou a publicação, não que o evento foi processado nem que não pode haver perda em qualquer falha. A configuração Redis local tem AOF `everysec` e RPO aproximado de um segundo em falha abrupta. Jobs são retidos sem expurgo automático para preservar deduplicação, o que requer uma política de capacidade antes de uso contínuo.

## Critérios de conclusão

- [x] DTO estrito e limite inicial de corpo publicados e cobertos por testes.
- [x] Semântica de idempotência definida; fingerprint SHA-256 canônico implementado como primitiva pura.
- [x] Caso de uso e porta de admissão desacoplados do broker.
- [x] Adapter BullMQ com job ID determinístico e comparação de fingerprint.
- [x] Resposta HTTP vinculada à confirmação da fila.
- [x] Autenticação Bearer de produtor e rate limit Redis compartilhado.
- [ ] Cobertura HTTP de autenticação, limite `429`, duplicatas, conflito e indisponibilidade da fila.
- [x] Logs HTTP e de processamento sem conteúdo do evento ou credencial.

## Exemplo local

Configure `INGEST_API_KEY` no `.env`, inicie Redis, API e worker e envie um evento:

```bash
curl -i http://localhost:3000/events \
  -H "Authorization: Bearer $INGEST_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"eventId":"5fd55d2a-4506-4cd5-9314-2f0a00a43167","eventType":"order.created","schemaVersion":1,"occurredAt":"2026-11-17T12:30:00Z","payload":{"orderId":"ord-123"}}'
```

Uma publicação confirmada responde `202` com `{"eventId":"…","status":"accepted"}`. O worker registra metadados demonstrativos; ainda não existe persistência do payload ou efeito de domínio.
