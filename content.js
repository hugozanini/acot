let isExtensionReady = true;
let initializeRetryCount = 0;
const MAX_RETRIES = 2;
let isFirstCommentClick = true;

function sendMessageToBackground(message) {
  return new Promise((resolve, reject) => {
    if (!isExtensionReady && initializeRetryCount >= MAX_RETRIES) {
      console.log('Extension not ready and max retries exceeded, reloading page...');
      window.location.reload();
      reject(new Error('Extension not ready'));
      return;
    }
    
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Chrome runtime error:', chrome.runtime.lastError);
          
          if (chrome.runtime.lastError.message.includes('Extension context invalidated') || 
              chrome.runtime.lastError.message.includes('Extension context was invalidated')) {
            
            if (isFirstCommentClick || initializeRetryCount < MAX_RETRIES) {
              console.log('First attempt after configuration - will retry');
              initializeRetryCount++;
              isFirstCommentClick = false;
              
              const notification = document.createElement('div');
              notification.textContent = 'Extension is initializing. Please try clicking the comment again.';
              notification.style.position = 'fixed';
              notification.style.top = '0';
              notification.style.left = '0';
              notification.style.right = '0';
              notification.style.backgroundColor = '#4285f4';
              notification.style.color = 'white';
              notification.style.padding = '10px';
              notification.style.textAlign = 'center';
              notification.style.zIndex = '9999';
              document.body.appendChild(notification);
              
              setTimeout(() => {
                notification.remove();
              }, 5000);
              
              reject(new Error('Extension initializing'));
              return;
            } else {
              isExtensionReady = false;
              console.log('Extension context invalidated, will reload on next action');
              
              const notification = document.createElement('div');
              notification.textContent = 'Extension settings changed. Page will reload on next action.';
              notification.style.position = 'fixed';
              notification.style.top = '0';
              notification.style.left = '0';
              notification.style.right = '0';
              notification.style.backgroundColor = '#4285f4';
              notification.style.color = 'white';
              notification.style.padding = '10px';
              notification.style.textAlign = 'center';
              notification.style.zIndex = '9999';
              document.body.appendChild(notification);
              
              setTimeout(() => {
                notification.remove();
              }, 5000);
              
              reject(chrome.runtime.lastError);
              return;
            }
          }
          
          reject(chrome.runtime.lastError);
          return;
        }
        
        initializeRetryCount = 0;
        isFirstCommentClick = false;
        resolve(response);
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      
      if (isFirstCommentClick || initializeRetryCount < MAX_RETRIES) {
        console.log('First attempt after exception - will retry');
        initializeRetryCount++;
        isFirstCommentClick = false;
        reject(new Error('Extension initializing'));
      } else {
        isExtensionReady = false;
        reject(error);
      }
    }
  });
}

console.log('ACOT Content Script loaded');

function extractCommentText(commentElement) {
  console.log('Extracting text from comment element:', commentElement);
  
  const threadContainer = findCommentThreadContainer(commentElement);
  if (threadContainer && threadContainer !== commentElement) {
    console.log('Found a thread container, extracting all comments');
    return extractThreadComments(threadContainer);
  }
  
  const selectors = [
    '.docos-replyview-comment',
    '.docos-wackomsupport-commentcontent',
    '.docos-text',
    '.docos-replyview-body',
    '[data-comment-text="true"]',
    '.docos-comment-text',
    '.docos-content'
  ];
  
  for (const selector of selectors) {
    const element = commentElement.querySelector(selector);
    if (element) {
      console.log(`Found comment text using selector: ${selector}`);
      return element.textContent.trim();
    }
  }
  
  const textContent = commentElement.textContent || '';
  console.log('Using element text content as fallback');
  return textContent.trim();
}

function findCommentThreadContainer(element) {
  const threadSelectors = [
    '.docos-streamdocoview',
    '.docos-docoview-tesla-conflict',
    '.docos-anchoreddocoview',
    '[id^="docos-docoview-"]',
    '.docos-docoview'
  ];
  
  for (const selector of threadSelectors) {
    if (element.matches(selector)) {
      return element;
    }
  }
  
  for (const selector of threadSelectors) {
    const container = element.closest(selector);
    if (container) {
      return container;
    }
  }
  
  return null;
}

