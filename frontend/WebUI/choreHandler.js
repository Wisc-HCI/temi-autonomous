// choreHandler.js - Fix the issue where the room field disappears when editing the fourth card, and add gradient backgrounds

// Chore data storage
let chores = [
  { id: '1', name: 'Vacuuming', description: 'Vacuum the entire living room area', room: 'Living Room', effort: 'Medium' },
  { id: '2', name: 'Dish Washing', description: 'Wash all dishes in the sink', room: 'Kitchen', effort: 'Low' },
  { id: '3', name: 'Dusting', description: 'Dust bedroom furniture, shelves, and nightstands', room: 'Bedroom', effort: 'Low' },
  { id: '4', name: 'Laundry', description: 'Wash, dry, and fold the dirty clothes', room: 'Bathroom', effort: 'High' }
];

// DOM Load Event
document.addEventListener('DOMContentLoaded', function() {
  initChoreHandler();
  renderChores(); // Render chore cards when the page loads
});

function initChoreHandler() {
  console.log('Chore handler initialized');
  
  // Handle new chore buttons
  const newChoreBtn1 = document.getElementById('openChoreModal');
  const newChoreBtn2 = document.getElementById('openChoreModalQuick');
  
  if (newChoreBtn1) {
    newChoreBtn1.addEventListener('click', openNewChoreModal);
  } else {
    console.error('First new chore button not found!');
  }
  
  if (newChoreBtn2) {
    // Use once option to prevent duplicate event listeners
    newChoreBtn2.addEventListener('click', openNewChoreModal, { once: true });
  } else {
    console.error('Second new chore button not found!');
  }
  
  // Handle chore operations
  const choreContainer = document.getElementById('choresContainer');
  if (choreContainer) {
    choreContainer.addEventListener('click', function(e) {
      handleChoreActions(e);
    });
  } else {
    console.error('Chores container not found!');
  }
  
  // Handle save chore button
  const saveBtn = document.getElementById('saveChoreBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', function(e) {
      e.preventDefault();
      saveChore();
    });
  } else {
    console.error('Save chore button not found!');
  }
}

// Dynamically render all chore cards
function renderChores() {
  const choresContainer = document.getElementById('choresContainer');
  if (!choresContainer) return;
  
  // Clear the container
  choresContainer.innerHTML = '';
  
  // Generate a card for each chore data
  chores.forEach(chore => {
    const choreCard = createChoreCard(chore);
    choresContainer.appendChild(choreCard);
  });
}

// Create a single chore card (add gradient background logic)
function createChoreCard(chore) {
  const card = document.createElement('div');
  card.className = 'bg-white rounded-xl shadow-sm overflow-hidden card-hover border border-gray-100 fade-in transition-all duration-300';
  card.setAttribute('data-chore-id', chore.id);
  
  // Set different gradient classes and color identifiers based on effort level
  let gradientClass = 'from-gray-50 to-white'; // Default gradient
  let effortColor = 'text-gray-600';
  
  if (chore.effort === 'Low') {
    gradientClass = 'from-green-50 to-white'; // Light green gradient
    effortColor = 'text-green-600';
  } else if (chore.effort === 'Medium') {
    gradientClass = 'from-yellow-50 to-white'; // Light yellow gradient
    effortColor = 'text-yellow-600';
  } else if (chore.effort === 'High') {
    gradientClass = 'from-red-50 to-white'; // Light red gradient
    effortColor = 'text-red-600';
  }
  
  // Uniformly use top-to-bottom gradient direction
  const styleVariant = 'bg-gradient-to-b';
  
  card.innerHTML = `
    <div class="p-4 border-b border-gray-100 ${styleVariant} ${gradientClass}">
      <div class="flex justify-between items-center">
        <h3 class="font-bold text-gray-800">${chore.name}</h3>
        <div class="flex space-x-2">
          <button class="text-gray-400 hover:text-primary edit-chore" data-chore-id="${chore.id}">
            <i class="fa fa-pencil"></i>
          </button>
          <button class="text-gray-400 hover:text-danger delete-chore" data-chore-id="${chore.id}">
            <i class="fa fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="flex items-center mt-2">
        <div class="flex items-center text-sm text-gray-600 mr-4">
          <i class="fa fa-home mr-1.5"></i>
          <span>${chore.room}</span>
        </div>
        <div class="flex items-center text-sm ${effortColor}">
          <i class="fa fa-bolt mr-1.5"></i>
          <span>${chore.effort} Effort</span>
        </div>
      </div>
    </div>
    <div class="p-5">
      <p class="text-gray-600">${chore.description}</p>
    </div>
  `;
  
  return card;
}

