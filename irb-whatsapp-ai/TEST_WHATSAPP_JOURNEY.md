# 🧪 TEST: WhatsApp Journey Completa

## Setup

### 1. Verificar se servidores estão rodando
```bash
# No seu terminal, ir para a pasta do projeto
cd /Users/saraiva/Documents/IRB/irb-whatsapp-ai

# Ver se os containers estão rodando
docker-compose ps

# Esperar que apareça algo como:
# irb-api        ... Up
# irb-worker     ... Up
# irb-dashboard  ... Up
```

Se algum container não está rodando, fazer:
```bash
docker-compose up -d
```

---

## 🧪 TESTE 1: Enviar "oi" no WhatsApp

### Passo 1: Abra WhatsApp
- Celular ou WhatsApp Web
- Procure por: **IRB Prime Care** ou **55 17 99779601** (número da clínica)

### Passo 2: Envie mensagem
Escreva: `oi`

### Passo 3: Espere resposta
**Esperado**: Julia responde com:
```
Oiii! 👋✨ Sou a Julia, da IRB Prime Care!

Que bom demais você veio falar com a gente! 🙌 
Aqui a gente cuida de você como família - com a seriedade de médicos de verdade 
e o carinho que você merece. 💙

Me conta, o que te trouxe por aqui? 🤔

[Botões:]
- 🏥 Tenho um sintoma
- 💪 Quero check-up
- 📋 Tenho pedido de exame
```

**Se não funcionou**: Ir para TROUBLESHOOTING abaixo

---

## 🧪 TESTE 2: Clique em um botão (ex: "Tenho um sintoma")

### Passo 1: Click no botão
Clique em: **🏥 Tenho um sintoma**

### Passo 2: Espere resposta
**Esperado**: Julia pergunta:
```
Entendi! 👂 Vamos descobrir o que está acontecendo...

Onde está esse desconforto? 🔍

[Botões:]
- 🧠 Cabeça / Coração / Nervos
- 🦵 Costas / Articulações / Músculos
- 🌡️ Pele / Digestão / Outro
```

---

## 🧪 TESTE 3: Continue a triagem
Clique em qualquer opção (ex: **🧠 Cabeça / Coração / Nervos**)

**Esperado**: Julia faz mais perguntas pra entender melhor

---

## 🧪 TESTE 4: Chegue ao agendamento
Continue respondendo até Julia perguntar:
```
Qual período fica melhor pra você?

[Botões:]
- 🌅 Manhã (7h-12h)
- 🌆 Tarde (13h-18h)
- ⏰ Qualquer horário
```

Escolha um período.

---

## 🧪 TESTE 5: Clique no link de agendamento
**Esperado**: Julia envia:
```
Perfeito! Aqui está seu link para finalizar o agendamento:

https://seu-link-aqui.com/booking/...

Clique nele pra terminar a reserva! 🚀
```

### Passo 1: Clique no link
Clique no link que Julia enviar.

### Passo 2: Página de booking
**Esperado**: Abre uma página bonita com:
- Seu nome
- Especialista
- Horário
- Botão "Confirmar"

### Passo 3: Confirme agendamento
Clique em "Confirmar".

### Passo 4: Volta pro WhatsApp
**Esperado**: Julia envia:
```
🎉 Consultório agendado com sucesso!

Seu agendamento com [DR/DRA NOME]:
📅 Data: [DATA]
⏰ Horário: [HORÁRIO]
📍 Endereço: [ENDEREÇO]

Dúvidas? É só chamar! 💙
```

---

## ✅ TESTE PASSOU SE:
- [ ] Julia respondeu em todos os passos
- [ ] Botões apareceram corretamente
- [ ] Link de agendamento foi gerado
- [ ] Agendamento foi confirmado
- [ ] Nenhuma mensagem de erro apareceu
- [ ] Tudo levou menos de 5 minutos

---

## 🔴 TROUBLESHOOTING

### Problema: Julia não responde
**Solução**:
1. Verificar logs:
```bash
docker logs irb-worker -f
docker logs irb-api -f
```

2. Procure por erros (palavras-chave):
   - `error`
   - `Error`
   - `500`
   - `failed`

3. Se encontrou erro, anote e compartilhe

### Problema: Botões não aparecem
**Solução**:
1. Fechar e reabrir o WhatsApp
2. Atualizar a página (se web)
3. Testar em celular (web as vezes é bugado)

### Problema: Link de agendamento não funciona
**Solução**:
1. Copiar o link e abrir em navegador novo
2. Verificar se está usando HTTPS
3. Checar: `docker logs irb-api -f` procurando por "booking"

### Problema: Botão não funciona ao clicar
**Solução**:
1. Seu WhatsApp pode estar desatualizado
2. Tente em celular (não WhatsApp Web)
3. Tente com outro número para testar

---

## 📊 DOCUMENTAR RESULTADO

Quando completar o teste, envie:

```
✅ TESTE PASSOU - Tudo funcionou
Tempo total: X minutos
Nenhum erro encontrado

OU

⚠️ TESTE FALHOU - Problema encontrado
Etapa que falhou: [QUAL]
Erro: [MENSAGEM DE ERRO]
Logs: [COPIE O ERRO DO LOG]
```

---

**Status**: Ready to test  
**Último update**: March 7, 2026
