// userSetting.js - User settings functionality

function initUserSettings() {
  const userSettingsBtn = document.getElementById('userSettingsBtn');
  const familyNameElement = document.getElementById('familyName');
  const userNameInput = document.getElementById('userName');
  const userAvatarPreview = document.getElementById('userAvatarPreview');
  const userAvatarInput = document.getElementById('userAvatarInput');
  const saveUserSettingsBtn = document.getElementById('saveUserSettings');
  
  // Load saved settings
  function loadUserSettings() {
    const savedName = localStorage.getItem('familyName');
    const savedAvatar = localStorage.getItem('avatarUrl');
    
    if (savedName && familyNameElement) {
      familyNameElement.textContent = savedName;
    }
    
    const userAvatarImg = document.getElementById('userAvatarImg');
    if (savedAvatar && userAvatarImg) {
      userAvatarImg.src = savedAvatar;
    }
    if (savedAvatar && userAvatarPreview) {
      userAvatarPreview.src = savedAvatar;
    }
  }
  
  // Handle avatar upload
  if (userAvatarInput) {
    userAvatarInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
          if (userAvatarPreview) {
            userAvatarPreview.src = event.target.result;
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }
  
  // Save settings
  if (saveUserSettingsBtn) {
    saveUserSettingsBtn.addEventListener('click', function() {
      const newName = userNameInput ? userNameInput.value.trim() : '';
      const newAvatar = userAvatarPreview ? userAvatarPreview.src : '';
      
      // Update family name
      if (newName && familyNameElement) {
        familyNameElement.textContent = newName;
        localStorage.setItem('familyName', newName);
      }
      
      // Update avatar
      const userAvatarImg = document.getElementById('userAvatarImg');
      if (newAvatar && userAvatarImg) {
        userAvatarImg.src = newAvatar;
        localStorage.setItem('avatarUrl', newAvatar);
      }
      
      // Close modal
      closeModal('userSettings');
      
      // Show success notification
      showNotification('Settings saved successfully!', 'success');
    });
  }
  
  // Open modal
  if (userSettingsBtn) {
    userSettingsBtn.addEventListener('click', function() {
      if (userNameInput && familyNameElement) {
        userNameInput.value = familyNameElement.textContent;
      }
      openModal('userSettings');
    });
  }
  
  // Initialize
  loadUserSettings();
}