// Open new chore modal
function openNewChoreModal() {
  const choreForm = document.getElementById('choreForm');
  if (!choreForm) return;
  
  // Reset all form fields
  choreForm.reset();
  
  // Ensure Room and Effort fields show default options (empty)
  document.getElementById('choreRoom').value = '';
  document.getElementById('choreEffort').value = '';
  
  // Clear the edit ID to ensure it's a new creation operation
  document.getElementById('editChoreId').value = '';
  
  // Set the modal title
  document.getElementById('choreModalTitle').textContent = 'Create New Chore';
  
  // Open the modal
  openModal('chore');
}

// Open edit chore modal - Fix the issue where the room field disappears
function openEditChoreModal(choreId) {
  const chore = chores.find(c => c.id === choreId);
  if (chore) {
    console.log('Editing chore:', chore);
    
    document.getElementById('editChoreId').value = chore.id;
    document.getElementById('choreName').value = chore.name;
    document.getElementById('choreDescription').value = chore.description;
    
    // Fix the room field selection issue
    const roomSelect = document.getElementById('choreRoom');
    const roomValue = chore.room.trim();
    
    // Reset all options
    Array.from(roomSelect.options).forEach(option => {
      option.selected = false;
      
      // Ensure option values do not contain extra spaces
      option.value = option.value.trim();
    });
    
    // Find the matching option and select it
    const matchingOption = Array.from(roomSelect.options).find(
      option => option.value === roomValue
    );
    
    if (matchingOption) {
      matchingOption.selected = true;
      console.log('Room option selected:', roomValue);
    } else {
      console.error('No matching room option found for:', roomValue);
      roomSelect.selectedIndex = 0; // Default to selecting the first option
    }
    
    document.getElementById('choreEffort').value = chore.effort;
    document.getElementById('choreModalTitle').textContent = 'Edit Chore';
    openModal('chore');
  }
}

// Handle chore actions (edit/delete)
function handleChoreActions(e) {
  const editBtn = e.target.closest('.edit-chore');
  const deleteBtn = e.target.closest('.delete-chore');
  
  if (editBtn) {
    const choreId = editBtn.dataset.choreId;
    openEditChoreModal(choreId);
  } else if (deleteBtn) {
    const choreId = deleteBtn.dataset.choreId;
    deleteChore(choreId);
  }
}

// Save chore
function saveChore() {
  const choreForm = document.getElementById('choreForm');
  if (!choreForm) return;
  
  const choreId = document.getElementById('editChoreId').value;
  const name = document.getElementById('choreName').value;
  const description = document.getElementById('choreDescription').value;
  const room = document.getElementById('choreRoom').value.trim();
  const effort = document.getElementById('choreEffort').value;
  
  // Validate all fields
  if (!name || !description || !room || !effort) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }
  
  // Validate the validity of the room field
  const validRooms = ['Living Room', 'Kitchen', 'Bedroom', 'Bathroom'];
  if (!validRooms.includes(room)) {
    console.error('Invalid room value:', room);
    showNotification('Invalid room selected', 'error');
    return;
  }
  
  const choreData = {
    id: choreId || Date.now().toString(),
    name,
    description,
    room,
    effort
  };
  
  // Check for duplicate chores
  if (!choreId && chores.some(c => c.name === name && c.room === room)) {
    showNotification('A chore with this name already exists in this room', 'warning');
    return;
  }
  
  if (choreId) {
    // Update existing chore
    updateExistingChore(choreData);
  } else {
    // Create new chore
    createNewChore(choreData);
  }
  
  closeModal('chore');
}

// Update existing chore
function updateExistingChore(choreData) {
  const index = chores.findIndex(c => c.id === choreData.id);
  if (index !== -1) {
    chores[index] = choreData;
    renderChores(); // Re-render all cards to update
    showNotification('Chore updated successfully', 'success');
  }
}

// Create new chore
function createNewChore(choreData) {
  // Check for duplicates again (defensive coding)
  if (chores.some(c => c.name === choreData.name && c.room === choreData.room)) {
    showNotification('A chore with this name already exists in this room', 'warning');
    return;
  }
  
  chores.push(choreData);
  renderChores(); // Re-render all cards to add the new card
  showNotification('Chore added successfully', 'success');
}

// Delete chore
function deleteChore(choreId) {
  chores = chores.filter(c => c.id !== choreId);
  renderChores(); // Re-render all cards to remove the deleted card
  showNotification('Chore deleted successfully', 'success');
}

// Expose chore data for other modules
window.choreHandler = {
  getChores: function() {
    return [...chores];
  },
  addChore: function(chore) {
    chores.push(chore);
    renderChores();
  },
  updateChore: function(chore) {
    const index = chores.findIndex(c => c.id === chore.id);
    if (index !== -1) {
      chores[index] = chore;
      renderChores();
    }
  },
  deleteChore: function(choreId) {
    chores = chores.filter(c => c.id !== choreId);
    renderChores();
  }
};