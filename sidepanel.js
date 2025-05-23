
console.log('ACOT Side Panel loaded');

const apiConfigSection = document.getElementById('apiConfigSection');
const summarySection = document.getElementById('summarySection');
const geminiConfigSection = document.getElementById('geminiConfigSection');
const ollamaConfigSection = document.getElementById('ollamaConfigSection');
const modelSelectionSection = document.getElementById('modelSelectionSection');
const openaiCompatibleSection = document.getElementById('openaiCompatibleSection');
const apiKeyInput = document.getElementById('apiKeyInput');
const ollamaEndpointInput = document.getElementById('ollamaEndpointInput');
const openaiModelInput = document.getElementById('openaiModelInput');
const testGeminiButton = document.getElementById('testGeminiButton');
const testOllamaButton = document.getElementById('testOllamaButton');
const saveGeminiConfigButton = document.getElementById('saveGeminiConfigButton');
const saveOllamaConfigButton = document.getElementById('saveOllamaConfigButton');
const geminiStatusMessage = document.getElementById('geminiStatusMessage');
const ollamaStatusMessage = document.getElementById('ollamaStatusMessage');
const modelSelect = document.getElementById('modelSelect');
const summaryContent = document.getElementById('summaryContent');
const settingsIcon = document.getElementById('settingsIcon');
const promptTemplateSection = document.getElementById('promptTemplateSection');
const promptTemplateInput = document.getElementById('promptTemplateInput');
const savePromptButton = document.getElementById('savePromptButton');
const promptStatusMessage = document.getElementById('promptStatusMessage');
const acotLogo = document.getElementById('acotLogo');
const mainTabs = document.getElementById('mainTabs');

const DEFAULT_PROMPT = 'Summarize this Google Docs comment concisely, focusing on the main point or question:';

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupMessageListener();
  setupTabNavigation();
  setupProviderSelection();
  setupTestButtons();
  setupSaveButtons();
  checkConfiguration();
});

function setupTabNavigation() {
  const tabButtons = mainTabs.querySelectorAll('.tab-button');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      tabButtons.forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
      
      button.classList.add('active');
      const tabId = button.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
      
      chrome.storage.local.set({ activeTab: tabId });
    });
  });
  
  chrome.storage.local.get(['activeTab', 'configVerified'], (result) => {
    if (result.activeTab) {
      const tabButton = document.querySelector(`.tab-button[data-tab="${result.activeTab}"]`);
      if (tabButton) {
        tabButton.click();
      }
    } else if (result.configVerified) {
      document.querySelector('.tab-button[data-tab="summary"]').click();
    } else {
      document.querySelector('.tab-button[data-tab="settings"]').click();
    }
  });
}

function loadSettings() {
  chrome.storage.local.get([
    'apiProvider', 
    'geminiApiKey', 
    'geminiModel', 
    'ollamaEndpoint', 
    'openaiModel',
    'promptTemplate',
    'configVerified'
  ], (result) => {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }
    
    if (result.ollamaEndpoint) {
      ollamaEndpointInput.value = result.ollamaEndpoint;
      
      if (result.ollamaEndpoint.endsWith('/v1')) {
        openaiCompatibleSection.style.display = 'block';
        if (result.openaiModel) {
          openaiModelInput.value = result.openaiModel;
        }
      }
    }
    
    if (result.promptTemplate) {
      promptTemplateInput.value = result.promptTemplate;
    } else {
      promptTemplateInput.value = DEFAULT_PROMPT;
    }
  });
}

function setupProviderSelection() {
  const providerRadios = document.querySelectorAll('input[name="provider"]');
  
  providerRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'gemini') {
        geminiConfigSection.style.display = 'block';
        ollamaConfigSection.style.display = 'none';
      } else if (radio.value === 'ollama') {
        geminiConfigSection.style.display = 'none';
        ollamaConfigSection.style.display = 'block';
      }
    });
  });
  
  ollamaEndpointInput.addEventListener('input', function() {
    const endpoint = this.value.trim();
    if (endpoint.endsWith('/v1')) {
      openaiCompatibleSection.style.display = 'block';
    } else {
      openaiCompatibleSection.style.display = 'none';
    }
  });
  
  chrome.storage.local.get(['apiProvider'], (result) => {
    if (result.apiProvider === 'ollama') {
      document.querySelector('input[value="ollama"]').checked = true;
      geminiConfigSection.style.display = 'none';
      ollamaConfigSection.style.display = 'block';
    }
  });
}

