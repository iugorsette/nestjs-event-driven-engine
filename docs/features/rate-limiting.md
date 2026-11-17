# Rate limiting distribuído

**Estado: planejado.** O serviço ainda não limita tráfego por IP, produtor ou rota.

## Objetivo

Reduzir brute force e abuso acidental/malicioso com contadores compartilhados entre réplicas. Um limitador apenas em memória não é suficiente quando há mais de uma instância.

## Direção técnica

Avaliar `@nestjs/throttler` com armazenamento Redis. Limites devem ser diferentes por operação; autenticação e ingestão têm custos e riscos distintos. Identidade autenticada deve ser preferida ao IP quando o produtor estiver identificado.

## Decisões em aberto

- Algoritmo e janela (janela fixa, deslizante ou token bucket).
- Limites por identidade, tenant, IP e rota.
- Tratamento de IP atrás de proxy e configuração de proxies confiáveis.
- Fail-open ou fail-closed durante falha de Redis por endpoint.
- Headers de limite que serão devolvidos e política de `429`.

## Critérios de conclusão

- Limites consistentes entre instâncias e configuração reproduzível localmente.
- Respostas e headers documentados.
- Testes para limite excedido, chaves distintas e indisponibilidade de Redis.
- Métricas para bloqueios e falhas do storage, sem registrar credenciais.
