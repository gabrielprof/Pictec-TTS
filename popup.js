// popup.js - Lógica para carregar e salvar a chave da API no pop-up da extensão.

// 1. Função para carregar a chave da API salva ao iniciar o popup.
// Recebe os elementos DOM necessários como argumentos.
function loadApiKey(apiKeyInput, statusDiv) {
    chrome.storage.local.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
            statusDiv.textContent = 'Chave carregada. Pronto para usar.';
        } else {
            statusDiv.textContent = 'Insira sua chave da API do Gemini.';
        }
    });
}

// 2. Função nomeada para lidar com o clique (lógica de salvar).
// Recebe os elementos DOM necessários como argumentos.
function handleSaveClick(apiKeyInput, statusDiv) {
    const apiKey = apiKeyInput.value.trim();
    
    if (apiKey) {
        // Salva a chave no armazenamento local do Chrome
        chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
            statusDiv.textContent = 'Chave da API salva com sucesso!';
            // Opcional: Limpar a mensagem após um tempo
            setTimeout(() => {
                statusDiv.textContent = 'Pronto para usar.';
            }, 3000);
        });
       } else {
        // Se o campo estiver vazio
        statusDiv.textContent = 'Erro: Por favor, insira sua chave da API.';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // A busca pelos elementos DOM (getElementById) DEVE coincidir exatamente com o HTML.
    // Alterado de 'apiKeyInput' para 'apiKey' para corresponder ao popup.html
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('saveButton');
    const statusDiv = document.getElementById('status');

    // Carregar a chave da API imediatamente, passando os elementos
    loadApiKey(apiKeyInput, statusDiv);

    // 3. Anexar a função ao listener do botão, usando uma função anônima
    // para passar os argumentos (apiKeyInput e statusDiv) para a função externa.
    saveButton.addEventListener('click', () => handleSaveClick(apiKeyInput, statusDiv));
});