# High-Throughput Event-Driven Engine

Um motor de processamento de eventos em construção com NestJS e TypeScript. O projeto documenta as decisões e limites de cada etapa para demonstrar engenharia voltada a resiliência, segurança, observabilidade e processamento assíncrono.

## Estado atual

A base atual inclui o bootstrap NestJS, endpoint `/health`, configurações defensivas de HTTP, validação de ambiente, logs JSON com correlação por requisição e o adapter de admissão BullMQ/Redis. A rota de ingestão, worker consumidor e persistência de domínio ainda serão implementados.

## Requisitos

- Node.js 20 ou superior
- npm 10 ou superior

## Executar localmente

```bash
cp .env.example .env
npm install
docker compose up -d redis
npm run start:dev
```

Verifique `http://localhost:3000/health`; a resposta esperada é `{"status":"ok"}`.

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

Se `CORS_ORIGINS` estiver vazio, CORS fica desativado. Valores inválidos interrompem a inicialização com uma mensagem estruturada. Em produção, configure somente origens confiáveis.

## Documentação

- [Visão geral e mapa da documentação](docs/README.md)
- [Arquitetura e decisões técnicas](docs/architecture.md)
- [Modelo de segurança e estado das proteções](docs/security.md)
- [Como executar e interpretar os testes](docs/testing.md)
- [Roadmap de implementação](docs/roadmap.md)
- [Catálogo de features atuais e planejadas](docs/features/README.md)

