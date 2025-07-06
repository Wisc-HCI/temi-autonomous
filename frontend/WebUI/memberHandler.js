// memberHandler.js
// Family member management with event dispatching

function initMemberHandler() {
  const memberGrid = document.getElementById('memberGrid');
  
  // Handle edit member
  document.querySelectorAll('.edit-member').forEach(button => {
    button.addEventListener('click', function() {
      const memberId = this.getAttribute('data-member-id');
      openEditMemberModal(memberId);
    });
  });
  
  // Handle delete member
  document.querySelectorAll('.delete-member').forEach(button => {
    button.addEventListener('click', function() {
      const memberId = this.getAttribute('data-member-id');
      deleteMember(memberId);
    });
  });
  
  // Add new member via card
  document.getElementById('addMemberCard').addEventListener('click', openNewMemberModal);
  
  // Add new member via quick action button
  document.getElementById('openMemberModal').addEventListener('click', openNewMemberModal);
  
  // Save member form
  document.getElementById('memberForm').addEventListener('submit', function(e) {
    e.preventDefault();
    saveMember();
  });
  
  // File upload preview
  document.getElementById('dropzone-file').addEventListener('change', function(e) {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = function(event) {
        document.getElementById('newPhotoPreview').src = event.target.result;
        document.getElementById('newPhotoPreviewContainer').classList.remove('hidden');
        document.getElementById('currentPhotoPreview').classList.add('hidden');
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  });
}

// Open edit member modal
function openEditMemberModal(memberId) {
  const memberCard = document.querySelector(`[data-member-id="${memberId}"]`);
  
  if (memberCard) {
    const name = memberCard.querySelector('h3').textContent;
    const ageOccupation = memberCard.querySelector('p').textContent.split('·');
    const age = ageOccupation[0].trim();
    const occupation = ageOccupation[1].trim();
    
    document.getElementById('editMemberId').value = memberId;
    document.getElementById('name').value = name;
    document.getElementById('age').value = age;
    document.getElementById('occupation').value = occupation;
    
    // Show current photo
    const imgSrc = memberCard.querySelector('img').src;
    document.getElementById('currentPhoto').src = imgSrc;
    document.getElementById('currentPhotoPreview').classList.remove('hidden');
    
    // Hide new photo preview
    document.getElementById('newPhotoPreviewContainer').classList.add('hidden');
    
    // Reset file input
    document.getElementById('dropzone-file').value = '';
    
    document.getElementById('modalTitle').textContent = 'Edit Family Member';
    
    openModal('member');
  }
}

// Open new member modal
function openNewMemberModal() {
  document.getElementById('editMemberId').value = '';
  document.getElementById('name').value = '';
  document.getElementById('age').value = '';
  document.getElementById('occupation').value = '';
  document.getElementById('dropzone-file').value = '';
  document.getElementById('currentPhotoPreview').classList.add('hidden');
  document.getElementById('newPhotoPreviewContainer').classList.add('hidden');
  document.getElementById('modalTitle').textContent = 'Add Family Member';
  openModal('member');
}

// Save member
function saveMember() {
  const memberId = document.getElementById('editMemberId').value;
  const name = document.getElementById('name').value;
  const age = document.getElementById('age').value;
  const occupation = document.getElementById('occupation').value;
  
  if (!name || !age || !occupation) {
    showNotification('Please fill all fields', 'error');
    return;
  }
  
  // Handle photo
  const fileInput = document.getElementById('dropzone-file');
  let photoUrl = '';
  
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    photoUrl = URL.createObjectURL(file);
  } else if (document.getElementById('currentPhotoPreview') && 
           !document.getElementById('currentPhotoPreview').classList.contains('hidden')) {
    photoUrl = document.getElementById('currentPhoto').src;
  } else {
    photoUrl = 'https://via.placeholder.com/150';
  }
  
  const memberData = {
    id: memberId || Date.now().toString(),
    name,
    age,
    occupation,
    photo: photoUrl
  };
  
  if (memberId) {
    // Dispatch update event
    const event = new CustomEvent('memberUpdated', { detail: memberData });
    document.dispatchEvent(event);
    
    // Update UI
    const memberCard = document.querySelector(`[data-member-id="${memberId}"]`);
    if (memberCard) {
      memberCard.querySelector('h3').textContent = name;
      memberCard.querySelector('p').textContent = `${age} · ${occupation}`;
      memberCard.querySelector('img').src = photoUrl;
      showNotification(`Member ${name} updated!`, 'success');
    }
  } else {
    // Dispatch add event
    const event = new CustomEvent('memberAdded', { detail: memberData });
    document.dispatchEvent(event);
    
    // Create new card
    const memberCard = document.createElement('div');
    memberCard.className = 'bg-white rounded-xl shadow overflow-hidden card-hover fade-in';
    memberCard.setAttribute('data-member-id', memberData.id);
    memberCard.innerHTML = `
      <div class="relative bg-gray-100 flex items-center justify-center h-30 overflow-hidden">
        <img src="${photoUrl}" alt="${name}" class="w-full h-30 object-cover">
      </div>
      <div class="p-4">
        <h3 class="font-bold text-lg mb-1">${name}</h3>
        <p class="text-gray-600 text-sm mb-3">${age} · ${occupation}</p>
        <div class="flex justify-between">
          <button class="text-primary text-sm edit-member" data-member-id="${memberData.id}">
            <i class="fa fa-edit mr-1"></i>Edit
          </button>
          <button class="text-gray-500 hover:text-danger delete-member" data-member-id="${memberData.id}">
            <i class="fa fa-trash"></i>
          </button>
        </div>
      </div>
    `;
    
    // Add event listeners
    memberCard.querySelector('.edit-member').addEventListener('click', () => {
      openEditMemberModal(memberData.id);
    });
    
    memberCard.querySelector('.delete-member').addEventListener('click', () => {
      deleteMember(memberData.id);
    });
    
    // Insert before add card
    const addMemberCard = document.getElementById('addMemberCard');
    memberGrid.insertBefore(memberCard, addMemberCard);
    
    showNotification(`Member ${name} added!`, 'success');
  }
  
  closeModal('member');
}

// Delete member
function deleteMember(memberId) {
  // Dispatch delete event
  const event = new CustomEvent('memberDeleted', { detail: memberId });
  document.dispatchEvent(event);
  
  // Remove from UI
  const memberCard = document.querySelector(`[data-member-id="${memberId}"]`);
  if (memberCard) {
    memberCard.classList.add('fade-out');
    setTimeout(() => {
      memberCard.remove();
      showNotification('Member deleted', 'success');
    }, 300);
  }
}