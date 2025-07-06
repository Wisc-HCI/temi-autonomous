// ScheduleHandler.js - Schedule Management Module
// Family member selector functionality
const scheduleMemberSelectors = new Map();

// Notification state management
let activeNotification = null;
let notificationTimeout = null;

function initScheduleMemberSelector(containerId, initialSelection = []) {
  // Check if selector already exists
  if (scheduleMemberSelectors.has(containerId)) {
    const selector = scheduleMemberSelectors.get(containerId);
    selector.setSelectedIds(initialSelection);
    return selector;
  }

  // Create new selector
  const selector = {
    containerId,
    selectedIds: new Set(initialSelection),
    
    toggleSelection(memberId) {
      if (this.selectedIds.has(memberId)) {
        this.selectedIds.delete(memberId);
      } else {
        this.selectedIds.add(memberId);
      }
      this.render();
    },
    
    setSelectedIds(ids) {
      this.selectedIds = new Set(ids);
      this.render();
    },
    
    getSelectedIds() {
      return Array.from(this.selectedIds);
    },
    
    getSelectedNames() {
      return this.getSelectedIds()
        .map(id => familyMembers.find(m => m.id === id)?.name)
        .filter(Boolean)
        .join(', ');
    },
    
    render() {
      const container = document.getElementById(this.containerId);
      if (!container) return;
      
      container.innerHTML = '';
      familyMembers.forEach(member => {
        const isSelected = this.selectedIds.has(member.id);
        const chip = document.createElement('div');
        chip.className = `chip 
          ${isSelected ? 'bg-primary/10 text-primary border-2 border-primary' : 'bg-gray-100 text-gray-600 border-2 border-gray-300'} 
          px-3 py-1 rounded-full text-xs font-medium 
          flex items-center cursor-pointer 
          transition-all duration-200`;
        chip.dataset.memberId = member.id;
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = member.name;
        
        const icon = document.createElement('i');
        icon.className = 'fa fa-times ml-1';
        icon.style.display = isSelected ? 'inline' : 'none';
        
        chip.appendChild(nameSpan);
        chip.appendChild(icon);
        
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleSelection(member.id);
        });
        
        container.appendChild(chip);
      });
    }
  };

  scheduleMemberSelectors.set(containerId, selector);
  selector.render();
  return selector;
}

// Schedule data storage
let schedules = [
  { 
    id: '1', 
    name: 'Prepare Breakfast', 
    startTime: '07:00', 
    endTime: '07:30', 
    isAllDay: false,
    description: 'Prepare breakfast for the whole family', 
    type: 'taskflow', 
    relatedItemId: '1',
    memberIds: ['3'],
    memberNames: 'Peppa Pig'
  },
  { 
    id: '2', 
    name: 'Take Medicine', 
    startTime: '08:30', 
    endTime: '08:45', 
    isAllDay: false,
    description: 'Remind Mommy Pig to take cold medication', 
    type: 'standalone', 
    relatedItemId: '',
    memberIds: ['2'],
    memberNames: 'Mommy Pig'
  }
];

// DOM load event
document.addEventListener('DOMContentLoaded', function() {
  initScheduleHandler();
});

// Prevent duplicate submissions
let isSubmitting = false;

function initScheduleHandler() {
  console.log('Schedule handler initialized');
  
  // Handle new schedule buttons
  const newScheduleBtn1 = document.getElementById('openScheduleModal');
  const newScheduleBtn2 = document.getElementById('openScheduleModal2');
  
  if (newScheduleBtn1) {
    newScheduleBtn1.addEventListener('click', openNewScheduleModal);
  } else {
    console.error('First new schedule button not found!');
  }
  
  if (newScheduleBtn2) {
    newScheduleBtn2.addEventListener('click', openNewScheduleModal);
  } else {
    console.error('Second new schedule button not found!');
  }
  
  // Bind event delegation to document level
  document.addEventListener('click', function(e) {
    handleScheduleActions(e);
  });
  
  // Handle schedule type change
  document.getElementById('scheduleType')?.addEventListener('change', function() {
    updateScheduleType(this);
  });
  
  // Handle save schedule button
  const saveScheduleBtn = document.getElementById('saveScheduleBtn');
  if (saveScheduleBtn) {
    saveScheduleBtn.addEventListener('click', function(e) {
      e.preventDefault();
      debounceSaveSchedule();
    });
  } else {
    console.error('Save schedule button not found!');
  }
  
  // Initialize related items container
  updateScheduleType(document.getElementById('scheduleType') || { value: 'standalone' });
  
  // Prevent form default submission
  const scheduleForm = document.getElementById('scheduleForm');
  if (scheduleForm) {
    scheduleForm.addEventListener('submit', function(e) {
      e.preventDefault();
      debounceSaveSchedule();
    });
  }
}

