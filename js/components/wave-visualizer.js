BT.WaveVisualizer = class {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.clientWidth;
    this.height = canvas.clientHeight;
    
    canvas.width = this.width * window.devicePixelRatio;
    canvas.height = this.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    this.isActive = false;
    this.phase = 0;
    this.animationFrame = null;
  }
  
  start() {
    this.isActive = true;
    this.canvas.classList.add('active');
    this.draw();
  }
  
  stop() {
    this.isActive = false;
    this.canvas.classList.remove('active');
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    // clear
    setTimeout(() => {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }, 500);
  }
  
  draw() {
    if (!this.isActive) return;
    
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.phase += 0.05;
    
    this.drawWave(0.5, 0.5, 2, '#6D8F7A', 1);
    this.drawWave(0.7, 0.3, 3, '#6D8F7A', 0.5);
    
    this.animationFrame = requestAnimationFrame(this.draw.bind(this));
  }
  
  drawWave(ampMod, freqMod, thickness, color, alpha) {
    this.ctx.beginPath();
    this.ctx.lineWidth = thickness;
    this.ctx.strokeStyle = color;
    this.ctx.globalAlpha = alpha;
    
    const amplitude = (this.height / 3) * ampMod;
    const frequency = 0.02 * freqMod;
    
    for (let i = 0; i <= this.width; i++) {
      const y = Math.sin(i * frequency + this.phase) * amplitude * Math.sin(Math.PI * i / this.width);
      if (i === 0) {
        this.ctx.moveTo(i, this.height / 2 + y);
      } else {
        this.ctx.lineTo(i, this.height / 2 + y);
      }
    }
    
    this.ctx.stroke();
    this.ctx.globalAlpha = 1;
  }
};
