(function() {
  'use strict';
  
  // Configuration
  var config = {
    userId: null,
    baseUrl: 'https://assistly-nohi.onrender.com', // This will be replaced with actual URL
    width: 400,
    minHeight: 100,
    maxHeight: 600,
    initialHeight: 100,
    openHeight: 500
  };

  // Widget state tracking
  var widgetState = {
    isOpen: false
  };
  
  // Create iframe element
  function createIframe() {
    var iframe = document.createElement('iframe');
    iframe.src = config.baseUrl + '/widget/' + config.userId;
    iframe.frameBorder = '0';
    iframe.allow = 'clipboard-write; clipboard-read';
    
    // Set all styling internally
    iframe.style.position = 'fixed';
    iframe.style.bottom = '0';
    iframe.style.right = '0';
    iframe.style.border = 'none';
    iframe.style.zIndex = '9999';
    iframe.style.background = 'transparent';
    
    // Apply mobile styles if needed
    applyMobileStyles(iframe);
    
    return iframe;
  }

  // Apply mobile styles to iframe
  function applyMobileStyles(iframe) {
    if (window.innerWidth <= 768) {
      // Mobile: 100% width and height
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.left = '0';
      iframe.style.top = '0';
    } else {
      // Desktop: fixed width and height based on widget state
      iframe.style.width = config.width + 'px';
      iframe.style.height = widgetState.isOpen ? config.openHeight + 'px' : config.initialHeight + 'px';
      iframe.style.bottom = '0.8rem';
      iframe.style.right = '0.8rem';
      iframe.style.left = 'auto';
      iframe.style.top = 'auto';
    }
  }

  // Apply box shadow based on widget state
  function applyBoxShadow(iframe) {
    if (window.innerWidth > 768) { // Only apply on desktop
      if (widgetState.isOpen) {
        iframe.style.boxShadow = 'rgba(0, 0, 0, 0.24) 0px 3px 8px';
      } else {
        iframe.style.boxShadow = 'none';
      }
    }
  }
  
  // Handle messages from widget
  function handleMessage(event) {
    if (event.data && event.data.type === 'resize-iframe') {
      if (iframe) {
        if (window.innerWidth <= 768) {
          // Mobile: keep 100% height
          iframe.style.height = '100%';
        } else {
          // Desktop: use dynamic height
          //var newHeight = Math.min(Math.max(event.data.height, config.minHeight), config.maxHeight);
          iframe.style.height = config.openHeight + 'px';
        }
      }
    }
    
    // Handle widget state changes
    if (event.data && event.data.type === 'widget-state') {
      widgetState.isOpen = event.data.isOpen;
      if (iframe) {
        applyBoxShadow(iframe);
      }
    }
  }

  // Handle window resize to update mobile styles
  function handleWindowResize() {
    if (iframe) {
      applyMobileStyles(iframe);
    }
  }
  
  // Initialize widget
  function init(userId, baseUrl) {
    if (!userId) {
      console.error('Assistly Widget: userId is required');
      return;
    }
    
    config.userId = userId;
    if (baseUrl) {
      config.baseUrl = baseUrl;
    }
    
    // Create and append iframe
    iframe = createIframe();
    document.body.appendChild(iframe);
    
    // Listen for messages from widget
    window.addEventListener('message', handleMessage);
    
    // Listen for window resize to update mobile styles
    window.addEventListener('resize', handleWindowResize);
    
    // Apply initial box shadow
    applyBoxShadow(iframe);
    
    console.log('Assistly Widget initialized for user:', userId);
  }
  
  // Cleanup function
  function destroy() {
    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
      iframe = null;
    }
    window.removeEventListener('message', handleMessage);
    window.removeEventListener('resize', handleWindowResize);
  }
  
  // Global variables
  var iframe = null;
  
  // Expose public API
  window.AssistlyWidget = {
    init: init,
    destroy: destroy,
    config: config
  };
  
  // Auto-initialize if data attributes are present
  document.addEventListener('DOMContentLoaded', function() {
    var script = document.querySelector('script[data-assistly-user-id]');
    if (script) {
      var userId = script.getAttribute('data-assistly-user-id');
      var baseUrl = script.getAttribute('data-assistly-base-url');
      init(userId, baseUrl);
    }
  });
  
})();