// Debounce function to prevent duplicate submissions
function debounceSaveSchedule() {
  if (isSubmitting) return;
  
  isSubmitting = true;
  saveSchedule();
  
  // Release lock after 300ms
  setTimeout(() => {
    isSubmitting = false;
  }, 300);
}

function openNewScheduleModal() {
  document.getElementById('scheduleForm').reset();
  document.getElementById('editScheduleId').value = '';
  document.getElementById('scheduleModalTitle').textContent = 'Add New Schedule';
  document.getElementById('allDay').checked = false;
  document.getElementById('relatedItemId').value = '';
  
  // Clear related items container
  document.getElementById('relatedItemsList').innerHTML = '';
  
  // Initialize member selector (empty selection)
  initScheduleMemberSelector('familyMembersContainer', []);
  
  openModal('schedule');
}

function handleScheduleActions(e) {
  const editBtn = e.target.closest('.edit-schedule');
  const deleteBtn = e.target.closest('.delete-schedule');
  
  if (editBtn) {
    const scheduleId = editBtn.dataset.scheduleId;
    openEditScheduleModal(scheduleId);
  } else if (deleteBtn) {
    const scheduleId = deleteBtn.dataset.scheduleId;
    deleteSchedule(scheduleId);
  }
}

function updateScheduleType(selectElement) {
  const relatedItemsContainer = document.getElementById('relatedItemsContainer');
  const relatedItemsList = document.getElementById('relatedItemsList');
  const relatedItemIdInput = document.getElementById('relatedItemId');
  const scheduleNameInput = document.getElementById('scheduleName');
  const scheduleDescInput = document.getElementById('scheduleDescription');
  
  relatedItemIdInput.value = '';
  
  switch (selectElement.value) {
    case 'taskflow':
      relatedItemsContainer.classList.remove('hidden');
      relatedItemsList.innerHTML = '';
      
      // Get all tasks and generate options
      const tasks = window.taskHandler.getTasks() || [];
      tasks.forEach(task => {
        const taskOption = document.createElement('div');
        taskOption.className = 'bg-gray-50 p-3 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors';
        taskOption.dataset.taskId = task.id;
        taskOption.innerHTML = `
          <h4 class="font-medium">${task.name}</h4>
          <p class="text-xs text-gray-500 mt-1">${task.memberNames} - ${task.dayType}</p>
        `;
        
        taskOption.addEventListener('click', function() {
          // Remove all selected states
          document.querySelectorAll('#relatedItemsList > div').forEach(el => {
            el.classList.remove('border-2', 'border-primary', 'bg-primary/5');
          });
          
          // Add current selected state
          this.classList.add('border-2', 'border-primary', 'bg-primary/5');
          
          // Set related item ID
          relatedItemIdInput.value = this.dataset.taskId;
          
          // Auto-fill taskflow name and description
          scheduleNameInput.value = task.name;
          scheduleDescInput.value = task.description;
        });
        
        relatedItemsList.appendChild(taskOption);
      });
      
      break;
      
    case 'chores':
      relatedItemsContainer.classList.remove('hidden');
      relatedItemsList.innerHTML = '';
      
      // Get all chores and generate options
      const chores = window.choreHandler.getChores() || [];
      chores.forEach(chore => {
        const choreOption = document.createElement('div');
        choreOption.className = 'bg-gray-50 p-3 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors';
        choreOption.dataset.choreId = chore.id;
        choreOption.innerHTML = `
          <h4 class="font-medium">${chore.name}</h4>
          <p class="text-xs text-gray-500 mt-1">${chore.room} - ${chore.effort}</p>
        `;
        
        choreOption.addEventListener('click', function() {
          document.querySelectorAll('#relatedItemsList > div').forEach(el => {
            el.classList.remove('border-2', 'border-primary', 'bg-primary/5');
          });
          
          this.classList.add('border-2', 'border-primary', 'bg-primary/5');
          relatedItemIdInput.value = this.dataset.choreId;
          
          // Auto-fill chore name and description
          scheduleNameInput.value = chore.name;
          scheduleDescInput.value = chore.description;
        });
        
        relatedItemsList.appendChild(choreOption);
      });
      
      break;
      
    default:
      relatedItemsContainer.classList.add('hidden');
      relatedItemsList.innerHTML = '';
      relatedItemIdInput.value = '';
      // Reset name and description inputs
      scheduleNameInput.value = '';
      scheduleDescInput.value = '';
  }
}

