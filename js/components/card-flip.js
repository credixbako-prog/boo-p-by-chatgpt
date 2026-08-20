BT.CardFlip = {
  toggle: function(element) {
    const inner = element.querySelector('.card-flip-inner');
    if (inner) {
      inner.classList.toggle('flipped');
    }
  }
};
