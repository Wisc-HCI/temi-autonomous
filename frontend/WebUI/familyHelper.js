// familyHelper.js
// Helper functions for family member management

let familyMembers = [
    { id: '1', name: 'Daddy Pig', age: '35', occupation: 'Engineer', photo: 'father.jpg' },
    { id: '2', name: 'Mommy Pig', age: '32', occupation: 'Teacher', photo: 'mom.jpg' },
    { id: '3', name: 'Peppa Pig', age: '6', occupation: 'Student', photo: 'child.jpg' }
  ];
  
  // Initialize family helper
  function initFamilyHelper() {
    // Listen for new member additions
    document.addEventListener('memberAdded', (e) => {
      familyMembers.push(e.detail);
    });
    
    // Listen for member updates
    document.addEventListener('memberUpdated', (e) => {
      const index = familyMembers.findIndex(m => m.id === e.detail.id);
      if (index !== -1) {
        familyMembers[index] = e.detail;
      }
    });
    
    // Listen for member deletions
    document.addEventListener('memberDeleted', (e) => {
      familyMembers = familyMembers.filter(m => m.id !== e.detail);
    });
  }
  
  // Get all family members
  function getFamilyMembers() {
    return [...familyMembers];
  }
  
  // Render family member chips in modal
  function renderFamilyMemberChips(containerId, selectedIds = []) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    familyMembers.forEach(member => {
      const isSelected = selectedIds.includes(member.id);
      const chip = document.createElement('div');
      chip.className = `chip ${isSelected ? 'bg-primary/10 border border-primary' : 'cursor-pointer'}`;
      chip.dataset.memberId = member.id;
      chip.innerHTML = `
        ${member.name}
        ${isSelected ? `<span class="chip-remove" data-member-id="${member.id}">&times;</span>` : ''}
      `;
      
      if (!isSelected) {
        chip.addEventListener('click', () => {
          chip.classList.add('bg-primary/10', 'border', 'border-primary');
          const removeBtn = document.createElement('span');
          removeBtn.className = 'chip-remove';
          removeBtn.dataset.memberId = member.id;
          removeBtn.innerHTML = '&times;';
          chip.appendChild(removeBtn);
          
          // Dispatch event for selection change
          const event = new CustomEvent('memberSelected', { 
            detail: { 
              memberId: member.id, 
              selected: true 
            } 
          });
          document.dispatchEvent(event);
        });
      } else {
        chip.querySelector('.chip-remove').addEventListener('click', (e) => {
          e.stopPropagation();
          chip.classList.remove('bg-primary/10', 'border', 'border-primary');
          e.target.remove();
          
          // Dispatch event for selection change
          const event = new CustomEvent('memberSelected', { 
            detail: { 
              memberId: member.id, 
              selected: false 
            } 
          });
          document.dispatchEvent(event);
        });
      }
      
      container.appendChild(chip);
    });
  }
  
  // Get selected member names
  function getSelectedMemberNames(selectedIds) {
    return familyMembers
      .filter(m => selectedIds.includes(m.id))
      .map(m => m.name)
      .join(', ');
  }