<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

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
- `POST /users/login`: Faz login de um usuário.
- `GET /users/profile`: Obtém o perfil do usuário autenticado.
- `PUT /users/profile`: Atualiza o perfil do usuário autenticado.
- `GET /users`: Obtém todos os usuários.
- `DELETE /users/:id`: Remove um usuário.

### Reservas
- `POST /bookings`: Cria uma nova reserva.
- `GET /bookings`: Obtém todas as reservas.
- `GET /bookings/user/:userId`: Obtém reservas por usuário.
- `DELETE /bookings/:id`: Remove uma reserva.
- `GET /bookings/availability/:resourceId`: Verifica a disponibilidade de um recurso.

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

- **JWT**: A autenticação é gerenciada usando tokens JWT. Os usuários recebem um token JWT ao fazer login, que deve ser incluído no cabeçalho `Authorization` das requisições subsequentes.
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

## Deployment

Quando estiver pronto para implantar sua aplicação NestJS em produção, há alguns passos importantes que você pode seguir para garantir que ela funcione da maneira mais eficiente possível. Confira a [documentação de implantação](https://docs.nestjs.com/deployment) para mais informações.

Se você está procurando uma plataforma baseada em nuvem para implantar sua aplicação NestJS, confira [Mau](https://mau.nestjs.com), nossa plataforma oficial para implantar aplicações NestJS na AWS. Mau torna a implantação simples e rápida, exigindo apenas alguns passos simples:

```bash
$ npm install -g mau
$ mau deploy
```

Com Mau, você pode implantar sua aplicação em apenas alguns cliques, permitindo que você se concentre em construir funcionalidades em vez de gerenciar infraestrutura.

## Resources

Confira alguns recursos que podem ser úteis ao trabalhar com NestJS:

- Visite a [Documentação do NestJS](https://docs.nestjs.com) para saber mais sobre o framework.
- Para perguntas e suporte, visite nosso [canal no Discord](https://discord.gg/G7Qnnhy).
- Para se aprofundar e obter mais experiência prática, confira nossos [cursos oficiais](https://courses.nestjs.com/).
- Implante sua aplicação na AWS com a ajuda do [NestJS Mau](https://mau.nestjs.com) em apenas alguns cliques.
- Visualize o gráfico da sua aplicação e interaja com a aplicação NestJS em tempo real usando o [NestJS Devtools](https://devtools.nestjs.com).
- Precisa de ajuda com seu projeto (meio período ou período integral)? Confira nosso [suporte empresarial oficial](https://enterprise.nestjs.com).
- Para ficar por dentro das novidades e receber atualizações, siga-nos no [X](https://x.com/nestframework) e no [LinkedIn](https://linkedin.com/company/nestjs).
- Procurando um emprego ou tem uma vaga para oferecer? Confira nosso [Quadro de Empregos oficial](https://jobs.nestjs.com).

## Support

Nest é um projeto de código aberto licenciado pelo MIT. Ele pode crescer graças aos patrocinadores e ao apoio dos incríveis apoiadores. Se você gostaria de se juntar a eles, por favor [leia mais aqui](https://docs.nestjs.com/support).

## Stay in touch

- Autor - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest é licenciado pelo [MIT](https://github.com/nestjs/nest/blob/master/LICENSE).
