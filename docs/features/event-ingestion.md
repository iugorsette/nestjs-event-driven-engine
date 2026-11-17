# Ingestão de eventos

**Estado: contrato inicial implementado; endpoint ainda não existe.** O DTO estrito está em `src/events/dto/ingest-event.dto.ts` e o limite HTTP de JSON é 256 KiB.

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

Campos desconhecidos são rejeitados pela `ValidationPipe` global. Identidade do produtor/tenant não deve vir do payload; deve ser derivada da autenticação quando ela existir.

## Semântica de aceitação

- `202 Accepted` só depois de a fila confirmar publicação durável.
- Erro de validação deve identificar o campo sem ecoar segredos ou payloads sensíveis.
- `eventId` é a identidade estável de idempotência; não será necessário um segundo header `Idempotency-Key` no contrato inicial.
- Reenvio do mesmo `eventId` com o mesmo envelope é duplicata e deve devolver a confirmação original sem publicar de novo.
- Reenvio do mesmo `eventId` com conteúdo diferente é conflito HTTP `409` e não deve publicar.
- Indisponibilidade da fila não pode ser respondida como aceitação bem-sucedida.

## Decisões em aberto

- O limite atual é 256 KiB para o corpo JSON completo; o teste confirma o limite exato e uma requisição maior.
- Autenticação, autorização por produtor e quotas.
- Retenção e compatibilidade de versões do schema.
- Período de retenção das identidades aceitas; precisa cobrir a janela de retry/replay suportada pelo serviço.
- Como persistir atomicamente identidade, fingerprint e publicação durável quando a fila for integrada.

O DTO e o limite de corpo não criam uma rota. `POST /events` continua adiado até a camada de publicação poder confirmar aceitação durável; responder `202` antes disso criaria risco de perda de eventos.

## Critérios de conclusão

- [x] DTO estrito e limite inicial de corpo publicados e cobertos por testes.
- [x] Semântica de idempotência definida; fingerprint SHA-256 canônico implementado como primitiva pura.
- [ ] Resposta HTTP vinculada à confirmação da fila.
- [ ] Cobertura HTTP de duplicatas e indisponibilidade da fila.
- Métricas/logs sem conteúdo sensível do evento.
