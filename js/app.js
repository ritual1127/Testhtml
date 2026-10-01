/* =========================================================
   앱: 탭 라우팅, 테마, 애니메이션 루프
   ========================================================= */
(function () {
  const APP = {
    views: {},
    built: {},
    current: null,
    pendingPart: null,
    init() {
      document.getElementById('themeBtn').addEventListener('click', () => this.toggleTheme());
      this.syncThemeIcon();
      window.addEventListener('hashchange', () => this.route());
      this.route();
      let last = performance.now();
      const loop = t => {
        const dt = Math.max(0, (t - last) / 1000);
        last = t;
        const v = this.views[this.current];
        if (v) v.tick(dt);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      document.addEventListener('keydown', e => {
        const v = this.views[this.current];
        if (!v || e.target.closest('input,textarea,button')) return;
        if (e.key === 'n' || e.key === 'ArrowRight') { e.preventDefault(); if (v.mode === 'step') v.next(); }
        else if (e.key === ' ') { e.preventDefault(); v.togglePlay(); }
        else if (e.key === 'p') { e.preventDefault(); v.sim.tapPB(); if (!v.running) v.play(); }
        else if (e.key === 'r') { e.preventDefault(); v.reset(); }
      });
    },
    route() {
      const valid = ['home', 'basics', 't1', 't2', 't3', 'parts'];
      let id = (location.hash || '#home').slice(1);
      if (!valid.includes(id)) id = 'home';
      document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + id));
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.getAttribute('href') === '#' + id));
      const root = document.getElementById('page-' + id);
      if (!this.built[id]) {
        this.built[id] = true;
        if (id === 'basics') buildBasics(root);
        else if (id === 'parts') buildPartsPage(root);
        else if (TASKS[id]) this.views[id] = new TaskView(root, TASKS[id]);
      }
      // 다른 과제는 멈춤
      for (const k in this.views) if (k !== id && this.views[k].running) this.views[k].pause();
      this.current = id;
      const at = document.querySelector('.tab.active');
      if (at) at.scrollIntoView({ block: 'nearest', inline: 'center' });
      if (id === 'parts' && this.pendingPart) {
        const key = this.pendingPart;
        this.pendingPart = null;
        setTimeout(() => {
          const el = document.getElementById('part-' + key);
          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
        }, 60);
      } else {
        window.scrollTo(0, 0);
      }
    },
    flashPart(key) { this.pendingPart = key; },
    toggleTheme() {
      const root = document.documentElement;
      const cur = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      const nx = cur === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', nx);
      try { localStorage.setItem('hsim-theme', nx); } catch (e) { /* 저장 불가 무시 */ }
      this.syncThemeIcon();
    },
    syncThemeIcon() {
      const light = document.documentElement.getAttribute('data-theme') === 'light';
      const b = document.getElementById('themeBtn');
      b.textContent = light ? '🌙' : '☀️';
      b.title = light ? '어두운 테마로' : '밝은 테마로';
    },
  };
  window.APP = APP;
  document.addEventListener('DOMContentLoaded', () => APP.init());
})();
