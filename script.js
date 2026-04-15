// ── Theme ────────────────────────────────────────────────
(function () {
  const btn = document.getElementById('toggle-theme');
  const setTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  };
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(saved || (prefersDark ? 'dark' : 'light'));
  if (btn) {
    btn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      setTheme(cur === 'dark' ? 'light' : 'dark');
    });
  }
})();

// ── Vim ──────────────────────────────────────────────────
(function () {
  let lastKey     = '';
  let lastKeyTime = 0;
  let mode        = 'normal';
  let searchHighlights = [];
  let searchIdx   = 0;
  let watchMode   = false;
  let watchHandler = null;
  let togetherMode = false;
  let togetherScrollHandler = null;
  let togetherCurrentSection = '';
  let togetherTwirl = 0;
  let togetherBubbleTimer = null;
  let togetherSpawnedPhoto = false;

  const half      = () => window.innerHeight / 2;
  const full      = () => window.innerHeight;
  const onProjects = () => window.location.pathname.includes('projects');

  // ── Build UI ──────────────────────────────────────────

  const cmdBar = document.createElement('div');
  cmdBar.className = 'vim-bar';
  cmdBar.style.display = 'none';
  cmdBar.innerHTML =
    '<span class="vim-bar-prefix">:</span>' +
    '<input class="vim-bar-input" id="vim-cmd-input" autocomplete="off" spellcheck="false">' +
    '<span class="vim-bar-msg" id="vim-bar-msg"></span>';
  document.body.appendChild(cmdBar);
  const cmdInput = document.getElementById('vim-cmd-input');
  const cmdMsg   = document.getElementById('vim-bar-msg');

  const searchBar = document.createElement('div');
  searchBar.className = 'vim-bar';
  searchBar.style.display = 'none';
  searchBar.innerHTML =
    '<span class="vim-bar-prefix">/</span>' +
    '<input class="vim-bar-input" id="vim-search-input" autocomplete="off" spellcheck="false">' +
    '<span class="vim-bar-msg" id="vim-search-count"></span>';
  document.body.appendChild(searchBar);
  const searchInput = document.getElementById('vim-search-input');
  const searchCount = document.getElementById('vim-search-count');

  const helpEl = document.createElement('div');
  helpEl.className = 'vim-help';
  helpEl.style.display = 'none';
  helpEl.innerHTML = `
    <div class="vim-help-box">
      <div class="vim-help-title">:help — keybindings</div>
      <table class="vim-help-table">
        <tr><td>j / k</td><td>scroll down / up</td></tr>
        <tr><td>gg / G</td><td>top / bottom</td></tr>
        <tr><td>Ctrl+d / u</td><td>half page down / up</td></tr>
        <tr><td>Ctrl+b</td><td>full page up</td></tr>
        <tr><td>gt / gT</td><td>next / prev page</td></tr>
        <tr><td>/</td><td>search</td></tr>
        <tr><td>n / N</td><td>next / prev match</td></tr>
        <tr><td>:</td><td>command mode</td></tr>
        <tr><td>:cd projects</td><td>go to projects</td></tr>
        <tr><td>:q</td><td>go to CV</td></tr>
        <tr><td>:noh</td><td>clear highlights</td></tr>
        <tr><td>:dark / :light</td><td>switch theme</td></tr>
        <tr><td>:watch</td><td>i'm watching you</td></tr>
        <tr><td>:together</td><td>fun guided page tour</td></tr>
        <tr><td>Esc</td><td>normal mode</td></tr>
      </table>
      <div class="vim-help-close">press Esc to close</div>
    </div>`;
  document.body.appendChild(helpEl);
  helpEl.addEventListener('click', e => { if (e.target === helpEl) closeAll(); });

  // ── Helpers ───────────────────────────────────────────

  function closeAll() {
    cmdBar.style.display    = 'none';
    searchBar.style.display = 'none';
    helpEl.style.display    = 'none';
    cmdInput.value          = '';
    cmdMsg.textContent      = '';
    mode = 'normal';
  }

  function openCmd() {
    closeAll();
    mode = 'command';
    cmdBar.style.display = 'flex';
    cmdInput.focus();
  }

  function openSearch() {
    closeAll();
    mode = 'search';
    searchBar.style.display = 'flex';
    searchInput.value = '';
    searchInput.focus();
  }

  function showMsg(msg, isError) {
    cmdBar.style.display = 'flex';
    cmdMsg.textContent = msg;
    cmdMsg.className = 'vim-bar-msg' + (isError ? ' is-error' : '');
    setTimeout(() => { if (mode !== 'command') closeAll(); }, 3000);
  }

  // ── Search ────────────────────────────────────────────

  function getTarget() {
    return document.getElementById('cv-text') ||
           document.getElementById('projects-content');
  }

  function clearHighlights() {
    searchHighlights.forEach(m => {
      if (m.parentNode) m.replaceWith(document.createTextNode(m.textContent));
    });
    const t = getTarget();
    if (t) t.normalize();
    searchHighlights = [];
    searchIdx = 0;
    searchCount.textContent = '';
    searchCount.className = 'vim-bar-msg';
  }

  function doSearch(query) {
    clearHighlights();
    if (!query) return;
    const target = getTarget();
    if (!target) return;

    const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);

    nodes.forEach(node => {
      const text = node.textContent;
      const matches = [...text.matchAll(re)];
      if (!matches.length) return;
      const frag = document.createDocumentFragment();
      let last = 0;
      matches.forEach(m => {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const mark = document.createElement('mark');
        mark.className = 'vim-hl';
        mark.textContent = m[0];
        frag.appendChild(mark);
        searchHighlights.push(mark);
        last = m.index + m[0].length;
      });
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });

    if (searchHighlights.length) {
      jumpTo(0);
    } else {
      searchCount.textContent = 'E486: Pattern not found';
      searchCount.className = 'vim-bar-msg is-error';
    }
  }

  function jumpTo(idx) {
    if (!searchHighlights.length) return;
    searchHighlights.forEach(m => m.classList.remove('vim-hl-cur'));
    searchIdx = ((idx % searchHighlights.length) + searchHighlights.length) % searchHighlights.length;
    const cur = searchHighlights[searchIdx];
    cur.classList.add('vim-hl-cur');
    cur.scrollIntoView({ behavior: 'smooth', block: 'center' });
    searchCount.textContent = `[${searchIdx + 1}/${searchHighlights.length}]`;
    searchCount.className = 'vim-bar-msg';
  }

  // ── Watch mode ────────────────────────────────────────

  function enableWatch() {
    watchMode = true;
    if (togetherMode) disableTogether();
    closeAll();

    const photo = document.getElementById('cv-photo');
    const scene = document.getElementById('photo-scene');
    if (!photo || !scene) return;

    const bubble = scene.querySelector('.clippy-bubble');

    // show message once, then hide
    if (bubble) {
      bubble.innerHTML = 'watching you<br>read my cv...';
      bubble.style.opacity   = '1';
      bubble.style.transform = 'translateX(0)';
      setTimeout(() => {
        bubble.style.transition = 'opacity 0.4s ease';
        bubble.style.opacity    = '0';
        scene.classList.add('watch-no-bubble');
      }, 2600);
    }

    // detach from layout, follow cursor
    photo.style.position      = 'fixed';
    photo.style.left          = '0';
    photo.style.top           = '0';
    photo.style.zIndex        = '9000';
    photo.style.pointerEvents = 'none';
    photo.style.transition    = 'transform 0.1s ease';
    photo.style.margin        = '0';

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    watchHandler = e => {
      const x = e.clientX - 64;
      const y = e.clientY - 64;
      photo.style.transform = `translate(${x}px, ${y}px)`;

      // tilt based on viewport position — looks like it's watching you
      const dx = (e.clientX / vw - 0.5) * 2;
      const dy = (e.clientY / vh - 0.5) * 2;
      scene.style.transition = 'transform 0.1s ease';
      scene.style.transform  = `perspective(400px) rotateY(${dx * 18}deg) rotateX(${-dy * 18}deg)`;
    };

    document.addEventListener('mousemove', watchHandler);
  }

  function disableWatch() {
    watchMode = false;

    const photo = document.getElementById('cv-photo');
    const scene = document.getElementById('photo-scene');

    if (photo) {
      photo.style.position      = '';
      photo.style.left          = '';
      photo.style.top           = '';
      photo.style.zIndex        = '';
      photo.style.pointerEvents = '';
      photo.style.transform     = '';
      photo.style.transition    = '';
      photo.style.margin        = '';
    }
    if (scene) {
      scene.style.transform  = '';
      scene.style.transition = '';
      scene.classList.remove('watch-no-bubble');
      const bubble = scene.querySelector('.clippy-bubble');
      if (bubble) {
        bubble.innerHTML         = 'press :h<br>for help';
        bubble.style.opacity     = '';
        bubble.style.transform   = '';
        bubble.style.transition  = '';
      }
    }
    if (watchHandler) {
      document.removeEventListener('mousemove', watchHandler);
      watchHandler = null;
    }
  }

  // ── Together mode ─────────────────────────────────────

  const togetherMsgsCv = {
    intro: 'let\'s read my cv<br>together.',
    education: 'oh here is my degree,<br>nothing special...',
    thesis: 'thesis zone:<br>motifs and SNPs.',
    research: 'research arc unlocked:<br>viral + cancer data.',
    publications: 'papers and talks:<br>trying to look serious.',
    skills: 'these are my skills.<br>yes, i debug at 2am.',
    languages: 'languages section:<br>english, french, bash.',
    extracurricular: 'outside the lab:<br>run, climb, repeat.',
    additional: 'visit projects too —<br>folder icon above.'
  };
  const togetherPathCv = {
    intro: { lane: 'left', y: 92, motion: 'twirl', turns: 1 },
    education: { lane: 'right', y: 132, motion: 'twirl', turns: 2 },
    thesis: { lane: 'right', y: 188, motion: 'drop' },
    research: { lane: 'right', y: 244, motion: 'drop' },
    publications: { lane: 'right', y: 300, motion: 'drop' },
    skills: { lane: 'left', y: 366, motion: 'twirl', turns: 2 },
    languages: { lane: 'left', y: 426, motion: 'drop' },
    extracurricular: { lane: 'left', y: 486, motion: 'drop' },
    additional: { lane: 'left', y: 546, motion: 'drop' }
  };
  const togetherMsgsProjects = {
    intro: 'let\'s browse my<br>projects together.',
    bio: 'bioinformatics tools:<br>where the science happens.',
    web: 'web apps section:<br>yes i also ship UI.',
    closed: 'private repos here —<br>classified folder vibes.'
  };
  const togetherPathProjects = {
    intro: { lane: 'left', y: 108, motion: 'twirl', turns: 1 },
    bio: { lane: 'right', y: 176, motion: 'twirl', turns: 2 },
    web: { lane: 'right', y: 288, motion: 'drop' },
    closed: { lane: 'left', y: 410, motion: 'drop' }
  };

  function togetherConfig() {
    if (onProjects()) {
      return { msgs: togetherMsgsProjects, path: togetherPathProjects };
    }
    return { msgs: togetherMsgsCv, path: togetherPathCv };
  }

  function getTogetherNodes() {
    const photo = document.getElementById('cv-photo') || document.getElementById('together-photo');
    const scene = document.getElementById('photo-scene') || document.getElementById('together-scene');
    return { photo, scene };
  }

  function ensureTogetherAvatar() {
    const existing = document.getElementById('cv-photo');
    if (existing) return;
    if (document.getElementById('together-photo')) return;

    const photo = document.createElement('div');
    photo.className = 'cv-photo visible';
    photo.id = 'together-photo';
    photo.innerHTML = `
      <div class="photo-scene" id="together-scene">
        <div class="clippy-bubble">press :h<br>for help</div>
        <div class="photo-pixelwrap">
          <img src="532939741_24360625223603724_7356990923222520707_n.jpg" alt="Georgios Kousis Tsampazis">
        </div>
      </div>`;
    document.body.appendChild(photo);
    togetherSpawnedPhoto = true;
  }

  function togetherSectionLabel(raw) {
    const t = raw.toLowerCase();
    if (onProjects()) {
      if (t.includes('bioinformatics')) return 'bio';
      if (t.includes('websites') || t.includes('web apps')) return 'web';
      if (t.includes('closed')) return 'closed';
      return 'intro';
    }
    if (t.includes('education')) return 'education';
    if (t.includes('thesis')) return 'thesis';
    if (t.includes('research')) return 'research';
    if (t.includes('publications')) return 'publications';
    if (t.includes('skills')) return 'skills';
    if (t.includes('languages')) return 'languages';
    if (t.includes('extracurricular')) return 'extracurricular';
    if (t.includes('additional')) return 'additional';
    return 'intro';
  }

  function updateTogetherCaption(label, motion) {
    const { scene } = getTogetherNodes();
    if (!scene) return;
    const bubble = scene.querySelector('.clippy-bubble');
    if (!bubble) return;
    const hideShift = scene.classList.contains('bubble-right') ? '-8px' : '8px';

    if (togetherBubbleTimer) {
      clearTimeout(togetherBubbleTimer);
      togetherBubbleTimer = null;
    }

    bubble.style.opacity = '0';
    bubble.style.transform = `translateX(${hideShift})`;
    const delay = motion === 'drop' ? 340 : 620;
    const { msgs } = togetherConfig();
    togetherBubbleTimer = setTimeout(() => {
      bubble.innerHTML = msgs[label] || msgs.intro;
      bubble.style.opacity = '1';
      bubble.style.transform = 'translateX(0)';
      togetherBubbleTimer = null;
    }, delay);
  }

  function togetherMovePhoto(label) {
    const { photo, scene } = getTogetherNodes();
    const wrap = scene ? scene.querySelector('.photo-pixelwrap') : null;
    if (!photo || !scene) return;

    const { path } = togetherConfig();
    const step = path[label] || path.intro;
    const rightSide = step.lane === 'right';
    scene.classList.toggle('bubble-left', rightSide);
    scene.classList.toggle('bubble-right', !rightSide);
    const x = rightSide ? Math.max(24, window.innerWidth - 220) : 24;
    const y = Math.min(window.innerHeight - 180, step.y || 100);
    togetherTwirl += 1;
    const baseYDeg = rightSide ? 180 : -180;
    const extraSpin = step.motion === 'twirl' ? (step.turns || 1) * 360 : 0;
    const yDeg = baseYDeg + (rightSide ? extraSpin : -extraSpin);
    const zBump = togetherTwirl % 2 === 0 ? 8 : -8;
    photo.style.transform = `translate(${x}px, ${y}px) rotateZ(${zBump}deg)`;
    scene.style.transform = '';
    if (wrap) {
      wrap.style.transform = `perspective(650px) rotateY(${yDeg}deg) rotateX(${step.motion === 'drop' ? 4 : 10}deg) scale(${step.motion === 'drop' ? 1.01 : 1.05})`;
      wrap.classList.remove('twirl-burst');
      if (step.motion === 'twirl') {
        void wrap.offsetWidth;
        wrap.classList.add('twirl-burst');
      }
    }
    return step.motion;
  }

  function togetherActiveSection() {
    const selector = onProjects() ? '#projects-content .github-section-title' : '#cv-text .b2';
    const headings = [...document.querySelectorAll(selector)];
    let active = 'intro';
    headings.forEach(h => {
      if (h.getBoundingClientRect().top < window.innerHeight * 0.45) {
        active = togetherSectionLabel(h.textContent || '');
      }
    });
    return active;
  }

  function enableTogether() {
    togetherMode = true;
    if (watchMode) disableWatch();
    closeAll();

    if (onProjects()) ensureTogetherAvatar();
    const { photo, scene } = getTogetherNodes();
    if (!photo || !scene) return;

    document.body.classList.add('together-mode');
    photo.style.position      = 'fixed';
    photo.style.left          = '0';
    photo.style.top           = '0';
    photo.style.zIndex        = '9000';
    photo.style.pointerEvents = 'none';
    photo.style.margin        = '0';
    photo.style.opacity       = '1';
    photo.style.transition    = 'transform 0.92s cubic-bezier(.2,.8,.2,1)';
    scene.style.transition    = 'transform 0.92s cubic-bezier(.2,.8,.2,1)';
    scene.classList.add('twirl-ready');
    scene.classList.add('together-bubble');

    const bubble = scene.querySelector('.clippy-bubble');
    const wrap = scene.querySelector('.photo-pixelwrap');
    if (bubble) {
      bubble.style.opacity = '0';
      bubble.style.transform = 'translateX(8px)';
      bubble.style.transition = 'opacity 0.28s cubic-bezier(.2,.7,.2,1), transform 0.28s cubic-bezier(.2,.7,.2,1)';
    }
    if (wrap) {
      wrap.classList.remove('twirl-burst');
      wrap.classList.remove('intro-twirl');
      void wrap.offsetWidth;
      wrap.classList.add('intro-twirl');
      setTimeout(() => wrap.classList.remove('intro-twirl'), 760);
    }

    togetherCurrentSection = '';
    togetherTwirl = 0;

    togetherScrollHandler = () => {
      const active = togetherActiveSection();
      if (active !== togetherCurrentSection) {
        togetherCurrentSection = active;
        const motion = togetherMovePhoto(active) || 'drop';
        updateTogetherCaption(active, motion);
      }
    };

    window.addEventListener('scroll', togetherScrollHandler, { passive: true });
    window.addEventListener('resize', togetherScrollHandler);
    togetherScrollHandler();
  }

  function disableTogether() {
    togetherMode = false;
    document.body.classList.remove('together-mode');

    const { photo, scene } = getTogetherNodes();
    if (photo) {
      photo.style.position      = '';
      photo.style.left          = '';
      photo.style.top           = '';
      photo.style.zIndex        = '';
      photo.style.pointerEvents = '';
      photo.style.transform     = '';
      photo.style.transition    = '';
      photo.style.margin        = '';
      photo.style.opacity       = '';
    }
    if (scene) {
      scene.style.transform  = '';
      scene.style.transition = '';
      scene.classList.remove('twirl-ready');
      scene.classList.remove('together-bubble');
      scene.classList.remove('bubble-left');
      scene.classList.remove('bubble-right');
      const wrap = scene.querySelector('.photo-pixelwrap');
      if (wrap) {
        wrap.style.transform = '';
        wrap.classList.remove('twirl-burst');
        wrap.classList.remove('intro-twirl');
      }
      const bubble = scene.querySelector('.clippy-bubble');
      if (bubble) {
        bubble.innerHTML         = 'press :h<br>for help';
        bubble.style.opacity     = '';
        bubble.style.transform   = '';
        bubble.style.transition  = '';
      }
    }

    if (togetherBubbleTimer) {
      clearTimeout(togetherBubbleTimer);
      togetherBubbleTimer = null;
    }

    if (togetherScrollHandler) {
      window.removeEventListener('scroll', togetherScrollHandler);
      window.removeEventListener('resize', togetherScrollHandler);
      togetherScrollHandler = null;
    }

    if (togetherSpawnedPhoto) {
      const spawned = document.getElementById('together-photo');
      if (spawned) spawned.remove();
      togetherSpawnedPhoto = false;
    }
  }

  // ── Commands ──────────────────────────────────────────

  function execCmd(raw) {
    const cmd = raw.trim();
    if (!cmd) { closeAll(); return; }

    if (['q', 'q!', 'wq', 'x'].includes(cmd)) {
      closeAll();
      if (onProjects()) window.location.href = 'index.html';
      return;
    }

    if (cmd === 'cd projects' || cmd === 'projects') {
      closeAll();
      if (!onProjects()) { sessionStorage.setItem('skipAnim', '1'); window.location.href = 'projects.html'; }
      return;
    }

    if (cmd === 'help' || cmd === 'h') {
      closeAll();
      helpEl.style.display = 'flex';
      return;
    }

    if (cmd === 'noh' || cmd === 'nohlsearch') { closeAll(); clearHighlights(); return; }

    if (cmd === 'watch') { watchMode ? disableWatch() : enableWatch(); return; }
    if (cmd === 'together') { togetherMode ? disableTogether() : enableTogether(); return; }

    if (cmd === 'dark')  { closeAll(); document.documentElement.setAttribute('data-theme', 'dark');  localStorage.setItem('theme', 'dark');  return; }
    if (cmd === 'light') { closeAll(); document.documentElement.setAttribute('data-theme', 'light'); localStorage.setItem('theme', 'light'); return; }

    showMsg('E492: Not an editor command: ' + cmd, true);
  }

  // ── Input events ──────────────────────────────────────

  cmdInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  execCmd(cmdInput.value);
    if (e.key === 'Escape') closeAll();
    e.stopPropagation();
  });

  searchInput.addEventListener('input', () => doSearch(searchInput.value));
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { mode = 'normal'; searchBar.style.display = 'none'; }
    if (e.key === 'Escape') { clearHighlights(); closeAll(); }
    e.stopPropagation();
  });

  // ── Normal mode keys ──────────────────────────────────

  document.addEventListener('keydown', e => {
    if (mode !== 'normal') return;
    const active = document.activeElement;
    if (active && active !== document.body &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    if (e.metaKey || e.altKey) return;

    const key  = e.key;
    const ctrl = e.ctrlKey;
    const now  = Date.now();
    const seq  = lastKey === 'g' && now - lastKeyTime < 600;

    if (key === 'Escape') {
      closeAll();
      clearHighlights();
      if (watchMode) disableWatch();
      if (togetherMode) disableTogether();
      lastKey = '';
      return;
    }
    if (key === ':' && !ctrl) { e.preventDefault(); openCmd(); lastKey = ''; return; }
    if (key === '/' && !ctrl) { e.preventDefault(); openSearch(); lastKey = ''; return; }
    if (key === 'n' && !ctrl && searchHighlights.length) { jumpTo(searchIdx + 1); lastKey = ''; return; }
    if (key === 'N' && !ctrl && searchHighlights.length) { jumpTo(searchIdx - 1); lastKey = ''; return; }

    if (key === 'G' && !ctrl) { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); lastKey = ''; return; }

    if (key === 'g' && !ctrl) {
      if (seq) { window.scrollTo({ top: 0, behavior: 'smooth' }); lastKey = ''; return; }
      lastKey = 'g'; lastKeyTime = now; return;
    }
    if (seq && key === 't') {
      if (!onProjects()) { sessionStorage.setItem('skipAnim', '1'); window.location.href = 'projects.html'; }
      else window.location.href = 'index.html';
      lastKey = ''; return;
    }
    if (seq && key === 'T') {
      if (onProjects()) window.location.href = 'index.html';
      else { sessionStorage.setItem('skipAnim', '1'); window.location.href = 'projects.html'; }
      lastKey = ''; return;
    }

    if (key === 'j' && !ctrl) window.scrollBy({ top:  64, behavior: 'smooth' });
    if (key === 'k' && !ctrl) window.scrollBy({ top: -64, behavior: 'smooth' });
    if (ctrl && key === 'd') { e.preventDefault(); window.scrollBy({ top:  half(), behavior: 'smooth' }); }
    if (ctrl && key === 'u') { e.preventDefault(); window.scrollBy({ top: -half(), behavior: 'smooth' }); }
    if (ctrl && key === 'b') { e.preventDefault(); window.scrollBy({ top: -full(), behavior: 'smooth' }); }

    lastKey = key; lastKeyTime = now;
  });
})();
