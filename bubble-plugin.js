/**
 * Bubble.io Image Editor Plugin
 * Version: 1.0.0
 * 
 * This file contains the complete plugin implementation for Bubble.io
 * It will be minified and hosted on jsDelivr CDN via GitHub releases
 */

// ============================================================================
// ELEMENT: Image Editor Canvas
// ============================================================================

/**
 * Element Initialize Function
 * Called once when the element first becomes visible on the page
 */
function initializeImageEditor(instance, context) {
  console.log('[Image Editor] Initializing element');
  
  // Create iframe container for the image editor
  var iframe = document.createElement('iframe');
  iframe.setAttribute('id', 'image-editor-iframe-' + Date.now());
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.overflow = 'hidden';
  iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
  
  // Store references in instance.data for access in update and actions
  instance.data.iframe = iframe;
  instance.data.editorReady = false;
  instance.data.messageQueue = [];
  instance.data.autoLoadExecuted = false;
  
  // Set up postMessage listener for cross-origin communication with iframe
  var messageHandler = function(event) {
    // Security: Verify message is from our editor
    if (!instance.data.editorUrl) return;
    
    var editorOrigin = new URL(instance.data.editorUrl).origin;
    if (event.origin !== editorOrigin) {
      console.warn('[Image Editor] Received message from unauthorized origin:', event.origin);
      return;
    }
    
    var data = event.data;
    if (!data || !data.type) return;
    
    console.log('[Image Editor] Received message:', data.type);
    
    // Handle different message types from the editor
    switch(data.type) {
      case 'editor_ready':
        console.log('[Image Editor] Editor is ready');
        instance.data.editorReady = true;
        instance.publishState('is_loaded', true);
        instance.publishState('error_message', '');
        instance.triggerEvent('Editor loaded');
        
        // Process any queued messages that were sent before editor was ready
        if (instance.data.messageQueue.length > 0) {
          console.log('[Image Editor] Processing', instance.data.messageQueue.length, 'queued messages');
          instance.data.messageQueue.forEach(function(msg) {
            iframe.contentWindow.postMessage(msg, editorOrigin);
          });
          instance.data.messageQueue = [];
        }
        break;
        
      case 'image_loaded':
        console.log('[Image Editor] Image loaded:', data.image);
        instance.publishState('current_image_url', data.image || '');
        instance.publishState('current_user_id', data.userId || '');
        instance.publishState('is_modified', false);
        instance.publishState('error_message', '');
        instance.triggerEvent('Image loaded', {
          url: data.image,
          userId: data.userId
        });
        break;
        
      case 'image_modified':
        console.log('[Image Editor] Image modified');
        instance.publishState('is_modified', true);
        instance.triggerEvent('Image modified');
        break;
        
      case 'export_started':
        console.log('[Image Editor] Export started');
        instance.publishState('export_status', 'exporting');
        instance.publishState('error_message', '');
        instance.triggerEvent('Export started');
        break;
        
      case 'export_success':
        console.log('[Image Editor] Export success');
        instance.publishState('export_status', 'success');
        instance.publishState('last_export_timestamp', new Date());
        instance.publishState('error_message', '');
        instance.triggerEvent('Export completed', {
          timestamp: new Date()
        });
        break;
        
      case 'export_error':
        console.error('[Image Editor] Export error:', data.error);
        instance.publishState('export_status', 'error');
        instance.publishState('error_message', data.error || 'Export failed');
        instance.triggerEvent('Export failed', {
          error: data.error || 'Export failed'
        });
        break;
        
      case 'error':
        console.error('[Image Editor] Editor error:', data.error);
        instance.publishState('error_message', data.error || 'Unknown error');
        instance.triggerEvent('Editor error', {
          error: data.error || 'Unknown error'
        });
        break;
        
      case 'image_data':
        console.log('[Image Editor] Received image data for download');
        if (data.imageData && instance.data.downloadFilename) {
          // Create download link
          var link = document.createElement('a');
          link.href = data.imageData;
          link.download = instance.data.downloadFilename;
          link.style.display = 'none';
          
          // Trigger download
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up
          delete instance.data.downloadFilename;
          
          console.log('[Image Editor] Image download initiated');
        } else {
          console.error('[Image Editor] Invalid image data received for download');
          instance.publishState('error_message', 'Failed to get image data for download');
          instance.triggerEvent('Editor error', {
            error: 'Failed to get image data for download'
          });
        }
        break;
        
      default:
        console.warn('[Image Editor] Unknown message type:', data.type);
    }
  };
  
  // Register message listener
  window.addEventListener('message', messageHandler);
  instance.data.messageHandler = messageHandler;
  
  // Handle iframe load event
  iframe.addEventListener('load', function() {
    console.log('[Image Editor] Iframe loaded');
  });
  
  // Handle iframe errors
  iframe.addEventListener('error', function(error) {
    console.error('[Image Editor] Iframe load error:', error);
    instance.publishState('error_message', 'Failed to load editor');
    instance.triggerEvent('Editor error', {
      error: 'Failed to load editor'
    });
  });
  
  // Append iframe to the canvas container
  instance.canvas.append(iframe);
  
  // Initialize all published states with default values
  instance.publishState('is_loaded', false);
  instance.publishState('is_modified', false);
  instance.publishState('export_status', 'idle');
  instance.publishState('current_image_url', '');
  instance.publishState('current_user_id', '');
  instance.publishState('error_message', '');
  instance.publishState('last_export_timestamp', null);
  
  console.log('[Image Editor] Element initialized');
}

