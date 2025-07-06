// taskHandler.js - Implementation of Task Flow task cards with gradient backgrounds
// Family member selector functionality
const taskMemberSelectors = new Map();

function initTaskMemberSelector(containerId, initialSelection = []) {
  if (taskMemberSelectors.has(containerId)) {
    const selector = taskMemberSelectors.get(containerId);
    selector.setSelectedIds(initialSelection);
    return selector;
  }

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
        
        chip.addEventListener('click', () => {
          this.toggleSelection(member.id);
        });
        
        container.appendChild(chip);
      });
    }
  };

  taskMemberSelectors.set(containerId, selector);
  selector.render();
  return selector;
}

// Task data storage (modify gradient-related fields)
let tasks = [
  { 
    id: '1', 
    name: 'Morning Routine', 
    description: 'Energizing morning habits to start your day right!', 
    dayType: 'weekday', 
    gradient: 'from-blue-100 to-white', // Explicit blue gradient class name
    steps: [
      { text: 'Wake up at 8:30', completed: false },
      { text: 'Meditate for 10 minutes', completed: false },
      { text: 'Read 20 pages', completed: false }
    ],
    memberIds: ['1'],
    memberNames: 'Daddy Pig'
  },
  { 
    id: '2', 
    name: 'Bedtime Routine', 
    description: 'Relaxing evening activities to end your day peacefully.', 
    dayType: 'weekend', 
    gradient: 'from-purple-100 to-white', // Explicit purple gradient class name
    steps: [
      { text: 'Read for 30 minutes', completed: false },
      { text: 'Stretch for 15 minutes', completed: false },
      { text: 'Prepare tomorrow\'s to-do list', completed: false }
    ],
    memberIds: ['3'],
    memberNames: 'Peppa Pig'
  }
];

// Render all task cards (retain only gradient backgrounds, restore other styles to original)
function renderTasks() {
  const container = document.getElementById('taskFlowContainer');
  if (!container) return;
  
  container.innerHTML = ''; // Clear the container
  
  tasks.forEach(task => {
    const card = createTaskCard(task);
    container.appendChild(card);
  });
}

// Create a single task card (retain only top gradient background, other styles consistent with original)
function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'bg-white rounded-xl shadow-card overflow-hidden card-hover border border-gray-100';
  card.setAttribute('data-task-id', task.id);
  
  // Build steps HTML (restore original styles)
  let stepsHtml = '';
  task.steps.forEach((step, index) => {
    stepsHtml += `
      <li class="task-item flex items-center py-2 border-b border-gray-100 last:border-0 ${step.completed ? 'line-through text-gray-400' : ''}">
        <input type="checkbox" class="task-checkbox h-4 w-4 text-blue-500 rounded border-gray-300 focus:ring-blue-500" ${step.completed ? 'checked' : ''}>
        <span class="ml-2">${step.text}</span>
      </li>
    `;
  });
  
  // Format dayType display
  const displayDayType = task.dayType.charAt(0).toUpperCase() + task.dayType.slice(1);
  
  card.innerHTML = `
    <div class="p-5 border-b border-gray-100 bg-gradient-to-r ${task.gradient}">
      <div class="flex justify-between items-center">
        <h3 class="font-bold text-gray-800">${task.name}</h3>
        <div class="flex space-x-2">
          <button class="text-gray-400 hover:text-primary edit-task" data-task-id="${task.id}">
            <i class="fa fa-pencil"></i>
          </button>
          <button class="text-gray-400 hover:text-danger delete-task" data-task-id="${task.id}">
            <i class="fa fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="flex items-center mt-2">
        <div class="flex items-center text-sm text-gray-600 mr-4">
          <i class="fa fa-user mr-1.5"></i>
          <span>${task.memberNames}</span>
        </div>
        <div class="flex items-center text-sm text-gray-600">
          <i class="fa fa-calendar mr-1.5"></i>
          <span>${displayDayType}</span>
        </div>
      </div>
    </div>
    <div class="p-5">
      <p class="text-gray-600 mb-3">${task.description}</p>
      <ul class="space-y-3">
        ${stepsHtml}
      </ul>
    </div>
  `;
  
  return card;
}