function saveSchedule() {
  const scheduleForm = document.getElementById('scheduleForm');
  if (!scheduleForm) return;
  
  const scheduleId = document.getElementById('editScheduleId').value;
  const name = document.getElementById('scheduleName').value;
  const startTime = document.getElementById('scheduleStartTime').value;
  const endTime = document.getElementById('scheduleEndTime').value;
  const isAllDay = document.getElementById('allDay').checked;
  const description = document.getElementById('scheduleDescription').value;
  const type = document.getElementById('scheduleType').value;
  const relatedItemId = document.getElementById('relatedItemId').value;
  
  // Get selected family members
  const selector = scheduleMemberSelectors.get('familyMembersContainer');
  const selectedMemberIds = selector.getSelectedIds();
  
  // Validate required fields
  if (!name || selectedMemberIds.length === 0 || !description) {
    showNotification('Please fill in all required fields', 'error');
    isSubmitting = false; // Release lock
    return;
  }
  
  // Build schedule data
  const scheduleData = {
    id: scheduleId || Date.now().toString(),
    name,
    startTime,
    endTime,
    isAllDay,
    description,
    type,
    relatedItemId,
    memberIds: selectedMemberIds,
    memberNames: selector.getSelectedNames()
  };
  
  // Disable save button to prevent duplicate submissions
  const saveBtn = document.getElementById('saveScheduleBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i> Saving...';
  }
  
  // Add log output for debugging
  console.log('Saving schedule data:', scheduleData);
  
  if (scheduleId) {
    // Update existing schedule
    updateExistingSchedule(scheduleData);
  } else {
    // Create new schedule
    schedules.push(scheduleData);
    renderNewScheduleCard(scheduleData);
    showNotification('Schedule created successfully', 'success');
  }
  
  // Restore button state
  setTimeout(() => {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = 'Save';
    }
  }, 500);
  
  closeModal('schedule');
}

