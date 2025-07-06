// notification.js - Notification system

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  const colors = {
    success: 'bg-secondary text-white',
    error: 'bg-danger text-white',
    info: 'bg-primary text-white'
  };
  
  notification.className = `fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 transform transition-all duration-300 ${colors[type]}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('translate-x-48');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}