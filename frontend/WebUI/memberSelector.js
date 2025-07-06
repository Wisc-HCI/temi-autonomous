// memberSelector.js

class FamilyMemberSelector {
    constructor(containerId, onSelectionChange = () => {}) {
      this.containerId = containerId;
      this.container = document.getElementById(containerId);
      this.selectedIds = new Set();
      this.onSelectionChange = onSelectionChange;
      
      
      this.init();
    }
 
    init() {
      if (!this.container) return;
      
      
      this.container.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (chip && chip.dataset.memberId) {
          this.toggleSelection(chip.dataset.memberId);
        }
      });
      this.render();
    }
    
    toggleSelection(memberId) {
      
      const isSelected = this.selectedIds.has(memberId);
      const newSelectedIds = new Set(this.selectedIds);
      
      if (isSelected) {
        newSelectedIds.delete(memberId);
      } else {
        newSelectedIds.add(memberId);
      }
           
      this.selectedIds = newSelectedIds;
      this.render();
      this.onSelectionChange(Array.from(this.selectedIds));
    }
    
    setSelectedIds(ids = []) {
      this.selectedIds = new Set(ids);
      this.render();
    }
    
    getSelectedIds() {
      return Array.from(this.selectedIds);
    }
    
    getSelectedNames() {
      return this.getSelectedIds()
        .map(id => familyMembers.find(m => m.id === id)?.name)
        .filter(Boolean)
        .join(', ');
    }
  
    render() {
      if (!this.container) return;
      
      this.container.innerHTML = '';
      
      familyMembers.forEach(member => {
        const isSelected = this.selectedIds.has(member.id);
        const chip = this.createChip(member, isSelected);
        this.container.appendChild(chip);
      });
    }
    
  
    createChip(member, isSelected) {
      const chip = document.createElement('div');
      chip.className = `chip 
        ${isSelected ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'} 
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
      
      return chip;
    }
  }

  const selectors = new Map();
  
  function initMemberSelector(containerId, initialSelection = [], onChange = () => {}) {
    
    if (selectors.has(containerId)) {
      selectors.get(containerId).setSelectedIds(initialSelection);
    } else {
      
      const selector = new FamilyMemberSelector(containerId, onChange);
      selectors.set(containerId, selector);
    }
    
    return selectors.get(containerId);
  }
 
  function getMemberSelector(containerId) {
    return selectors.get(containerId);
  }