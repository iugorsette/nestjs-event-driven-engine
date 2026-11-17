# High-Throughput Event-Driven Engine

Um motor de processamento de eventos em construção com NestJS e TypeScript. O projeto documenta as decisões e limites de cada etapa para demonstrar engenharia voltada a resiliência, segurança, observabilidade e processamento assíncrono.

## Estado atual

A base atual inclui o bootstrap NestJS, endpoints `/health` e `POST /events`, autenticação de produtor, rate limiting compartilhado via Redis, validação defensiva de HTTP, logs JSON com correlação por requisição, adapter de admissão BullMQ/Redis e um worker consumidor em processo separado. A persistência de domínio ainda será implementada; o handler atual é demonstrativo e não grava efeitos de negócio.

## Requisitos

- Node.js 20.19+, 22.12+ ou 24+
- npm 10 ou superior

## Executar localmente

```bash
cp .env.example .env
npm install
docker compose up -d redis
```

Configure `INGEST_API_KEY` no arquivo `.env` com uma chave gerada, por exemplo `openssl rand -hex 32`, e inicie a API:

```bash
npm run start:dev
```

Verifique `http://localhost:3000/health`; a resposta esperada é `{"status":"ok"}`. Configure a mesma chave no shell para enviar uma amostra: `export INGEST_API_KEY='<valor configurado no .env>'`.

Em outro terminal, inicie o consumidor com `npm run start:worker:dev`. Envie eventos com `POST /events` e `Authorization: Bearer <INGEST_API_KEY>`; a API responde `202` depois de confirmar a publicação no Redis.

Para executar a suíte automatizada, use `npm test`. Ela compila o TypeScript dos testes em uma pasta temporária ignorada pelo Git e usa o test runner nativo do Node.

Para validar a integração com Redis real, use `npm run test:redis` depois de subir o serviço local.

O Redis local é iniciado com AOF (`appendfsync everysec`) e política `noeviction`. Essa configuração é para desenvolvimento e pode perder até cerca de um segundo de gravações em uma falha abrupta; ajuste persistência, memória e replicação para o RPO/RTO do ambiente de produção.

## Configuração

| Variável | Descrição | Padrão |
| --- | --- | --- |
| `NODE_ENV` | `development`, `test` ou `production` | `development` |
| `PORT` | Porta HTTP (inteiro de 1 a 65535) | `3000` |
| `CORS_ORIGINS` | Origens HTTP(S) exatas, separadas por vírgula e sem caminho | vazio |
| `REDIS_URL` | URL `redis://` local ou `rediss://` com TLS em produção | `redis://localhost:6379/0` |
| `WORKER_CONCURRENCY` | Limite de jobs simultâneos por processo worker (1 a 100) | `5` |
| `INGEST_API_KEY` | Segredo do produtor, obrigatório para a API em produção e com 32 a 256 caracteres imprimíveis | não definido |

Se `CORS_ORIGINS` estiver vazio, CORS fica desativado. Valores inválidos interrompem a inicialização com uma mensagem estruturada. Em produção, configure somente origens confiáveis.

## Documentação

- [Visão geral e mapa da documentação](docs/README.md)
- [Arquitetura e decisões técnicas](docs/architecture.md)
- [Modelo de segurança e estado das proteções](docs/security.md)
- [Como executar e interpretar os testes](docs/testing.md)
- [Roadmap de implementação](docs/roadmap.md)
- [Catálogo de features atuais e planejadas](docs/features/README.md)

