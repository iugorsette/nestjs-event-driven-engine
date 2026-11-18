# Rate limiting distribuído

**Estado: versão inicial implementada.** `@nestjs/throttler` usa storage Redis atômico compartilhado; autenticação Bearer protege a ingestão e falhas do Redis bloqueiam a requisição (`503`).

## Objetivo

Reduzir brute force e abuso acidental/malicioso com contadores compartilhados entre réplicas. Um limitador apenas em memória não é suficiente quando há mais de uma instância.

## Direção técnica

O guard global aplica 120 requisições/minuto por IP às rotas HTTP, exceto `GET /health`. `POST /events` substitui esse limite por 30 requisições/minuto e bloqueia por 60 segundos quando excedido. As respostas incluem `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` e `Retry-After` quando bloqueadas. A contagem fica em janela fixa implementada por script Lua atômico; as chaves Redis contêm hash do tracker, não o IP em texto claro. O limite é por IP mesmo após autenticação, como defesa contra brute force e abuso de credenciais.

O storage falha fechado: indisponibilidade ou erro Redis retorna `503` em vez de aceitar chamadas sem contagem. O módulo espera o cliente Redis atingir `ready` durante o startup; se isso não ocorrer em cinco segundos, a inicialização falha. No encerramento, a conexão do limiter é desconectada para não prender o shutdown. Para várias réplicas, Redis mantém uma fonte compartilhada de contagem. A chave Bearer ainda é única e não representa uma identidade com quota individual.

## Decisão: script Lua e adapter do storage

O script está em `src/security/rate-limiting/scripts/increment-throttle.lua`; o TypeScript o registra como `incrementThrottle` usando `ioredis.defineCommand`. Isso deixa o algoritmo com syntax highlighting próprio e a chamada do storage expressa em termos do domínio. O build Nest copia arquivos `.lua` para `dist`; em desenvolvimento, o loader também localiza o script na árvore `src`.

Lua foi escolhido porque uma chamada precisa ler o bloqueio atual, incrementar o contador, definir o TTL e possivelmente criar o bloqueio condicionalmente. Executar essa sequência no servidor Redis evita uma leitura e decisão separadas no cliente, que poderiam correr com requisições concorrentes. O script é curto e executa atomicamente em relação a outros comandos Redis: nenhum comando de outro cliente se intercala enquanto ele roda. Isso não significa que o Redis jamais falhará ou que a contagem sobreviverá a qualquer failover; persistência e disponibilidade continuam dependendo da configuração Redis. Scripts também bloqueiam o servidor enquanto executam, então devem permanecer pequenos. [Redis scripting](https://redis.io/docs/latest/interact/programmability/eval-intro/)

`MULTI/EXEC` agrupa comandos, mas não permite ramificar dentro da transação usando o resultado do `INCR`; `WATCH` pode implementar controle otimista, porém adiciona repetição e viagens de rede sob disputa. Neste caso, o script entrega a decisão condicional numa chamada atômica. [Comparação de estratégias de rate limiting do Redis](https://redis.io/tutorials/howtos/ratelimiting/)

`defineCommand` não remove nem substitui Lua: organiza o script como comando tipado do cliente e deixa o ioredis usar `EVALSHA` e cuidar do cache/reload do script. Assim, a extração melhora a manutenção do código e não muda a semântica nem torna o algoritmo mais rápido por si só. [ioredis Lua scripting](https://github.com/redis/ioredis#lua-scripting)

## Por que não usar `@nest-lab/throttler-storage-redis`?

Para uma aplicação comum, a escolha inicial deveria ser o pacote mantido pela comunidade, desde que a versão avaliada passe nos requisitos e testes do serviço. Ele reduz o código de infraestrutura próprio. Não o descartamos por estar abandonado: é mantido no repositório `nest-lab`, tem releases publicados e também usa Lua por baixo. [Releases do pacote](https://github.com/jmcdo29/nest-lab/releases), [implementação do storage](https://github.com/jmcdo29/nest-lab/blob/main/packages/throttler-storage-redis/src/throttler-storage-redis.service.ts)

Há, porém, um ponto concreto a verificar antes de adotar a versão `1.2.0`: o issue aberto [#74](https://github.com/jmcdo29/nest-lab/issues/74) relata que chamadas durante um bloqueio podem renovar o contador e fazer a restrição durar além do `Retry-After`. O relato se aplica à semântica de janela/bloqueio usada aqui. Nosso script verifica o bloqueio antes de incrementar, evitando esse mecanismo específico. Isso não comprova que a implementação própria está correta em todos os cenários; falta uma regressão de integração que reproduza a janela de bloqueio.

Neste portfólio, mantivemos o adapter próprio por dois motivos limitados: estudar e mostrar a operação atômica em Lua, e controlar o comportamento de bloqueio/fail-closed deste projeto. O tratamento de Redis indisponível como `503` também é uma política local que pode ser implementada por wrapper/filtro ao usar o pacote; não é, sozinho, motivo suficiente para manter um storage inteiro próprio. O custo da escolha própria é nosso: compatibilidade com `@nestjs/throttler`, tratamento de erros, manutenção do script e testes em cada versão de Redis suportada.

**Decisão revisável:** a integração atual valida `429`, `Retry-After`, incrementos concorrentes, expiração da janela e fail-closed quando Redis cai após o startup. Antes de usar qualquer uma das implementações em produção, adicionar teste de failover e validar os limites de capacidade. Se uma versão do pacote passar esses cenários e aceitar a política fail-closed desejada, preferi-la reduz código próprio; se não passar, manter ou contribuir uma correção específica. A versão atual do adapter é uma decisão didática para o portfólio, não uma alegação de superioridade geral.

**Limite da decisão:** atomicidade reduz condições de corrida no contador; não prova capacidade, durabilidade, disponibilidade ou segurança completa do serviço. A frase “não falha sob concorrência” seria forte demais. O código e a configuração de Redis ainda precisam de testes e operação observada.

## Decisões em aberto

- Avaliar janela deslizante/token bucket se métricas mostrarem rajadas indesejadas nas bordas da janela fixa.
- Limites por produtor/tenant, múltiplas chaves e rotação individual.
- Configurar proxy confiável somente quando a topologia de deploy estiver definida; não confiar em `X-Forwarded-For` arbitrário.
- Métricas de bloqueio e erro do storage, sem registrar chave, header ou IP em claro.

## Critérios de conclusão

- Limites consistentes entre instâncias e configuração reproduzível localmente.
- Respostas e headers documentados.
- [x] Cobertura HTTP com storage fake para autenticação, limite excedido, duplicatas, fila indisponível e fail-closed `503`.
- [x] Validar limite `429` e header `Retry-After` em integração HTTP com Redis real.
- [x] Validar expiração, concorrência e fail-closed após perda de Redis contra o storage em integração.