/**
 * Element Update Function
 * Called whenever any of the element's properties change
 */
function updateImageEditor(instance, properties) {
  if (!instance.data.iframe) {
    console.warn('[Image Editor] Update called before initialization');
    return;
  }
  
  console.log('[Image Editor] Updating element properties');
  
  // Update iframe URL if editor_url property changed
  if (properties.editor_url !== instance.data.editorUrl) {
    var newUrl = properties.editor_url || 'https://lmqkf0940zey.space.minimax.io';
    console.log('[Image Editor] Updating editor URL to:', newUrl);
    
    instance.data.editorUrl = newUrl;
    instance.data.iframe.setAttribute('src', newUrl);
    instance.data.editorReady = false;
    instance.data.autoLoadExecuted = false;
    
    // Reset states when loading new editor URL
    instance.publishState('is_loaded', false);
    instance.publishState('is_modified', false);
    instance.publishState('export_status', 'idle');
  }
  
  // Store webhook URL and user ID for use in actions
  instance.data.webhookUrl = properties.webhook_url || '';
  instance.data.userId = properties.user_id || '';
  instance.data.autoLoad = properties.auto_load_on_start || false;
  
  console.log('[Image Editor] Properties updated - webhook:', instance.data.webhookUrl, 'userId:', instance.data.userId);
}

/**
 * Element Reset Function (Optional)
 * Called when the element needs to be reset to its initial state
 */
