

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({
    path: 'sidepanel.html',
    enabled: true
  });
  
  chrome.storage.local.get(['promptTemplate', 'configVerified'], (result) => {
    if (!result.promptTemplate) {
      chrome.storage.local.set({
        promptTemplate: 'Summarize this Google Docs comment concisely, focusing on the main point or question:'
      });
    }
    
    if (result.configVerified === undefined) {
      chrome.storage.local.set({ configVerified: false });
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'commentClicked') {
    console.log('Background received comment text:', message.commentText);
    
    chrome.runtime.sendMessage({
      action: 'processingComment',
      commentText: message.commentText
    });
    
    (async () => {
      const config = await getApiConfig();
      
      const { configVerified } = await new Promise(resolve => {
        chrome.storage.local.get(['configVerified'], resolve);
      });
      
      if (!configVerified) {
        chrome.runtime.sendMessage({
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
          chrome.runtime.sendMessage({
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
          chrome.runtime.sendMessage({
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
      
      chrome.runtime.sendMessage({
        action: 'summaryResult',
        ...summaryResult,
        originalComment: message.commentText
      });
    })();
    
    sendResponse({status: 'received and processing'});
  }
  return true; // Required for async sendResponse
});
