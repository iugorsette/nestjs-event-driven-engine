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
- Repetição com a mesma chave de idempotência precisa ter resultado documentado e previsível.
- Indisponibilidade da fila não pode ser respondida como aceitação bem-sucedida.

## Decisões em aberto

- O limite atual é 256 KiB para o corpo JSON completo; revisar com payloads representativos e requisitos reais.
- Autenticação, autorização por produtor e quotas.
- Retenção e compatibilidade de versões do schema.
- Usar `eventId`, `Idempotency-Key` ou ambos como chave de idempotência e definir conflito quando a mesma chave vier com conteúdo diferente.
- Se idempotência será controlada na API, na fila, no consumidor ou em mais de uma camada.

O DTO e o limite de corpo não criam uma rota. `POST /events` continua adiado até a camada de publicação poder confirmar aceitação durável; responder `202` antes disso criaria risco de perda de eventos.

## Critérios de conclusão

- [x] DTO estrito e limite inicial de corpo publicados e cobertos por testes.
- [ ] Resposta HTTP vinculada à confirmação da fila.
- [ ] Cobertura de duplicatas e indisponibilidade da fila.
- Métricas/logs sem conteúdo sensível do evento.