function renderNewScheduleCard(scheduleData) {
  const newScheduleCard = document.createElement('div');
  newScheduleCard.className = 'relative left-[-11px] fade-in';
  newScheduleCard.setAttribute('data-schedule-id', scheduleData.id);
  
  // Determine schedule type color and circle style
  let dotColor, typeColor, typeText, typeIcon;
  switch (scheduleData.type) {
    case 'taskflow':
      dotColor = 'bg-primary'; // Blue circle
      typeColor = 'bg-primary/10 text-primary';
      typeText = 'Task Flow';
      typeIcon = 'fa-tasks';
      break;
    case 'chores':
      dotColor = 'bg-purple'; // Purple circle
      typeColor = 'bg-purple/10 text-purple';
      typeText = 'Chores';
      typeIcon = 'fa-home';
      break;
    default:
      dotColor = 'bg-warning'; // Yellow circle (default type)
      typeColor = 'bg-warning/10 text-warning';
      typeText = 'Standalone Activity';
      typeIcon = 'fa-bell';
      break;
  }
  
  // Escape HTML to prevent text overlap and XSS
  const escapedName = escapeHtml(scheduleData.name);
  const escapedDescription = escapeHtml(scheduleData.description);
  
  newScheduleCard.innerHTML = `
    <!-- Circle element, consistent with initial card style and position -->
    <div class="schedule-dot w-5 h-5 rounded-full ${dotColor} border-2 border-white absolute top-0"></div>
    <div class="ml-6">
      <div class="flex items-center justify-between">
        <span class="schedule-time text-sm font-medium text-gray-500">
          ${scheduleData.isAllDay ? 'All Day' : `${scheduleData.startTime} - ${scheduleData.endTime}`}
        </span>
        <div class="flex items-center">
          <span class="schedule-type text-xs ${typeColor} px-2 py-0.5 rounded-full mr-2">
            ${typeText}
          </span>
          <span class="text-xs text-gray-500">${scheduleData.memberNames}</span>
        </div>
      </div>
      <div class="mt-1 bg-gray-50 p-3 rounded-lg">
        <div class="flex items-start">
          <div class="schedule-icon w-8 h-8 rounded-full ${getScheduleTypeColor(scheduleData.type, true)} flex items-center justify-center mr-3 flex-shrink-0">
            <i class="fa ${typeIcon} ${getScheduleTypeColor(scheduleData.type)}"></i>
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="schedule-title font-medium truncate">${escapedName}</h4>
            <p class="schedule-description text-xs text-gray-500 mt-1 truncate">${escapedDescription}</p>
          </div>
          <div class="schedule-actions flex space-x-2 ml-2 flex-shrink-0">
            <button class="text-gray-400 hover:text-primary edit-schedule" data-schedule-id="${scheduleData.id}">
              <i class="fa fa-pencil"></i>
            </button>
            <button class="text-gray-400 hover:text-danger delete-schedule" data-schedule-id="${scheduleData.id}">
              <i class="fa fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add to timeline container
  document.getElementById('timelineContainer').appendChild(newScheduleCard);
}

function updateExistingSchedule(scheduleData) {
  const scheduleCard = document.querySelector(`[data-schedule-id="${scheduleData.id}"]`);
  
  if (scheduleCard) {
    // Create new schedule card
    const newScheduleCard = document.createElement('div');
    newScheduleCard.className = 'relative left-[-11px] fade-in';
    newScheduleCard.setAttribute('data-schedule-id', scheduleData.id);
    
    // Determine schedule type color and circle style
    let dotColor, typeColor, typeText, typeIcon;
    switch (scheduleData.type) {
      case 'taskflow':
        dotColor = 'bg-primary';
        typeColor = 'bg-primary/10 text-primary';
        typeText = 'Task Flow';
        typeIcon = 'fa-tasks';
        break;
      case 'chores':
        dotColor = 'bg-purple';
        typeColor = 'bg-purple/10 text-purple';
        typeText = 'Chores';
        typeIcon = 'fa-home';
        break;
      default:
        dotColor = 'bg-warning';
        typeColor = 'bg-warning/10 text-warning';
        typeText = 'Standalone Activity';
        typeIcon = 'fa-bell';
        break;
    }
    
    // Ensure text content is properly escaped to prevent overlap
    const escapedName = escapeHtml(scheduleData.name);
    const escapedDescription = escapeHtml(scheduleData.description);
    
    newScheduleCard.innerHTML = `
      <!-- Circle element, consistent with initial card style and position -->
      <div class="schedule-dot w-5 h-5 rounded-full ${dotColor} border-2 border-white absolute top-0"></div>
      <div class="ml-6">
        <div class="flex items-center justify-between">
          <span class="schedule-time text-sm font-medium text-gray-500">
            ${scheduleData.isAllDay ? 'All Day' : `${scheduleData.startTime} - ${scheduleData.endTime}`}
          </span>
          <div class="flex items-center">
            <span class="schedule-type text-xs ${typeColor} px-2 py-0.5 rounded-full mr-2">
              ${typeText}
            </span>
            <span class="text-xs text-gray-500">${scheduleData.memberNames}</span>
          </div>
        </div>
        <div class="mt-1 bg-gray-50 p-3 rounded-lg">
          <div class="flex items-start">
            <div class="schedule-icon w-8 h-8 rounded-full ${getScheduleTypeColor(scheduleData.type, true)} flex items-center justify-center mr-3 flex-shrink-0">
              <i class="fa ${typeIcon} ${getScheduleTypeColor(scheduleData.type)}"></i>
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="schedule-title font-medium truncate">${escapedName}</h4>
              <p class="schedule-description text-xs text-gray-500 mt-1 truncate">${escapedDescription}</p>
            </div>
            <div class="schedule-actions flex space-x-2 ml-2 flex-shrink-0">
              <button class="text-gray-400 hover:text-primary edit-schedule" data-schedule-id="${scheduleData.id}">
                <i class="fa fa-pencil"></i>
              </button>
              <button class="text-gray-400 hover:text-danger delete-schedule" data-schedule-id="${scheduleData.id}">
                <i class="fa fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Replace old card
    scheduleCard.replaceWith(newScheduleCard);
    
    // Update data
    const index = schedules.findIndex(s => s.id === scheduleData.id);
    if (index !== -1) {
      schedules[index] = scheduleData;
    }
    
    showNotification('Schedule updated successfully', 'success');
  }
  
  // Release lock
  isSubmitting = false;
}

