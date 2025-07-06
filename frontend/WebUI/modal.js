// modal.js - Modal management system with improved event binding

// Global modal functions
function openModal(modalKey) {
  const modal = document.getElementById(`${modalKey}Modal`);
  if (!modal) return;
  
  modal.classList.remove('opacity-0', 'pointer-events-none');
  modal.classList.add('opacity-100', 'pointer-events-auto');
  
  const modalContent = modal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.classList.remove('scale-95');
    modalContent.classList.add('scale-100');
  }
  
  document.body.style.overflow = 'hidden';
}

function closeModal(modalKey) {
  const modal = document.getElementById(`${modalKey}Modal`);
  if (!modal) return;
  
  modal.classList.add('opacity-0', 'pointer-events-none');
  modal.classList.remove('opacity-100', 'pointer-events-auto');
  
  const modalContent = modal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
  }
  
  document.body.style.overflow = '';
}

// Initialize modal system
function initModalSystem() {
  // Auto-bind modal openers
  document.getElementById('openMemberModal')?.addEventListener('click', () => openModal('member'));
  document.getElementById('addMemberCard')?.addEventListener('click', () => openModal('member'));
  document.getElementById('openScheduleModal')?.addEventListener('click', () => openModal('schedule'));
  document.getElementById('openScheduleModal2')?.addEventListener('click', () => openModal('schedule'));
  document.getElementById('openTaskModal')?.addEventListener('click', () => openModal('task'));
  document.getElementById('openTaskModal2')?.addEventListener('click', () => openModal('task'));
  document.getElementById('userSettingsBtn')?.addEventListener('click', () => openModal('userSettings'));
  document.getElementById('openChoreModal')?.addEventListener('click', () => openModal('chore'));
  document.getElementById('openChoreModalQuick')?.addEventListener('click', () => openModal('chore'));

  // Auto-bind modal closers
  document.getElementById('closeMemberModal')?.addEventListener('click', () => closeModal('member'));
  document.getElementById('cancelMember')?.addEventListener('click', () => closeModal('member'));
  document.getElementById('closeScheduleModal')?.addEventListener('click', () => closeModal('schedule'));
  document.getElementById('cancelSchedule')?.addEventListener('click', () => closeModal('schedule'));
  document.getElementById('closeTaskModal')?.addEventListener('click', () => closeModal('task'));
  document.getElementById('cancelTask')?.addEventListener('click', () => closeModal('task'));
  document.getElementById('closeUserSettingsModal')?.addEventListener('click', () => closeModal('userSettings'));
  document.getElementById('cancelUserSettings')?.addEventListener('click', () => closeModal('userSettings'));
  document.getElementById('closeChoreModal')?.addEventListener('click', () => closeModal('chore'));
  document.getElementById('cancelChore')?.addEventListener('click', () => closeModal('chore'));

  // Bind outside click to close
  const modals = ['member', 'schedule', 'task', 'userSettings', 'chore'];
  modals.forEach(modalKey => {
    const modal = document.getElementById(`${modalKey}Modal`);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal(modalKey);
        }
      });
    }
  });
}