# High-Throughput Event-Driven Engine

Um motor de processamento de eventos em construção com NestJS e TypeScript. O projeto documenta as decisões e limites de cada etapa para demonstrar engenharia voltada a resiliência, segurança, observabilidade e processamento assíncrono.

## Estado atual

A base atual inclui o bootstrap NestJS, endpoint `/health`, configurações defensivas de HTTP, validação de ambiente e logs JSON com correlação por requisição. O processamento de eventos, filas, Redis e persistência ainda serão implementados.

## Requisitos

- Node.js 20 ou superior
- npm 10 ou superior

## Executar localmente

```bash
cp .env.example .env
npm install
npm run start:dev
```

Verifique `http://localhost:3000/health`; a resposta esperada é `{"status":"ok"}`.

## Configuração

| Variável | Descrição | Padrão |
| --- | --- | --- |
| `NODE_ENV` | `development`, `test` ou `production` | `development` |
| `PORT` | Porta HTTP (inteiro de 1 a 65535) | `3000` |
| `CORS_ORIGINS` | Origens HTTP(S) exatas, separadas por vírgula e sem caminho | vazio |

Se `CORS_ORIGINS` estiver vazio, CORS fica desativado. Valores inválidos interrompem a inicialização com uma mensagem estruturada. Em produção, configure somente origens confiáveis.

## Documentação

- [Visão geral e mapa da documentação](docs/README.md)
- [Arquitetura e decisões técnicas](docs/architecture.md)
- [Modelo de segurança e estado das proteções](docs/security.md)
- [Roadmap de implementação](docs/roadmap.md)
- [Catálogo de features atuais e planejadas](docs/features/README.md)

