---
title: Fluxo de Pagamento
tags:
  - irb
  - fluxo
  - financeiro
  - pagamento
---

# Fluxo de Pagamento

Processo de pagamento na IRB. Atualmente quase 100% manual.

## Fluxo Atual

1. Paciente realiza atendimento
2. Recepcao informa valor
3. Opcoes: Pix ou Cartao
4. **Pix**: recepcao gera manualmente → paciente paga → recepcao confirma visualmente
5. **Cartao**: maquininha na recepcao (sem codigo de rastreio)
6. Conciliacao financeira em Excel (Joao)
7. Faturamento manual

## Problemas

- [[Processos Manuais]] - Tudo manual, sem automacao
- Sem chave para ligar pagamento ao paciente/procedimento
- Cartao sem indicacao/codigo → nao rastreia retorno
- Se volume aumentar, recepcao vira "setor de validacao de Pix"
- Pacientes nao pagam antecipado (alto no-show)
- Sem taxa de reserva

## Fluxo Desejado (com [[Asaas]])

1. Atendimento gera Pix automatico (QR code condicionado ao valor)
2. Paciente paga → [[Asaas]] confirma automaticamente
3. Status atualiza no sistema sem intervencao humana
4. Recepcao ve apenas: pago / nao pago
5. Joao analisa relatorios, nao valida transacoes

## Pessoas

- Joao: gerente financeiro
- Michel: contas a pagar
- Recepcao: executa pagamento
