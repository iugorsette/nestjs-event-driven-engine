# Catálogo de features

## Implementado

- [Bootstrap e configuração segura](#bootstrap-e-configuração-segura)
- [Health endpoint](#health-endpoint)
- [Logging HTTP correlacionado](#logging-http-correlacionado)

## Planejado

- [Ingestão de eventos](event-ingestion.md)
- [Rate limiting distribuído](rate-limiting.md)
- [Fila e workers](queue-and-workers.md)
- [Persistência](persistence.md)
- [Observabilidade operacional](observability.md)

## Bootstrap e configuração segura

**Estado: implementado.** Helmet e HPP são aplicados no bootstrap; a `ValidationPipe` global transforma DTOs e rejeita propriedades não permitidas. As origens CORS vêm de `CORS_ORIGINS`. `NODE_ENV`, `PORT` e as origens são validados antes de o servidor abrir a porta.

Detalhes e limites: [segurança](../security.md) e [arquitetura](../architecture.md).

## Health endpoint

**Estado: implementado.** `GET /health` responde `{"status":"ok"}` para indicar que o processo HTTP está respondendo. Como ainda não há dependências externas, essa rota não verifica Redis ou banco e não deve ser tratada como readiness de um futuro pipeline.

## Logging HTTP correlacionado

**Estado: implementado.** Cada requisição ganha um UUID gerado pelo servidor, devolvido no header `x-request-id`. Os logs de início e conclusão são JSON e contêm método, status e duração. URL, query string, headers e corpo não são registrados por esse middleware.

O logger não substitui métricas nem tracing; essas capacidades estão planejadas em [observabilidade operacional](observability.md).
