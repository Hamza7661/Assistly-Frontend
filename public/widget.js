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
    openHeight: 500,
    countryCode: 'US' // Default country code
  };

  // Mobile layout tuning
  var mobileCollapsedHeight = 140;

  // Widget state tracking
  var widgetState = {
    isOpen: false
  };
  
  // Create iframe element
  function createIframe() {
    var iframe = document.createElement('iframe');
    var url = config.baseUrl + '/widget/' + config.userId;
    if (config.countryCode) {
      url += '?country=' + encodeURIComponent(config.countryCode);
    }
    iframe.src = url;
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
      if (widgetState.isOpen) {
        // Expanded state should take the full viewport
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.left = '0';
        iframe.style.right = '0';
        iframe.style.top = '0';
        iframe.style.bottom = '0';
        iframe.style.maxWidth = '100%';
      } else {
        // Collapsed state stays in the corner and does not block the page
        iframe.style.width = '320px';
        iframe.style.maxWidth = 'calc(100% - 1.6rem)';
        iframe.style.height = Math.max(config.initialHeight, mobileCollapsedHeight) + 'px';
        iframe.style.left = 'auto';
        iframe.style.right = '0.8rem';
        iframe.style.top = 'auto';
        iframe.style.bottom = '0.8rem';
      }
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
          // Mobile: use full height only when open, otherwise honor collapsed size
          if (widgetState.isOpen) {
            iframe.style.height = '100%';
          } else {
            var requestedHeight = typeof event.data.height === 'number' ? event.data.height : config.initialHeight;
            var clamped = Math.min(Math.max(requestedHeight, config.minHeight), config.maxHeight);
            iframe.style.height = Math.max(clamped, mobileCollapsedHeight) + 'px';
          }
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
        applyMobileStyles(iframe);
      }
    }
  }

  // Handle window resize to update mobile styles
  function handleWindowResize() {
    if (iframe) {
      applyMobileStyles(iframe);
    }
  }
  
  // Detect country code using multiple methods
  function detectCountryCode() {
    // Method 1: Try timezone-based detection
    try {
      var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      var timezoneToCountry = {
        'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US',
        'America/Toronto': 'CA', 'America/Vancouver': 'CA',
        'Europe/London': 'GB', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Rome': 'IT',
        'Europe/Madrid': 'ES', 'Europe/Amsterdam': 'NL', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO',
        'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Europe/Warsaw': 'PL', 'Europe/Prague': 'CZ',
        'Europe/Budapest': 'HU', 'Europe/Vienna': 'AT', 'Europe/Zurich': 'CH', 'Europe/Brussels': 'BE',
        'Europe/Dublin': 'IE', 'Europe/Lisbon': 'PT', 'Europe/Athens': 'GR', 'Europe/Istanbul': 'TR',
        'Europe/Moscow': 'RU', 'Asia/Tokyo': 'JP', 'Asia/Shanghai': 'CN', 'Asia/Hong_Kong': 'HK',
        'Asia/Singapore': 'SG', 'Asia/Seoul': 'KR', 'Asia/Taipei': 'TW', 'Asia/Bangkok': 'TH',
        'Asia/Jakarta': 'ID', 'Asia/Manila': 'PH', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Ho_Chi_Minh': 'VN',
        'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Tehran': 'IR', 'Asia/Karachi': 'PK',
        'Asia/Kolkata': 'IN', 'Asia/Dhaka': 'BD', 'Asia/Colombo': 'LK', 'Asia/Kathmandu': 'NP',
        'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Perth': 'AU',
        'Australia/Adelaide': 'AU', 'Australia/Brisbane': 'AU', 'Pacific/Auckland': 'NZ',
        'Africa/Cairo': 'EG', 'Africa/Johannesburg': 'ZA', 'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE',
        'America/Sao_Paulo': 'BR', 'America/Argentina/Buenos_Aires': 'AR', 'America/Mexico_City': 'MX',
        'America/Lima': 'PE', 'America/Santiago': 'CL', 'America/Bogota': 'CO', 'America/Caracas': 'VE'
      };
      
      if (timezoneToCountry[timezone]) {
        return timezoneToCountry[timezone];
      }
    } catch (e) {
      console.warn('Timezone detection failed:', e);
    }
    
    // Method 2: Try locale-based detection
    try {
      var locale = navigator.language || navigator.userLanguage;
      if (locale) {
        var parts = locale.split('-');
        if (parts.length >= 2) {
          var countryCode = parts[parts.length - 1].toUpperCase();
          if (countryCode.length === 2 && /^[A-Z]{2}$/.test(countryCode)) {
            return countryCode;
          }
        }
      }
    } catch (e) {
      console.warn('Locale detection failed:', e);
    }
    
    // Method 3: Fallback to default
    return 'US';
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
    
    // Detect country code
    config.countryCode = detectCountryCode();
    
    // Create and append iframe
    iframe = createIframe();
    document.body.appendChild(iframe);
    
    // Listen for messages from widget
    window.addEventListener('message', handleMessage);
    
    // Listen for window resize to update mobile styles
    window.addEventListener('resize', handleWindowResize);
    
    // Apply initial box shadow
    applyBoxShadow(iframe);
    
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