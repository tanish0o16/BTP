document.addEventListener("DOMContentLoaded", () => {
  // Sequential animation for steps
  const steps = document.querySelectorAll('.step');
  steps.forEach((step, index) => {
    step.style.opacity = 0;
    step.style.transform = 'translateY(20px)';
    setTimeout(() => {
      step.style.transition = 'all 0.6s ease-out';
      step.style.opacity = 1;
      step.style.transform = 'translateY(0)';
    }, index * 300);
  });

  // Highlight actual buttons on main page
  const highlightBtns = document.querySelectorAll('.highlight-btn');
  highlightBtns.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      const targetSelector = btn.getAttribute('data-target');
      const targetEl = document.querySelector(targetSelector);
      if(targetEl) targetEl.classList.add('highlight-active');
    });
    btn.addEventListener('mouseleave', () => {
      const targetSelector = btn.getAttribute('data-target');
      const targetEl = document.querySelector(targetSelector);
      if(targetEl) targetEl.classList.remove('highlight-active');
    });
  });
});
