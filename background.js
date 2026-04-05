// background.js - Service Worker que gerencia a comunicação com a API do Gemini.
// Este script fica rodando em segundo plano.

// Constantes para a API do Gemini
const GEMINI_MODEL = 'gemini-flash-latest';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// --- NOVO: Criação do item do Menu de Contexto ---
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "analyzeSelectedImage",
        title: "PictecTTS: Descrever imagem com Gemini AI",
        contexts: ["image"] // O item só aparece quando o usuário clica com o botão direito em uma imagem
    });
});

// --- NOVO: Listener para o clique no Menu de Contexto ---
chrome.contextMenus.onClicked.addListener((info, tab) => {
    // Verifica se a imagem foi clicada e se a ação é a nossa
    if (info.menuItemId === "analyzeSelectedImage" && info.mediaType === "image") {
        // info.srcUrl contém o link direto da imagem clicada
        handleImageAnalysis(info.srcUrl, tab.id);
    }
});

/**
 * Converte uma URL de imagem externa em uma string Base64.
 * @param {string} url - URL da imagem.
 * @returns {Promise<Object>} Um objeto contendo o base64 da imagem e o tipo MIME.
 */
async function urlToGenerativePart(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Erro ao buscar imagem: ${response.statusText}`);
        }

        const imageBlob = await response.blob();
        const mimeType = imageBlob.type;

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                // reader.result é um DataURL, precisamos remover o prefixo
                const base64Data = reader.result.split(',')[1];
                resolve({ base64: base64Data, mimeType: mimeType });
            };
            reader.readAsDataURL(imageBlob);
        });
    } catch (e) {
        console.error("Erro na conversão da URL da imagem para Base64:", e);
        throw new Error(`Falha na preparação da imagem: ${e.message}`);
    }
}

/**
 * Processa a requisição para a API do Gemini e envia a resposta de volta para a aba.
 * @param {string} imageUrl - URL da imagem a ser analisada.
 * @param {number} tabId - ID da aba para onde a resposta deve ser enviada.
 */
async function handleImageAnalysis(imageUrl, tabId) {
    // 1. Obter a chave da API
    const result = await chrome.storage.local.get('geminiApiKey');
    const apiKey = result.geminiApiKey;

    if (!apiKey) {
        // Envia mensagem de erro para a aba
        return chrome.tabs.sendMessage(tabId, { error: "Erro: Chave da API do Gemini não configurada." });
    }

    // Informa a aba que a análise começou
    chrome.tabs.sendMessage(tabId, { status: "Analisando imagem..." });


    try {
        // 2. Converter a URL da imagem para Base64
        const { base64: base64Image, mimeType: imageMimeType } = await urlToGenerativePart(imageUrl);

        // 3. Montar o payload da API
        const payload = {
            contents: [
                {
                    parts: [
                        { text: "Você é um assistente de aprendizado. Analise esta imagem detalhadamente, focando em elementos educacionais, como gráficos, diagramas, figuras geométricas (triângulos, quadrados), números ou rótulos científicos. Use frases claras e completas, ideais para um motor de Texto para Fala (TTS). Exemplo de saída: 'Esta imagem contém um triângulo com um ângulo reto e outro de 15 graus.' Tome cuidado para não ser prolixo, seja objetivo e não se prolongue muito na resposta. Se houver uma pessoa ou personagem famoso retratado na imagem e você conseguir identificá-lo, anuncie que há uma pessoa e identifique-a deixando claro que há uma margem de erro em sua identificação. Se houver forma geométrica ou número, deixe claro qual/quais e qual sua posição/função perceptível na imagem. Se houver um mapa, descreva os pontos mais importantes, linhas, legendas e indicadores disponíveis." },
                        {
                            inlineData: {
                                mimeType: imageMimeType,
                                data: base64Image
                            }
                        }
                    ]
                }
            ],
            // Configurações para forçar o modelo a gerar texto
            generationConfig: {
                 // Aumenta a temperatura para respostas mais criativas/detalhadas (se necessário), mas 0.4 é bom para precisão
                temperature: 0.4, 
                maxOutputTokens: 2048,
            }
        };
console.log("Chamando a URL:", API_URL);
        // 4. Fazer a requisição para a API do Gemini
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify(payload)
        });

        const apiResult = await response.json();
        
        // 5. Verificar e extrair a descrição
        const candidate = apiResult.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;

        if (text) {
            console.log("Descrição da API recebida com sucesso.");
            // Envia a descrição de volta para a aba
            chrome.tabs.sendMessage(tabId, { description: text });
        } else {
            // --- LÓGICA DE TRATAMENTO DE ERROS REFORÇADA ---
            console.error("Resposta completa da API:", apiResult);

            let errorMessage = "Erro: Nenhuma descrição de texto foi gerada pela API.";
            
            const safetyRating = candidate?.safetyRatings?.[0];
            if (safetyRating && safetyRating.blocked === true) {
                errorMessage = `A descrição foi bloqueada devido a filtros de segurança (${safetyRating.category}).`;
            } else if (apiResult.error) {
                 errorMessage = `Erro na API: ${apiResult.error.message || 'Erro desconhecido.'}`;
            } else {
                errorMessage += " Verifique os logs do Service Worker para detalhes.";
            }

            chrome.tabs.sendMessage(tabId, { error: errorMessage });
        }

    } catch (e) {
        console.error("Erro geral durante a análise da imagem:", e);
        chrome.tabs.sendMessage(tabId, { error: `Erro interno: ${e.message}` });
    }
}

// Escuta pelo comando de teclado definido no manifest (Alt+I)
chrome.commands.onCommand.addListener((command) => {
    if (command === "analyze-focused-image") {
        // Busca a aba ativa no momento para enviar a instrução
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                // Envia uma mensagem para o content.js da aba ativa
                chrome.tabs.sendMessage(tabs[0].id, { action: "analyzeFocused" });
            }
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Se a mensagem for 'analyzeImage', ele chama a função de análise
    if (request.action === 'analyzeImage' && request.imageUrl) {
        console.log("Atalho detectado: Iniciando análise da imagem focada.");
        // O 'sender.tab.id' garante que a resposta volte para a aba certa
        handleImageAnalysis(request.imageUrl, sender.tab.id);
    }
    return true; // Mantém o canal aberto para evitar erros de conexão
});