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
- [ ] Definir duração da retenção idempotente e política de limpeza dos jobs.
- [ ] Revisar o RPO Redis antes de prometer a aceitação como sem perda.
- [x] Publicar somente após confirmação da fila; retornar `202`, `409` para conflito e `503` quando fila indisponível.
- [x] Expor `POST /events` com DTO estrito e autenticação Bearer.
- [ ] Cobrir respostas HTTP de validação, duplicata, conflito, autenticação e indisponibilidade da fila.

## 4. Proteção de tráfego — em andamento

- [x] Exigir uma chave de produtor com comparação em tempo constante; torná-la obrigatória na inicialização da API em produção.
- [x] Aplicar limite por IP à rota de ingestão (30 chamadas/60s e bloqueio por 60s) usando storage Redis compartilhado e resposta `429`.
- [x] Falhar fechado com `503` se o storage Redis do rate limit estiver indisponível.
- [ ] Validar IP real atrás de proxy confiável, definir política de rotação de credenciais e adicionar cobertura HTTP dos cenários de segurança.

## 5. Fila e workers — em andamento

- [x] Adicionar adapter BullMQ, fila Redis local com AOF e ID de job determinístico.
- [x] Implementar consumidor NestJS em processo separado, validar novamente os jobs, configurar concorrência por processo, retries com backoff/jitter e shutdown gracioso.
- [x] Registrar handler de demonstração sem efeitos de negócio persistentes, deixando esse limite explícito para o portfólio.
- [ ] Definir retenção de deduplicação, RPO Redis e política de capacidade antes de habilitar processamento contínuo.
- [ ] Implementar DLQ com redrive/auditoria, timeout cooperativo e classificação configurável de falhas.
- [ ] Implementar idempotência durável dos efeitos de processamento após escolher a persistência.
- [x] Manter Redis Compose e instruções para executar API e worker localmente.
- Após concluir workers e idempotência, documentar estratégia de deploy e escala em AWS (ECS) e GCP, incluindo serviços separados para API/consumidores, Redis gerenciado, autoscaling, observabilidade e trade-offs. Manter implantação cloud fora do escopo do portfólio enquanto houver custo recorrente sem necessidade demonstrativa.

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
- Completar o desenho de produção em nuvem após fechar requisitos de RPO/RTO, retenção, capacidade, segurança e orçamento; não provisionar recursos pagos como requisito para concluir o portfólio.
