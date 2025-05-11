const originalIcons = {
  '16': 'icons/icon16.png',
  '48': 'icons/icon48.png',
  '128': 'icons/icon128.png'
};

const animatedIcons = {
  '16': 'icons/icon16.png',
  '48': 'icons/icon48.png',
  '128': 'icons/icon128.png'
};

chrome.runtime.onInstalled.addListener(() => {
  console.log('ACOT Extension installed');
  
  chrome.sidePanel.setOptions({
    path: 'sidepanel.html',
    enabled: true
  });
  
  chrome.storage.local.get(['promptTemplate', 'configVerified', 'sidePanelOpenedTabs'], (result) => {
    if (!result.promptTemplate) {
      chrome.storage.local.set({
        promptTemplate: 'Summarize this Google Docs comment concisely, focusing on the main point or question:'
      });
    }
    
    if (result.configVerified === undefined) {
      chrome.storage.local.set({ configVerified: false });
    }
    
    if (!result.sidePanelOpenedTabs) {
      chrome.storage.local.set({ sidePanelOpenedTabs: {} });
    }
  });
});

async function getApiConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiProvider', 'geminiApiKey', 'geminiModel', 'ollamaEndpoint', 'openaiModel'], (result) => {
      resolve({
        provider: result.apiProvider || 'gemini',
        geminiApiKey: result.geminiApiKey,
        geminiModel: result.geminiModel || 'gemini-1.5-flash',
        ollamaEndpoint: result.ollamaEndpoint,
        openaiModel: result.openaiModel || 'gpt-4'
      });
    });
  });
}

async function summarizeWithGemini(apiKey, commentText, promptTemplate, model) {
  try {
    const modelToUse = model || 'gemini-1.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/${modelToUse}:generateContent?key=${apiKey}`;
    
    const promptToUse = promptTemplate || 'Summarize this Google Docs comment thread concisely, focusing on the main points and questions:';
    
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `${promptToUse} "${commentText}"`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 100
      }
    };
    
    console.log(`Sending request to Gemini API using model ${modelToUse}...`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.candidates && data.candidates[0]?.content?.parts && data.candidates[0].content.parts[0]?.text) {
      return {
        success: true,
        summary: data.candidates[0].content.parts[0].text.trim()
      };
    } else {
      throw new Error('Unexpected API response format');
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

async function summarizeWithOllama(endpoint, commentText, promptTemplate) {
  try {
    const promptToUse = promptTemplate || 'Summarize this Google Docs comment thread concisely, focusing on the main points and questions:';
    
    const config = await getApiConfig();
    const isOpenAICompatible = endpoint.endsWith('/v1');
    
    const apiUrl = isOpenAICompatible ? 
      `${endpoint}/chat/completions` : 
      `${endpoint}/api/generate`;
    
    const sanitizedCommentText = commentText.replace(/'/g, '');
    const sanitizedPrompt = promptToUse.replace(/'/g, '');
    
    const requestBodyObj = isOpenAICompatible ? 
      {
        "model": config.openaiModel || "gpt-4", // Use the user-configured model name
        "messages": [
          {
            "role": "user",
            "content": `${sanitizedPrompt} ${sanitizedCommentText}`
          }
        ],
        "temperature": 0.7, // Match the user's successful curl example
        "max_tokens": 150,
        "stream": false
      } : 
      {
        "prompt": `${sanitizedPrompt} ${sanitizedCommentText}`,
        "stream": false
      };
    
    const requestBody = JSON.stringify(requestBodyObj);
    
    console.log(`Sending request to custom API at ${apiUrl}...`);
    console.log(`Request body: ${requestBody}`);
    console.log(`Using model: ${requestBodyObj.model || 'N/A'} for OpenAI-compatible endpoint: ${isOpenAICompatible}`);
    
    console.log(`Sending request to ${apiUrl} with body: '${requestBody}'`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: requestBody
    });
    
    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      try {
        const errorText = await response.text();
        console.error(`API Error Response (${response.status}):`, errorText);
        errorMessage += ` - ${errorText}`;
      } catch (e) {
        console.error('Unable to read error response');
      }
      throw new Error(errorMessage);
    }
    
    let responseText;
    try {
      responseText = await response.text();
      console.log('Raw response text:', responseText);
      
      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response from server');
      }
    } catch (textError) {
      console.error('Error reading response text:', textError);
      throw new Error(`Failed to read API response: ${textError.message}`);
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log('Parsed API response data:', data);
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError, 'Response text:', responseText);
      throw new Error(`Failed to parse API response: ${jsonError.message}`);
    }
    
    if (isOpenAICompatible) {
      console.log('Received OpenAI-compatible API response:', data);
      
      if (data.choices && data.choices[0]?.message?.content) {
        return {
          success: true,
          summary: data.choices[0].message.content.trim()
        };
      } 
      else if (data.choices && data.choices[0]?.message?.annotations) {
        return {
          success: true,
          summary: data.choices[0].message.content.trim()
        };
      }
      else if (data.choices && data.choices[0]?.text) {
        return {
          success: true,
          summary: data.choices[0].text.trim()
        };
      } else {
        console.error('Unexpected OpenAI-compatible API response format:', data);
        throw new Error('Unexpected API response format');
      }
    } else {
      if (data.response) {
        return {
          success: true,
          summary: data.response.trim()
        };
      } else {
        console.error('Unexpected Ollama API response format:', data);
        throw new Error('Unexpected API response format');
      }
    }
  } catch (error) {
    console.error('Error calling Ollama API:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

// Add this event listener to handle settings updates
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.configVerified || changes.geminiApiKey || changes.apiProvider || 
        changes.ollamaEndpoint || changes.geminiModel || changes.openaiModel) {
      console.log('Extension settings changed, notifying content scripts');
      
      // Use a more careful approach to sending messages
      chrome.tabs.query({ url: "https://docs.google.com/document/*" }, (tabs) => {
        if (!tabs || tabs.length === 0) {
          console.log('No Google Docs tabs open to notify');
          return;
        }
        
        tabs.forEach(tab => {
          // Send message with error handling
          try {
            chrome.tabs.sendMessage(
              tab.id, 
              { 
                action: 'settingsChanged',
                message: 'Extension settings have been updated.'
              },
              // Add response callback to catch errors
              (response) => {
                if (chrome.runtime.lastError) {
                  // This is normal if the content script isn't ready yet
                  console.log(`Tab notification skipped: ${chrome.runtime.lastError.message}`);
                  return;
                }
                console.log('Tab notification sent successfully:', response);
              }
            );
          } catch (err) {
            console.error('Error in sending settings notification:', err);
          }
        });
      });
    }
  }
});