function extractThreadComments(threadContainer) {
  console.log('Extracting all comments from thread container');
  
  const commentSelectors = [
    '.docos-replyview',
    '.docos-anchoredreplyview',
    '.docos-replyview-comment',
    '.comment-container'
  ];
  
  let commentElements = [];
  for (const selector of commentSelectors) {
    const elements = threadContainer.querySelectorAll(selector);
    if (elements && elements.length > 0) {
      commentElements = Array.from(elements);
      console.log(`Found ${commentElements.length} comments using selector: ${selector}`);
      break;
    }
  }
  
  if (commentElements.length === 0) {
    return threadContainer.textContent.trim();
  }
  
  const commentTexts = [];
  const textSelectors = [
    '.docos-replyview-comment',
    '.docos-wackomsupport-commentcontent',
    '.docos-text',
    '.docos-replyview-body',
    '[data-comment-text="true"]',
    '.docos-comment-text',
    '.docos-content'
  ];
  
  commentElements.forEach((comment, index) => {
    let commentText = '';
    
    const authorElement = comment.querySelector('.docos-replyview-author, .docos-author, [data-author="true"]');
    const authorName = authorElement ? authorElement.textContent.trim() : `Commenter ${index + 1}`;
    
    for (const selector of textSelectors) {
      const element = comment.querySelector(selector);
      if (element) {
        commentText = element.textContent.trim();
        break;
      }
    }
    
    if (!commentText) {
      commentText = comment.textContent.trim();
    }
    
    commentTexts.push(`${authorName}: ${commentText}`);
  });
  
  return commentTexts.join('\n\n');
}

function attachEventListenersToComments() {
  const commentSelectors = [
    '.docos-streamdocoview',
    '.docos-docoview-tesla-conflict',
    '.docos-anchoreddocoview',
    '[id^="docos-docoview-"]',
    '.docos-docoview',
    '.docos-wackomsupport-commentview',
    '.comment-container',
    '.comment-bubble',
    '.goog-inline-block.kix-commentflag',
    '.docos-anchoredreplyview',
    '.docos-replyview'
  ];
  
  for (const selector of commentSelectors) {
    const comments = document.querySelectorAll(selector);
    console.log(`Found ${comments.length} comments with selector: ${selector}`);
    
    comments.forEach(comment => {
      if (!comment.dataset.acotListenerAdded) {
        comment.dataset.acotListenerAdded = 'true';
        
        comment.addEventListener('click', async (event) => {
          const commentText = extractCommentText(comment);
          console.log('Comment clicked through direct listener:', commentText);
          
          if (commentText) {
            try {
              const response = await sendMessageToBackground({ 
                action: 'commentClicked', 
                commentText: commentText 
              });
              console.log('Response from background:', response);
            } catch (error) {
              console.error('Error in comment click handler:', error);
              
              // Show different messages based on error type
              if (error.message === 'Extension initializing') {
                // We don't need to do anything here as the notification is shown in sendMessageToBackground
                console.log('Extension is initializing, waiting for retry');
                
                // Highlight the comment to indicate it was clicked
                const originalBackground = comment.style.backgroundColor;
                comment.style.backgroundColor = 'rgba(66, 133, 244, 0.3)';
                setTimeout(() => {
                  comment.style.backgroundColor = originalBackground;
                }, 1000);
              } else if (!isExtensionReady) {
                window.location.reload();
              }
            }
          }
        });
      }
    });
  }
}