// Initialize task handler (other logic remains fully intact)
let addStepHandler = null;
let taskEventListenersBound = false;

function initTaskHandler() {
  console.log('Task handler initialized');
  
  // Ensure event listeners are bound only once
  if (taskEventListenersBound) return;
  taskEventListenersBound = true;
  
  // Handle new task button
  const newTaskBtn1 = document.getElementById('openTaskModal');
  const newTaskBtn2 = document.getElementById('openTaskModal2');
  
  if (newTaskBtn1) newTaskBtn1.addEventListener('click', openNewTaskModal);
  if (newTaskBtn2) newTaskBtn2.addEventListener('click', openNewTaskModal);
  
  // Handle task actions (edit/delete)
  const taskContainer = document.getElementById('taskFlowContainer');
  if (taskContainer) {
    taskContainer.addEventListener('click', handleTaskActions);
    taskContainer.addEventListener('change', handleTaskCheckboxes);
  }
  
  // Handle save task button
  const saveTaskBtn = document.getElementById('saveTaskBtn');
  if (saveTaskBtn) {
    saveTaskBtn.addEventListener('click', saveTask);
  }
  
  // Handle add task step button
  const addStepBtn = document.getElementById('addTaskStep');
  if (addStepBtn) {
    if (addStepHandler) {
      addStepBtn.removeEventListener('click', addStepHandler);
    }
    
    addStepHandler = function(e) {
      e.preventDefault();
      addTaskStep();
    };
    
    addStepBtn.addEventListener('click', addStepHandler);
  }
  
  // Handle step deletion
  const stepsContainer = document.getElementById('taskStepsContainer');
  if (stepsContainer) {
    stepsContainer.addEventListener('click', handleStepDeletion);
  }
  
  // Render tasks after initialization is complete
  renderTasks();
}

// Open new task modal (other logic remains fully intact)
function openNewTaskModal() {
  document.getElementById('taskForm').reset();
  document.getElementById('taskStepsContainer').innerHTML = '';
  document.getElementById('editTaskId').value = '';
  document.querySelector('input[name="dayType"][value="weekday"]').checked = true;
  document.getElementById('taskModalTitle').textContent = 'Create New Task Flow';
  
  initTaskMemberSelector('taskFamilyMembersContainer', []);
  addTaskStep(); // Add initial step
  openModal('task');
}

// Handle task actions (edit/delete) (other logic remains fully intact)
function handleTaskActions(e) {
  const editBtn = e.target.closest('.edit-task');
  const deleteBtn = e.target.closest('.delete-task');
  
  if (editBtn) {
    const taskId = editBtn.dataset.taskId;
    openEditTaskModal(taskId);
  } else if (deleteBtn) {
    const taskId = deleteBtn.dataset.taskId;
    deleteTask(taskId);
  }
}

// Handle task checkboxes (other logic remains fully intact)
function handleTaskCheckboxes(e) {
  if (e.target.classList.contains('task-checkbox')) {
    const taskItem = e.target.closest('.task-item');
    const taskId = taskItem.closest('[data-task-id]').dataset.taskId;
    const stepIndex = Array.from(taskItem.parentElement.children).indexOf(taskItem);
    
    // Update the completion status of the step in task data
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      task.steps[stepIndex].completed = e.target.checked;
      // Re-render the card to reflect the status change
      renderTasks();
    }
  }
}

// Add task step (other logic remains fully intact)
function addTaskStep(stepText = '') {
  const container = document.getElementById('taskStepsContainer');
  if (!container) return;
  
  const stepDiv = document.createElement('div');
  stepDiv.className = 'task-step flex items-center space-x-2 mb-2 fade-in';
  stepDiv.innerHTML = `
    <input type="text" placeholder="Enter task step" 
           value="${stepText.replace(/"/g, '&quot;')}"
           class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary">
    <button type="button" class="delete-task-step text-danger hover:text-danger/80 px-2">
      <i class="fa fa-trash"></i>
    </button>
  `;
  
  container.appendChild(stepDiv);
  
  setTimeout(() => {
    stepDiv.classList.add('opacity-100');
  }, 10);
}

