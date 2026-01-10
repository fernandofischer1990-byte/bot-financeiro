// Mapeamento de padrões de descrição para categorias
const EXPENSE_PATTERNS: Record<string, string[]> = {
  alimentacao: [
    'SUPERMERCADO', 'MERCADO', 'PADARIA', 'RESTAURANTE', 'LANCHONETE', 
    'IFOOD', 'RAPPI', 'UBER EATS', 'CARREFOUR', 'PÃO DE AÇUCAR', 'EXTRA',
    'ATACADAO', 'ASSAI', 'HORTIFRUTI', 'ACOUGUE', 'PEIXARIA', 'BK ', 
    'MCDONALDS', 'BURGER', 'PIZZA', 'SUSHI', 'CAFE ', 'STARBUCKS',
    'SUBWAY', 'KFC', 'HABIB', 'GIRAFFA', 'OUTBACK', 'MADERO'
  ],
  transporte: [
    'UBER ', '99 ', '99POP', 'CABIFY', 'COMBUSTIVEL', 'GASOLINA', 
    'ALCOOL', 'DIESEL', 'POSTO ', 'SHELL', 'IPIRANGA', 'BR DISTRIBUIDORA',
    'ESTACIONAMENTO', 'ZONA AZUL', 'PEDAGIO', 'AUTOPASS', 'CONECTCAR',
    'SEM PARAR', 'VELOE', 'METRO', 'ONIBUS', 'PASSAGEM', 'BILHETE UNICO'
  ],
  moradia: [
    'ALUGUEL', 'CONDOMINIO', 'IPTU', 'ENERGIA', 'ELETRICA', 'LUZ ', 
    'ENEL', 'CPFL', 'CEMIG', 'ELETROPAULO', 'AGUA ', 'SABESP', 
    'COPASA', 'SANEPAR', 'GAS ', 'COMGAS', 'NATURGY', 'INTERNET',
    'CLARO', 'VIVO', 'TIM ', 'OI ', 'NET ', 'SKY'
  ],
  saude: [
    'FARMACIA', 'DROGARIA', 'DROGA', 'HOSPITAL', 'CLINICA', 'MEDICO',
    'LABORATORIO', 'EXAME', 'CONSULTA', 'RAIA', 'PACHECO', 'PANVEL',
    'PAGUE MENOS', 'SAO PAULO DROG', 'UNIMED', 'SULAMERICA', 'BRADESCO SAUDE',
    'AMIL', 'HAPVIDA', 'NOTREDAME', 'ODONTO', 'DENTISTA'
  ],
  educacao: [
    'ESCOLA', 'COLEGIO', 'UNIVERSIDADE', 'FACULDADE', 'CURSO', 
    'UDEMY', 'ALURA', 'HOTMART', 'LIVRO', 'LIVRARIA', 'PAPELARIA',
    'SARAIVA', 'CULTURA', 'AMAZON KINDLE', 'GOOGLE PLAY LIVRO'
  ],
  lazer: [
    'CINEMA', 'CINEMARK', 'UCI', 'KINOPLEX', 'TEATRO', 'SHOW',
    'INGRESSO', 'SYMPLA', 'EVENTIM', 'VIAGEM', 'HOTEL', 'BOOKING',
    'AIRBNB', 'DECOLAR', 'LATAM', 'GOL ', 'AZUL ', 'CVC ', 
    'PARQUE', 'MUSEU', 'JOGO ', 'STEAM', 'PLAYSTATION', 'XBOX', 'NINTENDO'
  ],
  vestuario: [
    'ROUPA', 'CALCADO', 'SAPATO', 'TENIS', 'RENNER', 'RIACHUELO',
    'C&A', 'ZARA', 'FOREVER', 'SHEIN', 'SHOPEE', 'MERCADO LIVRE ROUPA',
    'NIKE', 'ADIDAS', 'CENTAURO', 'NETSHOES', 'DAFITI'
  ],
  assinaturas: [
    'NETFLIX', 'SPOTIFY', 'PRIME VIDEO', 'AMAZON PRIME', 'DISNEY',
    'HBO', 'GLOBOPLAY', 'DEEZER', 'APPLE MUSIC', 'YOUTUBE PREMIUM',
    'ACADEMIA', 'SMART FIT', 'BIO RITMO', 'TOTAL PASS', 'GYM PASS',
    'XBOX GAME PASS', 'PLAYSTATION PLUS', 'CRUNCHYROLL', 'PARAMOUNT',
    'APPLE TV', 'STAR+', 'DISCOVERY', 'MAX '
  ],
  outros_despesa: [
    'PIX ENVIADO', 'TED ENVIADO', 'DOC ENVIADO', 'TRANSFERENCIA ENVIADA',
    'BOLETO', 'PGTO FAT', 'PAGAMENTO FATURA', 'SAQUE', 'TARIFA', 
    'IOF', 'ANUIDADE', 'MENSALIDADE'
  ]
};

const INCOME_PATTERNS: Record<string, string[]> = {
  salario: [
    'SALARIO', 'PAGAMENTO', 'HOLERITE', 'FOLHA DE PAGAMENTO',
    'ADIANTAMENTO', '13 SALARIO', 'DECIMO TERCEIRO', 'FERIAS',
    'PLR', 'BONUS', 'PARTICIPACAO LUCROS'
  ],
  freelance: [
    'FREELANCE', 'SERVICO PRESTADO', 'NOTA FISCAL', 'NF-E',
    'CONSULTORIA', 'PROJETO'
  ],
  investimentos: [
    'RENDIMENTO', 'DIVIDENDO', 'JUROS', 'JCP', 'PROVENTOS',
    'FUNDO IMOBILIARIO', 'FII', 'TESOURO', 'CDB', 'LCI', 'LCA',
    'POUPANCA REND', 'APLICACAO'
  ],
  vendas: [
    'VENDA', 'MERCADO LIVRE', 'OLX', 'SHOPEE VENDA'
  ],
  outros_receita: [
    'PIX RECEBIDO', 'TED RECEBIDO', 'DOC RECEBIDO', 'TRANSFERENCIA RECEBIDA',
    'DEPOSITO', 'REEMBOLSO', 'DEVOLUCAO', 'ESTORNO', 'CASHBACK'
  ]
};

export function suggestCategory(description: string, type: 'income' | 'expense'): string {
  const upperDesc = description.toUpperCase();
  
  const patterns = type === 'expense' ? EXPENSE_PATTERNS : INCOME_PATTERNS;
  
  for (const [category, keywords] of Object.entries(patterns)) {
    for (const keyword of keywords) {
      if (upperDesc.includes(keyword)) {
        return category;
      }
    }
  }
  
  return type === 'expense' ? 'outros_despesa' : 'outros_receita';
}

export function getCategoryConfidence(description: string, category: string): 'high' | 'medium' | 'low' {
  const upperDesc = description.toUpperCase();
  const allPatterns = { ...EXPENSE_PATTERNS, ...INCOME_PATTERNS };
  
  const keywords = allPatterns[category] || [];
  
  // Check for exact keyword matches
  let matchCount = 0;
  for (const keyword of keywords) {
    if (upperDesc.includes(keyword)) {
      matchCount++;
    }
  }
  
  if (matchCount >= 2) return 'high';
  if (matchCount === 1) return 'medium';
  return 'low';
}

export { EXPENSE_PATTERNS, INCOME_PATTERNS };