function checkConfiguration() {
  chrome.storage.local.get(['apiProvider', 'geminiApiKey', 'geminiModel', 'ollamaEndpoint', 'configVerified'], (result) => {
    if (result.configVerified) {
      document.querySelector('.tab-button[data-tab="summary"]').click();
    } else {
      document.querySelector('.tab-button[data-tab="settings"]').click();
    }
    
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
      
      if (result.geminiApiKey && !result.geminiModel) {
        testGeminiConnection(result.geminiApiKey);
      }
    }
    
    if (result.ollamaEndpoint) {
      ollamaEndpointInput.value = result.ollamaEndpoint;
    }
  });
}

function setupTestButtons() {
  testGeminiButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showStatus(geminiStatusMessage, 'Please enter an API Key', 'status-error');
      return;
    }
    
    showStatus(geminiStatusMessage, 'Testing connection...', '');
    startLogoAnimation();
    testGeminiConnection(apiKey);
  });
  
  testOllamaButton.addEventListener('click', () => {
    const endpoint = ollamaEndpointInput.value.trim();
    
    if (!endpoint) {
      showStatus(ollamaStatusMessage, 'Please enter an endpoint URL', 'status-error');
      return;
    }
    
    showStatus(ollamaStatusMessage, 'Testing connection...', '');
    startLogoAnimation();
    testOllamaConnection(endpoint);
  });
}

function testGeminiConnection(apiKey) {
  const endpoint = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
  
  fetch(endpoint)
    .then(response => {
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      stopLogoAnimation();
      showStatus(geminiStatusMessage, 'Connection successful!', 'status-success');
      
      chrome.storage.local.set({ 
        geminiApiKey: apiKey,
        apiProvider: 'gemini'
      });
      
      modelSelectionSection.style.display = 'block';
      
      if (data.models && data.models.length > 0) {
        modelSelect.innerHTML = '';
        
        const geminiModels = data.models.filter(model => model.name.includes('gemini'));
        
        geminiModels.forEach(model => {
          const option = document.createElement('option');
          const modelName = model.name.split('/').pop();
          option.value = modelName;
          option.textContent = modelName;
          modelSelect.appendChild(option);
        });
      }
    })
    .catch(error => {
      stopLogoAnimation();
      console.error('Error testing Gemini API:', error);
      showStatus(geminiStatusMessage, `Connection failed: ${error.message}`, 'status-error');
    });
}

function testOllamaConnection(endpoint) {
  const isOpenAICompatible = endpoint.endsWith('/v1');
  const url = isOpenAICompatible ? 
    `${endpoint}/chat/completions` : 
    `${endpoint}/api/generate`;
  
  const modelName = isOpenAICompatible ? 
    (openaiModelInput.value.trim() || 'gpt-4') : 
    null;
  
  const testContent = "Test connection. Please respond with Connection successful.";
  
  const testRequest = isOpenAICompatible ? 
    JSON.stringify({
      "model": modelName,
      "messages": [
        {
          "role": "user",
          "content": testContent
        }
      ],
      "temperature": 0.7,
      "max_tokens": 150,
      "stream": false
    }) : 
    JSON.stringify({
      "prompt": testContent,
      "stream": false
    });
  
  console.log(`Testing connection to ${url} with request:`, testRequest);
  console.log(`Using model: ${modelName} for OpenAI-compatible endpoint: ${isOpenAICompatible}`);
  
  console.log(`Sending request to ${url} with body: '${testRequest}'`);
  
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: testRequest
  })
    .then(async response => {
      if (!response.ok) {
        const errorText = await response.text().catch(e => 'Unable to read error response');
        console.error(`API Error Response (${response.status}):`, errorText);
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      
      const responseText = await response.text();
      console.log('Raw response text:', responseText);
      
      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response from server');
      }
      
      try {
        return JSON.parse(responseText);
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError, 'Response text:', responseText);
        throw new Error(`Failed to parse API response: ${jsonError.message}`);
      }
    })
    .then(data => {
      stopLogoAnimation();
      console.log('API response:', data);
      
      console.log('API response data:', data);
      
      const isSuccess = endpoint.endsWith('/v1') ? 
        (data.choices && (data.choices[0]?.message?.content || data.choices[0]?.text)) : 
        data.response;
      
      if (isSuccess) {
        showStatus(ollamaStatusMessage, 'Connection successful!', 'status-success');
        
        chrome.storage.local.set({ 
          ollamaEndpoint: endpoint,
          apiProvider: 'ollama',
          configVerified: true
        }, () => {
          document.querySelector('.tab-button[data-tab="summary"]').click();
        });
      } else {
        console.error('Unexpected API response format:', data);
        throw new Error('Unexpected API response format');
      }
    })
    .catch(error => {
      stopLogoAnimation();
      console.error('Error testing Ollama API:', error);
      showStatus(ollamaStatusMessage, `Connection failed: ${error.message}`, 'status-error');
    });
}

