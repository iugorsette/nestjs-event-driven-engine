# Observabilidade operacional

**Estado: parcialmente implementado.** Já há logs JSON e correlação HTTP. Métricas, tracing e alertas não existem.

## Objetivo

Permitir responder rapidamente se o sistema está aceitando trabalho, onde a latência se acumula, por que jobs falham e quando a capacidade está saturada.

## Já disponível

- Logs JSON por linha em stdout.
- UUID de correlação gerado pelo servidor e retornado em `x-request-id`.
- Eventos HTTP com método, status e duração; sem query string ou corpo.

## Planejado

- Métricas de requests, fila pendente, latência de espera e processamento, retries e dead-letter.
- Tracing distribuído da requisição até a execução do worker.
- Readiness que considera dependências necessárias; liveness separada.
- Dashboards, alertas com limites e runbooks para saturação e falhas.
- Integração com NestJS Observe para visualizar tráfego de desenvolvimento; usar credencial separada e rever envio de source context antes de ativar.

## Princípios

- Métricas usam labels limitadas; não usar IDs de evento ou usuário como labels de alta cardinalidade.
- Redigir dados sensíveis antes de exportar logs ou traces.
- Propagar contexto entre API, fila e worker sem confiar em campos de correlação controlados pelo produtor.
- Definir SLO e alertas com base em comportamento do pipeline, não apenas disponibilidade do processo.
