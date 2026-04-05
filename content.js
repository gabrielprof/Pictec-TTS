// content.js - Injetado na página web para interagir com o DOM e o motor TTS.

// --- CONFIGURAÇÕES TTS ---
const TTS_RATE = 1.2; // Velocidade de leitura (1.0 = normal, 1.2 = 20% mais rápido)
const TTS_PITCH = 1.0; // Tom da voz
const LANG_CODE = 'pt-BR';

// Variável para armazenar a voz preferida
let selectedVoice = null;

/**
 * Encontra a melhor voz disponível (Preferencialmente Google português do Brasil)
 */
function getPreferredVoice(voiceList) {
    const preferredVoiceName = 'Google português do Brasil';
    
    // 1. Tenta a voz de alta qualidade
    selectedVoice = voiceList.find(voice => 
        voice.name === preferredVoiceName && voice.lang === LANG_CODE
    );

    // 2. Se não encontrar, pega a primeira voz que fala português do Brasil
    if (!selectedVoice) {
        selectedVoice = voiceList.find(voice => voice.lang === LANG_CODE);
    }
    
    // 3. Se ainda não encontrar, usa a primeira disponível
    if (!selectedVoice) {
        selectedVoice = voiceList[0];
    }
}

/**
 * Inicializa o motor de vozes do navegador
 */
function initializeVoices() {
    const voices = speechSynthesis.getVoices();
    if (voices.length) {
        getPreferredVoice(voices);
    } else {
        speechSynthesis.onvoiceschanged = () => {
            getPreferredVoice(speechSynthesis.getVoices());
        };
    }
}

// Inicializa o carregamento das vozes
initializeVoices();

/**
 * Reproduz o texto fornecido usando o motor TTS do navegador.
 */
function speakDescription(text) {
    speechSynthesis.cancel(); 

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = TTS_RATE;
    utterance.pitch = TTS_PITCH;
    utterance.lang = LANG_CODE;
    
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }
    
    speechSynthesis.speak(utterance);
    console.log(`TTS iniciado com sucesso para: ${text.substring(0, 50)}...`);
}

/**
 * Exibe uma mensagem de status temporária na parte superior da página.
 */
function showStatusMessage(message, isError = false) {
    let statusBox = document.getElementById('gemini-tts-status-box');
    
    if (!statusBox) {
        statusBox = document.createElement('div');
        statusBox.id = 'gemini-tts-status-box';
        statusBox.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            font-family: 'Inter', sans-serif;
            font-size: 16px;
            font-weight: 600;
            color: white;
            transition: all 0.3s ease-in-out;
            opacity: 0;
            visibility: hidden;
        `;
        document.body.appendChild(statusBox);
    }

    statusBox.textContent = message;
    
    if (isError) {
        statusBox.style.backgroundColor = '#dc2626'; // Vermelho para erro
    } else if (message.includes("Analisando")) {
        statusBox.style.backgroundColor = '#fcd34d'; // Amarelo para status
        statusBox.style.color = '#333';
    } else {
        statusBox.style.backgroundColor = '#10b981'; // Verde para sucesso
        statusBox.style.color = 'white';
    }

    statusBox.style.opacity = '1';
    statusBox.style.visibility = 'visible';
    
    setTimeout(() => {
        statusBox.style.opacity = '0';
        statusBox.style.visibility = 'hidden';
    }, 4000);
}

// --- ACESSIBILIDADE E ATALHOS ---

/**
 * Adiciona tabindex às imagens para permitir navegação via teclado
 */
function makeImagesFocusable() {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        if (!img.hasAttribute('tabindex')) {
            img.setAttribute('tabindex', '0');
            img.setAttribute('aria-label', 'Imagem disponível para descrição. Pressione Alt mais I para analisar.');
        }
    });
}

// Cria uma Live Region invisível para falar com o leitor de tela (NVDA/JAWS/VoiceOver)
const liveRegion = document.createElement('div');
liveRegion.setAttribute('aria-live', 'polite'); 
liveRegion.style.cssText = "position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(1px, 1px, 1px, 1px);";
document.body.appendChild(liveRegion);

// Inicializa o foco das imagens
makeImagesFocusable();

/**
 * LISTENER UNIFICADO: Gerencia tanto o atalho quanto as respostas da API
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    // 1. Tratamento do Atalho Alt + I (Enviado pelo background.js)
    if (request.action === "analyzeFocused") {
        const focusedElement = document.activeElement; 
        
        if (focusedElement && focusedElement.tagName === 'IMG') {
            const imageUrl = focusedElement.src;
            // Envia mensagem ao background para processar a análise (mesmo fluxo do clique direito)
            chrome.runtime.sendMessage({ action: 'analyzeImage', imageUrl: imageUrl });
            
            showStatusMessage("Analisando imagem focada...");
            liveRegion.textContent = "Analisando imagem selecionada. Aguarde a descrição.";
        } else {
            const msg = "Nenhuma imagem selecionada. Use a tecla TAB para escolher uma imagem antes de usar o atalho.";
            showStatusMessage("Selecione uma imagem primeiro", true);
            liveRegion.textContent = msg;
        }
    }

    // 2. Tratamento de Erros (vinda direta ou via API)
    if (request.error) {
        showStatusMessage(request.error, true);
        speakDescription("Erro: " + request.error);
        liveRegion.textContent = "Erro na análise: " + request.error;
    } 
    
    // 3. Tratamento de Sucesso (Descrição recebida)
    else if (request.description) {
        showStatusMessage("Descrição recebida!", false);
        speakDescription(request.description);
        // Atualiza a live region para o cego ouvir automaticamente
        liveRegion.textContent = "Descrição concluída: " + request.description;
    } 
    
    // 4. Tratamento de Status (Início da análise)
    else if (request.status) {
        showStatusMessage(request.status);
        liveRegion.textContent = request.status;
    }
});