function resetImageEditor(instance) {
  console.log('[Image Editor] Resetting element');
  
  if (instance.data.iframe && instance.data.editorReady && instance.data.editorUrl) {
    var editorOrigin = new URL(instance.data.editorUrl).origin;
    instance.data.iframe.contentWindow.postMessage({
      type: 'reset'
    }, editorOrigin);
  }
  
  // Reset states
  instance.publishState('is_modified', false);
  instance.publishState('current_image_url', '');
  instance.publishState('current_user_id', '');
  instance.publishState('export_status', 'idle');
  instance.publishState('error_message', '');
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Action: Load Image
 * Loads an image into the editor canvas
 * Parameters:
 *   - image_url (text): URL or base64 data of the image to load
 *   - user_id (text): User identifier to associate with this image
 *   - element (element reference): Reference to the Image Editor Canvas element
 */
function actionLoadImage(properties, context) {
  console.log('[Image Editor] Action: Load Image');
  
  // Note: In Bubble, "element" property references the target Image Editor Canvas element
  // This assumes the action is configured with an "element" field of type "Image Editor Canvas"
  var element = properties.element;
  
  if (!element || !element.data) {
    console.error('[Image Editor] No element reference provided to Load Image action');
    return;
  }
  
  if (!element.data.iframe) {
    console.error('[Image Editor] Element not initialized');
    return;
  }
  
  if (!element.data.editorUrl) {
    console.error('[Image Editor] Editor URL not configured');
    return;
  }
  
  var imageUrl = properties.image_url || '';
  var userId = properties.user_id || '';
  
  if (!imageUrl) {
    console.warn('[Image Editor] No image URL provided to Load Image action');
    return;
  }
  
  console.log('[Image Editor] Loading image:', imageUrl, 'for user:', userId);
  
  var editorOrigin = new URL(element.data.editorUrl).origin;
  var message = {
    type: 'load_image',
    image: imageUrl,
    userId: userId
  };
  
  // Send message if editor is ready, otherwise queue it
  if (element.data.editorReady) {
    element.data.iframe.contentWindow.postMessage(message, editorOrigin);
  } else {
    console.log('[Image Editor] Editor not ready, queueing message');
    element.data.messageQueue.push(message);
  }
}

/**
 * Action: Export Image
 * Exports the edited image to the configured webhook
 * Parameters:
 *   - element (element reference): Reference to the Image Editor Canvas element
 */
function actionExportImage(properties, context) {
  console.log('[Image Editor] Action: Export Image');
  
  var element = properties.element;
  
  if (!element || !element.data) {
    console.error('[Image Editor] No element reference provided to Export Image action');
    return;
  }
  
  if (!element.data.iframe || !element.data.editorReady) {
    console.error('[Image Editor] Editor not ready');
    return;
  }
  
  if (!element.data.editorUrl) {
    console.error('[Image Editor] Editor URL not configured');
    return;
  }
  
  var webhookUrl = element.data.webhookUrl || properties.webhook_url || '';
  var userId = element.data.userId || properties.user_id || '';
  
  if (!webhookUrl) {
    console.error('[Image Editor] No webhook URL configured');
    element.publishState('error_message', 'No webhook URL configured');
    element.triggerEvent('Export failed', { error: 'No webhook URL configured' });
    return;
  }
  
  console.log('[Image Editor] Exporting to webhook:', webhookUrl, 'for user:', userId);
  
  var editorOrigin = new URL(element.data.editorUrl).origin;
  element.data.iframe.contentWindow.postMessage({
    type: 'export',
    webhookUrl: webhookUrl,
    userId: userId
  }, editorOrigin);
}

/**
 * Action: Reset Canvas
 * Clears the editor and resets to blank state
 * Parameters:
 *   - element (element reference): Reference to the Image Editor Canvas element
 */
function actionResetCanvas(properties, context) {
  console.log('[Image Editor] Action: Reset Canvas');
  
  var element = properties.element;
  
  if (!element || !element.data) {
    console.error('[Image Editor] No element reference provided to Reset Canvas action');
    return;
  }
  
  if (!element.data.iframe || !element.data.editorReady) {
    console.warn('[Image Editor] Editor not ready, cannot reset');
    return;
  }
  
  if (!element.data.editorUrl) {
    console.error('[Image Editor] Editor URL not configured');
    return;
  }
  
  var editorOrigin = new URL(element.data.editorUrl).origin;
  element.data.iframe.contentWindow.postMessage({
    type: 'reset'
  }, editorOrigin);
  
  // Update states
  element.publishState('is_modified', false);
  element.publishState('current_image_url', '');
  element.publishState('export_status', 'idle');
  element.publishState('error_message', '');
}

/**
 * Action: Undo
 * Undoes the last editing action
 * Parameters:
 *   - element (element reference): Reference to the Image Editor Canvas element
 */
function actionUndo(properties, context) {
  console.log('[Image Editor] Action: Undo');
  
  var element = properties.element;
  
  if (!element || !element.data) {
    console.error('[Image Editor] No element reference provided to Undo action');
    return;
  }
  
  if (!element.data.iframe || !element.data.editorReady) {
    console.warn('[Image Editor] Editor not ready, cannot undo');
    return;
  }
  
  if (!element.data.editorUrl) {
    console.error('[Image Editor] Editor URL not configured');
    return;
  }
  
  var editorOrigin = new URL(element.data.editorUrl).origin;
  element.data.iframe.contentWindow.postMessage({
    type: 'undo'
  }, editorOrigin);
}

/**
 * Action: Redo
 * Redoes a previously undone action
 * Parameters:
 *   - element (element reference): Reference to the Image Editor Canvas element
 */
function actionRedo(properties, context) {
  console.log('[Image Editor] Action: Redo');
  
  var element = properties.element;
  
  if (!element || !element.data) {
    console.error('[Image Editor] No element reference provided to Redo action');
    return;
  }
  
  if (!element.data.iframe || !element.data.editorReady) {
    console.warn('[Image Editor] Editor not ready, cannot redo');
    return;
  }
  
  if (!element.data.editorUrl) {
    console.error('[Image Editor] Editor URL not configured');
    return;
  }
  
  var editorOrigin = new URL(element.data.editorUrl).origin;
  element.data.iframe.contentWindow.postMessage({
    type: 'redo'
  }, editorOrigin);
}

/**
 * Action: Upload Image File
 * Opens a file picker dialog and loads the selected image
 * Parameters:
 *   - element (element reference): Reference to the Image Editor Canvas element
 *   - user_id (text, optional): User identifier to associate with this image
 */
function actionUploadImageFile(properties, context) {
  console.log('[Image Editor] Action: Upload Image File');
  
  var element = properties.element;
  
  if (!element || !element.data) {
    console.error('[Image Editor] No element reference provided to Upload Image File action');
    return;
  }
  
  if (!element.data.iframe) {
    console.error('[Image Editor] Element not initialized');
    return;
  }
  
  // Create a hidden file input element
  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  
  fileInput.addEventListener('change', function(event) {
    var file = event.target.files[0];
    if (!file) {
      console.warn('[Image Editor] No file selected');
      return;
    }
    
    // Check if it's an image file
    if (!file.type.startsWith('image/')) {
      console.error('[Image Editor] Selected file is not an image');
      element.triggerEvent('Editor error');
      if (element.publishState) {
        element.publishState('error_message', 'Selected file is not an image');
      }
      return;
    }
    
    // Read the file as base64
    var reader = new FileReader();
    reader.onload = function(e) {
      var base64Data = e.target.result;
      var userId = properties.user_id || '';
      
      // Load the image using the existing load image logic
      if (!element.data.editorUrl) {
        console.error('[Image Editor] Editor URL not configured');
        return;
      }
      
      var editorOrigin = new URL(element.data.editorUrl).origin;
      var message = {
        type: 'load_image',
        image: base64Data,
        userId: userId
      };
      
      // Send message to editor
      if (element.data.editorReady) {
        element.data.iframe.contentWindow.postMessage(message, editorOrigin);
      } else {
        element.data.messageQueue.push(message);
      }
      
      // Update element states
      if (element.publishState) {
        element.publishState('current_image_url', base64Data);
        element.publishState('current_user_id', userId);
      }
      
      console.log('[Image Editor] Image file uploaded and loaded');
    };
    
    reader.onerror = function() {
      console.error('[Image Editor] Error reading file');
      element.triggerEvent('Editor error');
      if (element.publishState) {
        element.publishState('error_message', 'Error reading selected file');
      }
    };
    
    reader.readAsDataURL(file);
    
    // Clean up
    document.body.removeChild(fileInput);
  });
  
  // Add to DOM and trigger click
  document.body.appendChild(fileInput);
  fileInput.click();
}

/**
 * Action: Download Edited Image
 * Downloads the current edited image as a file
 * Parameters:
 *   - element (element reference): Reference to the Image Editor Canvas element
 *   - filename (text, optional): Name for the downloaded file
 */
function actionDownloadEditedImage(properties, context) {
  console.log('[Image Editor] Action: Download Edited Image');
  
  var element = properties.element;
  
  if (!element || !element.data) {
    console.error('[Image Editor] No element reference provided to Download Edited Image action');
    return;
  }
  
  if (!element.data.iframe || !element.data.editorReady) {
    console.warn('[Image Editor] Editor not ready, cannot download image');
    return;
  }
  
  if (!element.data.editorUrl) {
    console.error('[Image Editor] Editor URL not configured');
    return;
  }
  
  var filename = properties.filename || 'edited-image.png';
  
  // Ensure filename has proper extension
  if (!filename.match(/\.(png|jpg|jpeg)$/i)) {
    filename += '.png';
  }
  
  var editorOrigin = new URL(element.data.editorUrl).origin;
  
  // Store download request info for when we receive the response
  element.data.downloadFilename = filename;
  
  // Request the current image data from the editor
  element.data.iframe.contentWindow.postMessage({
    type: 'get_image_data',
    format: 'png'
  }, editorOrigin);
  
  console.log('[Image Editor] Requested image data for download');
}

// ============================================================================
// EXPORTS
// ============================================================================

// These function names will be used in the Bubble plugin editor
// when configuring the element and actions

// Element functions (configured in Elements tab)
// - Initialize function: initializeImageEditor
// - Update function: updateImageEditor
// - Reset function: resetImageEditor

// Action functions (configured in Actions tab)
// - Load Image: actionLoadImage
// - Export Image: actionExportImage  
// - Reset Canvas: actionResetCanvas
// - Undo: actionUndo
// - Redo: actionRedo
// - Upload Image File: actionUploadImageFile
// - Download Edited Image: actionDownloadEditedImage
// - Redo: actionRedo