function setupSaveButtons() {
  saveGeminiConfigButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    const selectedModel = modelSelect.value;
    
    if (!apiKey) {
      showStatus(geminiStatusMessage, 'Please enter an API Key', 'status-error');
      return;
    }
    
    if (!selectedModel) {
      showStatus(geminiStatusMessage, 'Please select a model', 'status-error');
      return;
    }
    
    startLogoAnimation();
    
    chrome.storage.local.set({ 
      geminiApiKey: apiKey,
      geminiModel: selectedModel,
      apiProvider: 'gemini',
      configVerified: true
    }, () => {
      stopLogoAnimation();
      showStatus(geminiStatusMessage, 'Configuration saved!', 'status-success');
      
      document.querySelector('.tab-button[data-tab="summary"]').click();
    });
  });
  
  saveOllamaConfigButton.addEventListener('click', () => {
    const endpoint = ollamaEndpointInput.value.trim();
    
    if (!endpoint) {
      showStatus(ollamaStatusMessage, 'Please enter an endpoint URL', 'status-error');
      return;
    }
    
    startLogoAnimation();
    
    if (endpoint.endsWith('/v1')) {
      const modelName = openaiModelInput.value.trim();
      if (!modelName) {
        stopLogoAnimation();
        showStatus(ollamaStatusMessage, 'Please enter a model name for OpenAI-compatible endpoint', 'status-error');
        return;
      }
      
      chrome.storage.local.set({ 
        ollamaEndpoint: endpoint,
        openaiModel: modelName,
        apiProvider: 'ollama',
        configVerified: true
      }, () => {
        showStatus(ollamaStatusMessage, 'Configuration saved!', 'status-success');
        testOllamaConnection(endpoint);
      });
    } else {
      testOllamaConnection(endpoint);
    }
  });
}

savePromptButton.addEventListener('click', () => {
  const promptTemplate = promptTemplateInput.value.trim();
  
  if (!promptTemplate) {
    showStatus(promptStatusMessage, 'Please enter a prompt template', 'status-error');
    return;
  }
  
  startLogoAnimation();
  
  chrome.storage.local.set({ promptTemplate: promptTemplate }, () => {
    stopLogoAnimation();
    showStatus(promptStatusMessage, 'Prompt template saved successfully', 'status-success');
  });
});

function showStatus(element, message, type) {
  element.textContent = message;
  element.className = 'status-message';
  
  if (type) {
    element.classList.add(type);
  }
  
  setTimeout(() => {
    element.textContent = '';
    element.className = 'status-message';
  }, 3000);
}

function startLogoAnimation() {
  if (acotLogo) {
    acotLogo.classList.add('loading');
  }
}

function stopLogoAnimation() {
  if (acotLogo) {
    acotLogo.classList.remove('loading');
  }
}

function displaySummary(summary, originalComment) {
  const summaryHTML = `
    <div class="summary-container">
      <div class="summary-result">
        <p>${escapeHTML(summary)}</p>
      </div>
    </div>
  `;
  
  summaryContent.innerHTML = summaryHTML;
  summaryContent.className = '';
  
  const summaryTitle = document.getElementById('summaryTitle');
  if (summaryTitle) {
    summaryTitle.classList.add('clickable-title');
    summaryTitle.title = "Click to view original comment thread";
    
    const newTitle = summaryTitle.cloneNode(true);
    summaryTitle.parentNode.replaceChild(newTitle, summaryTitle);
    
    newTitle.addEventListener('click', (event) => {
      event.preventDefault();
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'focusOnComment',
            commentText: originalComment
          });
        }
      });
    });
  }
}

function displayError(errorMessage) {
  summaryContent.innerHTML = `
    <div class="error-container">
      <p class="error-message">${escapeHTML(errorMessage)}</p>
      <p>Please check your API key and try again.</p>
    </div>
  `;
  summaryContent.className = 'error';
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'processingComment') {
      document.querySelector('.tab-button[data-tab="summary"]').click();
      
      startLogoAnimation();
      
      summaryContent.innerHTML = `
        <div class="loading-indicator">
          <div class="spinner"></div>
          <p>Generating summary...</p>
        </div>
      `;
      summaryContent.className = 'loading';
      
      sendResponse({status: 'processing state updated'});
    }
    
    else if (message.action === 'summaryResult') {
      stopLogoAnimation();
      
      if (message.success) {
        displaySummary(message.summary, message.originalComment);
      } else {
        displayError(message.error);
      }
      sendResponse({status: 'summary result displayed'});
    }
    
    return true; // Required for async sendResponse
  });
}