function setupCommentListeners() {
  console.log('Setting up comment listeners');
  
  attachEventListenersToComments();
  
  const observer = new MutationObserver((mutations) => {
    attachEventListenersToComments();
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  document.addEventListener('click', async function(event) {
    const commentContainers = [
      '.docos-streamdocoview',
      '.docos-docoview-tesla-conflict',
      '.docos-anchoreddocoview',
      '[id^="docos-docoview-"]',
      '.docos-docoview',
      '.docos-wackomsupport-commentview',
      '.comment-container',
      '.comment-bubble',
      '.goog-inline-block.kix-commentflag',
      '.docos-anchoredreplyview',
      '.docos-replyview'
    ];
    
    for (const selector of commentContainers) {
      const container = event.target.closest(selector);
      if (container) {
        console.log(`Comment clicked via delegation: ${selector}`);
        const commentText = extractCommentText(container);
        console.log('Extracted comment text:', commentText);
        
        if (commentText) {
          try {
            const response = await sendMessageToBackground({ 
              action: 'commentClicked', 
              commentText: commentText 
            });
            console.log('Response from background:', response);
          } catch (error) {
            console.error('Error in comment click delegation:', error);
            
            // Show different messages based on error type
            if (error.message === 'Extension initializing') {
              // We don't need to do anything here as the notification is shown in sendMessageToBackground
              console.log('Extension is initializing, waiting for retry');
              
              // Highlight the comment to indicate it was clicked
              const originalBackground = container.style.backgroundColor;
              container.style.backgroundColor = 'rgba(66, 133, 244, 0.3)';
              setTimeout(() => {
                container.style.backgroundColor = originalBackground;
              }, 1000);
            } else if (!isExtensionReady) {
              window.location.reload();
            }
          }
        }
        break;
      }
    }
  });
}

function findAndFocusComment(commentText) {
  console.log('Attempting to find and focus on comment:', commentText);
  
  const commentSelectors = [
    '.docos-streamdocoview',
    '.docos-docoview-tesla-conflict',
    '.docos-anchoreddocoview',
    '[id^="docos-docoview-"]',
    '.docos-docoview',
    '.docos-wackomsupport-commentview',
    '.comment-container',
    '.comment-bubble',
    '.goog-inline-block.kix-commentflag',
    '.docos-anchoredreplyview',
    '.docos-replyview'
  ];
  
  for (const selector of commentSelectors) {
    const comments = document.querySelectorAll(selector);
    
    for (const comment of comments) {
      const extractedText = extractCommentText(comment);
      
      if (extractedText && extractedText.includes(commentText.substring(0, 50))) {
        console.log('Found matching comment, focusing on it');
        comment.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        const originalBackground = comment.style.backgroundColor;
        comment.style.backgroundColor = 'rgba(66, 133, 244, 0.2)';
        
        setTimeout(() => {
          comment.style.backgroundColor = originalBackground;
        }, 2000);
        
        return true;
      }
    }
  }
  
  console.log('Could not find matching comment');
  return false;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === 'focusOnComment') {
      const success = findAndFocusComment(message.commentText);
      sendResponse({ success });
    } else if (message.action === 'settingsChanged') {
      console.log('Received settings changed notification:', message.message);
      // Show a notification to the user
      const notification = document.createElement('div');
      notification.textContent = 'Extension settings updated. Some features may require page reload.';
      notification.style.position = 'fixed';
      notification.style.top = '0';
      notification.style.left = '0';
      notification.style.right = '0';
      notification.style.backgroundColor = '#4285f4';
      notification.style.color = 'white';
      notification.style.padding = '10px';
      notification.style.textAlign = 'center';
      notification.style.zIndex = '9999';
      document.body.appendChild(notification);
      
      // Add a reload button
      const reloadButton = document.createElement('button');
      reloadButton.textContent = 'Reload Now';
      reloadButton.style.marginLeft = '10px';
      reloadButton.style.padding = '5px 10px';
      reloadButton.style.backgroundColor = 'white';
      reloadButton.style.color = '#4285f4';
      reloadButton.style.border = 'none';
      reloadButton.style.borderRadius = '4px';
      reloadButton.style.cursor = 'pointer';
      reloadButton.addEventListener('click', () => {
        window.location.reload();
      });
      notification.appendChild(reloadButton);
      
      setTimeout(() => {
        notification.remove();
      }, 15000);
      
      sendResponse({ received: true });
    }
    return true; // Required for async sendResponse
  } catch (error) {
    console.error('Error handling message:', error);
    // If we get an extension context error, set the flag
    if (error.message && (
        error.message.includes('Extension context invalidated') || 
        error.message.includes('Extension context was invalidated'))) {
      isExtensionReady = false;
    }
    sendResponse({ success: false, error: error.message });
    return true;
  }
});

window.addEventListener('load', () => {
  console.log('Page loaded, setting up ACOT');
  
  // Check if the extension is ready
  checkExtensionReady();
  
  setTimeout(setupCommentListeners, 2000);
  
  setInterval(attachEventListenersToComments, 5000);
});

// Helper function to check if the extension is ready
function checkExtensionReady() {
  try {
    chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('Extension not fully initialized on page load:', chrome.runtime.lastError);
        isFirstCommentClick = true; // Set this to true to trigger the initialization flow
        
        // Try again in 2 seconds
        setTimeout(checkExtensionReady, 2000);
      } else {
        console.log('Extension is ready on page load');
        isFirstCommentClick = false; // Extension is fully initialized
        initializeRetryCount = 0;
      }
    });
  } catch (err) {
    console.warn('Could not check extension ready state:', err);
    isFirstCommentClick = true; // Assume we need initialization
    
    // Try again in 2 seconds
    setTimeout(checkExtensionReady, 2000);
  }
}
