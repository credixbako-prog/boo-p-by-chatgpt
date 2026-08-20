BT.navigation = {
  init: function() {
    this.navItems = document.querySelectorAll('.nav-item');
    this.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-target');
        window.location.hash = '#' + target;
      });
    });
  },
  
  updateActive: function(screenId) {
    if (!this.navItems) this.navItems = document.querySelectorAll('.nav-item');
    this.navItems.forEach(item => {
      if (item.getAttribute('data-target') === screenId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
};
