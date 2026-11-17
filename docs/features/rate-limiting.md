# Rate limiting distribuído

**Estado: versão inicial implementada.** `@nestjs/throttler` usa storage Redis atômico compartilhado; autenticação Bearer protege a ingestão e falhas do Redis bloqueiam a requisição (`503`).

## Objetivo

Reduzir brute force e abuso acidental/malicioso com contadores compartilhados entre réplicas. Um limitador apenas em memória não é suficiente quando há mais de uma instância.

## Direção técnica

O guard global aplica 120 requisições/minuto por IP às rotas HTTP, exceto `GET /health`. `POST /events` substitui esse limite por 30 requisições/minuto e bloqueia por 60 segundos quando excedido. As respostas incluem `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` e `Retry-After` quando bloqueadas. A contagem fica em janela fixa implementada por script Lua atômico; as chaves Redis contêm hash do tracker, não o IP em texto claro. O limite é por IP mesmo após autenticação, como defesa contra brute force e abuso de credenciais.

O storage falha fechado: indisponibilidade ou erro Redis retorna `503` em vez de aceitar chamadas sem contagem. Para várias réplicas, Redis mantém uma fonte compartilhada de contagem. A chave Bearer ainda é única e não representa uma identidade com quota individual.

## Decisões em aberto

- Avaliar janela deslizante/token bucket se métricas mostrarem rajadas indesejadas nas bordas da janela fixa.
- Limites por produtor/tenant, múltiplas chaves e rotação individual.
- Configurar proxy confiável somente quando a topologia de deploy estiver definida; não confiar em `X-Forwarded-For` arbitrário.
- Métricas de bloqueio e erro do storage, sem registrar chave, header ou IP em claro.

## Critérios de conclusão

- Limites consistentes entre instâncias e configuração reproduzível localmente.
- Respostas e headers documentados.
- Cobertura HTTP para autenticação, limite excedido, duplicatas e falha de Redis.
- Validar o comportamento e headers `429`/`503` sob integração com Redis.
