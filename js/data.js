/* =====================================================================
   DATOS: lee las pestañas del Google Sheet y construye el modelo del reto.
   Todo lo calculado (resultados, puntos, clasificación, kills, medallas)
   se calcula aquí a partir de lo que se apunta en el sheet.
   ===================================================================== */
(function () {
  const CFG = window.RETO_CONFIG || {};
  const TABS = ['Inicio', 'Equipos', 'Jornadas', 'Enfrentamientos', 'Insignias', 'Historia', 'Listas'];

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    const rows = []; let row = []; let cur = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch === '\r') { /* ignorar */ }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  async function fetchTab(name) {
    let url;
    if (CFG.DATA_DIR) url = `${CFG.DATA_DIR}/${encodeURIComponent(name)}.csv?t=${Date.now()}`;
    else url = `https://docs.google.com/spreadsheets/d/${CFG.SHEET_ID}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent(name)}&t=${Date.now()}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`No se pudo leer la pestaña "${name}" (HTTP ${r.status})`);
    const txt = await r.text();
    if (/^\s*<!DOCTYPE html|<html/i.test(txt)) throw new Error(`El sheet no es público: no se pudo leer "${name}"`);
    return parseCSV(txt);
  }

  const S = v => (v === undefined || v === null ? '' : String(v)).trim();
  const N = v => { const n = parseFloat(S(v).replace(',', '.')); return isNaN(n) ? 0 : n; };
  const ENF_ID = /^J(\d+)-E(\d+)$/;

  /* ---------- Construcción del modelo ---------- */
  function build(raw) {
    const DB = {};

    // Nombre del reto (Inicio!B4 · fila con "Nombre del reto")
    DB.nombre = '';
    for (const r of raw.Inicio) if (S(r[0]) === 'Nombre del reto') { DB.nombre = S(r[1]); break; }

    // Listas: carpeta de cada pokémon y objeto
    DB.pokeFolder = {}; DB.itemFolder = {};
    raw.Listas.forEach((r, i) => {
      if (i === 0) return;
      if (S(r[0])) DB.pokeFolder[S(r[0])] = S(r[1]) || 'pokemon';
      if (S(r[3])) DB.itemFolder[S(r[3])] = S(r[4]) || 'items/hold-items';
    });

    // Equipos
    DB.teams = {}; DB.teamOrder = [];
    let mode = '';
    for (const r of raw.Equipos) {
      const a = S(r[0]);
      if (a === 'Siglas') { mode = 'teams'; continue; }
      if (a === 'Equipo' && S(r[1]) === 'Nº') { mode = 'hall'; continue; }
      if (a.startsWith('HALL DE LA FAMA')) { mode = ''; continue; }
      if (mode === 'teams' && a && S(r[1])) {
        DB.teams[a] = {
          sig: a, name: S(r[1]), short: S(r[2]) || S(r[1]), coach: S(r[3]), logo: S(r[4]),
          color: S(r[5]) || '#9296AD',
          about: S(r[6]).split(/\n\s*\n|\n/).map(x => x.trim()).filter(Boolean),
          hall: []
        };
        DB.teamOrder.push(a);
      } else if (mode === 'hall' && DB.teams[a] && S(r[2])) {
        DB.teams[a].hall.push({ n: N(r[1]), poke: S(r[2]), nick: S(r[3]) });
      }
    }
    Object.values(DB.teams).forEach(t => t.hall.sort((x, y) => x.n - y.n));

    // Historia: tablas de niveles y puntos
    DB.levels = {}; DB.points = {};
    DB.historia = { title: 'Historia del VS', paras: [] };
    DB.rules = { Nuzlocke: [], VS: [] };
    DB.gallery = [];
    mode = '';
    for (const r of raw.Historia) {
      const a = S(r[0]), b = S(r[1]), c = S(r[2]), d = S(r[3]);
      if (a === 'HISTORIA DEL VS') { mode = 'hist'; continue; }
      if (a.startsWith('REGLAMENTOS')) { mode = 'rules'; continue; }
      if (a.startsWith('TABLA · Niveles')) { mode = 'levels'; continue; }
      if (a.startsWith('TABLA · Puntos')) { mode = 'points'; continue; }
      if (a === 'GALERÍA') { mode = 'gal'; continue; }
      if (mode === 'hist') {
        if (a === 'Título' && c) DB.historia.title = c;
        else if (/^Párrafo/.test(a) && c) DB.historia.paras.push(c);
      } else if (mode === 'rules') {
        if ((a === 'Nuzlocke' || a === 'VS') && c) DB.rules[a].push({ type: b || 'Regla', text: c });
      } else if (mode === 'levels') {
        if (a && a !== 'Jornada' && b) DB.levels[N(a)] = N(b);
      } else if (mode === 'points') {
        if (a && a !== 'Resultado' && b !== '') DB.points[a] = N(b);
      } else if (mode === 'gal') {
        if (a && !a.startsWith('Archivo') && !a.startsWith('Ejemplo')) DB.gallery.push({ file: a, date: b, title: c, quote: d });
      }
    }
    if (!Object.keys(DB.points).length) DB.points = { 'Victoria 2-0': 3, 'Victoria 2-1': 2, 'Derrota 1-2': 1, 'Derrota 0-2': 0 };

    // Jornadas (calendario)
    DB.enfs = []; DB.enfById = {};
    for (const r of raw.Jornadas) {
      const id = S(r[0]); const m = id.match(ENF_ID); if (!m) continue;
      const iso = S(r[31]);
      let date = null, hasTime = false;
      if (iso) { date = new Date(iso.length > 10 ? iso : iso + 'T00:00'); hasTime = iso.length > 10; if (isNaN(date)) date = null; }
      const e = {
        id, j: +m[1], n: +m[2], formato: S(r[3]) || (+m[1] === 1 ? 'Singles' : 'Dobles'),
        duo: S(r[4]) === '2vs2', local: S(r[5]).split('+').filter(Boolean), visit: S(r[7]).split('+').filter(Boolean),
        date, hasTime, replays: [S(r[11]), S(r[12]), S(r[13])],
        combats: [1, 2, 3].map(c => ({ n: c, sides: { Local: newSide(), Visitante: newSide() } }))
      };
      DB.enfs.push(e); DB.enfById[id] = e;
    }

    // Enfrentamientos (plantillas de combate)
    for (const r of raw.Enfrentamientos) {
      const id = S(r[0]); const rol = S(r[6]);
      if (!ENF_ID.test(id) || !['Titular', 'Baneado', 'Suplente'].includes(rol)) continue;
      const e = DB.enfById[id]; if (!e) continue;
      const cb = e.combats[N(r[3]) - 1]; if (!cb) continue;
      const lado = S(r[4]) === 'Visitante' ? 'Visitante' : 'Local';
      const poke = S(r[9]); const ko = /^s[ií]/i.test(S(r[18]));
      const kills = N(r[19]), assists = N(r[20]);
      if (!poke && !ko && !kills && !assists) continue;
      const sideTeams = lado === 'Local' ? e.local : e.visit;
      const mon = {
        team: S(r[8]) || sideTeams[0], poke, nick: S(r[10]), gender: S(r[11]),
        level: N(r[12]) || DB.levels[e.j] || '', item: S(r[13]),
        moves: [S(r[14]), S(r[15]), S(r[16]), S(r[17])].filter(Boolean),
        ko, kills, assists
      };
      const side = cb.sides[lado];
      if (rol === 'Titular') side.tit.push(mon); else if (rol === 'Baneado') side.ban = mon; else side.sub = mon;
    }

    // Resultados
    for (const e of DB.enfs) {
      e.w = { Local: 0, Visitante: 0 }; e.kos = { Local: 0, Visitante: 0 };
      for (const cb of e.combats) {
        // KOs hechos por un lado = pokémon titulares del rival marcados como KO
        cb.kos = { Local: cb.sides.Visitante.tit.filter(m => m.ko).length, Visitante: cb.sides.Local.tit.filter(m => m.ko).length };
        cb.hasData = cb.sides.Local.tit.length + cb.sides.Visitante.tit.length > 0 || cb.kos.Local + cb.kos.Visitante > 0;
        cb.winner = cb.kos.Local > cb.kos.Visitante ? 'Local' : cb.kos.Visitante > cb.kos.Local ? 'Visitante' : null;
        if (cb.winner) e.w[cb.winner]++;
        e.kos.Local += cb.kos.Local; e.kos.Visitante += cb.kos.Visitante;
      }
      e.played = e.combats.filter(c => c.winner);
      e.hasData = e.combats.some(c => c.hasData);
      e.state = (e.w.Local >= 2 || e.w.Visitante >= 2) ? 'jugado' : (e.kos.Local + e.kos.Visitante > 0 ? 'curso' : 'pendiente');
      e.pts = { Local: null, Visitante: null };
      if (e.state === 'jugado') {
        const res = (me, op) => me >= 2 ? (op === 0 ? 'Victoria 2-0' : 'Victoria 2-1') : (me === 0 ? 'Derrota 0-2' : 'Derrota 1-2');
        e.pts.Local = DB.points[res(e.w.Local, e.w.Visitante)] ?? 0;
        e.pts.Visitante = DB.points[res(e.w.Visitante, e.w.Local)] ?? 0;
        e.winner = e.w.Local > e.w.Visitante ? 'Local' : 'Visitante';
      }
    }

    // Jornadas con datos
    DB.jornadas = [1, 2, 3, 4].map(j => {
      const list = DB.enfs.filter(e => e.j === j);
      return { j, enfs: list, hasData: list.some(e => e.hasData), hasDate: list.some(e => e.date), done: list.length > 0 && list.every(e => e.state === 'jugado') };
    });

    // Clasificación
    DB.stand = {};
    for (const sig of DB.teamOrder) DB.stand[sig] = { sig, pts: 0, byJ: {}, made: 0, recv: 0, won: 0, lost: 0, played: 0, ewon: 0, elost: 0 };
    for (const e of DB.enfs) {
      for (const [lado, teams] of [['Local', e.local], ['Visitante', e.visit]]) {
        const op = lado === 'Local' ? 'Visitante' : 'Local';
        for (const sig of teams) {
          const s = DB.stand[sig]; if (!s) continue;
          const bj = s.byJ[e.j] || (s.byJ[e.j] = { pts: 0, made: 0, recv: 0, has: false });
          s.made += e.kos[lado]; s.recv += e.kos[op]; bj.made += e.kos[lado]; bj.recv += e.kos[op];
          s.won += e.w[lado]; s.lost += e.w[op];
          if (e.state === 'jugado') { if (e.winner === lado) s.ewon++; else s.elost++; }
          if (e.hasData) { bj.has = true; s.played++; }
          if (e.pts[lado] !== null) { s.pts += e.pts[lado]; bj.pts += e.pts[lado]; }
        }
      }
    }
    DB.ranking = DB.teamOrder.map(s => DB.stand[s]).sort((a, b) => (b.pts - a.pts) || ((b.made - b.recv) - (a.made - a.recv)) || (DB.teamOrder.indexOf(a.sig) - DB.teamOrder.indexOf(b.sig)));
    DB.ranking.forEach((s, i) => { s.pos = i + 1; });

    // Insignias
    const PRIZE = { 'MVP': 'mvp', 'Máximo asistente': 'asist', 'DPOY': 'dpoy', '6th Pokémon': 'sexto', 'ALL-GBA 1st Team': 'first', 'ALL-GBA 2nd Team': 'second' };
    DB.awards = [];
    for (const r of raw.Insignias) {
      // Jornada 1-4, o "Total" (premios del reto elegidos a mano; si Google anula el texto llega vacío)
      const type = PRIZE[S(r[1])]; const a = S(r[0]);
      const j = (!a || /^total$/i.test(a)) ? 'T' : N(a);
      if (!type || !j || !S(r[4])) continue;
      DB.awards.push({ j, type, n: N(r[2]), team: S(r[3]), poke: S(r[4]), nick: S(r[5]) });
    }
    return DB;
  }

  function newSide() { return { tit: [], ban: null, sub: null }; }

  async function load() {
    if (!CFG.DATA_DIR && (!CFG.SHEET_ID || /PEGA_AQUI/.test(CFG.SHEET_ID))) throw new Error('Falta poner el ID del Google Sheet en js/config.js');
    const results = await Promise.all(TABS.map(fetchTab));
    const raw = {}; TABS.forEach((t, i) => { raw[t] = results[i]; });
    return build(raw);
  }

  window.RetoData = { load, parseCSV };
})();