// Handle step deletion (other logic remains fully intact)
function handleStepDeletion(e) {
  if (e.target.classList.contains('delete-task-step') || e.target.closest('.delete-task-step')) {
    const container = document.getElementById('taskStepsContainer');
    if (!container) return;
    
    const stepDiv = e.target.closest('.task-step');
    
    if (container.children.length > 1) {
      stepDiv.classList.add('fade-out');
      setTimeout(() => {
        stepDiv.remove();
      }, 300);
    } else {
      showNotification('At least one step is required', 'error');
    }
  }
}

// Save task (modify gradient mapping logic)
function saveTask(e) {
  if (e) e.target.disabled = true; // Prevent repeated submissions
  
  const taskForm = document.getElementById('taskForm');
  if (!taskForm) return;
  
  const taskId = document.getElementById('editTaskId').value;
  const name = document.getElementById('taskName').value;
  const description = document.getElementById('taskDescription').value;
  const dayType = document.querySelector('input[name="dayType"]:checked').value;
  
  // Get task steps
  const steps = [];
  const stepInputs = document.querySelectorAll('#taskStepsContainer .task-step input');
  stepInputs.forEach(input => {
    if (input.value.trim()) {
      steps.push({ text: input.value.trim(), completed: false });
    }
  });
  
  // Get selected family members
  const selector = taskMemberSelectors.get('taskFamilyMembersContainer');
  const selectedMemberIds = selector.getSelectedIds();
  
  // Dynamically set gradient type (explicit class name mapping)
  const gradientMap = {
    'weekday': 'from-blue-100 to-white', // Blue gradient
    'weekend': 'from-purple-100 to-white', // Purple gradient
  };
  const gradient = gradientMap[dayType] || 'from-gray-50 to-white';
  
  if (!name || !description || steps.length === 0 || selectedMemberIds.length === 0) {
    showNotification('Please fill in all fields and select at least one member', 'error');
    if (e) e.target.disabled = false;
    return;
  }
  
  const memberNames = selector.getSelectedNames();
  
  const taskData = {
    id: taskId || Date.now().toString(),
    name,
    description,
    dayType,
    gradient, // Retain gradient field
    steps,
    memberIds: selectedMemberIds,
    memberNames
  };
  
  if (taskId) {
    updateExistingTask(taskData);
  } else {
    createNewTask(taskData);
  }
  
  closeModal('task');
  if (e) e.target.disabled = false;
}

// Create new task (other logic remains fully intact)
function createNewTask(taskData) {
  tasks.push(taskData);
  renderTasks(); // Update data and re-render
  showNotification('Task flow created successfully', 'success');
}

// Update existing task (other logic remains fully intact)
function updateExistingTask(taskData) {
  const index = tasks.findIndex(t => t.id === taskData.id);
  if (index !== -1) {
    tasks[index] = taskData;
    renderTasks(); // Update data and re-render
    showNotification('Task flow updated successfully', 'success');
  }
}

// Open edit task modal (other logic remains fully intact)
function openEditTaskModal(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  
  document.getElementById('editTaskId').value = taskId;
  document.getElementById('taskName').value = task.name;
  document.getElementById('taskDescription').value = task.description;
  
  // Set day type
  document.querySelectorAll('input[name="dayType"]').forEach(radio => {
    radio.checked = radio.value === task.dayType;
  });
  
  // Initialize member selector
  initTaskMemberSelector('taskFamilyMembersContainer', task.memberIds || []);
  
  // Clear existing steps and add current steps
  const stepsContainer = document.getElementById('taskStepsContainer');
  if (stepsContainer) {
    stepsContainer.innerHTML = '';
    task.steps.forEach(step => {
      addTaskStep(step.text);
    });
  }
  
  document.getElementById('taskModalTitle').textContent = 'Edit Task Flow';
  openModal('task');
}

// Delete task (other logic remains fully intact)
function deleteTask(taskId) {
  tasks = tasks.filter(t => t.id !== taskId);
  renderTasks(); // Re-render all tasks
  showNotification('Task deleted successfully', 'success');
}

// Expose task data to other modules (other logic remains fully intact)
window.taskHandler = {
  getTasks: function() {
    return [...tasks];
  }
};

// DOM Load Event
document.addEventListener('DOMContentLoaded', function() {
  initTaskHandler();
});