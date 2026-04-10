'use strict';

/* ── Utilities ─────────────────────────────────────────── */

// Shorthand — avoids repeated getElementById calls
const $ = id => document.getElementById(id);
const v = id => $(id).value.trim();

// XSS prevention: escape before any innerHTML insertion
// Single-pass regex is faster than three chained replaces
const esc = s => s.replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]));

// One formatter for both long and short date displays
const fmt = (s, opts) => s
    ? new Date(s + 'T12:00:00').toLocaleDateString('en-US', opts)
    : null;

const LONG  = { weekday:'long',  year:'numeric', month:'long', day:'numeric' };
const SHORT = {                  year:'numeric', month:'long', day:'numeric' };


/* ── Data readers ──────────────────────────────────────── */

// Centralised story definition — add new sections here only
const STORY_DEFS = [
    { sec:'Home & Family',           ids:['h-hl',  'h-sub',  'h-body',  'h-quote']  },
    { sec:'Work & Career',           ids:['w-hl',  'w-sub',  'w-body',  'w-quote']  },
    { sec:'Health & Wellness',       ids:['hl-hl', 'hl-sub', 'hl-body', 'hl-quote'] },
    { sec:'Entertainment & Leisure', ids:['e-hl',  'e-sub',  'e-body',  'e-quote']  },
    { sec:'Community & Social',      ids:['c-hl',  'c-sub',  'c-body',  'c-quote']  },
    { sec:'Looking Ahead',           ids:['la-hl', null,     'la-body', null]        },
];

function readStories() {
    return STORY_DEFS.map(({ sec, ids: [hl, sub, body, q] }) => ({
        sec,
        hl:   v(hl)   || '',
        sub:  sub  ? v(sub)  : '',
        body: v(body) || '',
        q:    q    ? v(q)    : '',
    })).filter(s => s.hl || s.body);
}

function readStats() {
    return [[v('s1v'),v('s1l')],[v('s2v'),v('s2l')],[v('s3v'),v('s3l')],[v('s4v'),v('s4l')]]
        .filter(([val, lbl]) => val && lbl);
}


/* ── Builders (pure: input → HTML string) ──────────────── */

/**
 * @param {{sec,hl,sub,body,q}} story
 * @param {'xl'|'lg'|'md'}      size
 * @param {string}              byline  — '' to omit
 * @param {1|2|3}               cols    — body column count
 * @param {string}              role    — data-role attribute value
 */
function buildSection({ sec, hl, sub, body, q }, size, byline = '', cols = 1, role = '') {
    if (!hl && !body) return '';
    const a = []; // build as array → single join is faster than string concat
    a.push(`<section data-size="${size}"${cols > 1 ? ` data-cols="${cols}"` : ''}${role ? ` data-role="${role}"` : ''}>`);
    if (sec)          a.push(`<header>${esc(sec)}</header>`);
    if (hl)           a.push(`<h2>${esc(hl)}</h2>`);
    if (sub)          a.push(`<h3>${esc(sub)}</h3>`);
    if (byline)       a.push(`<address>${esc(byline)}</address>`);
    if (body)         a.push(`<p>${esc(body)}</p>`);
    if (q && body)    a.push(`<figure>${esc(q)}</figure>`);
    a.push('</section>');
    return a.join('');
}

function buildStats(pairs) {
    if (!pairs.length) return '';
    return '<dl>' + pairs.map(([val, lbl]) =>
        `<div><dt>${esc(val)}</dt><dd>${esc(lbl)}</dd></div>`
    ).join('') + '</dl>';
}


/* ── Layout strategy ────────────────────────────────────
   LAYOUT maps rest-story count → layout function.
   To add a new layout, add an entry to this object.
   Falls back to `d` (default) for counts above 3.
   ═══════════════════════════════════════════════════════ */
const grid = (cls, html) => `<div class="${cls}">${html}</div>`;
const sec  = (s, size)   => buildSection(s, size);

const LAYOUT = {
    0: ()        => '',
    1: (r, by)   => buildSection(r[0], 'lg', by),
    2: (r)       => grid('two-up',   r.map(s => sec(s,'lg')).join('')),
    3: (r, by)   => buildSection(r[0], 'lg', by) +
                    grid('two-up',   r.slice(1).map(s => sec(s,'md')).join('')),
    d: (r, by)   => buildSection(r[0], 'lg', by) +
                    grid('three-up', r.slice(1).map(s => sec(s,'md')).join('')),
};

const layoutRest = (rest, by) => (LAYOUT[rest.length] ?? LAYOUT.d)(rest, by);


/* ── Orchestrator ──────────────────────────────────────── */

function generate() {
    const date   = v('ed-date');
    const name   = v('ed-name');
    const byline = name ? `By ${name} · Personal Correspondent` : '';
    
    // Nameplate — direct textContent writes, no innerHTML
    $('np-date').textContent        = fmt(date, LONG)  || '—';
    $('np-editor').textContent      = name ? `By ${name}` : 'Personal Edition';
    $('np-weather').textContent     = v('wx') ? `⛅ ${v('wx')}` : '';
    $('np-motto').textContent       = v('ed-motto') || "A personal record of the week's events";
    $('np-footer-date').textContent = fmt(date, SHORT) || 'Personal Edition';
    
    const stories = readStories();
    const stats   = readStats();
    const note    = v('ed-note');
    
    // Empty state handled by CSS :empty — just clear and return
    if (!stories.length && !stats.length && !note) {
        $('np-body').innerHTML = '';
        return;
    }
    
    const parts = [];
    
    // Lead: always XL, auto-column if long enough
    if (stories.length) {
        const lead = stories[0];
        parts.push(buildSection(lead, 'xl', byline, lead.body.length > 350 ? 2 : 1));
    }
    
    parts.push(buildStats(stats));
    parts.push(layoutRest(stories.slice(1), byline));
    
    if (note) parts.push(buildSection({ sec:"Editor's Note", hl:'', sub:'', body:note, q:'' }, 'md', '', 1, 'note'));
    
    $('np-body').innerHTML = parts.join('');
    
    // Re-trigger CSS animation without class toggling
    const el = $('newspaper');
    el.style.animation = 'none';
    el.offsetHeight;           // sync reflow — intentional
    el.style.animation = '';
}

/* ── Init ──────────────────────────────────────────────── */
$('ed-date').value = new Date().toISOString().split('T')[0];
