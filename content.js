
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
        
        comment.addEventListener('click', (event) => {
          const commentText = extractCommentText(comment);
          console.log('Comment clicked through direct listener:', commentText);
          
          if (commentText) {
            try {
              chrome.runtime.sendMessage(
                { action: 'commentClicked', commentText: commentText },
                (response) => {
                  if (chrome.runtime.lastError) {
                    console.error('Error sending message:', chrome.runtime.lastError);
                    return;
                  }
                  console.log('Response from background:', response);
                }
              );
            } catch (error) {
              console.error('Failed to send message to background script:', error);
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
  
  document.addEventListener('click', function(event) {
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
            chrome.runtime.sendMessage(
              { action: 'commentClicked', commentText: commentText },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.error('Error sending message:', chrome.runtime.lastError);
                  return;
                }
                console.log('Response from background:', response);
              }
            );
          } catch (error) {
            console.error('Failed to send message to background script:', error);
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
    }
    return true; // Required for async sendResponse
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
    return true;
  }
});

window.addEventListener('load', () => {
  console.log('Page loaded, setting up ACOT');
  
  setTimeout(setupCommentListeners, 2000);
  
  setInterval(attachEventListenersToComments, 5000);
});
