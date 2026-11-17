# Ingestão de eventos

**Estado: planejado.** Ainda não existe endpoint de ingestão.

## Objetivo

Receber eventos de produtores autenticados, validar o contrato e colocá-los em uma fila durável sem manter a conexão HTTP aberta durante o processamento.

## Contrato a definir

O envelope precisa identificar ao menos versão do schema, tipo do evento, instante de ocorrência e payload validável. A chave de idempotência e o identificador do produtor precisam ser definidos com os requisitos de domínio. Não incluir campos de transporte ou credenciais dentro do payload do evento.

## Semântica de aceitação

- `202 Accepted` só depois de a fila confirmar publicação durável.
- Erro de validação deve identificar o campo sem ecoar segredos ou payloads sensíveis.
- Repetição com a mesma chave de idempotência precisa ter resultado documentado e previsível.
- Indisponibilidade da fila não pode ser respondida como aceitação bem-sucedida.

## Decisões em aberto

- Tamanho máximo de payload e formatos aceitos.
- Autenticação, autorização por produtor e quotas.
- Retenção e compatibilidade de versões do schema.
- Se idempotência será controlada na API, na fila, no consumidor ou em mais de uma camada.

## Critérios de conclusão

- DTO estrito, limites e semântica publicados.
- Resposta HTTP vinculada à confirmação da fila.
- Cobertura de duplicatas, payload inválido e indisponibilidade da fila.
- Métricas/logs sem conteúdo sensível do evento.
