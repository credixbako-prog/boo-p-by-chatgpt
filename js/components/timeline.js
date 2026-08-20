BT.Timeline = {
  init: function(container) {
    if (!container) return;
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const footprints = entry.target.querySelectorAll('.sentier__footprint');
          footprints.forEach(fp => fp.classList.add('visible'));
          // Unobserve if you only want it to animate once
          // observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.2
    });
    
    const nodes = container.querySelectorAll('.sentier__node');
    nodes.forEach(node => observer.observe(node));
  }
};
