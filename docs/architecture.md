# Arquitetura e decisões

## Objetivo

O serviço receberá eventos via HTTP, confirmará a aceitação quando eles estiverem protegidos contra perda, e os processará em workers assíncronos. A arquitetura será construída em etapas para tornar explícitos os limites de entrega, falha e recuperação.

## Fluxo HTTP implementado hoje

```mermaid
flowchart LR
  Client[Cliente HTTP] --> Middleware[Helmet e HPP]
  Middleware --> Context[ID de requisição]
  Context --> Nest[NestJS API]
  Nest --> Validation[ValidationPipe global]
  Nest --> Health[GET /health]
  Nest --> Logs[Logger JSON]
```

Hoje o único endpoint de aplicação é `GET /health`. O adapter de admissão BullMQ/Redis e sua configuração já estão implementados, mas ainda não há rota HTTP de ingestão, worker consumidor ou banco de dados.

## Fluxo futuro pretendido

```mermaid
flowchart LR
  Producer[Producer / Client] --> Gateway[API NestJS]
  Gateway --> Admission[Validação, autenticação e limites]
  Admission --> Queue[BullMQ / Redis AOF]
  Queue --> Worker[Workers com concorrência limitada]
  Worker --> Store[(Persistência)]
  Gateway -. logs, métricas e traces .-> Obs[Observabilidade]
  Worker -. logs, métricas e traces .-> Obs
```

O adapter BullMQ/Redis já existe, mas ainda não há rota HTTP de ingestão nem worker consumidor. A configuração local usa AOF com `appendfsync everysec`, que admite perda de até cerca de um segundo em falha abrupta. Isso não representa durabilidade sem perda em todas as falhas; o perfil de produção depende do RPO requerido.

## Estratégia de deploy e escala (proposta)

O repositório demonstra a arquitetura e as decisões em ambiente local. Não faremos deploy permanente em nuvem como parte do portfólio: manter serviços gerenciados e tráfego contínuo gera custos, e não é necessário para demonstrar que os componentes podem escalar. A proposta abaixo descreve um caminho de evolução, não infraestrutura já provisionada ou validada.

### Como escalar na AWS com ECS

- Publicar API e workers como imagens de container e executá-los como serviços ECS separados. Assim, a API escala por demanda HTTP, enquanto workers escalam de forma independente conforme o backlog e a taxa de processamento.
- Usar um Application Load Balancer para entrada HTTP e manter as tarefas e dependências em uma rede privada, expondo somente os pontos de entrada necessários.
- Substituir Redis local por uma oferta gerenciada compatível com Redis/Valkey, em configuração multi-AZ escolhida conforme RPO, disponibilidade, throughput e custo. Validar previamente compatibilidade e semântica requeridas pelo BullMQ.
- Armazenar segredos fora das imagens e da configuração versionada; centralizar logs e métricas para acompanhar latência, erros, saturação e idade/profundidade da fila.
- Definir autoscaling dos workers com métricas de backlog e capacidade de processamento, com limites para concorrência e custo. Escalar somente por CPU pode reagir tarde quando a fila cresce antes de a CPU saturar.

### Como escalar na GCP

A mesma separação entre API e consumidores se aplica: empacotar cada processo em container, usar serviços gerenciados de execução apropriados para processos HTTP e consumidores contínuos, e conectar ambos a uma instância Redis compatível gerenciada. A escolha entre serviços de containers, Kubernetes ou VMs depende dos requisitos de execução contínua, controle operacional e custo; deve ser validada quando a implantação for realmente planejada. Métricas de backlog, segredos gerenciados, rede privada, logs e alertas continuam necessários.

### Decisões que precedem produção

