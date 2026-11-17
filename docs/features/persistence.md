# Persistência

**Estado: em aberto.** Nenhum banco ou ORM foi escolhido.

## Por que a escolha está aberta

O modelo de evento, a retenção, as consultas e a necessidade de transações ainda não foram definidos. Escolher banco antes desses requisitos criaria uma decisão sem evidência.

## Critérios de escolha

- Padrões de leitura e escrita e necessidade de consultas por atributos do evento.
- Volume, retenção, particionamento e custo de armazenamento.
- Transações e consistência exigidas pelo domínio.
- Backup, restauração, criptografia, controle de acesso e operação local.
- Estratégia de migração e compatibilidade entre versões do serviço.

## Regras de implementação

- Usar consultas parametrizadas e validação explícita de campos ordenáveis/filtráveis.
- Criar migrações rastreáveis e plano de rollback compatível.
- Não afirmar processamento exatamente uma vez com base somente em transação do banco.
- Avaliar padrão outbox se uma mesma operação precisar gravar estado no banco e publicar mensagem sem janela de perda.

## Critérios de conclusão

- Decisão documentada com requisitos e tradeoffs.
- Migrações, índices, retenção e política de acesso definidos.
- Testes para atomicidade, duplicatas e falhas de conexão.
