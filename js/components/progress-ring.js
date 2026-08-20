BT.ProgressRing = class {
  constructor(container, radius, stroke, color) {
    this.container = container;
    this.radius = radius;
    this.stroke = stroke;
    this.color = color;
    this.normalizedRadius = radius - stroke * 2;
    this.circumference = this.normalizedRadius * 2 * Math.PI;
    
    this.init();
  }
  
  init() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute('height', this.radius * 2);
    svg.setAttribute('width', this.radius * 2);
    svg.style.transform = "rotate(-90deg)";
    svg.style.filter = `drop-shadow(0 0 12px ${this.color}40)`; // 40 is hex for 25% opacity
    
    // Background ring
    const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bgCircle.setAttribute('stroke', 'rgba(15, 27, 45, 0.08)');
    bgCircle.setAttribute('fill', 'transparent');
    bgCircle.setAttribute('stroke-width', this.stroke);
    bgCircle.setAttribute('r', this.normalizedRadius);
    bgCircle.setAttribute('cx', this.radius);
    bgCircle.setAttribute('cy', this.radius);
    
    // Progress ring
    this.progressCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    this.progressCircle.setAttribute('stroke', this.color);
    this.progressCircle.setAttribute('fill', 'transparent');
    this.progressCircle.setAttribute('stroke-width', this.stroke);
    this.progressCircle.setAttribute('stroke-linecap', 'round');
    this.progressCircle.setAttribute('stroke-dasharray', this.circumference + ' ' + this.circumference);
    this.progressCircle.style.strokeDashoffset = this.circumference;
    this.progressCircle.setAttribute('r', this.normalizedRadius);
    this.progressCircle.setAttribute('cx', this.radius);
    this.progressCircle.setAttribute('cy', this.radius);
    
    svg.appendChild(bgCircle);
    svg.appendChild(this.progressCircle);
    
    this.container.appendChild(svg);
    // position svg absolute so content can be centered
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
  }
  
  setProgress(percent, animate = true) {
    const offset = this.circumference - percent / 100 * this.circumference;
    this.progressCircle.style.transition = animate ? 'stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1)' : 'none';
    this.progressCircle.style.strokeDashoffset = offset;
  }
};
