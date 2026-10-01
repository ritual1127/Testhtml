/* =========================================================
   ✍️ 암기 훈련 – 타이핑 빈칸, 필사(보고→초성→안 보고), 순서 맞추기,
   간격 반복 복습(Leitner), 오답 노트, 모의고사
   ========================================================= */
(function () {
  const { H, S, textW } = U;
  const { NAMES, DECKS, SEQS } = STUDY_DATA;
  const app = (el, ...kids) => el.append(...kids.filter(k => k != null && k !== false));
  const TASK_LABEL = { t1: '과제 1', t2: '과제 2', t3: '과제 3', common: '공통' };
  const GROUPS = ['t1', 't2', 't3', 'common'];

  /* ---------------- 문자열 도구 ---------------- */
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  function chosung(s) {
    return [...s].map(ch => {
      const c = ch.charCodeAt(0);
      return c >= 0xac00 && c <= 0xd7a3 ? CHO[Math.floor((c - 0xac00) / 588)] : ch;
    }).join('');
  }
  /** 힌트: 한글은 초성, 영문/숫자만 있는 답은 첫 글자만 */
  function hintOf(ans) {
    if (!/[가-힣]/.test(ans)) return [...ans].map((c, i) => i === 0 ? c : (/\s/.test(c) ? c : '•')).join('');
    return chosung(ans);
  }
  function norm(s) {
    return String(s).toLowerCase().replace(/way|웨이/g, '')
      .replace(/[\s\-_·.,()[\]{}/~'"’‘“”:;!?→>＝=+]/g, '');
  }
  function matchKeys(input, keysList) {
    const n = norm(input);
    if (!n) return false;
    return keysList.some(keys => {
      let pos = 0;
      for (const k of keys) {
        const nk = norm(k);
        const i = n.indexOf(nk, pos);
        if (i < 0) return false;
        pos = i + nk.length;
      }
      return true;
    });
  }
  const matchExact = (input, answers) => { const n = norm(input); return !!n && answers.some(a => norm(a) === n); };
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const stripMarks = t => t.replace(/\[\[(.+?)\]\]|\{\{(.+?)\}\}/g, (m, a, b) => (a != null ? a : b).split('|')[0]);
  const collapse = t => t.replace(/\s+/g, ' ').trim();
  function parseCloze(text, level) {
    const parts = [];
    const re = /\[\[(.+?)\]\]|\{\{(.+?)\}\}/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) parts.push({ s: text.slice(last, m.index) });
      const core = m[1] != null;
      const alts = (core ? m[1] : m[2]).split('|');
      if (core || level >= 2) parts.push({ blank: true, ans: alts, disp: alts[0] });
      else parts.push({ s: alts[0] });
      last = re.lastIndex;
    }
    if (last < text.length) parts.push({ s: text.slice(last) });
    return parts;
  }
  /** LCS 기반 비교: [{t:'eq'|'miss'|'extra', s}] */
  function diff(target, typed) {
    const a = [...target], b = [...typed];
    const n = a.length, m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out = [];
    const push = (t, s) => { const L = out[out.length - 1]; if (L && L.t === t) L.s += s; else out.push({ t, s }); };
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { push('eq', a[i]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { push('miss', a[i]); i++; }
      else { push('extra', b[j]); j++; }
    }
    while (i < n) push('miss', a[i++]);
    while (j < m) push('extra', b[j++]);
    return { ops: out, lcs: dp[0][0] };
  }
  function diffHTML(ops) {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return ops.map(o => o.t === 'eq' ? `<span class="df-eq">${esc(o.s)}</span>` : o.t === 'miss' ? `<span class="df-miss">${esc(o.s)}</span>` : `<span class="df-extra">${esc(o.s)}</span>`).join('');
  }

  /* ---------------- 저장소 (간격 반복) ---------------- */
  const KEY = 'hsim-study-v1';
  const MIN = 60e3, HOUR = 3600e3, DAY = 24 * HOUR;
  const INTERVALS = [0, MIN, 10 * MIN, HOUR, DAY, 3 * DAY];
  const LEVEL_NAME = ['새 문제', '학습 중', '학습 중', '거의 암기', '암기 완료', '암기 완료'];
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const Store = {
    data: { items: {}, days: {}, typing: {} },
    load() {
      try {
        const s = localStorage.getItem(KEY);
        if (s) { const o = JSON.parse(s); this.data = { items: o.items || {}, days: o.days || {}, typing: o.typing || {} }; }
      } catch (e) { /* 저장소 사용 불가 → 메모리만 */ }
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* 무시 */ } },
    get(id) { return this.data.items[id] || { b: 0, due: 0, ok: 0, ng: 0 }; },
    record(id, correct) {
      const now = Date.now();
      const it = Object.assign({ b: 0, due: 0, ok: 0, ng: 0 }, this.data.items[id]);
      if (correct) {
        it.ok++;
        if (it.b === 0 || now >= it.due) it.b = Math.min(5, it.b + 1); // 복습 시기가 됐을 때만 단계 상승
      } else { it.ng++; it.b = 1; }
      it.due = now + INTERVALS[it.b];
      it.last = now;
      this.data.items[id] = it;
      const d = today();
      this.data.days[d] = (this.data.days[d] || 0) + 1;
      this.save();
      if (Study.onChange) Study.onChange();
    },
    typingLevel(key) { return this.data.typing[key] || 0; },
    setTyping(key, lv) { if (lv > this.typingLevel(key)) { this.data.typing[key] = lv; this.save(); } },
    streak() {
      let n = 0;
      const d = new Date();
      if (!this.data.days[today()]) d.setDate(d.getDate() - 1);
      for (;;) {
        const k = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        if (!this.data.days[k]) break;
        n++; d.setDate(d.getDate() - 1);
      }
      return n;
    },
    reset() { this.data = { items: {}, days: {}, typing: {} }; this.save(); },
  };

  /* ---------------- 문제 목록 ---------------- */
  const ITEMS = {}, ORDER = [];
  const add = it => { ITEMS[it.id] = it; ORDER.push(it.id); };
  function buildItems() {
    for (const t of ['t1', 't2', 't3']) {
      for (const ref in NAMES[t]) add({ id: `name:${t}:${ref}`, type: 'name', task: t, ref, ans: NAMES[t][ref] });
      TASKS[t].ladder.forEach((r, ri) => {
        r.top.forEach((e, k) => add({ id: `lad:${t}:${ri}:${k}`, type: 'lad', task: t, ri, slot: k, ref: e.ref, kind: e.kind }));
        r.ser.forEach(e => add({ id: `lad:${t}:${ri}:2`, type: 'lad', task: t, ri, slot: 2, ref: e.ref, kind: e.kind }));
        add({ id: `lad:${t}:${ri}:c`, type: 'lad', task: t, ri, slot: 'c', ref: r.coil.ref, kind: r.coil.kind });
      });
    }
    DECKS.forEach(dk => dk.items.forEach((x, i) => {
      const o = typeof x === 'string' ? { t: x } : x;
      add({ id: `cloze:${dk.id}:${i}`, type: 'cloze', task: dk.task, deck: dk, idx: i, text: o.t, fix: !!o.fix });
    }));
    SEQS.forEach(sq => add({ id: `seq:${sq.id}`, type: 'seq', task: sq.task, seq: sq }));
  }
  const SLOT_NAME = { 0: '위쪽 접점', 1: '병렬(오른쪽) 접점', 2: '직렬(아래쪽) 접점', c: '코일' };
  function itemTitle(it) {
    if (it.type === 'name') return `${TASK_LABEL[it.task]} 유압 회로도 · ${numOf(it) || '부품'} 이름`;
    if (it.type === 'lad') return `${TASK_LABEL[it.task]} 전기 회로 ${it.ri + 1}번 줄 · ${SLOT_NAME[it.slot]}`;
    if (it.type === 'cloze') return `${it.deck.title} #${it.idx + 1}`;
    return it.seq.title;
  }
  function itemAnswer(it) {
    if (it.type === 'name') return it.ans.a;
    if (it.type === 'lad') return it.ref + (it.slot === 'c' ? ' 코일' : (it.kind === 'nc' ? ' (b접점)' : ' (a접점)'));
    if (it.type === 'cloze') return stripMarks(it.text);
    return it.seq.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  }
  function numOf(it) {
    const m = { t1: { cyl: '①', LS2: '②', fcv: '③', pc: '④', Y1: '⑤', Y2: '⑥', relief: '⑦', pu: '⑧', g9: '⑨' }, t2: { pcfcv: '①', V43: '②', Y3: '③' }, t3: { Y2: '①' } };
    return (m[it.task] || {})[it.ref] || '';
  }

  /* ---------------- 답 입력칸 ---------------- */
  function answerInput({ check, answer, width, placeholder, onSolved }) {
    const inp = H('input', { class: 'ans', type: 'text', placeholder: placeholder || '', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
    if (width) inp.style.width = width;
    let tries = 0, hinted = false, revealed = false, done = false, pending = false, lastSubmit = 0;
    const api = {
      el: inp,
      get done() { return done; },
      submit() {
        if (done) return;
        const now = performance.now();
        if (now - lastSubmit < 180) return;
        lastSubmit = now;
        const v = inp.value.trim();
        if (!v) { inp.focus(); return; }
        if (check(v)) {
          done = true;
          inp.readOnly = true;
          inp.classList.remove('bad');
          inp.classList.add(revealed || hinted || tries ? 'late' : 'good');
          if (revealed) inp.value = answer;
          onSolved(!revealed && !hinted && tries === 0, inp);
        } else {
          tries++;
          inp.classList.remove('bad'); void inp.offsetWidth; inp.classList.add('bad');
          if (tries === 2 && !hinted) api.hint();
          if (tries >= 3 && !revealed) api.reveal();
        }
      },
      hint() { if (done) return; hinted = true; inp.placeholder = hintOf(answer); inp.classList.add('hinted'); inp.title = '초성 힌트'; inp.focus(); },
      reveal() {
        if (done) return;
        revealed = true;
        inp.value = '';
        inp.placeholder = answer;
        inp.classList.add('revealed');
        inp.title = '정답을 보고 한 번 똑같이 쳐 보세요';
        inp.focus();
      },
    };
    inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (e.isComposing || e.keyCode === 229) { pending = true; return; }
      api.submit();
    });
    inp.addEventListener('compositionend', () => { if (pending) { pending = false; setTimeout(() => api.submit(), 0); } });
    return api;
  }

  /* ---------------- 회로도 생성 ---------------- */
  function hydFor(task) {
    const svg = S('svg');
    const T = TASKS[task];
    const D = new HYD.HydDiagram(svg, T.hydSize[0], T.hydSize[1]);
    T.build(D)(new Sim(T));
    return { svg, D };
  }
  function ladderFor(task) {
    const svg = S('svg');
    const lad = new Ladder(svg, TASKS[task].ladder, {});
    lad.update(new Sim(TASKS[task]));
    return { svg, lad };
  }

  /* ---------------- 단일 문제 카드 ---------------- */
  function renderQ(it, host, onResult, opts = {}) {
    host.innerHTML = '';
    let finished = false;
    const finish = ok => { if (finished) return; finished = true; onResult(ok); };
    host.append(H('div', { class: 'q-head' }, H('span', { class: 'pill', text: TASK_LABEL[it.task] }),
      H('span', { class: 'q-kind', text: { name: '🔧 부품 이름 쓰기', lad: '⚡ 래더 접점·코일 쓰기', cloze: '✍️ 노트 빈칸 쓰기', seq: '🔢 순서 맞추기' }[it.type] }),
      it.fix ? H('span', { class: 'badge-fix', text: '회로도 기준 정정 문장' }) : null));

    if (it.type === 'name' || it.type === 'lad') {
      let svg, prompt;
      if (it.type === 'name') {
        const r = hydFor(it.task);
        svg = r.svg;
        r.D.tags.forEach(T => { if (T.ref === it.ref) { T.tx.textContent = '?'; T.tx.classList.add('q'); r.D._layoutTag(T, '?'); } });
        r.D.plains.forEach(p => { if (p.ref === it.ref) p.el.textContent = '?'; });
        svg.querySelectorAll(`.comp[data-ref="${it.ref}"]`).forEach(e => e.classList.add('qsel'));
        const n = numOf(it);
        prompt = `회로도에서 <b>깜빡이는 부품</b>${n ? ` (<b>${n}</b>)` : ''}의 이름을 쓰세요.`;
      } else {
        const r = ladderFor(it.task);
        svg = r.svg;
        r.lad.labels.forEach(L => {
          if (L.ri !== it.ri) return;
          L.el.textContent = '?';
          if (L.slot === it.slot) { L.g.classList.add('qsel'); L.el.classList.add('qlabel'); }
        });
        const kindTxt = it.slot === 'c' ? (it.kind === 'sol' ? '솔레노이드 코일' : '릴레이 코일') : (it.kind === 'nc' ? 'b접점' : 'a접점');
        prompt = `<b>${it.ri + 1}번 줄</b>의 깜빡이는 <b>${SLOT_NAME[it.slot]}</b>(${kindTxt})의 이름은? <span class="muted small">(예: K1, LS2, PB1, Y1)</span>`;
      }
      host.append(H('div', { class: 'q-dia ' + (it.type === 'lad' ? 'lad' : '') }, svg));
      host.append(H('p', { class: 'q-prompt', html: prompt }));
      const ai = answerInput({
        answer: it.type === 'name' ? it.ans.a : it.ref,
        check: v => it.type === 'name' ? matchKeys(v, it.ans.keys) : norm(v) === norm(it.ref),
        width: it.type === 'name' ? 'min(100%, 340px)' : '140px',
        placeholder: '여기에 입력 후 Enter',
        onSolved: ok => finish(ok),
      });
      host.append(H('div', { class: 'q-row' }, ai.el,
        H('button', { class: 'btn primary', text: '확인', onclick: () => ai.submit() }),
        H('button', { class: 'btn', text: '초성 힌트', onclick: () => ai.hint() }),
        H('button', { class: 'btn', text: '모르겠어요', onclick: () => ai.reveal() })));
      setTimeout(() => ai.el.focus({ preventScroll: true }), 30);
      return;
    }
    if (it.type === 'cloze') {
      const parts = parseCloze(it.text, opts.level || 1);
      const line = H('div', { class: 'cloze-line big' });
      const blanks = [];
      let allFirst = true;
      for (const p of parts) {
        if (!p.blank) { line.append(document.createTextNode(p.s)); continue; }
        const w = Math.max(56, textW(p.disp, 16) + 30);
        const ai = answerInput({
          answer: p.disp, check: v => matchExact(v, p.ans), width: w + 'px', placeholder: '',
          onSolved: ok => {
            if (!ok) allFirst = false;
            const nx = blanks.find(b => !b.done);
            if (nx) nx.el.focus(); else finish(allFirst);
          },
        });
        blanks.push(ai);
        line.append(ai.el);
      }
      host.append(line);
      host.append(H('div', { class: 'q-row' },
        H('button', { class: 'btn primary', text: '확인', onclick: () => { const b = blanks.find(x => x.el === document.activeElement && !x.done) || blanks.find(x => !x.done); if (b) b.submit(); } }),
        H('button', { class: 'btn', text: '초성 힌트', onclick: () => { const b = blanks.find(x => x.el === document.activeElement && !x.done) || blanks.find(x => !x.done); if (b) b.hint(); } }),
        H('button', { class: 'btn', text: '모르겠어요', onclick: () => { const b = blanks.find(x => x.el === document.activeElement && !x.done) || blanks.find(x => !x.done); if (b) b.reveal(); } }),
        opts.compact ? null : H('span', { class: 'muted small', text: 'Enter = 확인 · 틀리면 2번째에 초성 힌트, 3번째에 정답 공개' })));
      if (!opts.compact) setTimeout(() => blanks[0] && blanks[0].el.focus({ preventScroll: true }), 30);
      return;
    }
    // 순서 맞추기
    const steps = it.seq.steps;
    const picked = H('ol', { class: 'seq-picked' });
    const pool = H('div', { class: 'seq-pool' });
    const msg = H('div', { class: 'small muted', text: `${steps.length}개 단계를 일어나는 순서대로 눌러 보세요.` });
    let next = 0, mistakes = 0;
    shuffle(steps.map((s, i) => i)).forEach(i => {
      const b = H('button', { class: 'seq-card', text: steps[i] });
      b.addEventListener('click', () => {
        if (i === next) {
          b.remove();
          picked.append(H('li', { class: 'seq-done', text: steps[i] }));
          next++;
          msg.textContent = next < steps.length ? `좋아요! ${next + 1}번째 단계는?` : (mistakes ? `완성! 실수 ${mistakes}번 — 한 번 더 연습해 보세요.` : '완벽해요! 한 번도 안 틀렸어요 🎉');
          if (next === steps.length) finish(mistakes === 0);
        } else {
          mistakes++;
          b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
          msg.textContent = `아니에요. 지금은 ${next + 1}번째 단계를 고를 차례예요. (실수 ${mistakes})`;
        }
      });
      pool.append(b);
    });
    host.append(H('div', { class: 'q-prompt', html: `<b>${it.seq.title}</b>` }), msg, picked, pool);
  }

  /* ---------------- 세션 (복습 / 모의고사) ---------------- */
  function runSession(host, ids, { mode, title, level = 1, onEnd }) {
    const queue = ids.slice();
    const total = ids.length;
    const results = {};
    let doneCount = 0, idx = 0;
    const t0 = Date.now();
    host.innerHTML = '';
    const bar = H('div', { class: 'sess-bar' }, H('div', { class: 'fill' }));
    const info = H('div', { class: 'sess-info' });
    const card = H('div', { class: 'card q-card' });
    const body = H('div', { class: 'card-b' });
    const fb = H('div', { class: 'q-feedback' });
    card.append(body, fb);
    host.append(H('div', { class: 'sess-top' }, H('b', { text: title }), H('button', { class: 'btn', text: '그만하기', onclick: () => end(true) })), bar, info, card);
    const upd = () => {
      bar.firstChild.style.width = (doneCount / total * 100) + '%';
      info.textContent = `${Math.min(doneCount + 1, total)} / ${total} · 맞힘 ${Object.values(results).filter(v => v).length}` + (mode === 'review' ? ' · 틀린 문제는 조금 뒤에 다시 나와요' : '');
    };
    const show = () => {
      if (idx >= queue.length) return end(false);
      upd();
      fb.innerHTML = '';
      fb.className = 'q-feedback';
      const it = ITEMS[queue[idx]];
      renderQ(it, body, ok => {
        const first = !(it.id in results);
        if (first) { results[it.id] = ok; Store.record(it.id, ok); doneCount++; }
        else if (mode === 'review') Store.record(it.id, ok);
        if (!ok && mode === 'review') queue.splice(Math.min(queue.length, idx + 4), 0, it.id);
        fb.className = 'q-feedback ' + (ok ? 'ok' : 'ng');
        const nextBtn = H('button', { class: 'btn primary', text: idx + 1 >= queue.length ? '결과 보기 ▶' : '다음 문제 ▶ (Enter)', onclick: () => { idx++; show(); } });
        app(fb, H('div', { class: 'fb-msg', html: ok ? '✅ <b>정답!</b> 한 번에 맞혔어요.' : `❌ <b>다시 외워요.</b> ${mode === 'review' ? '이 문제는 잠시 후 다시 나와요.' : ''}` }),
          ok ? null : H('pre', { class: 'fb-ans', text: '정답: ' + itemAnswer(it) }), nextBtn);
        setTimeout(() => nextBtn.focus({ preventScroll: true }), 50);
        upd();
      }, { level });
      card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    const end = aborted => {
      const ok = Object.values(results).filter(v => v).length;
      const n = Object.keys(results).length;
      const secs = Math.round((Date.now() - t0) / 1000);
      host.innerHTML = '';
      const wrong = Object.keys(results).filter(id => !results[id]);
      const pct = n ? Math.round(ok / n * 100) : 0;
      host.append(H('div', { class: 'card sess-end' }, H('div', { class: 'card-b' },
        H('h2', { text: aborted ? '여기까지 했어요' : (mode === 'exam' ? '📝 모의고사 결과' : '🎉 복습 완료!') }),
        H('div', { class: 'big-score', text: n ? `${ok} / ${n}  (${pct}점)` : '-' }),
        H('p', { class: 'muted', text: `걸린 시간 ${Math.floor(secs / 60)}분 ${secs % 60}초` + (mode === 'review' ? ' · 처음에 맞힌 수 기준' : '') }),
        wrong.length ? H('div', null, H('h4', { text: '틀린 문제 (정답 확인)' }),
          H('ul', { class: 'wrong-list' }, wrong.map(id => H('li', null, H('b', { text: itemTitle(ITEMS[id]) }), H('pre', { text: itemAnswer(ITEMS[id]) }))))) : H('p', { text: '틀린 문제가 없어요! 👏' }),
        H('div', { class: 'q-row' },
          wrong.length ? H('button', { class: 'btn primary', text: `틀린 ${wrong.length}문제만 다시`, onclick: () => runSession(host, wrong, { mode: 'review', title: '틀린 문제 다시 풀기', level, onEnd }) }) : null,
          H('button', { class: 'btn', text: '대시보드로', onclick: () => onEnd && onEnd() })))));
      if (onEnd && Study.onChange) Study.onChange();
    };
    show();
  }

  /* ---------------- 연습 1: 회로도 빈칸 ---------------- */
  function diagramPractice(host, task, kind) {
    host.innerHTML = '';
    const box = H('div', { class: 'dia-box' });
    const scroll = H('div', { class: 'dia-scroll' }, box);
    const score = H('span', { class: 'pill' });
    const inputs = [];
    let W, Hh;
    const place = (ai, x, y, w) => {
      ai.el.classList.add('on-dia');
      ai.el.style.left = (x / W * 100) + '%';
      ai.el.style.top = (y / Hh * 100) + '%';
      ai.el.style.width = (w / W * 100) + '%';
      box.append(ai.el);
    };
    const updScore = () => {
      const d = inputs.filter(i => i.ai.done).length;
      score.textContent = `${d} / ${inputs.length} 완료` + (d === inputs.length ? ' 🎉' : '');
    };
    const mk = (id, answer, check, placeholder) => {
      const ai = answerInput({
        answer, check, placeholder,
        onSolved: ok => {
          Store.record(id, ok);
          updScore();
          const nx = inputs.find(i => !i.ai.done);
          if (nx) nx.ai.el.focus({ preventScroll: true });
        },
      });
      inputs.push({ id, ai });
      return ai;
    };
    if (kind === 'hyd') {
      const { svg, D } = hydFor(task);
      box.append(svg);
      W = D.W; Hh = D.H;
      const spots = [];
      D.tags.forEach(T => spots.push({ ref: T.ref, x: T.x, y: T.y, num: T.num, hide: () => { T.g.style.display = 'none'; } }));
      D.plains.forEach(p => spots.push({ ref: p.ref, x: p.x, y: p.y, num: '', hide: () => { p.el.style.display = 'none'; } }));
      const NUMS = '①②③④⑤⑥⑦⑧⑨';
      spots.sort((a, b) => (a.num ? NUMS.indexOf(a.num) : 20 + a.y / 1000) - (b.num ? NUMS.indexOf(b.num) : 20 + b.y / 1000));
      spots.filter(s => NAMES[task][s.ref]).forEach(s => {
        s.hide();
        const ans = NAMES[task][s.ref];
        const short = ans.a.replace(/\s*\(.*\)/, '');
        const w = Math.min(200, Math.max(84, textW(short, 13) + 26));
        const x = Math.min(s.x, W - w - 2);
        place(mk(`name:${task}:${s.ref}`, ans.a, v => matchKeys(v, ans.keys), s.num || '?'), x, s.y - 4, w);
      });
    } else {
      const { svg, lad } = ladderFor(task);
      box.append(svg);
      box.classList.add('lad');
      W = lad.W; Hh = 410;
      lad.labels.forEach(L => {
        L.el.style.display = 'none';
        place(mk(`lad:${task}:${L.ri}:${L.slot}`, L.ref, v => norm(v) === norm(L.ref), '?'), L.x - 46, L.y - 5, 48);
      });
    }
    updScore();
    host.append(
      H('p', { class: 'small muted', html: kind === 'hyd'
        ? '회로도 위 빈칸에 <b>부품 이름</b>을 쓰고 <b>Enter</b>. 띄어쓰기·하이픈은 상관없어요 (예: <code>4/2way 편솔레노이드밸브</code>도 정답). 2번 틀리면 <b>초성 힌트</b>, 3번 틀리면 정답이 보이고 한 번 따라 치면 넘어가요.'
        : '래더의 모든 <b>접점·코일 이름</b>이 지워졌어요. 각 빈칸에 <code>K1</code>, <code>LS2</code>, <code>PB1</code>, <code>Y1</code> 처럼 쓰고 <b>Enter</b>. 접점 모양(a/b)과 줄 번호를 보고 떠올려 보세요.' }),
      scroll,
      H('div', { class: 'q-row' }, score,
        H('button', { class: 'btn', text: '남은 칸 정답 보기', onclick: () => inputs.forEach(i => i.ai.reveal()) }),
        H('button', { class: 'btn', text: '↻ 처음부터 다시', onclick: () => diagramPractice(host, task, kind) })));
    setTimeout(() => inputs[0] && inputs[0].ai.el.focus({ preventScroll: true }), 50);
  }

  /* ---------------- 연습 2: 노트 빈칸 (목록) ---------------- */
  function clozePractice(host, deckId, level, shuffled) {
    host.innerHTML = '';
    const dk = DECKS.find(d => d.id === deckId);
    const idxs = dk.items.map((x, i) => i);
    const order = shuffled ? shuffle(idxs) : idxs;
    const status = H('span', { class: 'pill' });
    let done = 0, perfect = 0;
    const upd = () => { status.textContent = `${done} / ${order.length} 문장 · 한 번에 맞힘 ${perfect}`; };
    const list = H('div', { class: 'cloze-list' });
    order.forEach((i, k) => {
      const it = ITEMS[`cloze:${dk.id}:${i}`];
      const row = H('div', { class: 'cloze-row' });
      const num = H('span', { class: 'cl-num', text: String(k + 1) });
      const holder = H('div', { class: 'cl-body' });
      row.append(num, holder);
      list.append(row);
      renderQ(it, holder, ok => {
        Store.record(it.id, ok);
        done++; if (ok) perfect++;
        row.classList.add(ok ? 'ok' : 'late');
        upd();
        const nextRow = row.nextElementSibling;
        if (nextRow) { const inp = nextRow.querySelector('input.ans:not([readonly])'); if (inp) inp.focus({ preventScroll: false }); }
      }, { level, compact: true });
      // 목록 모드에서는 머리말 생략
      const head = holder.querySelector('.q-head');
      if (head && !it.fix) head.remove(); else if (head) { head.querySelectorAll('.pill,.q-kind').forEach(e => e.remove()); }
    });
    upd();
    host.append(H('div', { class: 'q-row' }, status, H('button', { class: 'btn', text: '↻ 다시', onclick: () => clozePractice(host, deckId, level, shuffled) })), list);
    const first = list.querySelector('input.ans');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 50);
  }

  /* ---------------- 연습 3: 따라 쓰기 → 초성 → 안 보고 ---------------- */
  function typingPractice(host, deckId, start = 0, level = 1) {
    host.innerHTML = '';
    const dk = DECKS.find(d => d.id === deckId);
    const n = dk.items.length;
    const i = Math.max(0, Math.min(n - 1, start));
    const raw = typeof dk.items[i] === 'string' ? dk.items[i] : dk.items[i].t;
    const target = collapse(stripMarks(raw));
    const tkey = `${deckId}:${i}`;
    const lvNames = ['', '① 보고 따라 쓰기', '② 초성만 보고 쓰기', '③ 안 보고 외워 쓰기'];
    const passNeed = [0, 0.95, 0.9, 0.9];

    const nav = H('div', { class: 'q-row' },
      H('button', { class: 'btn', text: '◀ 이전 문장', disabled: i === 0 ? 'disabled' : null, onclick: () => typingPractice(host, deckId, i - 1, 1) }),
      H('span', { class: 'pill', text: `문장 ${i + 1} / ${n}` }),
      H('button', { class: 'btn', text: '다음 문장 ▶', disabled: i === n - 1 ? 'disabled' : null, onclick: () => typingPractice(host, deckId, i + 1, 1) }),
      H('span', { class: 'lv-dots', html: [1, 2, 3].map(l => `<span class="dot ${Store.typingLevel(tkey) >= l ? 'on' : ''}" title="${lvNames[l]}"></span>`).join('') + ' <span class="muted small">통과한 단계</span>' }));
    const lvSeg = H('div', { class: 'seg' });
    [1, 2, 3].forEach(l => lvSeg.append(H('button', { class: l === level ? 'on' : '', text: lvNames[l], onclick: () => typingPractice(host, deckId, i, l) })));
    const disp = H('div', { class: 'type-target lv' + level });
    const chars = [...target];
    const spans = chars.map(ch => {
      const sp = H('span', { class: 'tc' });
      sp.textContent = level === 1 ? ch : level === 2 ? chosung(ch) : (ch === ' ' ? ' ' : '＿');
      disp.append(sp);
      return sp;
    });
    const ta = H('textarea', { class: 'type-input', rows: '3', placeholder: level === 3 ? '기억나는 대로 문장 전체를 쓰고 Enter (또는 채점하기)' : '여기에 똑같이 따라 쓰세요 (Enter = 채점)', spellcheck: 'false', autocomplete: 'off' });
    const stat = H('div', { class: 'type-stat small muted' });
    const result = H('div', { class: 'type-result' });
    const gradeBtn = H('button', { class: 'btn primary', text: '채점하기', onclick: () => grade() });
    let composing = false, t0 = 0, graded = false;

    const cur = () => collapse(ta.value.replace(/\n/g, ' ')).length ? ta.value.replace(/\n/g, ' ').replace(/\s+/g, ' ').replace(/^\s+/, '') : '';
    const paint = () => {
      if (graded) return;
      const typed = [...cur()];
      if (!t0 && typed.length) t0 = performance.now();
      const upto = composing ? typed.length - 1 : typed.length;
      let right = 0;
      spans.forEach((sp, k) => {
        let cls = 'tc';
        if (level !== 3) {
          if (k < upto) {
            if (typed[k] === chars[k]) { cls += ' ok'; right++; if (level === 2) sp.textContent = chars[k]; }
            else { cls += ' bad'; if (level === 2) sp.textContent = chosung(chars[k]); }
          } else if (level === 2) sp.textContent = chosung(chars[k]);
          if (k === upto) cls += ' cursor';
        } else if (k < typed.length) cls += ' filled';
        sp.className = cls;
      });
      const secs = t0 ? (performance.now() - t0) / 1000 : 0;
      stat.textContent = level === 3
        ? `${typed.length} / ${chars.length}자`
        : `진행 ${Math.min(typed.length, chars.length)} / ${chars.length}자 · 맞은 글자 ${right}` + (secs > 2 ? ` · 분당 ${Math.round(typed.length / secs * 60)}자` : '');
      if (level !== 3 && typed.length >= chars.length && (!composing || typed[chars.length - 1] === chars[chars.length - 1])) grade();
    };
    const grade = () => {
      if (graded) return;
      const typed = cur().trim();
      if (!typed) { ta.focus(); return; }
      graded = true;
      ta.readOnly = true;
      const a = target.replace(/\s/g, ''), b = typed.replace(/\s/g, '');
      const df = diff(a, b);
      const acc = a.length ? df.lcs / Math.max(a.length, b.length) : 0;
      const secs = t0 ? (performance.now() - t0) / 1000 : 0;
      const pass = acc >= passNeed[level];
      if (pass) Store.setTyping(tkey, level);
      spans.forEach((sp, k) => { sp.textContent = chars[k]; sp.className = 'tc shown'; });
      result.innerHTML = '';
      result.className = 'type-result ' + (pass ? 'ok' : 'ng');
      const pctTxt = Math.round(acc * 100) + '%';
      app(result, H('div', { class: 'fb-msg', html: pass ? `✅ <b>통과!</b> 정확도 ${pctTxt}` : `❌ 정확도 ${pctTxt} — ${Math.round(passNeed[level] * 100)}% 이상이면 통과예요.` }),
        H('div', { class: 'small muted', text: `${Math.round(secs)}초` + (secs > 1 ? ` · 분당 ${Math.round(b.length / secs * 60)}자` : '') + ' · 띄어쓰기는 채점에서 제외' }),
        acc < 1 ? H('div', { class: 'df', html: '<span class="muted small">비교 — </span>' + diffHTML(df.ops) + '<div class="small muted" style="margin-top:4px"><span class="df-miss">빨간 밑줄</span> = 빠뜨린 글자, <span class="df-extra">회색 취소선</span> = 잘못 쓴 글자</div>' }) : null);
      const again = H('button', { class: 'btn', text: '↻ 이 단계 다시', onclick: () => typingPractice(host, deckId, i, level) });
      let next;
      if (pass && level < 3) next = H('button', { class: 'btn primary', text: `다음 단계: ${lvNames[level + 1]} ▶`, onclick: () => typingPractice(host, deckId, i, level + 1) });
      else if (pass && i < n - 1) next = H('button', { class: 'btn primary', text: '다음 문장 ▶', onclick: () => typingPractice(host, deckId, i + 1, 1) });
      else if (pass) next = H('button', { class: 'btn primary', text: '🎉 덱 완료! 처음부터', onclick: () => typingPractice(host, deckId, 0, 1) });
      result.append(H('div', { class: 'q-row' }, next, again));
      if (next) setTimeout(() => next.focus({ preventScroll: true }), 50);
      nav.querySelector('.lv-dots').innerHTML = [1, 2, 3].map(l => `<span class="dot ${Store.typingLevel(tkey) >= l ? 'on' : ''}"></span>`).join('') + ' <span class="muted small">통과한 단계</span>';
    };
    ta.addEventListener('compositionstart', () => { composing = true; });
    ta.addEventListener('compositionend', () => { composing = false; paint(); });
    ta.addEventListener('input', paint);
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (e.isComposing || e.keyCode === 229) { setTimeout(grade, 30); return; }
        grade();
      }
    });
    host.append(nav, H('div', { class: 'q-row' }, lvSeg),
      H('p', { class: 'small muted', html: level === 1 ? '문장을 보면서 똑같이 쳐요. 맞은 글자는 초록, 틀린 글자는 빨강.' : level === 2 ? '각 글자의 <b>초성</b>만 보여요. 맞게 치면 글자가 나타나요.' : '문장이 모두 가려졌어요. <b>기억만으로</b> 쓰고 채점하세요. (90% 이상 통과)' }),
      disp, ta, H('div', { class: 'q-row' }, stat, gradeBtn), result);
    setTimeout(() => ta.focus({ preventScroll: true }), 50);
  }

  /* ---------------- 연습 4: 순서 맞추기 ---------------- */
  function seqPractice(host, seqId) {
    host.innerHTML = '';
    const it = ITEMS[`seq:${seqId}`];
    const body = H('div');
    host.append(body);
    renderQ(it, body, ok => {
      Store.record(it.id, ok);
      body.append(H('div', { class: 'q-row' }, H('button', { class: 'btn primary', text: '↻ 다시 섞어서 풀기', onclick: () => seqPractice(host, seqId) })));
    });
  }

  /* ---------------- 오답 노트 ---------------- */
  function wrongNote(host, startReview) {
    host.innerHTML = '';
    const rows = ORDER.map(id => ({ it: ITEMS[id], st: Store.get(id) })).filter(r => r.st.ng > 0)
      .sort((a, b) => (b.st.ng - b.st.ok * 0.5) - (a.st.ng - a.st.ok * 0.5));
    if (!rows.length) { host.append(H('p', { class: 'muted', text: '아직 틀린 문제가 없어요. 문제를 풀면 틀린 것들이 여기에 모여요.' })); return; }
    host.append(H('div', { class: 'q-row' }, H('span', { class: 'pill', text: `틀린 적 있는 문제 ${rows.length}개` }),
      H('button', { class: 'btn primary', text: '오답만 복습하기', onclick: () => startReview(rows.filter(r => r.st.b < 4).map(r => r.it.id).slice(0, 30), '오답 복습') })));
    const tbl = H('div', { class: 'wrong-table' });
    rows.forEach(({ it, st }) => {
      tbl.append(H('div', { class: 'wt-row' },
        H('div', null, H('div', { class: 'small muted', text: itemTitle(it) }), H('pre', { class: 'wt-ans', text: itemAnswer(it) })),
        H('div', { class: 'wt-st' }, H('span', { class: 'pill ng', text: `틀림 ${st.ng}` }), H('span', { class: 'pill', text: `맞힘 ${st.ok}` }), H('span', { class: 'pill lvl' + st.b, text: LEVEL_NAME[st.b] }))));
    });
    host.append(tbl);
  }

  /* ---------------- 페이지 ---------------- */
  const Study = {
    mode: 'dia', task: 't1', diaKind: 'hyd', deck: 't1-seq', level: 1, shuffled: false, seq: 't1-cycle', filter: 'all',
    built: false,
    build(root) {
      Store.load();
      if (!ORDER.length) buildItems();
      this.root = root;
      root.innerHTML = '';
      root.append(H('div', { class: 'page-head' }, H('h1', { text: '✍️ 암기 훈련' }),
        H('p', { html: '보고 이해한 걸 <b>직접 타이핑</b>하며 외워요. 맞힌 문제는 점점 늦게, 틀린 문제는 곧바로 다시 나오는 <b>간격 반복</b> 방식이라 확실하게 머리에 남아요. 기록은 이 기기의 브라우저에 저장돼요.' })));
      this.dash = H('div', { class: 'card study-dash' });
      root.append(this.dash);
      this.tabs = H('div', { class: 'seg study-tabs' });
      [['dia', '📋 회로도 빈칸'], ['cloze', '✍️ 노트 빈칸'], ['type', '⌨️ 따라·외워 쓰기'], ['seq', '🔢 순서 맞추기'], ['wrong', '📒 오답 노트']].forEach(([k, l]) => {
        this.tabs.append(H('button', { 'data-k': k, text: l, onclick: () => { this.mode = k; this.renderMode(); } }));
      });
      this.opts = H('div', { class: 'study-opts' });
      this.host = H('div', { class: 'card-b study-host' });
      root.append(H('div', { class: 'card', style: 'margin-top:14px' },
        H('div', { class: 'card-h', style: 'flex-wrap:wrap' }, this.tabs), this.opts, this.host));
      this.built = true;
      this.onChange = () => this.renderDash();
      if (window.STUDY_PRESET) { this.task = window.STUDY_PRESET; this.filter = window.STUDY_PRESET; window.STUDY_PRESET = null; }
      this.renderDash();
      this.renderMode();
    },
    show() {
      if (window.STUDY_PRESET) { this.task = window.STUDY_PRESET; this.filter = window.STUDY_PRESET; this.mode = 'dia'; window.STUDY_PRESET = null; this.renderMode(); }
      this.renderDash();
    },
    pool() { return ORDER.filter(id => this.filter === 'all' || ITEMS[id].task === this.filter); },
    renderDash() {
      const el = this.dash;
      if (!el) return;
      el.innerHTML = '';
      const now = Date.now();
      const st = id => Store.get(id);
      const stats = GROUPS.map(g => {
        const ids = ORDER.filter(id => ITEMS[id].task === g);
        const m = ids.filter(id => st(id).b >= 4).length, l = ids.filter(id => st(id).b > 0 && st(id).b < 4).length;
        return { g, total: ids.length, m, l };
      });
      const all = ORDER.length, mastered = ORDER.filter(id => st(id).b >= 4).length;
      const pool = this.pool();
      const due = pool.filter(id => { const s = st(id); return s.b > 0 && s.due <= now; });
      const fresh = pool.filter(id => st(id).b === 0);
      const wrongs = pool.filter(id => { const s = st(id); return s.ng > 0 && s.b < 4; });
      const todayN = Store.data.days[today()] || 0;
      const filt = H('div', { class: 'seg' });
      [['all', '전체'], ['t1', '과제 1'], ['t2', '과제 2'], ['t3', '과제 3'], ['common', '공통 소자']].forEach(([k, l]) => filt.append(H('button', { class: this.filter === k ? 'on' : '', text: l, onclick: () => { this.filter = k; this.renderDash(); } })));
      const reviewIds = due.sort((a, b) => st(a).due - st(b).due).concat(fresh).slice(0, 20);
      el.append(H('div', { class: 'card-b' },
        H('div', { class: 'dash-top' },
          H('div', { class: 'dash-kpis' },
            H('div', { class: 'kpi' }, H('div', { class: 'k', text: '암기 완료' }), H('div', { class: 'v', text: `${mastered} / ${all}` })),
            H('div', { class: 'kpi' }, H('div', { class: 'k', text: '오늘 푼 문제' }), H('div', { class: 'v', text: String(todayN) })),
            H('div', { class: 'kpi' }, H('div', { class: 'k', text: '연속 학습' }), H('div', { class: 'v', text: Store.streak() + '일 🔥' })),
            H('div', { class: 'kpi' }, H('div', { class: 'k', text: '지금 복습할 것' }), H('div', { class: 'v warn', text: String(due.length) }))),
          H('div', { class: 'dash-bars' }, stats.map(s => H('div', { class: 'dbar' },
            H('div', { class: 'dbar-l' }, H('b', { text: TASK_LABEL[s.g] }), H('span', { class: 'muted small', text: ` ${s.m}/${s.total} 암기` })),
            H('div', { class: 'dbar-t' }, H('div', { class: 'm', style: `width:${s.m / s.total * 100}%` }), H('div', { class: 'l', style: `width:${s.l / s.total * 100}%` })))))),
        H('div', { class: 'dash-actions' },
          H('span', { class: 'small muted', text: '범위' }), filt,
          H('button', { class: 'btn primary', text: `🔁 복습 시작 (${reviewIds.length}문제)`, disabled: reviewIds.length ? null : 'disabled', onclick: () => this.startSession(reviewIds, '간격 반복 복습', 'review') }),
          H('button', { class: 'btn', text: `❌ 오답만 (${wrongs.length})`, disabled: wrongs.length ? null : 'disabled', onclick: () => this.startSession(shuffle(wrongs).slice(0, 25), '오답만 다시', 'review') }),
          H('button', { class: 'btn', text: '📝 모의고사 15문제', onclick: () => this.startSession(this.examSet(), '모의고사', 'exam') }),
          H('button', { class: 'btn ghost', text: '기록 초기화', onclick: () => { if (confirm('암기 기록을 모두 지울까요?')) { Store.reset(); this.renderDash(); } } })),
        H('div', { class: 'small muted', style: 'margin-top:6px', html: '<span class="lg-m"></span> 암기 완료(4번 이상 시간 간격을 두고 맞힘) <span class="lg-l"></span> 학습 중 · 맞히면 1분 → 10분 → 1시간 → 1일 → 3일 뒤에 다시 나와요.' })));
    },
    examSet() {
      const pool = this.pool();
      const by = t => shuffle(pool.filter(id => ITEMS[id].type === t));
      const pick = [...by('name').slice(0, 3), ...by('lad').slice(0, 4), ...by('cloze').slice(0, 6), ...by('seq').slice(0, 2)];
      return shuffle(pick.length >= 5 ? pick : shuffle(pool).slice(0, 15));
    },
    startSession(ids, title, mode) {
      if (!ids.length) return;
      this.mode = 'session';
      [...this.tabs.children].forEach(b => b.classList.remove('on'));
      this.opts.innerHTML = '';
      runSession(this.host, ids, { mode, title, level: 1, onEnd: () => { this.mode = 'dia'; this.renderMode(); this.renderDash(); } });
      this.host.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    renderMode() {
      if (!this.built) return;
      [...this.tabs.children].forEach(b => b.classList.toggle('on', b.dataset.k === this.mode));
      const o = this.opts;
      o.innerHTML = '';
      const seg = (items, cur, set) => { const s = H('div', { class: 'seg' }); items.forEach(([k, l]) => s.append(H('button', { class: k === cur ? 'on' : '', text: l, onclick: () => { set(k); this.renderMode(); } }))); return s; };
      const deckSel = () => {
        const sel = H('select', { class: 'sel' });
        DECKS.forEach(d => { const op = H('option', { value: d.id, text: d.title }); if (d.id === this.deck) op.selected = true; sel.append(op); });
        sel.addEventListener('change', () => { this.deck = sel.value; this.renderMode(); });
        return sel;
      };
      const taskSeg = () => seg([['t1', '과제 1'], ['t2', '과제 2'], ['t3', '과제 3']], this.task, v => { this.task = v; });
      if (this.mode === 'dia') {
        o.append(taskSeg(), seg([['hyd', '💧 유압 회로도'], ['lad', '⚡ 전기 회로도']], this.diaKind, v => { this.diaKind = v; }));
        diagramPractice(this.host, this.task, this.diaKind);
      } else if (this.mode === 'cloze') {
        o.append(deckSel(), seg([[1, '1단계: 핵심어'], [2, '2단계: 더 많이']], this.level, v => { this.level = v; }),
          H('label', { class: 'chk' }, Object.assign(H('input', { type: 'checkbox' }), { checked: this.shuffled, onchange: e => { this.shuffled = e.target.checked; this.renderMode(); } }), '순서 섞기'));
        clozePractice(this.host, this.deck, this.level, this.shuffled);
      } else if (this.mode === 'type') {
        o.append(deckSel());
        const dk = DECKS.find(d => d.id === this.deck);
        const firstTodo = dk.items.findIndex((x, i) => Store.typingLevel(`${dk.id}:${i}`) < 3);
        o.append(H('span', { class: 'small muted', text: `이 덱 완전 암기 ${dk.items.filter((x, i) => Store.typingLevel(`${dk.id}:${i}`) >= 3).length} / ${dk.items.length} 문장` }));
        typingPractice(this.host, this.deck, firstTodo < 0 ? 0 : firstTodo, 1);
      } else if (this.mode === 'seq') {
        const sel = H('select', { class: 'sel' });
        SEQS.forEach(s => { const op = H('option', { value: s.id, text: s.title }); if (s.id === this.seq) op.selected = true; sel.append(op); });
        sel.addEventListener('change', () => { this.seq = sel.value; this.renderMode(); });
        o.append(sel);
        seqPractice(this.host, this.seq);
      } else if (this.mode === 'wrong') {
        wrongNote(this.host, (ids, t) => this.startSession(ids, t, 'review'));
      }
    },
  };

  window.Study = Study;
  window.StudyUtil = { norm, matchKeys, matchExact, chosung, parseCloze, diff, ITEMS, ORDER, buildItems, Store };
})();
