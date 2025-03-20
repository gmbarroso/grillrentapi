const { writeFileSync } = require('fs');

const APARTMENTS = {
  bloco1: [
    '211'
    // '102', '103', '104',
    // '201', '202', '203', '204',
    // '105', '106', '107', '108',
    // '205', '206', '207', '208',
    // '109', '110', '111', '112',
    // '209', '210', '212',
    // '113', '114', '115', '116',
    // '213', '214', '215', '216',
  ],
  bloco2: [
    // '101',
    // '102', '103', '104',
    // '201', '202', '203', '204',
    // '105', '106', '107', '108',
    // '205', '206', '207', '208',
    // '109', '110', '111', '112',
    // '209', '210',
    // '211',
    // '212',
    // '113', '114', '115', '116',
    // '213', '214', '215', '216',
  ],
};

const PASSWORDS = [
  'Senha123!',
  'Senha456!',
  'Senha789!',
  'SenhaABC!',
  'SenhaDEF!',
  'SenhaGHI!',
  'SenhaJKL!',
  'SenhaMNO!',
]; // Lista de senhas padrão

function getRandomPassword() {
  return PASSWORDS[Math.floor(Math.random() * PASSWORDS.length)];
}

async function createUsers() {
  const results = [];
  const errors = [];
  const usedPasswords = []; // Lista para armazenar apartamento, bloco e senha gerada (somente sucessos)

  for (const [block, apartments] of Object.entries(APARTMENTS)) {
    for (const apartment of apartments) {
      const password = getRandomPassword(); // Gera a senha
      const userData = {
        name: `Apartamento 2 ${apartment}`,
        email: `apartamento2${apartment}@email.com`,
        password,
        block: block.replace('bloco', ''),
        apartment,
        role: 'resident',
      };

      try {
        const response = await fetch(`{{api}}/users/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(userData),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseData = await response.json();
        console.log(`Usuário criado: ${responseData.user.apartment})`);
        results.push({ success: true, data: responseData });

        // Adiciona à lista de senhas utilizadas apenas em caso de sucesso
        usedPasswords.push({ apartment, block: block.replace('bloco', ''), password });
      } catch (error) {
        console.error(`Erro ao criar usuário para o apartamento ${apartment} do ${block}:`, error.message);
        results.push({ success: false, error: error.message, apartment, block });
        errors.push({ apartment, block, error: error.message }); // Adiciona o erro à lista
      }
    }
  }

  // Gera o arquivo JSON com os resultados
  writeFileSync('user_creation_results.json', JSON.stringify(results, null, 2));
  console.log('Arquivo user_creation_results.json gerado com os resultados.');

  // Gera o arquivo JSON com as senhas utilizadas (somente sucessos)
  writeFileSync('used_passwords.json', JSON.stringify(usedPasswords, null, 2));
  console.log('Arquivo used_passwords.json gerado com as senhas utilizadas.');

  // Loga os apartamentos que tiveram erro
  if (errors.length > 0) {
    console.log('Apartamentos com erro:', errors);
  } else {
    console.log('Nenhum erro encontrado.');
  }

  return { errors, usedPasswords }; // Retorna os apartamentos com erro e as senhas utilizadas
}

createUsers().then(() => console.log('Processo concluído!')).catch(console.error);