Uma implantação real exige fechar RPO/RTO, retenção e deduplicação, capacidade e política de escala, alta disponibilidade do Redis, estratégia de backup/recuperação, segurança de rede, orçamento e observabilidade. BullMQ depende do Redis para coordenação dos jobs; escalar API e workers horizontalmente não remove esse componente compartilhado nem seus limites. Por isso, a documentação de produção será aprofundada quando os workers, o processamento idempotente e as políticas operacionais estiverem implementados.

## Decisões atuais

### Bootstrap pequeno

O bootstrap configura middlewares e validação global uma única vez. As regras de parsing de ambiente ficam em `src/config/app-config.ts`, separadas do processo de subir o servidor. Isso permite falhar cedo quando a configuração é inválida.

### Configuração explícita

`.env` é carregado no início. `NODE_ENV`, `PORT` e `CORS_ORIGINS` são interpretados por uma função tipada. A lista CORS aceita origens HTTP(S) exatas, sem caminho, query ou fragmento; lista vazia desativa CORS.

### Correlação por contexto assíncrono

Cada requisição recebe um UUID gerado pelo servidor, retornado em `x-request-id`. `AsyncLocalStorage` mantém o ID disponível nos logs criados no mesmo fluxo assíncrono. O serviço não confia em um ID enviado pelo cliente para evitar colisão e conteúdo controlado pelo chamador nos logs.

### Logs como JSON por linha

O logger escreve um objeto JSON por linha, adequado à coleta por stdout em containers. Eventos HTTP registram método, status e duração, sem URL, query string, headers ou corpo, reduzindo a chance de gravar tokens e dados pessoais por acidente.

### API desacoplada do transporte de eventos

Quando a ingestão for criada, controller, aplicação e domínio devem depender de uma abstração de publicação. A API não deve conhecer detalhes internos do BullMQ; isso deixa possível testar regras sem Redis e substituir infraestrutura sem alterar o contrato HTTP.

## Propriedades arquiteturais a preservar

- Responder `202 Accepted` somente depois de a fila confirmar que a mensagem está durável.
- Projetar consumidores para entrega pelo menos uma vez; não prometer processamento exatamente uma vez.
- Tornar efeitos dos workers idempotentes para tolerar redelivery e retries.
- Usar `eventId` como identidade estável do evento; comparar fingerprint SHA-256 do envelope canônico para distinguir retry idêntico de reutilização conflitante do ID.
- Limitar concorrência e tamanho de payload para que a sobrecarga resulte em backpressure controlado.
- Propagar IDs de correlação para fila e worker sem usar dados pessoais como identificador.
- Manter readiness distinta de liveness quando a aplicação depender de Redis e banco.

## Estrutura atual do código

| Caminho | Responsabilidade |
| --- | --- |
| `src/main.ts` | Carrega ambiente, configura Nest, HTTP security middleware, validação e CORS. |
| `src/create-app.ts` | Monta a aplicação HTTP para execução e testes com a mesma configuração. |
| `src/events/dto/` | Contratos versionados e validação estrita dos eventos de entrada. |
| `src/events/application/` | Caso de uso e porta para admissão idempotente desacoplada do broker. |
| `src/events/queue/` | Adapter BullMQ que grava o envelope e fingerprint no job Redis usando `eventId` como `jobId`. |
| `src/config/app-config.ts` | Valida e transforma variáveis de ambiente. |
| `src/app.module.ts` | Registra controllers e middleware de contexto. |
| `src/app.controller.ts` | Endpoint mínimo de health. |
| `src/observability/` | Contexto assíncrono de requisição e logger estruturado. |

## Registro de decisão: nuvem como desenho, não como requisito do portfólio

**Decisão:** documentar uma estratégia plausível de implantação e escala em nuvem, sem provisionar recursos pagos neste projeto. **Motivo:** demonstrar compreensão de separação de serviços, escalabilidade independente, dependências compartilhadas e trade-offs operacionais sem criar custo recorrente desnecessário. **Revisão:** após workers, idempotência e observabilidade operacional, detalhar um caminho de produção com estimativas e requisitos explícitos antes de qualquer implantação.
