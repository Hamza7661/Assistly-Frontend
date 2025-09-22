(function() {
  'use strict';
  
  // Configuration
  var config = {
    userId: null,
    baseUrl: 'https://assistly-nohi.onrender.com', // This will be replaced with actual URL
    width: 400,
    minHeight: 100,
    maxHeight: 400,
    initialHeight: 400
  };
  
  // Create iframe element
  function createIframe() {
    var iframe = document.createElement('iframe');
    iframe.src = config.baseUrl + '/widget/' + config.userId;
    iframe.width = config.width;
    iframe.height = config.initialHeight;
    iframe.frameBorder = '0';
    iframe.allow = 'clipboard-write; clipboard-read';
    iframe.style.cssText = 'position:fixed;bottom:0;right:0;border:none;z-index:9999;background:transparent;';
    
    return iframe;
  }
  
  // Handle resize messages from widget
  function handleResize(event) {
    if (event.data && event.data.type === 'resize-iframe') {
      var newHeight = Math.min(Math.max(event.data.height, config.minHeight), config.maxHeight);
      if (iframe) {
        iframe.height = newHeight + 'px';
      }
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
    
    // Listen for resize messages
    window.addEventListener('message', handleResize);
    
    console.log('Assistly Widget initialized for user:', userId);
  }
  
  // Cleanup function
  function destroy() {
    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
      iframe = null;
    }
    window.removeEventListener('message', handleResize);
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
