# Segurança

Este documento distingue controles já configurados de controles planejados. Configurar uma biblioteca não prova, por si só, que o serviço está pronto para produção; as proteções precisam ser verificadas com os endpoints, proxies e infraestrutura reais.

## Controles implementados

| Controle | Estado | O que faz hoje | Limite atual |
| --- | --- | --- | --- |
| Helmet | Implementado | Aplica cabeçalhos HTTP de segurança padrão do Helmet. | A política deve ser revisada quando houver frontend, CSP ou uso de recursos externos. |
| HPP | Implementado | Normaliza parâmetros HTTP duplicados conforme o middleware `hpp`. | O comportamento de parâmetros repetidos deve ser coberto quando filtros de eventos existirem. |
| ValidationPipe | Implementado globalmente | Transforma DTOs, remove campos fora da allowlist e rejeita campos desconhecidos. | Ainda não há endpoint de ingestão com DTO; portanto, a validação de payloads não foi exercitada em uma rota de escrita. |
| CORS | Implementado por allowlist | Aceita somente as origens configuradas em `CORS_ORIGINS`; lista vazia desativa CORS. | CORS é uma política de navegador, não autenticação nem proteção contra chamadas diretas à API. |
| Configuração | Implementado | Rejeita ambiente, porta, origens CORS e URL Redis inválidos; exige `rediss://` em produção. | Senhas Redis devem ficar em secret manager; não colocar credenciais em `.env` versionado. |
| Limite de corpo | Implementado | O parser JSON rejeita corpos maiores que 256 KiB com `413`. | O limite ainda é constante de código; revisar com payloads reais antes de produção. |
| Redis | Implementado localmente | Compose usa volume, AOF, `appendfsync everysec` e `noeviction`. | O perfil local admite cerca de 1 s de perda abrupta e tem teto de memória de 512 MiB. |
| Logs | Implementado | Gera ID no servidor e evita registrar URL, query, headers e corpo nos eventos HTTP. | Logs de aplicação futuros devem continuar removendo tokens, payloads sensíveis e dados pessoais. |

## Ainda não implementado

- Rota de ingestão, autenticação e rate limiting distribuído.
- Autenticação e autorização para produtores.
- Worker, política operacional de redelivery/dead-letter e retenção de idempotência.
- Persistência ou consultas SQL/NoSQL. Não há sanitização de consulta a implementar até a escolha de um armazenamento.
- Métricas, tracing distribuído e alertas operacionais.

## Regras para as próximas etapas

1. Validar dados na borda com DTOs allowlist e limites explícitos de tamanho e formato.
2. Não concatenar entrada do usuário em SQL, filtros NoSQL, comandos ou nomes de filas; usar APIs parametrizadas e mapeamentos permitidos.
3. Definir confiança em proxy antes de usar IP para limites. Não confiar em `X-Forwarded-For` de clientes arbitrários.
4. Definir comportamento de rate limit quando Redis estiver indisponível por rota e risco; não escolher fail-open/closed implicitamente.
5. Não registrar conteúdo de evento por padrão. Redação de campos deve ocorrer antes de logs e traces.
6. Usar TLS na borda, segredos fora do Git e permissões mínimas para Redis e banco.
7. Tratar retries como redelivery possível e desenhar operações dos workers como idempotentes.

## Revisão de produção

Antes de chamar o serviço de pronto para produção, documentar limites, timeouts, proxy confiável, política de autenticação, configuração de Redis/banco, atualização de dependências, alertas e resposta a incidentes. Nenhum desses itens deve ser presumido como coberto pelos middlewares atuais.
