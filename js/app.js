/* =====================================================================
   RENDER: pinta las 6 páginas siguiendo el diseño (formatos, tamaños,
   distribuciones y textos del tablero de diseño).
   ===================================================================== */
(function () {
  const CFG = window.RETO_CONFIG || {};
  const A = CFG.ASSETS || 'assets';
  let DB = null;

  /* ---------------- utilidades ---------------- */
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sept', 'Oct', 'Nov', 'Dic'];
  const pad = n => String(n).padStart(2, '0');
  const fmtDay = d => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const fmtDate = (d, hasTime) => hasTime ? `${fmtDay(d)} · ${pad(d.getHours())}:${pad(d.getMinutes())}` : fmtDay(d);
  const pretty = p => String(p || '').split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('-');
  const monName = m => m.nick || pretty(m.poke);
  const T = sig => DB.teams[sig] || { sig, name: sig, short: sig, coach: sig, color: '#9296AD', logo: '', about: [], hall: [] };
  const coaches = sigs => sigs.map(s => T(s).coach).join(' & ');
  const jLabel = j => j === 1 ? 'Singles Gen7' : 'VGC Dobles Gen7';
  const pillLabel = j => j === 1 ? 'Singles Gen7' : 'VGC Gen7';
  const hexA = (hex, a) => { const v = String(hex).replace('#', ''); if (v.length < 6) return `rgba(146,150,173,${a})`; return `rgba(${parseInt(v.substr(0, 2), 16)},${parseInt(v.substr(2, 2), 16)},${parseInt(v.substr(4, 2), 16)},${a})`; };
  const onErr = `onerror="this.style.visibility='hidden'"`;

  const sprite = p => p ? `${A}/${DB.pokeFolder[p] || (p.includes('-mega') ? 'megas' : 'pokemon')}/${p}.png` : '';
  const itemImg = i => i ? `${A}/${DB.itemFolder[i] || 'items/hold-items'}/${i}.png` : '';
  const logoSrc = sig => { const t = DB.teams[sig]; return t && t.logo ? `${A}/equipos/${t.logo}` : ''; };
  const logo = (sig, size, extra = '') => `<img class="avatar" src="${logoSrc(sig)}" ${onErr} style="width: ${size}px; height: ${size}px; flex-shrink: 0; ${extra}">`;

  /* ---------------- insignias (SVG exactos del diseño) ---------------- */
  const BADGE = {
    mvp: { grad: 'gGold', icon: '<path d="M20 8.5 L22.1 13.2 L27.2 13.7 L23.4 17.1 L24.5 22.1 L20 19.5 L15.5 22.1 L16.6 17.1 L12.8 13.7 L17.9 13.2 Z" fill="#12131C"/>', name: 'MVP', sub: 'Pokémon más valioso' },
    asist: { grad: 'gBlue', icon: '<circle cx="16.5" cy="15" r="5.2" fill="none" stroke="#12131C" stroke-width="2.4"/><circle cx="23.5" cy="15" r="5.2" fill="none" stroke="#12131C" stroke-width="2.4"/>', name: 'Máximo asistente', sub: 'Mejor apoyo a su equipo' },
    dpoy: { grad: 'gTeal', icon: '<path d="M20 7.5 L26 10 L26 15.5 C26 20.5 23 23.7 20 25.2 C17 23.7 14 20.5 14 15.5 L14 10 Z" fill="#12131C"/>', name: 'DPOY', sub: 'Pokémon más defensivo' },
    sexto: { grad: 'gViolet', icon: '<path d="M20 8 L22.3 13.7 L28 15 L22.3 16.3 L20 22 L17.7 16.3 L12 15 L17.7 13.7 Z" fill="#12131C"/>', name: '6th Pokémon', sub: 'Pokémon revelación' },
    first: { grad: 'gRed', icon: '<text x="20" y="20.5" text-anchor="middle" font-family="\'Space Grotesk\', sans-serif" font-size="15" font-weight="700" fill="#12131C">1</text>', name: 'ALL-GBA 1st Team' },
    second: { grad: 'gViolet', icon: '<text x="20" y="20.5" text-anchor="middle" font-family="\'Space Grotesk\', sans-serif" font-size="15" font-weight="700" fill="#12131C">2</text>', name: 'ALL-GBA 2nd Team' }
  };
  function badge(type, size = 34, stacked = false, style = '') {
    const b = BADGE[type];
    const stroke = stacked ? 'stroke="#1B1D2B" stroke-width="2"' : 'stroke="rgba(255,255,255,0.35)" stroke-width="1"';
    return `<svg width="${size}" height="${size}" viewBox="0 0 40 34" style="flex-shrink: 0; ${style}"><path d="M13 26 L20 22 L27 26 L25 33 L20 29 L15 33 Z" fill="url(#${b.grad})"/><circle cx="20" cy="15" r="13" fill="url(#${b.grad})" ${stroke}/>${b.icon}</svg>`;
  }

  /* ---------------- navegación (hash) ---------------- */
  const state = { tab: 'inicio', team: null, clasJ: 1, jor: null, enf: null, combat: null, sideExpanded: false, ins: 'Total', killMode: 'tot', rules: 'Nuzlocke', galOpen: true, medOpen: false, secondOpen: true, spoiler: true, lastReveal: false, revealed: new Set() };

  function route() {
    const [tab, arg] = (location.hash.replace('#', '') || 'inicio').split('/');
    state.tab = ['inicio', 'equipos', 'clasificacion', 'jornadas', 'insignias', 'historia'].includes(tab) ? tab : 'inicio';
    if (state.tab === 'equipos' && arg && DB.teams[arg]) { if (state.team !== arg) state.medOpen = false; state.team = arg; }
    if (state.tab === 'jornadas' && arg && DB.enfById[arg]) {
      const e = DB.enfById[arg];
      if (state.enf !== arg) state.combat = null;
      state.jor = e.j; state.enf = arg;
      if (DB.jornadas[e.j - 1].enfs.indexOf(e) >= 2) state.sideExpanded = true;
    }
    render();
    window.scrollTo(0, 0);
  }
  window.go = (hash) => { if (location.hash === '#' + hash) route(); else location.hash = hash; };

  function render() {
    document.querySelectorAll('.mainnav a').forEach(a => a.classList.toggle('active', a.dataset.tab === state.tab));
    const app = document.getElementById('app');
    const fn = { inicio: renderInicio, equipos: renderEquipos, clasificacion: renderClasif, jornadas: renderJornadas, insignias: renderInsignias, historia: renderHistoria }[state.tab];
    app.innerHTML = fn();
    if (state.tab === 'inicio') startCountdown();
  }

  /* =====================================================================
     1 · INICIO
     ===================================================================== */
  let cdTimer = null;
  function nextEnf() {
    const pend = DB.enfs.filter(e => e.state !== 'jugado');
    const dated = pend.filter(e => e.date).sort((a, b) => a.date - b.date);
    return dated[0] || pend[0] || null;
  }
  function lastEnf() {
    const done = DB.enfs.filter(e => e.state === 'jugado');
    if (!done.length) return null;
    return done.slice().sort((a, b) => ((a.date ? +a.date : 0) - (b.date ? +b.date : 0)) || (DB.enfs.indexOf(a) - DB.enfs.indexOf(b))).pop();
  }
  function heroSide(sigs, right) {
    const logos = sigs.map((s, i) => logo(s, 56, `border: 3px solid ${T(s).color};${i > 0 ? ' margin-left: -18px;' : ''}`)).join('');
    const name = sigs.length > 1 ? esc(coaches(sigs)) : esc(T(sigs[0]).name);
    const h1 = `<h1 style="margin: 0; font-family: 'Space Grotesk', sans-serif; font-size: 32px; font-weight: 700; line-height: 1.1;">${name}</h1>`;
    return `<div style="display: flex; align-items: center; gap: 14px;">${right ? h1 + `<div style="display: flex;">${logos}</div>` : `<div style="display: flex;">${logos}</div>` + h1}</div>`;
  }
  function renderInicio() {
    const nx = nextEnf();
    const box = (id, lab) => `<div style="background: #1B1D2B; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px 26px; text-align: center; min-width: 88px;"><div id="${id}" style="font-family: 'Space Grotesk', sans-serif; font-size: 30px; font-weight: 700;">--</div><div style="font-size: 11px; color: #9296AD; letter-spacing: 1px;">${lab}</div></div>`;
    let hero;
    if (nx) {
      hero = `
      <div style="font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: #F5B700; font-weight: 600;">Próximo enfrentamiento · Jornada ${nx.j} · ${jLabel(nx.j)}</div>
      <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
        ${heroSide(nx.local, false)}
        <div style="font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; color: #4A4E63;">VS</div>
        ${heroSide(nx.visit, true)}
      </div>
      <div style="display: flex; align-items: center; gap: 8px; font-size: 18px; color: #F5B700; font-weight: 700; letter-spacing: 0.3px;">
        <span>📅</span><span>${nx.date ? fmtDate(nx.date, nx.hasTime) : 'Fecha por confirmar'}${nx.state === 'curso' ? ' · en curso' : ''}</span>
      </div>
      <div style="display: flex; gap: 14px; margin-top: 8px;" data-target="${nx.date ? +nx.date : ''}" id="countdown">
        ${box('cd-d', 'DÍAS')}${box('cd-h', 'HORAS')}${box('cd-m', 'MIN')}
      </div>`;
    } else {
      const champ = DB.ranking[0];
      hero = `
      <div style="font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: #F5B700; font-weight: 600;">Reto finalizado</div>
      <div style="display: flex; align-items: center; gap: 14px;">${logo(champ.sig, 56, `border: 3px solid ${T(champ.sig).color};`)}<h1 style="margin: 0; font-family: 'Space Grotesk', sans-serif; font-size: 32px; font-weight: 700; line-height: 1.1;">${esc(T(champ.sig).name)}</h1></div>
      <div style="font-size: 18px; color: #F5B700; font-weight: 700;">🏆 Campeón con ${champ.pts} pts</div>`;
    }

    // Clasificación (mini)
    const stand = DB.ranking.map((s, i) => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0; ${i < DB.ranking.length - 1 ? 'border-bottom: 1px solid rgba(255,255,255,0.06);' : ''}">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; color: #9296AD; width: 16px;">${s.pos}</div>
          ${logo(s.sig, 28, `border: 2px solid ${T(s.sig).color};`)}
          <div style="font-weight: 600; font-size: 13px;">${esc(T(s.sig).name)}</div>
        </div>
        <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 14px;">${s.pts} pts</div>
      </div>`).join('');

    // Último resultado
    const le = lastEnf();
    let last;
    if (le) {
      const side = (sigs) => `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100px;">
          <div style="display: flex;">${sigs.map((s, i) => logo(s, 48, `border: 2px solid ${T(s).color};${i > 0 ? ' margin-left: -14px;' : ''}`)).join('')}</div>
          <div style="font-size: 12px; font-weight: 600; text-align: center;">${sigs.length > 1 ? esc(sigs.map(s => T(s).short).join(' & ')) : esc(T(sigs[0]).name)}</div>
          <div style="font-size: 11px; color: #9296AD;">${esc(coaches(sigs))}</div>
        </div>`;
      const rep = le.replays.some(Boolean) ? ' · repetición disponible' : '';
      last = `
        <div style="font-size: 12px; color: #9296AD; letter-spacing: 1px; text-transform: uppercase;">Jornada ${le.j} · ${jLabel(le.j)}${le.date ? ' · ' + fmtDay(le.date) : ''}</div>
        <div style="display: flex; align-items: center; justify-content: center; gap: 16px; padding: 12px 0;">
          ${side(le.local)}
          ${state.lastReveal
            ? `<div style="font-family: 'Space Grotesk', sans-serif; font-size: 28px; font-weight: 700;">${le.w.Local}–${le.w.Visitante}</div>`
            : `<div title="Resultado oculto" style="font-family: 'Space Grotesk', sans-serif; font-size: 28px; font-weight: 700; color: #4A4E63;">?–?</div>`}
          ${side(le.visit)}
        </div>
        ${state.lastReveal
          ? `<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;"><div style="font-size: 13px; color: #9296AD;">${rep ? '▶ repetición disponible' : ''}</div><a onclick="toggleLast()" style="font-size: 12px; font-weight: 600; color: #9296AD;">🙈 Ocultar</a></div>`
          : `<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;"><div style="font-size: 13px; color: #9296AD;">🔒 Resultado oculto</div><div onclick="toggleLast()" class="clickable" style="padding: 7px 14px; border-radius: 20px; background: rgba(245,183,0,0.12); border: 1px solid #F5B700; color: #F5B700; font-size: 12px; font-weight: 700; white-space: nowrap;">👀 Ver resultado</div></div>`}
        <a onclick="go('jornadas/${le.id}')" style="font-size: 13px; font-weight: 600;">Ver detalle →</a>`;
    } else {
      last = `<div style="flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 13px; color: #9296AD;">Aún no hay ningún enfrentamiento terminado</div>`;
    }

    // Calendario
    const cal = DB.jornadas.map(J => {
      const color = (J.hasData || J.hasDate) ? '#F5B700' : '#9296AD';
      const rows = J.enfs.map(e => calRow(e)).join('');
      return `<div style="display: flex; flex-direction: column; gap: 2px;">
        <div style="font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: ${color}; font-weight: 700; margin-bottom: 6px;">Jornada ${J.j} · ${jLabel(J.j)}</div>
        ${rows}
      </div>`;
    }).join('');

    return `
    <div style="padding: 36px 64px 24px; display: flex; flex-direction: column; gap: 14px;">${hero}</div>
    <div style="padding: 0 64px 44px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: 550px; gap: 24px;">
      <div class="card" style="padding: 22px; display: flex; flex-direction: column; gap: 12px;">
        <div style="font-family: 'Space Grotesk', sans-serif; font-size: 17px; font-weight: 700;">Clasificación</div>
        ${stand}
        <a onclick="go('clasificacion')" style="font-size: 13px; font-weight: 600; margin-top: 2px;">Ver clasificación completa →</a>
      </div>
      <div class="card" style="padding: 22px; display: flex; flex-direction: column; gap: 14px;">
        <div style="font-family: 'Space Grotesk', sans-serif; font-size: 17px; font-weight: 700;">Último resultado</div>
        ${last}
      </div>
      <div class="card" style="padding: 22px; display: flex; flex-direction: column; gap: 12px; min-height: 0;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="font-family: 'Space Grotesk', sans-serif; font-size: 17px; font-weight: 700;">Calendario de jornadas</div>
          <a onclick="go('jornadas')" style="font-size: 12px; font-weight: 600;">Ver todo →</a>
        </div>
        <div class="cal-scroll" style="flex: 1; min-height: 0; overflow-y: auto; padding-right: 6px; display: flex; flex-direction: column; gap: 16px;">${cal}</div>
      </div>
    </div>`;
  }
  window.toggleLast = () => { state.lastReveal = !state.lastReveal; render(); };
  function calStatus(e) {
    if (e.state === 'jugado') return { txt: '✓ ' + (e.date ? fmtDate(e.date, e.hasTime) : 'Jugado'), color: '#9296AD', w: 600 };
    if (e.state === 'curso') return { txt: 'En curso', color: '#F5B700', w: 600 };
    if (e.date) return { txt: fmtDate(e.date, e.hasTime), color: '#F5B700', w: 600 };
    return { txt: 'Fecha por confirmar', color: '#4A4E63', w: 400 };
  }
  function calRow(e) {
    const st = calStatus(e);
    const stHtml = `<span style="font-size: 11px; color: ${st.color}; ${st.w === 600 ? 'font-weight: 600;' : ''} flex-shrink: 0;">${st.txt}</span>`;
    if (e.duo) {
      const pair = sigs => `<div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600;">${logo(sigs[0], 16)}${logo(sigs[1], 16, 'margin-left: -6px;')}<span>${esc(sigs.join(' & '))}</span></div>`;
      return `<a onclick="go('jornadas/${e.id}')" style="display: flex; flex-direction: column; gap: 4px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); text-decoration: none; color: inherit;">
        ${pair(e.local)}
        <div style="display: flex; align-items: center;"><div style="width: 60px; flex-shrink: 0;"></div><div style="font-size: 10px; color: #9296AD; font-weight: 600;">VS</div><div style="flex: 1; display: flex; justify-content: flex-end;">${stHtml}</div></div>
        ${pair(e.visit)}
      </a>`;
    }
    const a = e.local[0], b = e.visit[0];
    return `<a onclick="go('jornadas/${e.id}')" style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06); text-decoration: none; color: inherit;">
      <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600;">${logo(a, 18)}<span>${esc(a)} <span style="color: #9296AD; font-weight: 400;">vs</span> ${esc(b)}</span>${logo(b, 18)}</div>
      ${stHtml.replace('<span', '<div').replace('</span>', '</div>')}
    </a>`;
  }
  function startCountdown() {
    clearInterval(cdTimer);
    const el = document.getElementById('countdown'); if (!el) return;
    const target = +el.dataset.target;
    const tick = () => {
      const d = document.getElementById('cd-d'); if (!d) { clearInterval(cdTimer); return; }
      if (!target) { ['cd-d', 'cd-h', 'cd-m'].forEach(i => { document.getElementById(i).textContent = '--'; }); return; }
      let ms = Math.max(0, target - Date.now());
      const days = Math.floor(ms / 864e5); ms -= days * 864e5;
      const hrs = Math.floor(ms / 36e5); ms -= hrs * 36e5;
      const mins = Math.floor(ms / 6e4);
      d.textContent = pad(days); document.getElementById('cd-h').textContent = pad(hrs); document.getElementById('cd-m').textContent = pad(mins);
    };
    tick(); cdTimer = setInterval(tick, 20000);
  }

  /* =====================================================================
     2 · EQUIPOS
     ===================================================================== */
  function renderEquipos() {
    const sel = state.team || DB.teamOrder[0];
    const cards = DB.teamOrder.map(sig => {
      const t = T(sig); const s = DB.stand[sig]; const on = sig === sel;
      return `<div onclick="go('equipos/${sig}')" class="clickable" style="background: #1B1D2B; border: 1px solid ${on ? t.color : 'rgba(255,255,255,0.08)'}; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 10px;">
        ${logo(sig, 76)}
        <div style="font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 700; text-align: center; line-height: 1.2;">${esc(t.name)}</div>
        <div style="font-size: 12px; color: #9296AD;">Entrenador: ${esc(t.coach)}</div>
        <div style="font-size: 12px; ${on ? `background: ${hexA(t.color, 0.14)}; color: ${t.color};` : 'background: rgba(255,255,255,0.06); color: #9296AD;'} padding: 4px 10px; border-radius: 20px; font-weight: 600;">${s.pos}º · ${s.pts} pts</div>
      </div>`;
    }).join('');
    return `
    <div class="pagehead"><h1>Equipos</h1><div class="pagesub">Toca un equipo para ver su ficha completa</div></div>
    <div style="padding: 24px 64px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px;">${cards}</div>
    ${ficha(sel)}`;
  }
  function ficha(sig) {
    const t = T(sig); const s = DB.stand[sig];
    const about = t.about.map(p => /^["«“]/.test(p) ? `<div style="font-style: italic; color: #F4F1EA;">${esc(p)}</div>` : `<div>${esc(p)}</div>`).join('');
    const hallList = t.hall.length ? t.hall : Array.from({ length: 6 }, () => null);
    const hall = hallList.map(h => !h ? `
      <div style="aspect-ratio: 1; background: #232640; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #4A4E63;">?</div>` : `
      <div style="aspect-ratio: 1; background: #232640; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 6px 4px;">
        <img src="${sprite(h.poke)}" ${onErr} style="width: 64px; height: 64px; object-fit: contain;">
        <div style="font-size: 11px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;" title="${esc(pretty(h.poke))}">${esc(pretty(h.poke))}</div>
        <div style="font-size: 9px; color: #9296AD;">${esc(h.nick)}</div>
      </div>`).join('');
    const has = s.played > 0;
    const bal = (lab, v) => `<div style="display: flex; justify-content: space-between; font-size: 14px;"><span style="color: #9296AD;">${lab}</span><span style="font-weight: 600;">${has ? v : '—'}</span></div>`;
    return `
    <div style="margin: 0 64px 40px; background: #1B1D2B; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 32px; display: flex; gap: 32px;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; width: 180px; flex-shrink: 0;">
        ${logo(sig, 130, `border: 3px solid ${t.color};`)}
        <div style="font-family: 'Space Grotesk', sans-serif; font-size: 19px; font-weight: 700; text-align: center;">${esc(t.name)}</div>
        <div style="font-size: 13px; color: #9296AD; text-align: center;">Entrenador: ${esc(t.coach)}</div>
      </div>
      <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 20px;">
        <div>
          <div style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: #F5B700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">Sobre el equipo</div>
          <div style="font-size: 14px; line-height: 1.6; color: #D8D9E3; display: flex; flex-direction: column; gap: 10px;">${about}</div>
        </div>
        <div>
          <div style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: #F5B700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px;">Hall de la Fama</div>
          <div style="font-size: 11px; color: #9296AD; margin-bottom: 10px;">Los 6 pokémon más legendarios del equipo</div>
          <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px;">${hall}</div>
        </div>
        ${medallas(sig)}
      </div>
      <div style="width: 220px; flex-shrink: 0; display: flex; flex-direction: column; gap: 14px;">
        <div style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: #F5B700; letter-spacing: 1px; text-transform: uppercase;">Balance</div>
        ${bal('Enfrentamientos ganados', s.ewon)}${bal('Enfrentamientos perdidos', s.elost)}${bal('Combates ganados', s.won)}${bal('Combates perdidos', s.lost)}${bal('KOs a favor', s.made)}${bal('KOs en contra', s.recv)}
      </div>
    </div>`;
  }
  const ORDER_T = ['mvp', 'asist', 'dpoy', 'sexto', 'first', 'second'];
  function medalIcons(list, label) {
    // list: [{type, count}]
    return list.map(m => {
      let stack = '';
      for (let i = 0; i < m.count; i++) stack += badge(m.type, 30, i > 0, i > 0 ? 'margin-left: -14px;' : '');
      return `<div title="${esc(m.title)}" style="${m.count > 1 ? 'display: flex; align-items: center;' : ''}">${stack}</div>`;
    }).join('');
  }
  function medallas(sig) {
    const aw = DB.awards.filter(a => a.team === sig && a.j !== 'T');
    const byType = arr => ORDER_T.map(type => ({ type, count: arr.filter(a => a.type === type).length })).filter(x => x.count);
    const titled = (list, j) => list.map(m => ({ ...m, title: m.type === 'first' || m.type === 'second' ? `${m.count} pokémon en el ${BADGE[m.type].name}${j ? ' de la Jornada ' + j : ''}` : (m.count > 1 ? `${BADGE[m.type].name} × ${m.count}` : `${BADGE[m.type].name}${j ? ' de la Jornada ' + j : ''}`) }));
    const rows = [1, 2, 3, 4].map(j => {
      const list = byType(aw.filter(a => a.j === j));
      if (!list.length) return `<div style="display: flex; align-items: center; gap: 16px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); opacity: 0.5;"><div style="width: 90px; flex-shrink: 0; font-size: 12px; color: #9296AD; font-weight: 600;">Jornada ${j}</div><div style="font-size: 12px; color: #4A4E63;">Sin insignias todavía</div></div>`;
      return `<div style="display: flex; align-items: center; gap: 16px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06);"><div style="width: 90px; flex-shrink: 0; font-size: 12px; color: #9296AD; font-weight: 600;">Jornada ${j}</div><div style="display: flex; align-items: center; gap: 18px; flex: 1;">${medalIcons(titled(list, j))}</div></div>`;
    }).join('');
    const tot = byType(aw);
    const totalRow = `<div style="display: flex; align-items: center; gap: 16px; padding: 10px 0 0;"><div style="width: 90px; flex-shrink: 0; font-size: 12px; color: #F5B700; font-weight: 700;">Total</div><div style="display: flex; align-items: center; gap: 18px; flex: 1;">${tot.length ? medalIcons(titled(tot)) : '<div style="font-size: 12px; color: #4A4E63;">Sin insignias todavía</div>'}</div></div>`;
    const n = aw.length;
    const open = state.medOpen;
    const sub = open ? (n ? `${n} insignias ganadas — una insignia por cada premio que gana un pokémon del equipo esa jornada` : 'Una insignia por cada premio que gana un pokémon del equipo esa jornada')
      : (n ? `${n} insignias ganadas — toca para desplegar` : 'Toca para ver las insignias ganadas por jornada');
    return `<div style="background: #1B1D2B; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: ${open ? 16 : 0}px;">
      <div onclick="toggleMed()" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
        <div style="font-size: 12px; color: ${open ? '#F5B700' : '#4A4E63'}; font-weight: 700;">${open ? '▾' : '▸'}</div>
        <div style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: #F5B700; letter-spacing: 1px; text-transform: uppercase; white-space: nowrap;">Medallas de entrenador</div>
        <div style="font-size: 11px; color: #9296AD;">${sub}</div>
      </div>
      ${open ? `<div style="display: flex; flex-direction: column; gap: 10px;">${rows}${totalRow}</div>` : ''}
    </div>`;
  }
  window.toggleMed = () => { state.medOpen = !state.medOpen; render(); };

  /* =====================================================================
     3 · CLASIFICACIÓN
     ===================================================================== */
  function renderClasif() {
    const J = state.clasJ;
    const cols = 'grid-template-columns: 60px 2fr 1fr 1fr 1fr 1fr 1fr;';
    const head = [1, 2, 3, 4].map(j => j === J
      ? `<div onclick="setClasJ(${j})" class="clickable" style="text-align: center; display: flex; align-items: center; justify-content: center; gap: 4px; color: #F5B700; background: rgba(245,183,0,0.12); border-radius: 6px; padding: 4px 0;">J${j} <span style="font-size: 9px;">▾</span></div>`
      : `<div onclick="setClasJ(${j})" class="clickable" style="text-align: center; display: flex; align-items: center; justify-content: center; gap: 4px;">J${j} <span style="font-size: 9px; color: #4A4E63;">▸</span></div>`).join('');
    const rows = DB.ranking.map((s, i) => {
      const cells = [1, 2, 3, 4].map(j => {
        const bj = s.byJ[j];
        if (!DB.jornadas[j - 1].hasData) return `<div style="text-align: center; font-size: 14px; color: #4A4E63;">—</div>`;
        return `<div style="text-align: center; font-size: 14px;${j === J ? ' font-weight: 600;' : ''}">${bj ? bj.pts : 0}</div>`;
      }).join('');
      return `<div style="display: grid; ${cols} align-items: center; padding: 14px 24px; ${i < DB.ranking.length - 1 ? 'border-bottom: 1px solid rgba(255,255,255,0.06);' : ''} ${i === 0 ? 'background: rgba(245,183,0,0.06);' : ''}">
        <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; color: ${i === 0 ? '#F5B700' : '#9296AD'};">${s.pos}</div>
        <div style="display: flex; align-items: center; gap: 10px;">${logo(s.sig, 28)}<span style="font-weight: 600; font-size: 14px;">${esc(T(s.sig).name)}</span></div>
        ${cells}
        <div style="text-align: right; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 16px;">${s.pts}</div>
      </div>`;
    }).join('');
    return `
    <div class="pagehead"><h1>Clasificación general</h1><div class="pagesub">Puntos acumulados por jornada · toca J1, J2, J3 o J4 para ver el desglose de esa jornada</div></div>
    <div style="padding: 22px 64px 0;">
      <div class="card" style="overflow: hidden;">
        <div style="display: grid; ${cols} padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #9296AD; font-weight: 600; align-items: center;">
          <div>#</div><div>Equipo</div>${head}<div style="text-align: right;">Total</div>
        </div>
        ${rows}
      </div>
    </div>
    ${desglose(J)}`;
  }
  window.setClasJ = j => { state.clasJ = j; render(); };
  function desglose(j) {
    const J = DB.jornadas[j - 1];
    const top = Math.max(...DB.teamOrder.map(s => (DB.stand[s].byJ[j] || {}).pts || 0));
    const cards = DB.teamOrder.map(sig => {
      const t = T(sig); const bj = DB.stand[sig].byJ[j] || { pts: 0, made: 0, recv: 0 };
      const mine = J.enfs.filter(e => e.local.includes(sig) || e.visit.includes(sig));
      // Cada enfrentamiento del equipo, en orden de calendario: local a la izquierda, visitante a la derecha (siglas + logos)
      const sideHtml = (sigs, right) => `<div style="display: flex; flex-direction: column; gap: 3px; ${right ? 'align-items: flex-end;' : 'align-items: flex-start;'}">${sigs.map(x => {
        const nm = `<span style="${x === sig ? 'color: #F4F1EA; font-weight: 700;' : 'color: #9296AD; font-weight: 600;'}">${esc(x)}</span>`;
        return `<div style="display: flex; align-items: center; gap: 5px; font-size: 11px; white-space: nowrap;">${right ? nm + logo(x, 14) : logo(x, 14) + nm}</div>`;
      }).join('')}</div>`;
      const items = mine.map(e => {
        const me = e.local.includes(sig) ? 'Local' : 'Visitante'; const op = me === 'Local' ? 'Visitante' : 'Local';
        const done = e.state === 'jugado'; const won = done && e.winner === me;
        const has = e.hasData;
        const c = !has ? '#9296AD' : !done ? '#F5B700' : won ? '#4CC9F0' : '#E63946';
        const center = has
          ? `<div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 12px; color: ${c}; text-align: center;">${e.w.Local}–${e.w.Visitante}</div>`
          : `<div style="font-size: 10px; color: #4A4E63; font-weight: 600; text-align: center;">vs</div>`;
        const status = !has ? 'pendiente' : !done ? 'en curso' : `+${e.pts[me]} pts`;
        const combates = e.combats.filter(cb => cb.winner).map(cb => `<div style="display: flex; justify-content: space-between; font-size: 10px; color: #9296AD;"><span>Combate ${cb.n}</span><span style="color: #D8D9E3;">${cb.kos.Local}–${cb.kos.Visitante}</span></div>`).join('');
        const box = has
          ? `background: ${hexA(c, 0.06)}; border-left: 3px solid ${c};`
          : 'background: #232640; opacity: 0.55;';
        return `<a onclick="go('jornadas/${e.id}')" style="display: block; text-decoration: none; color: inherit; ${box} border-radius: 6px; padding: 8px 10px; cursor: pointer;">
          <div style="display: grid; grid-template-columns: minmax(0, 1fr) 36px minmax(0, 1fr); align-items: center; gap: 4px;">${sideHtml(e.local, false)}${center}${sideHtml(e.visit, true)}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px; font-size: 10px;">
            <span style="color: #9296AD;">Enfrentamiento ${e.n}${e.duo ? ' · 2vs2' : ''}</span>
            <span style="color: ${has ? c : '#9296AD'}; font-weight: ${has ? 700 : 400};">${status}${has ? ' ↗' : ''}</span>
          </div>
          ${combates ? `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; gap: 2px;">${combates}</div>` : ''}
        </a>`;
      }).join('');
      const dif = bj.made - bj.recv;
      const dc = dif > 0 ? '#4CC9F0' : dif < 0 ? '#E63946' : '#9296AD';
      const lead = top > 0 && bj.pts === top;
      return `<div style="background: #1B1D2B; border: 1px solid ${lead ? '#F5B700' : 'rgba(255,255,255,0.08)'}; border-radius: 14px; padding: 16px; display: flex; flex-direction: column;">
        <div style="display: flex; align-items: center; gap: 8px; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08);">${logo(sig, 26)}<div style="font-size: 13px; font-weight: 700;">${esc(t.name)}</div></div>
        <div style="display: flex; flex-direction: column; gap: 10px; flex: 1;">${items}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08);">
          <div style="font-size: 11px; color: #9296AD; text-transform: uppercase; letter-spacing: 0.5px;">Total Jornada ${j}</div>
          <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 18px;${lead ? ' color: #F5B700;' : ''}">${bj.pts} pts</div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
          <div style="font-size: 11px; color: #9296AD; text-transform: uppercase; letter-spacing: 0.5px;">Diferencial KOs</div>
          <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; color: ${dc};">${dif > 0 ? '+' + dif : dif < 0 ? '−' + Math.abs(dif) : '0'}</div>
        </div>
        <div style="font-size: 10px; color: #9296AD; text-align: right; margin-top: 2px;">${bj.made} KOs hechos − ${bj.recv} recibidos</div>
      </div>`;
    }).join('');
    return `
    <div style="padding: 20px 64px 40px;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
        <div style="font-family: 'Space Grotesk', sans-serif; font-size: 17px; font-weight: 700;">Jornada ${j} — desglose por equipo</div>
        <div style="font-size: 11px; color: #9296AD; background: #1B1D2B; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 3px 10px;">${jLabel(j)} · Bo3</div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; align-items: stretch;">${cards}</div>
    </div>`;
  }

  /* =====================================================================
     4 · JORNADAS
     ===================================================================== */
  function defaultJornada() {
    const withData = DB.jornadas.filter(J => J.hasData);
    return withData.length ? withData[withData.length - 1].j : 1;
  }
  function renderJornadas() {
    if (!state.jor) state.jor = defaultJornada();
    const J = DB.jornadas[state.jor - 1];
    if (!state.enf || DB.enfById[state.enf].j !== J.j) {
      const withData = J.enfs.filter(e => e.hasData);
      state.enf = (withData.length ? withData[withData.length - 1] : J.enfs[0]).id;
      state.combat = null;
      state.sideExpanded = J.enfs.indexOf(DB.enfById[state.enf]) >= 2;
    }
    const pills = DB.jornadas.map(x => {
      const sel = x.j === J.j;
      const cls = sel ? (x.hasData ? 'pill sel' : 'pill sel-empty') : (x.hasData ? 'pill' : 'pill muted');
      return `<div class="${cls}" onclick="setJor(${x.j})">Jornada ${x.j} · ${pillLabel(x.j)}</div>`;
    }).join('');
    const headline = J.j === 1 ? `${J.enfs.length} enfrentamientos individuales · todos contra todos` : `${J.enfs.length} enfrentamientos · 1 enfrentamiento 2vs2 + ${J.enfs.length - 1} individuales`;
    const visible = state.sideExpanded ? J.enfs : J.enfs.slice(0, 2);
    const rest = J.enfs.length - visible.length;
    const restLabel = J.j === 1 || J.enfs.slice(visible.length).every(e => !e.duo) ? `+ ${rest} enfrentamientos individuales más de esta jornada` : `+ ${rest} enfrentamientos más de esta jornada`;
    const side = `
      <div style="width: 430px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px;">
        <div style="font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #9296AD; font-weight: 600; margin-bottom: 2px;">${headline}</div>
        ${visible.map(e => sideCard(e, J)).join('')}
        ${rest > 0 ? `<div onclick="expandSide()" class="clickable" style="background: #1B1D2B; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; opacity: ${J.hasData ? 0.5 : 0.4};"><div style="font-size: 13px; color: #9296AD;">${restLabel}</div></div>` : ''}
      </div>`;
    let panel;
    if (!J.hasData) {
      panel = `<div style="flex: 1; background: #1B1D2B; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 560px; text-align: center;">
        <div style="font-family: 'Space Grotesk', sans-serif; font-size: 28px; font-weight: 700; color: #4A4E63;">Sin información de combates</div>
        <div style="font-size: 13px; color: #9296AD; max-width: 380px;">En cuanto se apunte al menos 1 combate de esta jornada en el sheet, aquí se mostrará el detalle del enfrentamiento correspondiente</div>
      </div>`;
    } else panel = enfPanel(DB.enfById[state.enf]);
    return `
    <div class="pagehead"><h1>Jornadas</h1><div class="pagesub">Las 4 grandes jornadas del reto, enfrentamiento a enfrentamiento</div></div>
    <div class="pillrow" style="align-items: center;">${pills}<div style="margin-left: auto;">${spoilerToggle()}</div></div>
    <div style="padding: 22px 64px 40px; display: flex; gap: 28px; align-items: flex-start;">${side}${panel}</div>`;
  }
  // Botón antispoiler: activado por defecto en cada visita; oculta marcadores, combates y equipos pero deja navegar
  function spoilerToggle() {
    const on = state.spoiler;
    return `<div onclick="toggleSpoiler()" class="clickable" title="${on ? 'Resultados ocultos · toca para verlos' : 'Resultados visibles · toca para ocultarlos'}" style="display: flex; align-items: center; gap: 10px; padding: 7px 10px 7px 16px; border-radius: 20px; background: ${on ? 'rgba(245,183,0,0.12)' : '#1B1D2B'}; border: 1px solid ${on ? '#F5B700' : 'rgba(255,255,255,0.08)'}; user-select: none;">
      <span style="font-size: 13px;">${on ? '🙈' : '👀'}</span>
      <span style="font-size: 13px; font-weight: 700; color: ${on ? '#F5B700' : '#9296AD'};">Antispoiler</span>
      <span style="font-size: 11px; font-weight: 600; color: ${on ? '#F5B700' : '#4A4E63'}; width: 22px;">${on ? 'ON' : 'OFF'}</span>
      <span style="position: relative; width: 36px; height: 20px; border-radius: 10px; background: ${on ? '#F5B700' : '#4A4E63'}; flex-shrink: 0;">
        <span style="position: absolute; top: 2px; ${on ? 'right: 2px;' : 'left: 2px;'} width: 16px; height: 16px; border-radius: 50%; background: ${on ? '#12131C' : '#F4F1EA'};"></span>
      </span>
    </div>`;
  }
  window.toggleSpoiler = () => { state.spoiler = !state.spoiler; state.revealed.clear(); state.combat = null; render(); };
  // Antispoiler de cada enfrentamiento: solo cuenta si el general está activado
  const isHidden = e => state.spoiler && !state.revealed.has(e.id);
  window.toggleEnfSpoiler = id => { if (!state.spoiler) return; if (state.revealed.has(id)) state.revealed.delete(id); else state.revealed.add(id); state.combat = null; render(); };
  function enfToggle(e) {
    const disabled = !state.spoiler; const on = isHidden(e);
    const tip = disabled ? 'Sin efecto: el antispoiler general está desactivado' : (on ? 'Resultado oculto · toca para ver este enfrentamiento' : 'Resultado visible · toca para volver a ocultarlo');
    return `<div ${disabled ? '' : `onclick="toggleEnfSpoiler('${e.id}')"`} class="${disabled ? '' : 'clickable'}" title="${tip}" style="display: flex; align-items: center; gap: 8px; padding: 6px 8px 6px 12px; border-radius: 20px; background: ${on ? 'rgba(245,183,0,0.12)' : '#1B1D2B'}; border: 1px solid ${on ? '#F5B700' : 'rgba(255,255,255,0.08)'};${disabled ? ' opacity: 0.4;' : ''} user-select: none; white-space: nowrap;">
      <span style="font-size: 12px;">${on ? '🙈' : '👀'}</span>
      <span style="font-size: 12px; font-weight: 700; color: ${on ? '#F5B700' : '#9296AD'};">Antispoiler</span>
      <span style="font-size: 10px; font-weight: 600; color: ${on ? '#F5B700' : '#4A4E63'}; width: 20px;">${on ? 'ON' : 'OFF'}</span>
      <span style="position: relative; width: 30px; height: 16px; border-radius: 8px; background: ${on ? '#F5B700' : '#4A4E63'}; flex-shrink: 0;"><span style="position: absolute; top: 2px; ${on ? 'right: 2px' : 'left: 2px'}; width: 12px; height: 12px; border-radius: 50%; background: ${on ? '#12131C' : '#F4F1EA'};"></span></span>
    </div>`;
  }
  window.setJor = j => { state.jor = j; state.enf = null; state.combat = null; state.sideExpanded = false; render(); };
  window.expandSide = () => { state.sideExpanded = true; render(); };
  window.setEnf = id => { state.enf = id; state.combat = null; render(); };
  window.setCombat = n => { state.combat = n; render(); };
  /* ---------- Repeticiones de Showdown (1 por combate) ----------
     En el sheet (Jornadas → Replay combate N) se pone el NOMBRE del archivo .html descargado de Showdown,
     guardado en la carpeta replays/ del repo; o un enlace completo https://... */
  const replayUrl = v => /^https?:\/\//i.test(v) ? v : `replays/${encodeURIComponent(v.replace(/^\.?\/?replays\//i, ''))}`;
  function replayButton(e) {
    const reps = e.replays.map((u, i) => u ? { u: replayUrl(u), i: i + 1 } : null).filter(Boolean);
    const title = n => `Enfrentamiento ${e.n} · Combate ${n} · ${e.local.join(' & ')} vs ${e.visit.join(' & ')}`;
    if (reps.length === 1) return `<div class="replay-btn" onclick="openReplay('${esc(reps[0].u)}', '${esc(title(reps[0].i))}')">▶ Ver repetición</div>`;
    if (reps.length > 1) return `<div class="replay-wrap"><div class="replay-btn" onclick="toggleReplays(event)">▶ Ver repetición ▾</div><div class="replay-menu" id="replay-menu">${reps.map(r => `<a onclick="openReplay('${esc(r.u)}', '${esc(title(r.i))}')">▶ Combate ${r.i}</a>`).join('')}</div></div>`;
    return '';
  }
  window.openReplay = (url, title) => {
    closeReplay();
    const m = document.createElement('div');
    m.id = 'replay-modal';
    m.innerHTML = `<div class="replay-modal-box">
        <div class="replay-modal-head">
          <div style="font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 700;">▶ ${title}</div>
          <div style="display: flex; align-items: center; gap: 14px;">
            <a href="${url}" target="_blank" rel="noopener" style="font-size: 12px; font-weight: 600;">Abrir en pestaña nueva ↗</a>
            <div onclick="closeReplay()" class="clickable" title="Cerrar" style="width: 30px; height: 30px; border-radius: 50%; background: #232640; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #F4F1EA;">✕</div>
          </div>
        </div>
        <iframe src="${url}" title="Repetición" style="flex: 1; width: 100%; border: 0; background: #FFFFFF; border-radius: 0 0 14px 14px;"></iframe>
      </div>`;
    m.addEventListener('click', ev => { if (ev.target === m) closeReplay(); });
    document.body.appendChild(m);
    document.body.style.overflow = 'hidden';
  };
  window.closeReplay = () => { const m = document.getElementById('replay-modal'); if (m) m.remove(); document.body.style.overflow = ''; };
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeReplay(); });
  window.toggleReplays = ev => { ev.stopPropagation(); document.getElementById('replay-menu').classList.toggle('open'); };
  document.addEventListener('click', () => { const m = document.getElementById('replay-menu'); if (m) m.classList.remove('open'); });

  function sideCard(e, J) {
    const sel = e.id === state.enf && J.hasData;
    const score = e.hasData && !isHidden(e) ? `<div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px;">${e.w.Local}–${e.w.Visitante}</div>` : `<div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; color: #9296AD;">vs</div>`;
    // Siglas del equipo grandes y en negrita; nombre del entrenador más pequeño y apagado
    const SIG = x => `<span style="font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 700; color: #F4F1EA; letter-spacing: 0.3px;">${esc(x)}</span>`;
    const AMP = '<span style="font-size: 12px; color: #9296AD; font-weight: 500;">&amp;</span>';
    const COACH = x => `<span style="font-size: 13px; font-weight: 500; color: #9296AD;">${esc(T(x).coach)}</span>`;
    const DOT = '<span style="font-size: 13px; color: #4A4E63;">·</span>';
    const row = inner => `<div style="display: flex; align-items: center; gap: 6px; white-space: nowrap;">${inner}</div>`;
    let left, right;
    if (e.duo) {
      left = row(`${logo(e.local[0], 20, 'margin-right: -4px;')}${logo(e.local[1], 20)}${SIG(e.local[0])}${AMP}${SIG(e.local[1])}`);
      right = row(`${SIG(e.visit[0])}${AMP}${SIG(e.visit[1])}${logo(e.visit[0], 20, 'margin-left: 2px;')}${logo(e.visit[1], 20, 'margin-left: -4px;')}`);
    } else {
      left = row(`${logo(e.local[0], 20)}${SIG(e.local[0])}${DOT}${COACH(e.local[0])}`);
      right = row(`${SIG(e.visit[0])}${DOT}${COACH(e.visit[0])}${logo(e.visit[0], 20)}`);
    }
    let st = 'pendiente', stColor = '#9296AD';
    if (e.state === 'jugado') st = e.replays.some(Boolean) ? 'repetición disponible' : 'jugado';
    else if (e.state === 'curso' || e.hasData) { st = `en curso (${e.combats.filter(c => c.winner).length}/3 combates)`; stColor = '#F5B700'; }
    if (isHidden(e)) { st = '🔒 oculto'; stColor = '#9296AD'; }
    const dim = J.hasData ? '' : ' opacity: 0.55;';
    return `<div onclick="${J.hasData ? `setEnf('${e.id}')` : ''}" class="${J.hasData ? 'clickable' : ''}" style="background: #1B1D2B; border: 1px solid ${sel ? '#F5B700' : 'rgba(255,255,255,0.08)'}; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 6px;${dim}">
      <div style="display: flex; justify-content: space-between; align-items: center;">${left}${score}${right}</div>
      <div style="font-size: 12px; color: ${stColor};">Enfrentamiento ${e.n} · ${e.duo ? '2vs2' : 'individual'} · ${st}</div>
    </div>`;
  }

  const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  function enfDateLine(e) {
    const txt = e.date ? `${DOW[e.date.getDay()]} ${fmtDate(e.date, e.hasTime)}` : 'Fecha por confirmar';
    return `<div style="font-family: 'Space Grotesk', sans-serif; font-size: 21px; font-weight: 700; color: ${e.date ? '#D8D9E3' : '#4A4E63'}; margin-top: 4px;">📅 ${txt}</div>`;
  }
  function lockedPanel(e) {
    const label = `Enfrentamiento ${e.n} · Bo3 · ${e.duo ? '2vs2' : '1vs1'}`;
    const cards = [1, 2, 3].map(n => `<div style="flex: 1; background: #1B1D2B; border: 1px dashed rgba(255,255,255,0.15); border-radius: 10px; padding: 10px 14px; text-align: center;">
        <div style="font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #9296AD;">Combate ${n}</div>
        <div style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: #4A4E63;">🔒 oculto</div>
      </div>`).join('');
    const replayBtn = replayButton(e);
    return `<div style="flex: 1; min-width: 0; background: #1B1D2B; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; display: flex; flex-direction: column; gap: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
        <div>
          <div style="font-family: 'Space Grotesk', sans-serif; font-size: 21px; letter-spacing: 0.5px; text-transform: uppercase; color: #F5B700; font-weight: 700;">${label}</div>
          ${enfDateLine(e)}
          <div style="font-family: 'Space Grotesk', sans-serif; font-size: 21px; font-weight: 700; margin-top: 4px;">${esc(e.local.join(' & '))} vs ${esc(e.visit.join(' & '))}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">${enfToggle(e)}${replayBtn}</div>
      </div>
      <div style="display: flex; gap: 10px;">${cards}</div>
      <div style="flex: 1; display: flex; align-items: center; justify-content: center; min-height: 420px;">
        <div style="text-align: center; max-width: 440px; display: flex; flex-direction: column; align-items: center; gap: 10px;">
          <div style="font-size: 34px;">🙈</div>
          <div style="font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; color: #F4F1EA;">Antispoiler activado</div>
          <div style="font-size: 13px; color: #9296AD; line-height: 1.5;">Marcadores, combates y equipos de este enfrentamiento están ocultos. Puedes moverte entre jornadas y enfrentamientos sin ver nada hasta que decidas destaparlo.</div>
          <div onclick="toggleEnfSpoiler('${e.id}')" class="clickable" style="margin-top: 6px; padding: 9px 18px; border-radius: 20px; background: #F5B700; color: #12131C; font-size: 13px; font-weight: 700;">👀 Ver este enfrentamiento</div>
          <div style="font-size: 11px; color: #4A4E63;">Para verlo todo de golpe, desactiva el antispoiler general (arriba a la derecha)</div>
        </div>
      </div>
    </div>`;
  }

  function enfPanel(e) {
    if (isHidden(e)) return lockedPanel(e);
    const sideName = (sigs) => sigs.join(' & ');
    const played = e.combats.filter(c => c.winner);
    const done = e.state === 'jugado';
    const twoZero = done && played.length === 2;
    const label = `Enfrentamiento ${e.n} · Bo3 · ${e.duo ? '2vs2' : '1vs1'}`;
    let title;
    const plural = sigs => sigs.length > 1 ? 'ganan' : 'gana';
    if (done) {
      const W = e.winner, L = W === 'Local' ? 'Visitante' : 'Local';
      const ws = W === 'Local' ? e.local : e.visit, ls = W === 'Local' ? e.visit : e.local;
      title = `${esc(sideName(ws))} ${plural(ws)} ${e.w[W]}–${e.w[L]} a ${esc(sideName(ls))}`;
    } else if (e.hasData) {
      title = `${esc(sideName(e.local))} ${e.w.Local}–${e.w.Visitante} ${esc(sideName(e.visit))} <span style="font-size: 14px; font-weight: 600; color: #9296AD;">· en curso</span>`;
    } else {
      title = `${esc(sideName(e.local))} vs ${esc(sideName(e.visit))} <span style="font-size: 14px; font-weight: 600; color: #9296AD;">· pendiente</span>`;
    }
    // Al entrar en un enfrentamiento se muestra siempre el Combate 1 (o el primero con datos), con su botón marcado
    if (!state.combat || !e.combats[state.combat - 1] || !e.combats[state.combat - 1].hasData) {
      const first = e.combats.find(c => c.hasData);
      state.combat = first ? first.n : null;
    }

    const replayBtn = replayButton(e);

    // Tarjetas de combate
    const showCombats = twoZero ? e.combats.filter(c => c.winner) : e.combats;
    const cards = showCombats.map(cb => {
      const sel = state.combat === cb.n;
      const width = twoZero ? 'width: 312px;' : 'flex: 1;';
      if (!cb.winner) {
        const inProgress = cb.hasData;
        return `<div onclick="${inProgress ? `setCombat(${cb.n})` : ''}" class="${inProgress ? 'clickable' : ''}" style="${width} background: #1B1D2B; border: ${sel ? '2px solid #F5B700' : '1px dashed rgba(255,255,255,0.15)'}; border-radius: 10px; padding: 10px 14px; text-align: center; opacity: ${sel ? 1 : 0.5};">
          <div style="font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: ${sel ? '#F5B700' : '#9296AD'};${sel ? ' font-weight: 700;' : ''}">Combate ${cb.n}${sel ? ' ▾' : ''}</div>
          <div style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: #4A4E63;">${inProgress ? 'en curso' : 'pendiente'}</div>
        </div>`;
      }
      const win = cb.winner === 'Local';
      const c = win ? '76,201,240' : '230,57,70', hex = win ? '#4CC9F0' : '#E63946';
      return `<div onclick="setCombat(${cb.n})" class="clickable" style="${width} background: rgba(${c},0.06); border: ${sel ? '2px solid #F5B700' : `1px solid rgba(${c},0.25)`}; border-radius: 10px; padding: 10px 14px; text-align: center;">
        <div style="font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: ${sel ? '#F5B700' : '#9296AD'};${sel ? ' font-weight: 700;' : ''}">Combate ${cb.n}${sel ? ' ▾' : ''}</div>
        <div style="font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; color: ${hex};">${cb.kos.Local}–${cb.kos.Visitante}</div>
      </div>`;
    }).join('');

    // El roster es siempre el del combate marcado (por defecto el Combate 1)
    let rosterCombat = null;
    if (state.combat) rosterCombat = e.combats[state.combat - 1];
    else if (done) rosterCombat = played[played.length - 1];

    let body;
    if (!e.hasData) {
      body = `<div style="flex: 1; display: flex; align-items: center; justify-content: center; min-height: 360px;"><div style="text-align: center; max-width: 420px;"><div style="font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; color: #4A4E63;">Enfrentamiento todavía sin jugar</div><div style="font-size: 12px; color: #9296AD; margin-top: 8px;">Cuando se apunte el primer combate en el sheet, aquí aparecerán el resultado y los equipos.</div></div></div>`;
    } else if (!rosterCombat) {
      const nextN = e.combats.find(c => !c.winner);
      body = `<div style="flex: 1; display: flex; align-items: center; justify-content: center; min-height: 360px;"><div style="text-align: center; max-width: 420px;"><div style="font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; color: #4A4E63;">Equipos y rosters se completan combate a combate</div><div style="font-size: 12px; color: #9296AD; margin-top: 8px;">Cuando el Combate ${nextN ? nextN.n : ''} se apunte en el sheet, aparecerá su resultado y se actualizará el marcador del enfrentamiento; los pokémon vivos/KO se van revelando con cada combate. Toca un combate jugado para ver cómo estaban los equipos.</div></div></div>`;
    } else {
      const note = e.duo ? 'El escudo en la esquina indica de qué equipo es cada pokémon · vivos primero · desplázate para ver todos' : 'Vivos primero · desplázate para ver todos';
      body = `<div style="font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #9296AD; font-weight: 600;">${note}</div>
        <div class="thin-scroll" style="max-height: 720px; overflow-y: auto; padding-right: 8px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            ${rosterSide(e, rosterCombat, 'Local')}${rosterSide(e, rosterCombat, 'Visitante')}
          </div>
        </div>`;
    }
    return `<div style="flex: 1; min-width: 0; background: #1B1D2B; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; display: flex; flex-direction: column; gap: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
        <div>
          <div style="font-family: 'Space Grotesk', sans-serif; font-size: 21px; letter-spacing: 0.5px; text-transform: uppercase; color: #F5B700; font-weight: 700;">${label}</div>
          ${enfDateLine(e)}
          <div style="font-family: 'Space Grotesk', sans-serif; font-size: 21px; font-weight: 700; margin-top: 4px;">${title}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">${enfToggle(e)}${replayBtn}</div>
      </div>
      ${e.hasData ? `<div style="display: flex; ${twoZero ? 'justify-content: space-evenly;' : 'gap: 10px;'}">${cards}</div>` : ''}
      ${body}
    </div>`;
  }

  function rosterSide(e, cb, lado) {
    const sigs = lado === 'Local' ? e.local : e.visit;
    const side = cb.sides[lado];
    const color = T(sigs[0]).color;
    const shield = e.duo;
    const head = `<div style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: ${color}; margin-bottom: 2px;">
      ${sigs.map((s, i) => logo(s, 20, sigs.length > 1 && i === 0 ? 'margin-right: -4px;' : '')).join('')}
      ${esc(coaches(sigs))} · ${esc(sigs.length > 1 ? sigs.map(s => T(s).short).join(' / ') : T(sigs[0]).name)}
    </div>`;
    let banRow = '';
    if (e.j > 1 && (side.ban || side.sub)) {
      const mini = (m, kind) => {
        if (!m) return `<div style="flex: 1;"></div>`;
        const isBan = kind === 'Baneado';
        return `<div style="position: relative; flex: 1; background: #1B1D2B; border: 1px dashed ${isBan ? 'rgba(230,57,70,0.4)' : 'rgba(146,150,173,0.4)'}; border-radius: 8px; padding: 8px; display: flex; align-items: center; gap: 10px;">
          ${shield ? logo(m.team, 16, 'position: absolute; top: 5px; right: 5px; border: 1px solid rgba(0,0,0,0.5);') : ''}
          <img src="${sprite(m.poke)}" ${onErr} style="width: 46px; height: 46px; object-fit: contain; ${isBan ? 'filter: grayscale(80%) opacity(0.7);' : 'opacity: 0.75;'}">
          <div>
            <div style="font-size: 8px; letter-spacing: 0.5px; text-transform: uppercase; color: ${isBan ? '#E63946' : '#9296AD'}; font-weight: 700;">${kind}</div>
            <div style="font-size: 11px; font-weight: 700;">${esc(monName(m))}${genderMark(m, true)}</div>
          </div>
        </div>`;
      };
      banRow = `<div style="display: flex; gap: 8px;">${mini(side.ban, 'Baneado')}${mini(side.sub, 'Suplente')}</div>`;
    }
    const mons = side.tit.slice().sort((a, b) => (a.ko - b.ko));
    return `<div style="display: flex; flex-direction: column; gap: 8px;">${head}${banRow}${mons.map(m => monCard(m, shield)).join('')}</div>`;
  }
  function genderMark(m, inline) {
    if (m.gender === '♂') return `<span style="font-size: 9px; color: #4CC9F0; font-weight: 700;">${inline ? ' ' : ''}♂</span>`;
    if (m.gender === '♀') return `<span style="font-size: 9px; color: #E63946; font-weight: 700;">${inline ? ' ' : ''}♀</span>`;
    return '';
  }
  function monCard(m, shield) {
    const alive = !m.ko;
    const name = esc(monName(m));
    const nameHtml = m.gender
      ? `<div style="display: flex; align-items: center; gap: 5px; min-width: 0;"><span style="font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 78px; display: inline-block;" title="${esc(pretty(m.poke))}">${name}</span>${genderMark(m)}</div>`
      : `<div style="font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;" title="${esc(pretty(m.poke))}">${name}</div>`;
    return `<div style="position: relative; background: ${alive ? '#232640' : '#1E1F2C'}; border-left: 3px solid ${alive ? '#4CC9F0' : '#E63946'}; border-radius: 8px; padding: 10px;${alive ? '' : ' opacity: 0.65;'}">
      ${shield ? logo(m.team, 18, 'position: absolute; top: 6px; right: 6px; border: 1px solid rgba(0,0,0,0.5);') : ''}
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 10px; width: 165px; flex-shrink: 0; overflow: hidden;">
          <div style="position: relative; width: 52px; height: 52px; flex-shrink: 0;">
            <img src="${sprite(m.poke)}" ${onErr} style="width: 52px; height: 52px; object-fit: contain;${alive ? '' : ' filter: grayscale(60%);'}">
            ${m.item ? `<img src="${itemImg(m.item)}" ${onErr} title="${esc(m.item)}" style="position: absolute; bottom: 2px; right: 2px; width: 18px; height: 18px; object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.8));">` : ''}
          </div>
          <div style="max-width: 103px; overflow: hidden;">
            ${nameHtml}
            <div style="font-size: 9px; color: ${alive ? '#9296AD' : '#E63946'};">Nv. ${m.level}${alive ? '' : ' · KO'}</div>
          </div>
        </div>
        <div style="flex: 1; font-size: 10px; color: #9296AD; line-height: 1.6; text-align: left; padding-left: 28px;">${m.moves.map(x => '· ' + esc(x)).join('<br>')}</div>
        <div style="flex: 0 0 46px; text-align: right;">
          <div style="font-size: 12px; font-weight: 700; color: #F5B700;">${m.kills} <span style="font-size: 8px; color: #9296AD; font-weight: 500;">kills</span></div>
        </div>
      </div>
    </div>`;
  }

  /* =====================================================================
     5 · INSIGNIAS
     ===================================================================== */
  function renderInsignias() {
    const sel = state.ins;
    const hasJ = j => DB.awards.some(a => a.j === j);
    const hasAny = hasJ('T');
    // Jornada (o reto) terminada pero sin premios apuntados → vista para votar (ranking de kills + todos los pokémon)
    const votable = j => !hasJ(j) && (j === 'T' ? DB.jornadas.every(x => x.done) : !!(DB.jornadas[j - 1] && DB.jornadas[j - 1].done));
    const pill = (key, lab, has) => {
      const on = key === sel;
      const cls = on ? (has ? 'pill sel' : 'pill sel-empty') : (has ? 'pill' : 'pill muted');
      return `<div class="${cls}" onclick="setIns('${key}')">${lab}</div>`;
    };
    const pills = [1, 2, 3, 4].map(j => pill(String(j), `Jornada ${j}`, hasJ(j) || votable(j))).join('') + pill('Total', 'Total', hasAny || votable('T'));
    const isTotal = sel === 'Total'; const j = isTotal ? 'T' : +sel;
    const vote = votable(j);
    const sub = vote ? `${isTotal ? 'Reto terminado' : 'Jornada terminada'} — todos los pokémon de un vistazo para votar los premios`
      : isTotal ? 'El escudo en la esquina de cada pokémon indica su equipo — sin necesidad de texto' : 'Vista filtrada por jornada — mismas categorías, solo los datos de esa jornada';
    const has = isTotal ? hasAny : hasJ(j);
    let content;
    if (vote) content = insigniasContent(j, true);
    else if (!has) {
      const jor = isTotal ? null : DB.jornadas[j - 1];
      const msg = isTotal ? 'Los premios del total los elegís vosotros: aparecerán aquí en cuanto se rellene el bloque TOTAL de la pestaña Insignias del sheet'
        : (jor && jor.done ? `La Jornada ${j} ya está completa · los premios se publicarán en cuanto se apunten en el sheet`
          : `A diferencia de Jornadas (que se actualiza combate a combate), esta vista solo se rellena cuando la Jornada ${j} se completa entera · quedan enfrentamientos de esta jornada por jugar`);
      content = `<div style="padding: 22px 64px 40px;"><div style="min-height: 520px; background: #1B1D2B; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center;">
        <div style="font-family: 'Space Grotesk', sans-serif; font-size: 28px; font-weight: 700; color: #4A4E63;">Sin información de insignias todavía</div>
        <div style="font-size: 13px; color: #9296AD; max-width: 460px;">${msg}</div>
      </div></div>`;
    } else content = insigniasContent(j);
    return `
    <div class="pagehead tight"><h1>Insignias &amp; estadísticas</h1><div class="pagesub">${sub}</div></div>
    <div class="pillrow">${pills}</div>
    ${content}`;
  }
  window.setIns = k => { state.ins = k; render(); };
  window.setKillMode = m => { state.killMode = m; render(); };
  window.toggleSecond = () => { state.secondOpen = !state.secondOpen; render(); };

  const monKey = m => `${m.team}|${m.poke}|${m.nick}`;
  // mode 'tot' = kills totales · 'avg' = kills por combate (kills ÷ combates en los que ha participado como titular)
  function killRanking(j, mode) {
    if (j === 'T') j = null;
    const map = {};
    for (const e of DB.enfs) {
      if (j && e.j !== j) continue;
      for (const cb of e.combats) for (const lado of ['Local', 'Visitante']) for (const m of cb.sides[lado].tit) {
        if (!m.poke) continue;
        const k = monKey(m);
        const r = map[k] || (map[k] = { team: m.team, poke: m.poke, nick: m.nick, kills: 0, combats: 0 });
        r.kills += m.kills; r.combats++;
      }
    }
    const list = Object.values(map);   // todos los pokémon que han jugado algún combate
    list.forEach(x => { x.avg = x.kills / x.combats; });
    list.sort(mode === 'avg' ? (a, b) => b.avg - a.avg || b.kills - a.kills : (a, b) => b.kills - a.kills || a.combats - b.combats);
    return list;
  }
  const jList = js => { const u = [...new Set(js)].sort((a, b) => a - b); return u.length === 1 ? `Jornada ${u[0]}` : `Jornada ${u.slice(0, -1).join(', ')} y ${u[u.length - 1]}`; };
  function groupAwards(type, j) {
    const list = DB.awards.filter(a => a.type === type && a.j === j).sort((a, b) => a.n - b.n);
    const map = {}; const out = [];
    for (const a of list) { const k = monKey(a); if (!map[k]) { map[k] = { ...a, js: [] }; out.push(map[k]); } map[k].js.push(a.j); }
    return out;
  }
  /* Vista para votar: pokémon de cada equipo (individuales en orden de clasificación, luego equipos conjuntos) */
  function voteColumn(j) {
    const isT = j === 'T';
    const enfs = DB.enfs.filter(e => isT || e.j === j);
    // Pokémon de un lado en una lista de enfrentamientos: titulares, baneado y suplente; solo cuentan combates/kills como titular
    const roster = (list, sideOf) => {
      const map = {}; const out = [];
      const get = m => { const k = `${m.team}|${m.poke}`; if (!map[k]) { map[k] = { team: m.team, poke: m.poke, nick: '', kills: 0, combats: 0 }; out.push(map[k]); } if (m.nick && !map[k].nick) map[k].nick = m.nick; return map[k]; };
      for (const e of list) {
        const lado = sideOf(e); if (!lado) continue;
        for (const cb of e.combats) {
          const sd = cb.sides[lado];
          for (const m of sd.tit) { if (!m.poke) continue; const r = get(m); r.kills += m.kills; r.combats++; }
          for (const m of [sd.ban, sd.sub]) if (m && m.poke) get(m);
        }
      }
      return out;
    };
    const tile = (m, shield) => `
      <div style="background: #232640; border-radius: 10px; padding: 8px 2px; display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center; min-width: 0;">
        <div style="position: relative; width: 64px; height: 64px;">
          <img src="${sprite(m.poke)}" ${onErr} style="width: 64px; height: 64px; object-fit: contain;">
          ${shield ? logo(m.team, 22, 'position: absolute; bottom: -4px; right: -4px; border: 2px solid #232640;') : ''}
        </div>
        <div style="font-size: 11px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;" title="${esc(pretty(m.poke))}">${esc(monName(m))}</div>
        <div style="font-size: 10px; line-height: 1.35; color: ${m.combats ? '#9296AD' : '#4A4E63'};">${m.kills} ${m.kills === 1 ? 'kill' : 'kills'}<br>${m.combats} ${m.combats === 1 ? 'combate' : 'combates'}</div>
      </div>`;
    const CARD = 'background: #1B1D2B; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 14px 16px; display: flex; align-items: center; gap: 14px;';
    const grid = (mons, shield) => `<div style="flex: 1; min-width: 0; display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 6px;">${mons.map(m => tile(m, shield)).join('') || '<div style="grid-column: 1 / -1; font-size: 12px; color: #4A4E63;">Sin pokémon apuntados</div>'}</div>`;
    const section = (t, sub) => `<div style="display: flex; align-items: baseline; gap: 10px; margin-top: 4px;">
        <div style="font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #F5B700;">${t}</div>
        <div style="font-size: 11px; color: #9296AD;">${sub}</div>
      </div>`;
    const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);

    // Equipos individuales, en orden de clasificación (de la jornada o general)
    const st = sig => isT ? DB.stand[sig] : (DB.stand[sig].byJ[j] || { pts: 0, made: 0, recv: 0 });
    const order = isT ? DB.ranking.map(r => r.sig)
      : [...DB.teamOrder].sort((a, b) => (st(b).pts - st(a).pts) || ((st(b).made - st(b).recv) - (st(a).made - st(a).recv)) || (DB.teamOrder.indexOf(a) - DB.teamOrder.indexOf(b)));
    const solo = enfs.filter(e => !e.duo);
    const indRows = order.map((sig, i) => {
      const x = st(sig);
      const mons = roster(solo, e => e.local.includes(sig) ? 'Local' : e.visit.includes(sig) ? 'Visitante' : null);
      return `<div style="${CARD}">
        <div style="width: 122px; flex-shrink: 0; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 700; color: ${i === 0 ? '#F5B700' : '#9296AD'}; width: 14px;">${i + 1}</div>
            ${logo(sig, 36)}
            <div style="min-width: 0;">
              <div style="font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 700;">${esc(sig)}</div>
              <div style="font-size: 11px; color: #9296AD; margin-top: 1px;">${esc(T(sig).coach)}</div>
            </div>
          </div>
          <div style="font-size: 11px; white-space: nowrap; padding-left: 22px;"><span style="color: #F5B700; font-weight: 700;">${x.pts} pts</span> <span style="color: #9296AD;">· ${signed(x.made - x.recv)} KOs</span></div>
        </div>
        ${grid(mons, false)}
      </div>`;
    }).join('');

    // Equipos conjuntos (2vs2): una fila por pareja, la ganadora primero
    const duoRows = enfs.filter(e => e.duo).sort((a, b) => (a.j - b.j) || (a.n - b.n)).map(e => {
      const lados = e.winner === 'Visitante' ? ['Visitante', 'Local'] : ['Local', 'Visitante'];
      return lados.map(lado => {
        const sigs = lado === 'Local' ? e.local : e.visit; const op = lado === 'Local' ? 'Visitante' : 'Local';
        const won = e.winner === lado;
        return `<div style="${CARD}">
          <div style="width: 122px; flex-shrink: 0; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex;">${sigs.map((s, k) => logo(s, 36, `border: 2px solid #1B1D2B;${k ? ' margin-left: -10px;' : ''}`)).join('')}</div>
            <div style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; white-space: nowrap;">${sigs.map(esc).join(' &amp; ')}</div>
            <div style="font-size: 11px; font-weight: 700; color: ${won ? '#4CC9F0' : '#E63946'};">${won ? 'Ganan' : 'Pierden'} ${e.w[lado]}–${e.w[op]}</div>
            ${isT ? `<div style="font-size: 10px; color: #9296AD;">Jornada ${e.j}</div>` : ''}
          </div>
          ${grid(roster([e], () => lado), true)}
        </div>`;
      }).join('');
    }).join('');

    const what = isT ? 'Reto terminado · premios del total' : `Jornada ${j} terminada · premios`;
    return `<div style="flex: 1; display: flex; flex-direction: column; gap: 12px; min-width: 0;">
      <div style="background: rgba(245,183,0,0.08); border: 1px solid rgba(245,183,0,0.35); border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 20px;">🗳️</div>
        <div>
          <div style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: #F5B700;">${what} pendientes de votación</div>
          <div style="font-size: 11px; color: #9296AD; margin-top: 2px;">Estos son todos los pokémon que han jugado ${isT ? 'el reto' : 'la jornada'}. Los premios aparecerán aquí cuando se apunten en el sheet.</div>
        </div>
      </div>
      ${section('Equipos individuales', `En orden de clasificación ${isT ? 'general' : `de la Jornada ${j}`} · kills y combates jugados en enfrentamientos individuales`)}
      ${indRows}
      ${duoRows ? section('Equipos conjuntos', `${isT ? 'Enfrentamientos 2vs2 del reto' : 'Enfrentamiento 2vs2 de la jornada'} · el escudo indica de qué equipo es cada pokémon`) + duoRows : ''}
    </div>`;
  }

  function insigniasContent(j, vote) {
    const avgMode = state.killMode === 'avg';
    const rank = killRanking(j, state.killMode);
    const nCombats = n => `${n} ${n === 1 ? 'combate' : 'combates'}`;
    const seg = (m, lab) => `<div onclick="setKillMode('${m}')" style="flex: 1; text-align: center; padding: 7px 8px; border-radius: 8px; font-size: 12px; cursor: pointer; ${state.killMode === m ? 'font-weight: 700; background: #F5B700; color: #12131C;' : 'font-weight: 600; color: #9296AD;'}">${lab}</div>`;
    const killSelector = `<div style="display: flex; gap: 4px; background: #232640; border-radius: 10px; padding: 3px;">${seg('tot', 'Kills totales')}${seg('avg', 'Kills por combate')}</div>`;
    const rankSub = avgMode ? `Kills ÷ combates en los que ha participado · ${j !== 'T' ? `solo Jornada ${j}` : 'todas las jornadas'}` : (j !== 'T' ? `Solo Jornada ${j}` : 'Acumulado de todas las jornadas jugadas');
    const rankRows = rank.map((r, i) => `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
          <div style="font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 700; color: ${i === 0 ? '#F5B700' : '#9296AD'}; width: 16px;">${i + 1}</div>
          <div style="position: relative; width: 64px; height: 64px; flex-shrink: 0;">
            <img src="${sprite(r.poke)}" ${onErr} style="width: 64px; height: 64px; object-fit: contain;">
            ${logo(r.team, 22, 'position: absolute; bottom: -3px; right: -3px; border: 2px solid #1B1D2B;')}
          </div>
          <div style="min-width: 0;">
            <div style="font-size: 13px; font-weight: 600;">${esc(monName(r))}</div>
            <div style="font-size: 10px; color: #9296AD; margin-top: 2px;">${avgMode ? `${r.kills} kills · ${nCombats(r.combats)}` : nCombats(r.combats)}</div>
          </div>
        </div>
        <div style="font-size: 14px; font-weight: 700;${i === 0 ? ' color: #F5B700;' : ''}">${avgMode ? r.avg.toFixed(2).replace('.', ',') : r.kills}</div>
      </div>`).join('') || `<div style="font-size: 12px; color: #4A4E63;">Todavía no hay kills apuntadas</div>`;

    const prizeCard = type => {
      const b = BADGE[type]; const winners = groupAwards(type, j);
      const rows = winners.length ? winners.map(w => `
        <div style="display: flex; align-items: center; gap: 10px; background: #232640; border-radius: 10px; padding: 10px;">
          <div style="position: relative; width: 64px; height: 64px; flex-shrink: 0;">
            <img src="${sprite(w.poke)}" ${onErr} style="width: 64px; height: 64px; object-fit: contain;">
            ${logo(w.team, 22, 'position: absolute; bottom: -3px; right: -3px; border: 2px solid #232640;')}
          </div>
          <div style="min-width: 0;">
            <div style="font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${esc(pretty(w.poke))}">${esc(monName(w))}</div>
            <div style="font-size: 10px; color: #9296AD; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(T(w.team).coach)} · ${esc(T(w.team).name)}</div>
          </div>
        </div>`).join('') : `<div style="background: #232640; border-radius: 10px; padding: 10px; font-size: 12px; color: #4A4E63; min-height: 84px; display: flex; align-items: center; justify-content: center;">Sin asignar</div>`;
      return `<div style="background: #1B1D2B; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">${badge(type, 34)}<div><div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 14px;">${b.name}</div><div style="font-size: 10px; color: #9296AD;">${b.sub}</div></div></div>
        ${rows}
      </div>`;
    };
    const teamGrid = type => {
      const winners = groupAwards(type, j);
      if (!winners.length) return `<div style="font-size: 12px; color: #4A4E63;">Sin asignar</div>`;
      return `<div style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px;">${winners.map(w => `
        <div style="background: #232640; border-radius: 10px; padding: 8px 6px; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center;">
          <div style="position: relative; width: 64px; height: 64px;">
            <img src="${sprite(w.poke)}" ${onErr} style="width: 64px; height: 64px; object-fit: contain;">
            ${logo(w.team, 22, 'position: absolute; bottom: -4px; right: -4px; border: 2px solid #232640;')}
          </div>
          <div style="font-size: 11px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;" title="${esc(pretty(w.poke))}">${esc(monName(w))}</div>
        </div>`).join('')}</div>`;
    };
    const scope = j !== 'T' ? `de la Jornada ${j}` : 'del reto';
    return `
    <div style="padding: 22px 64px 40px; display: flex; gap: 24px; align-items: flex-start;">
      <div style="width: 330px; flex-shrink: 0; background: #1B1D2B; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 22px; display: flex; flex-direction: column; gap: 14px;">
        <div><div style="font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 700;">Ranking de kills</div><div style="font-size: 11px; color: #9296AD; margin-top: 2px;">${rankSub}</div></div>
        ${killSelector}
        <!-- Lista completa con scroll (se ven ~5 a la vez); al volver a entrar empieza siempre desde el 1 -->
        <div class="thin-scroll rank-scroll">${rankRows}</div>
      </div>
      ${vote ? voteColumn(j) : `<div style="flex: 1; display: flex; flex-direction: column; gap: 18px; min-width: 0;">
        <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; align-items: start;">${['mvp', 'asist', 'dpoy', 'sexto'].map(prizeCard).join('')}</div>
        <div style="background: #1B1D2B; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">${badge('first', 34)}<div><div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 14px;">ALL-GBA 1st Team</div><div style="font-size: 10px; color: #9296AD;">Selección de los 6 mejores pokémon ${scope}</div></div></div>
            ${teamGrid('first')}
          </div>
          <div style="display: flex; flex-direction: column; gap: 12px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08);">
            <div onclick="toggleSecond()" class="clickable" style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">${badge('second', 34)}<div><div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 14px;">ALL-GBA 2nd Team</div><div style="font-size: 10px; color: #9296AD;">Los siguientes 6 mejores pokémon ${scope}</div></div></div>
              <div style="color: #F5B700; font-size: 13px; font-weight: 700;">${state.secondOpen ? '▾' : '▸'}</div>
            </div>
            ${state.secondOpen ? teamGrid('second') : ''}
          </div>
        </div>
      </div>`}
    </div>`;
  }

  /* =====================================================================
     6 · HISTORIA
     ===================================================================== */
  function rulesHtml(which) {
    const list = DB.rules[which] || [];
    let html = `<div style="font-size: 15px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; color: #F4F1EA;">Reglamento ${which}</div>`;
    let bullets = []; let firstSec = true;
    const flush = () => { if (bullets.length) { html += `<div style="display: flex; flex-direction: column; gap: 6px;">${bullets.join('')}</div>`; bullets = []; } };
    for (const r of list) {
      if (r.type === 'Regla') { bullets.push(`<div class="rule"><span>•</span>${esc(r.text)}</div>`); continue; }
      flush();
      if (r.type === 'Sección') { html += `<div style="font-size: 13px; font-weight: 700; color: #F5B700;${firstSec ? '' : ' margin-top: 4px;'}">${esc(r.text)}</div>`; firstSec = false; }
      else if (r.type === 'Subsección') html += `<div style="font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase; color: #9296AD; font-weight: 600; margin-top: 2px;">${esc(r.text)}</div>`;
      else if (r.type === 'Tabla') html += /punto/i.test(r.text) ? pointsTable() : levelsTable();
    }
    flush();
    return html;
  }
  function levelsTable() {
    const rows = Object.keys(DB.levels).sort((a, b) => a - b).map(j => `<div class="rules-table-row"><div>${j}</div><div style="text-align: right; font-weight: 600;">${DB.levels[j]}</div></div>`).join('');
    return `<div class="rules-table"><div class="rules-table-head"><div>Jornada</div><div style="text-align: right;">Nivel</div></div>${rows}</div>`;
  }
  function pointsTable() {
    const rows = Object.entries(DB.points).map(([k, v]) => `<div class="rules-table-row"><div>${esc(k)}</div><div style="text-align: right; font-weight: 600;${/^victoria/i.test(k) ? ' color: #F5B700;' : ''}">${v}</div></div>`).join('');
    return `<div class="rules-table"><div class="rules-table-head"><div>Resultado</div><div style="text-align: right;">Puntos</div></div>${rows}</div>`;
  }
  function renderHistoria() {
    const paras = DB.historia.paras.map((p, i, arr) => `<div style="font-size: 14px; line-height: 1.7; color: #D8D9E3;${i === arr.length - 1 && arr.length > 1 && p.length < 80 ? ' font-weight: 600;' : ''}">${esc(p)}</div>`).join('');
    const pill = (k, lab) => k === state.rules
      ? `<a onclick="setRules('${k}')" style="padding: 8px 16px; border-radius: 20px; background: #F5B700; color: #12131C; font-size: 13px; font-weight: 700;">${lab}</a>`
      : `<a onclick="setRules('${k}')" style="padding: 8px 16px; border-radius: 20px; background: #232640; color: #9296AD; font-size: 13px; font-weight: 600;">${lab}</a>`;
    const gal = DB.gallery.map(g => `
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div style="aspect-ratio: 4/3; background: #232640; border-radius: 10px; overflow: hidden;"><img src="${A}/galeria/${encodeURIComponent(g.file)}" ${onErr} style="width: 100%; height: 100%; object-fit: cover;"></div>
        <div style="font-size: 11px; color: #9296AD;">${esc([g.date, g.title].filter(Boolean).join(' · '))}</div>
        ${g.quote ? `<div style="font-size: 12px;">"${esc(g.quote.replace(/^["“«]|["”»]$/g, ''))}"</div>` : ''}
      </div>`).join('');
    const galBody = DB.gallery.length
      ? `<div class="thin-scroll" style="max-height: 420px; overflow-y: auto; padding-right: 8px;"><div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px;">${gal}</div></div>`
      : `<div style="font-size: 13px; color: #4A4E63; padding: 20px 0;">Todavía no hay fotos en la galería</div>`;
    return `
    <div style="padding: 22px 64px; display: flex; gap: 28px; align-items: flex-start;">
      <div style="flex: 1; min-width: 0; background: #1B1D2B; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; display: flex; flex-direction: column; gap: 14px;">
        <div style="font-family: 'Space Grotesk', sans-serif; font-size: 20px; font-weight: 700;">${esc(DB.historia.title)}</div>
        ${paras}
      </div>
      <div style="flex: 1; min-width: 0; background: #1B1D2B; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; display: flex; flex-direction: column; gap: 18px; height: 900px;">
        <div style="display: flex; gap: 8px; flex-shrink: 0;">${pill('Nuzlocke', 'Reglas Nuzlocke')}${pill('VS', 'Reglas VS')}</div>
        <div class="thin-scroll rules-scroll" style="flex: 1; min-height: 0; overflow-y: auto; padding-right: 10px; display: flex; flex-direction: column; gap: 14px;">${rulesHtml(state.rules)}</div>
      </div>
    </div>
    <div style="padding: 0 64px 40px;">
      <div style="background: #1B1D2B; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px 28px; display: flex; flex-direction: column; gap: 16px;">
        <div onclick="toggleGal()" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
          <div style="font-size: 14px; color: #F5B700; font-weight: 700;">${state.galOpen ? '▾' : '▸'}</div>
          <div style="font-family: 'Space Grotesk', sans-serif; font-size: 20px; font-weight: 700;">Galería</div>
          <div style="font-size: 12px; color: #9296AD;">— ${state.galOpen ? 'desplázate para ver más momentos' : 'toca para desplegar'}</div>
        </div>
        ${state.galOpen ? galBody : ''}
      </div>
    </div>`;
  }
  window.setRules = k => { state.rules = k; render(); };
  window.toggleGal = () => { state.galOpen = !state.galOpen; render(); };

  /* ---------------- arranque ---------------- */
  async function start() {
    try {
      DB = await window.RetoData.load();
      window.__DB = DB;
      const nombre = DB.nombre || '';
      document.getElementById('brand-text').textContent = nombre ? (/^liga\b/i.test(nombre) ? nombre.toUpperCase() : `LIGA ${nombre.toUpperCase()}`) : 'LIGA POKÉMON';
      document.title = nombre ? (/^liga\b/i.test(nombre) ? nombre : `Liga ${nombre}`) : 'Liga Pokémon';
      state.team = DB.teamOrder[0];
      window.addEventListener('hashchange', route);
      route();
    } catch (err) {
      console.error(err);
      document.getElementById('app').innerHTML = `<div class="loading"><div class="loading-title">No se han podido cargar los datos</div>
        <div class="loading-sub">${esc(err.message)}</div>
        <div class="loading-sub">Revisa que <code>js/config.js</code> tiene el ID del sheet y que el sheet está compartido como <code>Cualquier persona con el enlace · Lector</code>.</div></div>`;
    }
  }
  start();
})();
