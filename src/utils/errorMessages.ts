/**
 * Mensagens de erro específicas e úteis para o usuário
 * Em vez de "Erro ao...", fornecemos contexto e possíveis soluções
 */

export const ErrorMessages = {
  // Vendas
  vendas: {
    deleteSuccess: (id: string) => `Venda ${id} foi removida com sucesso`,
    deleteFailed: (reason?: string) => 
      reason?.includes('constraint') || reason?.includes('referência')
        ? 'Não é possível excluir esta venda pois existem pagamentos vinculados a ela. Exclua os pagamentos primeiro.'
        : reason?.includes('network') || reason?.includes('fetch')
        ? 'Falha na conexão com o servidor. Verifique sua internet e tente novamente.'
        : 'Não foi possível excluir a venda. Verifique se não há pagamentos associados ou tente novamente.',
    deleteError: 'Ocorreu um erro inesperado ao excluir a venda. Entre em contato com o suporte se o problema persistir.',
    createFailed: (reason?: string) =>
      reason?.includes('duplicate') || reason?.includes('já existe')
        ? 'Esta venda já foi registrada no sistema. Verifique se não é uma duplicata.'
        : reason?.includes('estoque')
        ? 'Estoque insuficiente para realizar esta venda. Verifique a quantidade disponível.'
        : 'Não foi possível registrar a venda. Verifique os dados e tente novamente.',
    loadFailed: 'Não foi possível carregar as vendas. Tente recarregar a página ou entre em contato com o suporte.',
  },

  // Produtos/Estoque
  produtos: {
    deleteSuccess: 'Produto removido com sucesso do estoque',
    deleteFailed: (reason?: string) =>
      reason?.includes('constraint') || reason?.includes('receita')
        ? 'Não é possível excluir este produto pois ele está sendo usado em receitas ou vendas. Remova as dependências primeiro.'
        : 'Não foi possível excluir o produto. Verifique se não há dependências (receitas, vendas) ou tente novamente.',
    duplicateSku: 'Já existe um produto com este SKU. Use um código único para cada produto.',
    saveFailed: (isEditing: boolean) =>
      isEditing
        ? 'Não foi possível atualizar o produto. Verifique os dados e tente novamente.'
        : 'Não foi possível cadastrar o produto. Verifique se o SKU é único e todos os campos obrigatórios estão preenchidos.',
    loadFailed: 'Não foi possível carregar o estoque. Tente recarregar a página.',
    insufficientStock: (sku: string, available: number) =>
      `Estoque insuficiente para o produto ${sku}. Disponível: ${available} unidades.`,
  },

  // Matéria-prima
  materiaPrima: {
    deleteSuccess: 'Matéria-prima removida com sucesso',
    deleteFailed: (reason?: string) =>
      reason?.includes('constraint') || reason?.includes('receita')
        ? 'Não é possível excluir esta matéria-prima pois ela está sendo usada em receitas de produtos. Remova das receitas primeiro.'
        : 'Não foi possível excluir a matéria-prima. Verifique se não está sendo usada em receitas.',
    saveFailed: 'Não foi possível salvar a matéria-prima. Verifique se o SKU é único e todos os campos estão corretos.',
    loadFailed: 'Não foi possível carregar as matérias-primas. Tente recarregar a página.',
  },

  // Clientes
  clientes: {
    deleteSuccess: 'Cliente removido com sucesso',
    deleteFailed: (reason?: string) =>
      reason?.includes('constraint') || reason?.includes('venda')
        ? 'Não é possível excluir este cliente pois existem vendas ou pagamentos associados. Remova as dependências primeiro.'
        : 'Não foi possível excluir o cliente. Verifique se não há vendas ou pagamentos vinculados.',
    duplicateName: 'Já existe um cliente com este nome. Use um nome único ou adicione um identificador.',
    saveFailed: (isEditing: boolean) =>
      isEditing
        ? 'Não foi possível atualizar o cliente. Verifique os dados e tente novamente.'
        : 'Não foi possível cadastrar o cliente. Verifique se todos os campos obrigatórios estão preenchidos.',
    loadFailed: 'Não foi possível carregar os clientes. Tente recarregar a página.',
    notFound: 'Cliente não encontrado. Ele pode ter sido excluído ou você não tem permissão para visualizá-lo.',
  },

  // Pagamentos
  pagamentos: {
    createSuccess: 'Pagamento registrado com sucesso',
    createFailed: (reason?: string) =>
      reason?.includes('cliente')
        ? 'Cliente não encontrado. Verifique se o cliente ainda existe no sistema.'
        : reason?.includes('valor')
        ? 'Valor do pagamento inválido. Informe um valor maior que zero.'
        : 'Não foi possível registrar o pagamento. Verifique os dados e tente novamente.',
    loadFailed: 'Não foi possível carregar os pagamentos. Tente recarregar a página.',
    invalidAmount: 'O valor do pagamento deve ser maior que zero.',
  },

  // Receitas
  receitas: {
    saveSuccess: (isEditing: boolean) =>
      isEditing ? 'Receita atualizada com sucesso' : 'Receita cadastrada com sucesso',
    saveFailed: (reason?: string) =>
      reason?.includes('materia-prima')
        ? 'Uma ou mais matérias-primas da receita não foram encontradas. Verifique se ainda existem no estoque.'
        : 'Não foi possível salvar a receita. Verifique se todas as matérias-primas são válidas.',
    loadFailed: 'Não foi possível carregar as receitas. Tente recarregar a página.',
    notFound: 'Nenhuma receita encontrada para este produto. Cadastre uma receita primeiro.',
    emptyItems: 'Adicione pelo menos uma matéria-prima com quantidade válida antes de salvar.',
    invalidQuantity: 'As quantidades devem ser maiores que zero.',
  },

  // Devoluções
  devolucoes: {
    conferSuccess: 'Devolução conferida e estoque atualizado com sucesso',
    conferFailed: 'Não foi possível conferir a devolução. Verifique os dados e tente novamente.',
    loadFailed: 'Não foi possível carregar as devoluções pendentes. Tente recarregar a página.',
    invalidQuantity: 'A quantidade recebida deve ser um número válido maior ou igual a zero.',
    missingProduct: 'Informe qual produto foi recebido para completar a conferência.',
  },

  // Upload/Importação
  upload: {
    formatError: 'Formato de arquivo não reconhecido. Use apenas arquivos .xlsx ou .csv',
    sizeError: (maxMB: number) => `Arquivo muito grande. O tamanho máximo é ${maxMB}MB`,
    importSuccess: (count: number) => `Importação concluída com sucesso! ${count} registros processados.`,
    importFailed: (reason?: string) =>
      reason?.includes('formato')
        ? 'Formato da planilha incorreto. Verifique se as colunas estão corretas.'
        : 'Falha na importação. Verifique o formato do arquivo e tente novamente.',
    processError: 'Erro ao processar a planilha. Verifique se o formato está correto e tente novamente.',
  },

  // Usuários
  usuarios: {
    saveSuccess: (isEditing: boolean) =>
      isEditing ? 'Usuário atualizado com sucesso' : 'Usuário cadastrado com sucesso',
    saveFailed: (reason?: string) =>
      reason?.includes('email') || reason?.includes('duplicate')
        ? 'Já existe um usuário com este e-mail. Use um e-mail diferente.'
        : 'Não foi possível salvar o usuário. Verifique os dados e tente novamente.',
    inactivateSuccess: 'Usuário inativado com sucesso',
    inactivateFailed: 'Não foi possível inativar o usuário. Tente novamente.',
    loadFailed: 'Não foi possível carregar os usuários. Tente recarregar a página.',
    weakPassword: 'A senha deve ter pelo menos 6 caracteres.',
  },

  // Autenticação
  auth: {
    invalidCredentials: 'E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.',
    userInactive: 'Sua conta está inativa. Entre em contato com o administrador.',
    sessionExpired: 'Sua sessão expirou. Faça login novamente.',
    unauthorized: 'Você não tem permissão para realizar esta ação.',
  },

  // Genérico
  generic: {
    networkError: 'Falha na conexão com o servidor. Verifique sua internet e tente novamente.',
    serverError: 'Erro no servidor. Nossa equipe foi notificada. Tente novamente em alguns instantes.',
    validationError: 'Verifique os campos obrigatórios e tente novamente.',
    unknownError: 'Ocorreu um erro inesperado. Se o problema persistir, entre em contato com o suporte.',
  },
};

/**
 * Helper para extrair mensagem de erro detalhada baseada no contexto
 */
export const getErrorMessage = (error: unknown, context: string): string => {
  // Tentar extrair mensagem do erro
  const err = error as { message?: string; error?: string; toString?: () => string };
  const errorMsg = err?.message || err?.error || (typeof error === 'string' ? error : String(error)) || '';
  const errorLower = errorMsg.toLowerCase();

  // Detectar tipo de erro
  if (errorLower.includes('network') || errorLower.includes('fetch failed')) {
    return ErrorMessages.generic.networkError;
  }

  if (errorLower.includes('500') || errorLower.includes('server error')) {
    return ErrorMessages.generic.serverError;
  }

  if (errorLower.includes('401') || errorLower.includes('unauthorized')) {
    return ErrorMessages.auth.unauthorized;
  }

  if (errorLower.includes('403') || errorLower.includes('forbidden')) {
    return ErrorMessages.auth.unauthorized;
  }

  // Retornar mensagem específica do contexto com a razão
  return errorMsg || ErrorMessages.generic.unknownError;
};