// Modify this part to avoid the icon animation issue
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('docs.google.com/document')) {
    // Temporarily disable icon animation to avoid errors
    console.log('Google Docs page loaded, but not changing icon to avoid errors');
    // Don't attempt to change the icon for now
    /*
    chrome.action.setIcon({
      tabId: tabId,
      path: animatedIcons
    });
    */
  }
});

// Modify this part to be more defensive with action handling
if (chrome.action) {
  chrome.action.onClicked.addListener((tab) => {
    if (tab && tab.url && tab.url.includes('docs.google.com/document')) {
      try {
        chrome.sidePanel.open({ tabId: tab.id }).catch(err => {
          console.error('Error opening side panel:', err);
        });
      } catch (err) {
        console.error('Error with side panel operation:', err);
      }
    } else {
      console.log('Tab not supported for side panel');
    }
  });
} else if (chrome.browserAction) {
  // Legacy support
  chrome.browserAction.onClicked.addListener((tab) => {
    if (tab && tab.url && tab.url.includes('docs.google.com/document')) {
      try {
        chrome.sidePanel.open({ tabId: tab.id }).catch(err => {
          console.error('Error opening side panel:', err);
        });
      } catch (err) {
        console.error('Error with side panel operation:', err);
      }
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Always check if the message and action exist
  if (!message || !message.action) {
    console.warn('Received message with no action');
    sendResponse({status: 'error', message: 'No action specified'});
    return true;
  }

  if (message.action === 'commentClicked') {
    console.log('Background received comment text:', message.commentText);
    
    // Use a safer approach to sending messages
    try {
      chrome.runtime.sendMessage({
        action: 'processingComment',
        commentText: message.commentText
      }, response => {
        if (chrome.runtime.lastError) {
          console.log('Error sending processing message:', chrome.runtime.lastError);
          // Continue with processing anyway
        }
      });
    } catch (err) {
      console.error('Error sending processing message:', err);
      // Continue with processing anyway
    }
    
    (async () => {
      try {
        const config = await getApiConfig();
        
        const { configVerified } = await new Promise(resolve => {
          chrome.storage.local.get(['configVerified'], resolve);
        });
        
        if (!configVerified) {
          sendMessageSafely({
            action: 'summaryResult',
            success: false,
            error: 'API not configured. Please configure your API settings first.'
          });
          return;
        }
        
        const { promptTemplate } = await new Promise(resolve => {
          chrome.storage.local.get(['promptTemplate'], resolve);
        });
        
        let summaryResult;
        
        if (config.provider === 'gemini') {
          if (!config.geminiApiKey) {
            sendMessageSafely({
              action: 'summaryResult',
              success: false,
              error: 'No Gemini API key found. Please configure your API settings.'
            });
            return;
          }
          summaryResult = await summarizeWithGemini(
            config.geminiApiKey, 
            message.commentText,
            promptTemplate,
            config.geminiModel
          );
        } else if (config.provider === 'ollama') {
          if (!config.ollamaEndpoint) {
            sendMessageSafely({
              action: 'summaryResult',
              success: false,
              error: 'Ollama configuration incomplete. Please configure your API settings.'
            });
            return;
          }
          summaryResult = await summarizeWithOllama(
            config.ollamaEndpoint,
            message.commentText,
            promptTemplate
          );
        }
        
        sendMessageSafely({
          action: 'summaryResult',
          ...summaryResult,
          originalComment: message.commentText
        });
      } catch (error) {
        console.error('Error processing comment:', error);
        sendMessageSafely({
          action: 'summaryResult',
          success: false,
          error: error.message || 'An unknown error occurred'
        });
      }
    })();
    
    sendResponse({status: 'received and processing'});
  }
  return true; // Required for async sendResponse
});

// Helper function to safely send messages
function sendMessageSafely(message) {
  try {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        console.log('Error sending message:', chrome.runtime.lastError);
      }
    });
  } catch (err) {
    console.error('Error sending message:', err);
  }
}