function openEditScheduleModal(scheduleId) {
  const schedule = schedules.find(s => s.id === scheduleId);
  if (!schedule) return;
  
  document.getElementById('editScheduleId').value = schedule.id;
  document.getElementById('scheduleName').value = schedule.name;
  document.getElementById('scheduleStartTime').value = schedule.startTime;
  document.getElementById('scheduleEndTime').value = schedule.endTime;
  document.getElementById('allDay').checked = schedule.isAllDay;
  document.getElementById('scheduleDescription').value = schedule.description;
  document.getElementById('scheduleType').value = schedule.type;
  document.getElementById('relatedItemId').value = schedule.relatedItemId;
  
  // Initialize member selector (selected members)
  initScheduleMemberSelector('familyMembersContainer', schedule.memberIds || []);
  
  // Update related items
  updateScheduleType(document.getElementById('scheduleType'));
  
  // Select related item (if any)
  if (schedule.relatedItemId) {
    const relatedItems = document.querySelectorAll('#relatedItemsList > div');
    relatedItems.forEach(item => {
      if (item.dataset.taskId === schedule.relatedItemId || item.dataset.choreId === schedule.relatedItemId) {
        item.click();
      }
    });
  }
  
  document.getElementById('scheduleModalTitle').textContent = 'Edit Schedule';
  
  openModal('schedule');
}

function deleteSchedule(scheduleId) {
  const scheduleCard = document.querySelector(`[data-schedule-id="${scheduleId}"]`);
  if (scheduleCard) {
    scheduleCard.classList.add('fade-out');
    setTimeout(() => {
      scheduleCard.remove();
      
      // Update data
      schedules = schedules.filter(s => s.id !== scheduleId);
      
      showNotification('Schedule deleted successfully', 'success');
    }, 300);
  }
}

// Helper function: Get schedule type color class
function getScheduleTypeColor(type, background = false) {
  switch (type) {
    case 'taskflow':
      return background ? 'bg-primary/20' : 'text-primary';
    case 'chores':
      return background ? 'bg-purple/20' : 'text-purple';
    default:
      return background ? 'bg-warning/20' : 'text-warning';
  }
}

// Helper function: Escape HTML to prevent text overlap and XSS
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Improved notification system
function showNotification(message, type = 'info') {
  // Clear existing notification and timeout
  if (activeNotification) {
    activeNotification.remove();
  }
  
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
  }
  
  // Create new notification
  const notification = document.createElement('div');
  
  // Set notification style
  let bgColor, textColor, icon;
  switch (type) {
    case 'success':
      bgColor = 'bg-green-500';
      textColor = 'text-white';
      icon = 'fa-check-circle';
      break;
    case 'error':
      bgColor = 'bg-red-500';
      textColor = 'text-white';
      icon = 'fa-exclamation-circle';
      break;
    case 'warning':
      bgColor = 'bg-yellow-500';
      textColor = 'text-white';
      icon = 'fa-exclamation-triangle';
      break;
    default:
      bgColor = 'bg-blue-500';
      textColor = 'text-white';
      icon = 'fa-info-circle';
  }
  
  notification.className = `notification fixed top-4 right-4 ${bgColor} ${textColor} px-4 py-2 rounded-lg shadow-lg flex items-center z-50 transform transition-all duration-300 ease-in-out translate-x-full`;
  
  // Set notification content
  notification.innerHTML = `
    <i class="fa ${icon} mr-2"></i>
    <span>${message}</span>
    <button class="ml-4 text-white hover:text-gray-200 focus:outline-none" onclick="this.parentElement.remove()">
      <i class="fa fa-times"></i>
    </button>
  `;
  
  // Add to document
  document.body.appendChild(notification);
  
  // Save reference
  activeNotification = notification;
  
  // Show animation
  setTimeout(() => {
    notification.classList.remove('translate-x-full');
    notification.classList.add('translate-x-0');
  }, 10);
  
  // Set auto-close
  notificationTimeout = setTimeout(() => {
    notification.classList.remove('translate-x-0');
    notification.classList.add('translate-x-full');
    
    setTimeout(() => {
      if (activeNotification === notification) {
        notification.remove();
        activeNotification = null;
      }
    }, 300);
  }, 3000);
}

// Expose schedule data for other modules
window.scheduleHandler = {
  getSchedules: function() {
    return [...schedules];
  }
};