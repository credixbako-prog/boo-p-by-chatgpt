BT.RotaryDial = class {
  constructor(container, onChange) {
    this.container = container;
    this.onChange = onChange;
    this.value = 0;
    this.min = 0;
    this.max = Number.POSITIVE_INFINITY;
    this.isDragging = false;
    this.startX = 0;
    this.startValue = 0;
    this.sensitivity = 0.5; // pixels per unit
    
    this.init();
  }
  
  init() {
    this.track = document.createElement('div');
    this.track.className = 'session-dial__track';
    
    // Create tick marks (visually mocking a dial)
    let ticksHtml = `<svg width="100%" height="100%">`;
    // We'll just draw a bunch of lines that scroll.
    // Instead of actual scrolling ticks which requires complex transform logic,
    // we use a repeating background or transform group for simplicity in this MVP.
    ticksHtml += `<g id="dial-group">`;
    for(let i = -50; i <= 50; i++) {
      const height = i % 5 === 0 ? 30 : 15;
      ticksHtml += `<line x1="${i*10 + 160}" y1="30" x2="${i*10 + 160}" y2="${30 - height}" stroke="#0F1B2D" stroke-width="1.5" stroke-opacity="0.3"/>`;
    }
    ticksHtml += `</g></svg>`;
    this.track.innerHTML = ticksHtml;
    
    const centerLine = document.createElement('div');
    centerLine.className = 'session-dial__center-line';
    
    const fadeLeft = document.createElement('div');
    fadeLeft.className = 'session-dial__fade-left';
    
    const fadeRight = document.createElement('div');
    fadeRight.className = 'session-dial__fade-right';
    
    this.container.appendChild(this.track);
    this.container.appendChild(centerLine);
    this.container.appendChild(fadeLeft);
    this.container.appendChild(fadeRight);
    this.container.setAttribute('role', 'slider');
    this.container.setAttribute('tabindex', '0');
    this.container.setAttribute('aria-label', 'Sélecteur de page');
    this.container.setAttribute('aria-valuemin', '0');
    this.container.setAttribute('aria-valuenow', '0');
    
    this.group = this.track.querySelector('#dial-group');
    
    // Events
    this.track.addEventListener('mousedown', this.onDragStart.bind(this));
    window.addEventListener('mousemove', this.onDragMove.bind(this));
    window.addEventListener('mouseup', this.onDragEnd.bind(this));
    
    this.track.addEventListener('touchstart', (e) => {
      this.onDragStart(e.touches[0]);
    }, {passive: true});
    window.addEventListener('touchmove', (e) => {
      if(this.isDragging) this.onDragMove(e.touches[0]);
    }, {passive: true});
    window.addEventListener('touchend', this.onDragEnd.bind(this));
    this.container.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home') return this.setValue(this.min);
      if (event.key === 'End' && Number.isFinite(this.max)) return this.setValue(this.max);
      const largeStep = event.key === 'PageDown' || event.key === 'PageUp';
      const increase = event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'PageUp';
      this.setValue(this.value + (increase ? 1 : -1) * (largeStep ? 10 : 1));
    });
  }
  
  onDragStart(e) {
    this.isDragging = true;
    this.startX = e.clientX;
    this.startValue = this.value;
  }
  
  onDragMove(e) {
    if (!this.isDragging) return;
    const deltaX = e.clientX - this.startX;
    // Moving left increases value, moving right decreases value
    const deltaVal = Math.round(-deltaX * this.sensitivity);
    const newVal = Math.max(this.min, Math.min(this.max, this.startValue + deltaVal));
    
    if (newVal !== this.value) {
      this.setValue(newVal);
      if(navigator.vibrate && newVal % 10 === 0) navigator.vibrate(10); // Light haptic
    }
  }
  
  onDragEnd() {
    this.isDragging = false;
  }
  
  setValue(val) {
    this.value = Math.max(this.min, Math.min(this.max, parseInt(val, 10) || 0));
    // Update visual track
    const offset = -(this.value * 10 / this.sensitivity) % 50; // simple visual looping offset
    if(this.group) {
      this.group.style.transform = `translateX(${offset}px)`;
    }
    this.container.setAttribute('aria-valuenow', String(this.value));
    if (this.onChange) this.onChange(this.value);
  }

  setBounds(min, max) {
    this.min = Math.max(0, parseInt(min, 10) || 0);
    this.max = Number.isFinite(Number(max)) && Number(max) >= this.min ? Number(max) : Number.POSITIVE_INFINITY;
    this.container.setAttribute('aria-valuemin', String(this.min));
    if (Number.isFinite(this.max)) this.container.setAttribute('aria-valuemax', String(this.max));
    else this.container.removeAttribute('aria-valuemax');
    this.setValue(this.value);
  }
};
