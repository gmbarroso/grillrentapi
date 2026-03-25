## Description

GrillRentAPI é uma API para gerenciar usuários e reservas de recursos (como churrasqueiras) em um condomínio. A API permite que os usuários se registrem, façam login, visualizem e atualizem seus perfis, e façam reservas de recursos. A API também permite que administradores gerenciem usuários e reservas.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Configuracao de Email (Resend)

O envio de e-mail usa Resend.

```env
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM=GrillRent <onboarding@seu-dominio-verificado.com>
```

Notas:
- `RESEND_FROM` deve usar um remetente permitido no Resend (dominio verificado ou sandbox permitido).
- `input.from` enviado pelo servico sobrescreve `RESEND_FROM` quando informado.
- Cada organizacao pode definir seu remetente (`fromName`/`fromEmail`) em `admin/settings/contact-email`.

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Endpoints do Projeto

### Usuários
- `POST /users/register`: Registra um novo usuário.
- `POST /users/login`: **deprecated/disabled** (use `grillrentbff_v2`).
- `POST /users/logout`: **deprecated/disabled** (use `grillrentbff_v2`).
- `GET /users/profile`: Obtém o perfil do usuário autenticado.
- `PUT /users/profile`: Atualiza o perfil do usuário autenticado.
- `POST /users/onboarding/email`: Define email de onboarding.
- `POST /users/onboarding/verify`: Verifica token de onboarding.
- `POST /users/onboarding/change-password`: Troca senha temporária.
- `GET /users`: Obtém todos os usuários.
- `DELETE /users/:id`: Remove um usuário.

### Reservas
- `POST /bookings`: Cria uma nova reserva.
- `POST /bookings/batch`: Cria reservas em lote (somente recurso `hourly`).
- `GET /bookings`: Obtém todas as reservas.
- `GET /bookings/user/:userId`: Obtém reservas por usuário.
- `DELETE /bookings/:id`: Remove uma reserva.
- `GET /bookings/availability/:resourceId`: Verifica a disponibilidade de um recurso.

### Avisos
- `GET /notices/unread-count`: Estado de não lidos (`unreadCount`, `hasUnread`, `lastSeenNoticesAt`).
- `POST /notices/mark-seen`: Marca avisos como vistos.

### Mensagens
- `POST /messages/contact`: Envia mensagem de contato.
- `GET /messages/admin`: Inbox de mensagens para admins.
- `GET /messages/unread-count`: Contador de não lidas.
- `POST /messages/:id/mark-read`: Marca mensagem como lida.
- Não há endpoint público de replies/inbound email nesta versão.

### Configuração WhatsApp
- `GET /whatsapp/settings`: Lê settings por organização.
- `PUT /whatsapp/settings`: Atualiza settings (`apiKey: ""` limpa chave armazenada).
- `POST /whatsapp/settings/test-connection`: Testa conexão.
- `GET /whatsapp/settings/groups`: Lista grupos do provedor.
- `GET /whatsapp/settings/bindings`: Lista vínculos por feature.
- `PUT /whatsapp/settings/bindings/:feature`: Salva vínculo por feature.
- `POST /webhooks/whatsapp/evolution`: Inbound webhook (secret obrigatório em `x-webhook-secret`).

## Requisitos Funcionais

- **Autenticação de Usuários**: Usuários devem ser capazes de se registrar, fazer login e acessar seus perfis.
- **Gerenciamento de Usuários**: Administradores devem ser capazes de visualizar, atualizar e remover usuários.
- **Gerenciamento de Reservas**: Usuários devem ser capazes de criar, visualizar e remover reservas.
- **Verificação de Disponibilidade**: Usuários devem ser capazes de verificar a disponibilidade de recursos antes de fazer uma reserva.

## Tecnologias Utilizadas

- **Node.js**: Plataforma de desenvolvimento.
- **NestJS**: Framework para construção da API.
- **TypeORM**: ORM para interação com o banco de dados.
- **PostgreSQL**: Banco de dados relacional.
- **JWT**: Autenticação baseada em tokens.
- **Joi**: Validação de dados.

## Exemplos de Requisição e Resposta

### Registro de Usuário
**Requisição:**
```json
POST /users/register
{
  "name": "testuser",
  "email": "testuser@example.com",
  "password": "password123",
  "apartment": "101"
}
```

**Resposta:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "1",
    "name": "testuser",
    "email": "testuser@example.com",
    "apartment": "101"
  }
}
```

### Login de Usuário
**Requisição:**
```json
POST /users/login
{
  "name": "testuser",
  "password": "password123"
}
```

**Resposta:**
```json
{
  "message": "User logged in successfully",
  "token": "jwt-token"
}
```

### Criação de Reserva
**Requisição:**
```json
POST /bookings
{
  "resourceId": "1",
  "userId": "1",
  "startTime": "2025-02-12T10:00:00Z",
  "endTime": "2025-02-12T12:00:00Z"
}
```

**Resposta:**
```json
{
  "message": "Booking created successfully",
  "booking": {
    "id": "1",
    "resourceId": "1",
    "userId": "1",
    "startTime": "2025-02-12T10:00:00Z",
    "endTime": "2025-02-12T12:00:00Z"
  }
}
```

## Autenticação e Autorização

- **JWT**: A autenticação é gerenciada usando tokens JWT emitidos no BFF. O token deve ser incluído no cabeçalho `Authorization` das requisições subsequentes.
- **Guards**: O `JwtAuthGuard` é usado para proteger rotas que requerem autenticação.

## Tratamento de Erros

- **BadRequestException**: Lançada quando a validação dos dados falha.
- **UnauthorizedException**: Lançada quando as credenciais são inválidas ou o usuário não é encontrado.
- **ConflictException**: Lançada quando há um conflito, como um nome de usuário ou email já existente.
- **NotFoundException**: Lançada quando um recurso não é encontrado.

## Regras de Negócio

- **Registro de Usuário**: Verificar se o nome, email ou apartamento já estão em uso antes de registrar um novo usuário.
- **Login de Usuário**: Verificar as credenciais do usuário e gerar um token JWT se forem válidas.
- **Atualização de Perfil**: Permitir que os usuários atualizem seus perfis, mas verificar se o usuário existe antes de atualizar.
- **Criação de Reserva**: Verificar se a reserva está sendo feita para dias futuros e se o recurso está disponível antes de criar a reserva.
- **Verificação de Disponibilidade**: Verificar se o recurso está disponível no intervalo de tempo especificado antes de permitir a criação de uma reserva.
