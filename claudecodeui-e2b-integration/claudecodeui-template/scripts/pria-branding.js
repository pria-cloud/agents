/**
 * PRIA Branding Script
 * Dynamically replaces "Claude" with "PRIA" in the UI
 * This script is injected into the claudecodeui frontend
 */

(function() {
  'use strict';
  
  console.log('🎨 PRIA Branding Script: Initializing...');
  
  // Create PRIA logo (animated QR code grid)
  function createPRIALogo() {
    const logoContainer = document.createElement('div');
    logoContainer.className = 'pria-logo';
    logoContainer.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      margin: 0;
      padding: 2px;
    `;
    
    // Create 3x3 grid (9 boxes total)
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1px;
      width: 24px;
      height: 24px;
    `;
    
    // Create boxes
    const boxes = [];
    for (let i = 0; i < 9; i++) {
      const box = document.createElement('div');
      box.style.cssText = `
        width: 100%;
        height: 100%;
        border-radius: 1px;
        background-color: transparent;
        transition: all 0.3s ease;
      `;
      boxes.push(box);
      grid.appendChild(box);
    }
    
    logoContainer.appendChild(grid);
    
    // Animation logic
    let animationInterval;
    const MIN_FILLED = 5;
    const MAX_FILLED = 7;
    
    function updateBoxes() {
      const currentFilled = boxes.filter(box => 
        box.style.backgroundColor === 'rgb(124, 58, 237)' // violet-600
      ).length;
      
      const targetFilled = Math.floor(Math.random() * (MAX_FILLED - MIN_FILLED + 1)) + MIN_FILLED;
      
      if (currentFilled < targetFilled) {
        // Fill more boxes
        const emptyBoxes = boxes.filter(box => 
          box.style.backgroundColor !== 'rgb(124, 58, 237)'
        );
        const toFill = targetFilled - currentFilled;
        for (let i = 0; i < toFill && emptyBoxes.length > 0; i++) {
          const randomIndex = Math.floor(Math.random() * emptyBoxes.length);
          emptyBoxes[randomIndex].style.backgroundColor = 'rgb(124, 58, 237)'; // violet-600
          emptyBoxes.splice(randomIndex, 1);
        }
      } else if (currentFilled > targetFilled) {
        // Remove some boxes
        const filledBoxes = boxes.filter(box => 
          box.style.backgroundColor === 'rgb(124, 58, 237)'
        );
        const toRemove = currentFilled - targetFilled;
        for (let i = 0; i < toRemove && filledBoxes.length > 0; i++) {
          const randomIndex = Math.floor(Math.random() * filledBoxes.length);
          filledBoxes[randomIndex].style.backgroundColor = 'transparent';
          filledBoxes.splice(randomIndex, 1);
        }
      } else {
        // Swap some boxes for visual interest
        const filledBoxes = boxes.filter(box => 
          box.style.backgroundColor === 'rgb(124, 58, 237)'
        );
        const emptyBoxes = boxes.filter(box => 
          box.style.backgroundColor !== 'rgb(124, 58, 237)'
        );
        
        if (filledBoxes.length > 0 && emptyBoxes.length > 0) {
          const swaps = Math.min(2, Math.floor(Math.random() * 2) + 1);
          for (let i = 0; i < swaps; i++) {
            const filledIndex = Math.floor(Math.random() * filledBoxes.length);
            const emptyIndex = Math.floor(Math.random() * emptyBoxes.length);
            
            filledBoxes[filledIndex].style.backgroundColor = 'transparent';
            emptyBoxes[emptyIndex].style.backgroundColor = 'rgb(124, 58, 237)';
          }
        }
      }
    }
    
    // Start animation
    function startAnimation() {
      // Initial setup - fill 5-7 random boxes
      const initialFilled = Math.floor(Math.random() * 3) + 5; // 5-7
      for (let i = 0; i < initialFilled; i++) {
        const randomIndex = Math.floor(Math.random() * 9);
        boxes[randomIndex].style.backgroundColor = 'rgb(124, 58, 237)';
      }
      
      animationInterval = setInterval(updateBoxes, 1500);
    }
    
    function stopAnimation() {
      if (animationInterval) {
        clearInterval(animationInterval);
      }
    }
    
    // Start animation when logo is created
    startAnimation();
    
    // Stop animation when logo is removed
    logoContainer._stopAnimation = stopAnimation;
    
    return logoContainer;
  }
  
  // Text replacement mappings
  const replacements = {
    'Ask Claude to change your code': 'Ask PRIA to build or change your application',
    'Claude Code UI': 'PRIA Code UI',
    'Claude UI': 'PRIA UI',
    'Claude Code': 'PRIA Code',
    'Claude': 'PRIA',
    'claude': 'pria' // lowercase variant
  };
  
  // Function to replace text in text nodes
  function replaceTextInNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.textContent;
      let modified = false;
      
      // Apply replacements in order of specificity (longest first)
      Object.keys(replacements)
        .sort((a, b) => b.length - a.length)
        .forEach(search => {
          const replace = replacements[search];
          if (text.includes(search)) {
            text = text.replace(new RegExp(search, 'g'), replace);
            modified = true;
          }
        });
      
      if (modified) {
        node.textContent = text;
      }
    }
  }
  
  // Function to replace Claude logos with PRIA logos
  function replaceClaueLogos(element) {
    // Find images that might be Claude logos
    const images = element.querySelectorAll ? 
      element.querySelectorAll('img[src*="claude"], img[alt*="claude" i], img[alt*="Claude"], svg[aria-label*="claude" i], svg[aria-label*="Claude"]') : 
      [];
    
    images.forEach(img => {
      // Skip if already replaced
      if (img.classList.contains('pria-logo-replaced')) return;
      
      const priaLogo = createPRIALogo();
      priaLogo.classList.add('pria-logo-replaced');
      
      // Copy classes and styles from original
      if (img.className) {
        priaLogo.className += ' ' + img.className;
      }
      
      // Replace the image/svg with PRIA logo
      img.parentNode.replaceChild(priaLogo, img);
    });
    
    // Also look for common logo container classes/IDs
    const logoContainers = element.querySelectorAll ? 
      element.querySelectorAll('.claude-logo, #claude-logo, [class*="claude-avatar"], [class*="assistant-avatar"], .avatar, .bot-avatar') : 
      [];
    
    logoContainers.forEach(container => {
      // Skip if already replaced
      if (container.classList.contains('pria-logo-replaced')) return;
      
      // Check if container has Claude-related images
      const hasClaudeLogo = container.querySelector('img[src*="claude"], img[alt*="claude" i], svg[aria-label*="claude" i]');
      if (hasClaudeLogo || container.textContent.toLowerCase().includes('claude')) {
        // Clear container and add PRIA logo
        container.innerHTML = '';
        const priaLogo = createPRIALogo();
        container.appendChild(priaLogo);
        container.classList.add('pria-logo-replaced');
      }
    });
    
    // Look for chat message avatars (common pattern in chat interfaces)
    const messageAvatars = element.querySelectorAll ? 
      element.querySelectorAll('.message-avatar, .chat-avatar, [class*="message"] img, [class*="chat"] img, [role="img"]') : 
      [];
    
    messageAvatars.forEach(avatar => {
      // Skip if already replaced
      if (avatar.classList.contains('pria-logo-replaced')) return;
      
      // Check if this looks like a Claude avatar
      const isClaudeAvatar = 
        (avatar.alt && avatar.alt.toLowerCase().includes('claude')) ||
        (avatar.src && avatar.src.toLowerCase().includes('claude')) ||
        (avatar.getAttribute('aria-label') && avatar.getAttribute('aria-label').toLowerCase().includes('claude')) ||
        (avatar.title && avatar.title.toLowerCase().includes('claude'));
      
      if (isClaudeAvatar) {
        const priaLogo = createPRIALogo();
        priaLogo.classList.add('pria-logo-replaced');
        
        // Copy relevant classes
        if (avatar.className) {
          priaLogo.className += ' ' + avatar.className;
        }
        
        avatar.parentNode.replaceChild(priaLogo, avatar);
      }
    });
  }
  
  // Function to process all text nodes in an element
  function processElement(element) {
    // Skip script and style tags
    if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
      return;
    }
    
    // Process text nodes
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip if parent is script or style
          const parent = node.parentElement;
          if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }
    
    nodes.forEach(replaceTextInNode);
    
    // Replace Claude logos with PRIA logos
    replaceClaueLogos(element);
    
    // Update attributes
    if (element.getAttribute) {
      ['title', 'alt', 'placeholder', 'aria-label'].forEach(attr => {
        const value = element.getAttribute(attr);
        if (value) {
          let newValue = value;
          Object.keys(replacements)
            .sort((a, b) => b.length - a.length)
            .forEach(search => {
              newValue = newValue.replace(new RegExp(search, 'g'), replacements[search]);
            });
          if (newValue !== value) {
            element.setAttribute(attr, newValue);
          }
        }
      });
    }
  }
  
  // Function to update document title
  function updateTitle() {
    if (document.title) {
      Object.keys(replacements)
        .sort((a, b) => b.length - a.length)
        .forEach(search => {
          document.title = document.title.replace(new RegExp(search, 'g'), replacements[search]);
        });
    }
  }
  
  // Main function to apply branding
  function applyBranding() {
    // Update document title
    updateTitle();
    
    // Process entire body
    if (document.body) {
      processElement(document.body);
    }
  }
  
  // Debounce function for performance
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  // Debounced branding application
  const debouncedBranding = debounce(applyBranding, 100);
  
  // Apply branding when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBranding);
  } else {
    applyBranding();
  }
  
  // Watch for dynamic content changes
  const observer = new MutationObserver((mutations) => {
    // Check if any mutations added new nodes
    const hasNewNodes = mutations.some(mutation => 
      mutation.type === 'childList' && mutation.addedNodes.length > 0
    );
    
    if (hasNewNodes) {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            processElement(node);
          } else if (node.nodeType === Node.TEXT_NODE) {
            replaceTextInNode(node);
          }
        });
      });
    }
    
    // Also handle attribute changes
    mutations.forEach(mutation => {
      if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
        const attr = mutation.attributeName;
        if (['title', 'alt', 'placeholder', 'aria-label'].includes(attr)) {
          const element = mutation.target;
          const value = element.getAttribute(attr);
          if (value) {
            let newValue = value;
            Object.keys(replacements)
              .sort((a, b) => b.length - a.length)
              .forEach(search => {
                newValue = newValue.replace(new RegExp(search, 'g'), replacements[search]);
              });
            if (newValue !== value) {
              element.setAttribute(attr, newValue);
            }
          }
        }
      }
    });
  });
  
  // Start observing when body is available
  function startObserving() {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['title', 'alt', 'placeholder', 'aria-label']
      });
      console.log('🎨 PRIA Branding Script: Monitoring for changes...');
    } else {
      // Try again later if body not ready
      setTimeout(startObserving, 100);
    }
  }
  
  startObserving();
  
  // Also check periodically for any missed elements (failsafe)
  setInterval(debouncedBranding, 5000);
  
  console.log('🎨 PRIA Branding Script: Initialized successfully!');
})();