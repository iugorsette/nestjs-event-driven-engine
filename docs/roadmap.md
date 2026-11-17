# Roadmap

As etapas são incrementais. Cada uma deve resultar em código, documentação, validação adequada e um commit pequeno. Itens futuros são propostas com requisitos a fechar; não descrevem funcionalidades já disponíveis.

## 1. Base HTTP — concluída

- NestJS e TypeScript com build, lint e estrutura mínima.
- `GET /health`, Helmet, HPP, validação global estrita e CORS configurável.

## 2. Configuração e qualidade — concluída

- Validação de ambiente e carregamento de `.env` — implementado.
- Logs JSON e correlação por requisição — implementado.
- Testes de configuração, DTO validation, bootstrap, endpoint de health, request ID e headers — implementado.
- Separar liveness e readiness quando o serviço passar a depender de infraestrutura externa.

## 3. Contrato de ingestão — em andamento

- [x] Definir envelope versionado, DTO estrito e limite inicial de corpo.
- [x] Validar o limite no ponto exato de 256 KiB e acima dele.
- [x] Definir `eventId` como identidade de idempotência e conflito para envelope diferente.
- [x] Criar caso de uso e porta de admissão sem dependência do broker.
- [ ] Definir duração da retenção idempotente e como a reserva será atômica com a publicação.
- Publicar somente após confirmação durável da fila (depende da etapa 5).

## 4. Proteção de tráfego — planejado

- Adicionar autenticação para produtores e rate limit distribuído com Redis.
- Definir chaves de limite, limites por rota e resposta `429`.
- Decidir e documentar o comportamento quando Redis ficar indisponível.

## 5. Fila e workers — planejado

- Adicionar BullMQ, retries com backoff, timeouts, dead-letter e concorrência limitada.
- Implementar idempotência no processamento e encerramento gracioso.
- Definir compose para desenvolvimento local e instruções de operação.

## 6. Persistência — em aberto

- Escolher banco após definir formato dos eventos, retenção e padrões de consulta.
- Documentar migrações, índices, retenção, criptografia e política de acesso.
- Resolver atomicidade entre gravação de domínio e publicação (por exemplo, avaliar outbox se o fluxo exigir consistência entre banco e fila).

## 7. Observabilidade operacional — planejado

- Expor métricas de aceitação, fila, retries, falhas, latência e saturação.
- Propagar contexto para workers e tracing distribuído.
- Definir alertas, SLOs e procedimentos para dead-letter e indisponibilidade de dependências.
- Integrar o SDK NestJS Observe: chave de desenvolvimento separada, módulo e hook de instrumentação, shutdown hooks, verificação de telemetria local e decisões registradas de privacidade/redaction.

## 8. Endurecimento e publicação — planejado

- Rever limites HTTP, timeouts, CORS, proxy, dependências e gestão de segredos.
- Automatizar verificações de qualidade e segurança.
- Documentar implantação, operação, recuperação e limites conhecidos.
