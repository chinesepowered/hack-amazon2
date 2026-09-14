import { EXT_APPS_BUNDLE } from "@/lib/generated/ext-apps-bundle";

// The MCP App (ui://bedtime-saga/storybook.html). A single self-contained HTML document that the
// host renders in a sandboxed iframe. It uses the official @modelcontextprotocol/ext-apps `App`
// class (inlined) to receive tool inputs/results and to send ui/message back to the host.

const CSS = String.raw`
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Nunito:wght@500;700;800&display=swap');
:root{--ink:#2b2140;--paper:#fff4dc;--paper2:#f7e7c4;--amber:#ffb54c;--rose:#f2998c;--night:#12163a;--muted:#7a6a8a}
*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden;background:var(--night);color:var(--paper);font-family:Nunito,'Trebuchet MS',system-ui,sans-serif}
#root{position:absolute;inset:0}
.view{position:absolute;inset:0;display:flex;animation:fadein .5s ease both}
@keyframes fadein{from{opacity:0}to{opacity:1}}
.turn{animation:turn .95s cubic-bezier(.2,.75,.2,1) both;transform-origin:left center}
@keyframes turn{from{opacity:.2;transform:perspective(1800px) rotateY(-62deg)}to{opacity:1;transform:perspective(1800px) rotateY(0)}}
.art{position:relative;overflow:hidden;background:#1b2150}
.art svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.paper{background:linear-gradient(180deg,var(--paper),var(--paper2));color:var(--ink)}
.eyebrow{font-weight:800;letter-spacing:.12em;text-transform:uppercase;font-size:12.5px;color:var(--muted)}
.serif{font-family:Fraunces,Georgia,serif}
.chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 11px;font-weight:800;font-size:13px;background:#2b21401a;color:var(--ink)}
.dots{display:flex;gap:7px}.dots i{width:10px;height:10px;border-radius:50%;background:#2b214033}.dots i.on{background:var(--amber)}
/* page (also the base of the choices view) */
.page .art{flex:0 0 60%}
.page .text{flex:1;padding:28px 28px 22px;display:flex;flex-direction:column;gap:12px;min-width:0}
.page .body{font-family:Fraunces,Georgia,serif;font-size:25px;line-height:1.38;flex:1;display:flex;align-items:center}
.page .foot{display:flex;justify-content:space-between;align-items:center}
.page.withchoices .body{font-size:18px;line-height:1.36;flex:0 0 auto;align-items:flex-start}
.ask{margin-top:auto;display:flex;flex-direction:column;gap:9px}
.ask h2{margin:0 0 2px;font-size:20px;line-height:1.2;color:var(--ink)}
.opt{border:0;border-radius:16px;padding:11px 14px;background:#fff;color:var(--ink);font-family:inherit;font-size:16.5px;font-weight:800;line-height:1.2;cursor:pointer;display:flex;align-items:center;gap:12px;text-align:left;box-shadow:0 6px 16px #2b214026, inset 0 0 0 2px #ffb54c55;transition:transform .2s, box-shadow .2s;animation:pop .5s cubic-bezier(.2,.9,.3,1.3) both}
.opt:nth-child(3){animation-delay:.08s}.opt:nth-child(4){animation-delay:.16s}
@keyframes pop{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}
.opt .em{width:38px;height:38px;flex:none;border-radius:50%;background:#ffb54c55;display:grid;place-items:center;font-size:21px}
.opt:hover{transform:translateX(3px)}.opt.picked{box-shadow:0 6px 16px #2b214033, inset 0 0 0 4px var(--amber);transform:scale(1.02)}.opt.dim{opacity:.45}
.hint{color:var(--muted);font-weight:800;font-size:13px}
.bubble{position:absolute;left:18px;bottom:16px;background:#12163ad0;color:var(--paper);padding:8px 14px;border-radius:999px;font-weight:800;font-size:14px;backdrop-filter:blur(4px)}
/* recap */
.recap .art{flex:0 0 52%}
.recap .text{flex:1;padding:26px 28px;display:flex;flex-direction:column;gap:10px}
.recap h1{margin:0;font-size:30px;line-height:1.1}
.recap p{margin:0;font-size:16.5px;line-height:1.45;color:#4a3d5c}
.cliff{background:#ffb54c33;border-left:5px solid var(--amber);padding:10px 12px;border-radius:10px;font-style:italic;font-family:Fraunces,Georgia,serif;font-size:17px;color:var(--ink)}
.cast{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto}
.nightbadge{position:absolute;left:18px;top:16px;background:#12163acc;color:var(--paper);border-radius:999px;padding:7px 14px;font-weight:800;font-size:14px;backdrop-filter:blur(4px)}
/* character */
.character .art{flex:0 0 50%}
.character .text{flex:1;padding:34px;display:flex;flex-direction:column;justify-content:center;gap:12px}
.character h1{margin:0;font-size:44px}
/* goodnight */
.goodnight .art{position:absolute;inset:0}
.goodnight .veil{position:absolute;inset:0;background:linear-gradient(180deg,#0b0f2c00 30%,#0b0f2cf2 88%)}
.goodnight .inner{position:absolute;left:40px;right:40px;bottom:30px;display:flex;flex-direction:column;gap:6px}
.goodnight h1{margin:0;font-size:52px;color:var(--paper)}
.goodnight .t{font-size:20px;font-weight:800;color:var(--amber)}
.goodnight .c{font-family:Fraunces,Georgia,serif;font-style:italic;font-size:19px;color:#fff4dcdd}
/* book */
.book{padding:22px;gap:0;background:radial-gradient(circle at 50% 0,#2a2f6e,#12163a)}
.spread{display:flex;flex:1;border-radius:18px;overflow:hidden;box-shadow:0 20px 50px #0009}
.spread .left{flex:0 0 38%;padding:22px 18px;display:flex;flex-direction:column;gap:10px;border-right:2px solid #d9c49a}
.spread .right{flex:1;display:flex;flex-direction:column}
.spread .right .art{flex:1}
.spread .right .cap{padding:14px 18px;font-size:15.5px;line-height:1.4;color:#4a3d5c}
.ch{display:flex;gap:10px;align-items:center;border:0;background:transparent;text-align:left;padding:8px;border-radius:12px;cursor:pointer;font-family:inherit;color:var(--ink)}
.ch.on{background:#ffb54c40}.ch .thumb{width:74px;height:46px;border-radius:8px;overflow:hidden;position:relative;flex:none}.ch .thumb svg{position:absolute;inset:0;width:100%;height:100%}
.ch b{display:block;font-family:Fraunces,Georgia,serif;font-size:17px}.ch small{color:var(--muted);font-weight:700}
/* checkout */
.checkout{background:radial-gradient(circle at 25% 40%,#343a80,#12163a 70%);align-items:center;padding:0 40px;gap:40px}
.hard{width:260px;height:330px;flex:none;position:relative;transform:perspective(1200px) rotateY(-18deg);border-radius:6px 16px 16px 6px;overflow:hidden;box-shadow:24px 26px 50px #0009, inset 8px 0 0 #0003;animation:float 5s ease-in-out infinite}
@keyframes float{0%,100%{transform:perspective(1200px) rotateY(-18deg) translateY(0)}50%{transform:perspective(1200px) rotateY(-14deg) translateY(-6px)}}
.hard .art{position:absolute;inset:0}.hard .art svg{width:auto;height:100%;left:50%;transform:translateX(-50%)}
.hard .title{position:absolute;left:0;right:0;bottom:0;padding:16px;background:linear-gradient(0deg,#12163aee,#12163a00);font-family:Fraunces,Georgia,serif;font-size:26px;line-height:1.05;color:var(--paper)}
.order{flex:1;background:var(--paper);color:var(--ink);border-radius:24px;padding:26px 28px;display:flex;flex-direction:column;gap:10px;box-shadow:0 20px 50px #0008}
.order h1{margin:0;font-size:30px}.order .price{font-family:Fraunces,Georgia,serif;font-size:40px;font-weight:700}
.row{display:flex;justify-content:space-between;font-weight:700;color:#4a3d5c;border-bottom:1px dashed #d9c49a;padding:6px 0}
.cta{margin-top:6px;border:0;border-radius:16px;padding:15px;font-family:inherit;font-weight:800;font-size:18px;background:var(--amber);color:var(--ink);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px}
.cta[disabled]{opacity:.7;cursor:default}
.fine{font-size:12.5px;color:var(--muted);text-align:center}
/* receipt */
.receipt{align-items:center;justify-content:center;flex-direction:column;gap:12px;background:radial-gradient(circle at 50% 30%,#343a80,#12163a 70%)}
.tick{width:92px;height:92px;border-radius:50%;background:#8fc0a0;display:grid;place-items:center;animation:pop .6s cubic-bezier(.2,.9,.3,1.4) both}
.receipt h1{margin:6px 0 0;font-size:40px}.receipt p{margin:0;font-size:18px;color:#fff4dcd0}
/* pending */
.pending{position:absolute;right:16px;top:14px;background:#12163ad9;color:var(--paper);padding:8px 14px;border-radius:999px;font-weight:800;font-size:14px;display:flex;gap:8px;align-items:center;opacity:0;transition:opacity .25s;z-index:5}
.pending.on{opacity:1}.spark{width:10px;height:10px;border-radius:50%;background:var(--amber);animation:pulse 1s ease-in-out infinite}
@keyframes pulse{0%,100%{transform:scale(.7);opacity:.6}50%{transform:scale(1.15);opacity:1}}
.empty{margin:auto;text-align:center;color:#fff4dcb0}.empty h1{font-size:40px;margin:0 0 8px;color:var(--paper)}
`;

const SCRIPT = String.raw`
const { App } = globalThis.ExtApps;
const root = document.getElementById('root');
const pending = document.getElementById('pending');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const EMOJI = {child:'🧒',fox:'🦊',hedgehog:'🦔',owl:'🦉',turtle:'🐢',whale:'🐋',bunny:'🐰',dragon:'🐉',bear:'🐻',cat:'🐱',mouse:'🐭',robot:'🤖'};
const PENDING = {get_saga_recap:'Opening the saga…',tell_story_page:'Turning the page…',offer_choices:'Thinking of choices…',add_character:'Meeting a new friend…',end_chapter:'Tucking the story in…',open_saga_book:'Opening the saga book…',preview_keepsake_book:'Preparing the keepsake…',confirm_keepsake_order:'Placing the order…'};

const app = new App({ name: 'Bedtime Saga storybook', version: '1.0.0' });

function setView(html, cls, turn) {
  root.innerHTML = '<div class="view ' + cls + (turn ? ' turn' : '') + '" data-testid="view-' + cls.split(' ')[0] + '">' + html + '</div>';
}

function render(v) {
  if (!v || !v.view) return;
  const r = RENDER[v.view];
  if (r) r(v);
}

function pageText(v) {
  const dots = Array.from({ length: v.pagesPerNight }, (_, i) => '<i class="' + (i < v.page.pageNumber ? 'on' : '') + '"></i>').join('');
  return '<div class="eyebrow">Night ' + v.night + ' · ' + esc(v.sceneLabel) + '</div>' +
    '<div class="body" data-testid="page-text">' + esc(v.page.text) + '</div>' +
    '<div class="foot"><div class="dots">' + dots + '</div><span class="eyebrow">Page ' + v.page.pageNumber + ' of ' + v.pagesPerNight + '</span></div>';
}

const RENDER = {
  recap(v) {
    const lc = v.lastChapter;
    setView(
      '<div class="art">' + (v.svg || '') + '<div class="nightbadge">Night ' + v.night + '</div></div>' +
      '<div class="text paper"><div class="eyebrow">Last time on ' + esc(v.child) + "'s saga…</div>" +
      (lc ? '<h1 class="serif">' + esc(lc.title) + '</h1><p>' + esc(lc.summary) + '</p><div class="cliff">' + esc(lc.cliffhanger) + '</div>' : '<h1 class="serif">A brand-new saga</h1>') +
      '<div class="cast">' + v.cast.map((c) => '<span class="chip">' + (EMOJI[c.kind] || '✨') + ' ' + esc(c.name) + '</span>').join('') + '</div></div>',
      'recap', true);
  },
  page(v) {
    setView('<div class="art">' + v.svg + '</div><div class="text paper">' + pageText(v) + '</div>', 'page', true);
  },
  choices(v) {
    const already = root.querySelector('.view.page');
    const opts = '<div class="ask"><h2 class="serif">' + esc(v.question) + '</h2>' +
      v.choices.map((c, i) => '<button class="opt" data-testid="choice-' + i + '" data-label="' + esc(c.label) + '"><span class="em">' + esc(c.emoji || '✨') + '</span><span>' + esc(c.label) + '</span></button>').join('') +
      '<div class="hint">' + esc(v.child) + ', say your choice or tap one</div></div>';
    if (v.page) {
      if (already) {
        // Keep the illustrated page on screen and slide the choices in under the text.
        already.classList.remove('turn');
        already.classList.add('withchoices');
        already.setAttribute('data-testid', 'view-choices');
        const text = already.querySelector('.text');
        text.querySelector('.foot')?.remove();
        text.insertAdjacentHTML('beforeend', opts);
      } else {
        setView('<div class="art">' + (v.svg || '') + '</div><div class="text paper">' + pageText(v).replace(/<div class="foot">[\s\S]*$/, '') + opts + '</div>', 'page withchoices', false);
      }
    } else {
      setView('<div class="art">' + (v.svg || '') + '</div><div class="text paper">' + opts + '</div>', 'page withchoices', false);
    }
    root.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', async () => {
      root.querySelectorAll('.opt').forEach((o) => o.classList.add(o === b ? 'picked' : 'dim'));
      await app.sendMessage({ role: 'user', content: [{ type: 'text', text: 'I choose: ' + b.dataset.label }] });
    }));
  },
  character(v) {
    setView(
      '<div class="art">' + v.svg + '</div><div class="text paper"><div class="eyebrow">A new friend joins the saga</div>' +
      '<h1 class="serif">' + esc(v.member.name) + '</h1><div><span class="chip">' + (EMOJI[v.member.kind] || '✨') + ' ' + esc(v.member.kind) + '</span></div>' +
      '<p style="font-size:19px;line-height:1.45;margin:0;color:#4a3d5c">' + esc(v.member.trait) + '</p>' +
      '<div class="eyebrow" style="margin-top:10px">Saved to the family saga · back on future nights</div></div>',
      'character', true);
  },
  goodnight(v) {
    setView(
      '<div class="art">' + v.svg + '</div><div class="veil"></div><div class="inner">' +
      '<div class="t">The end of night ' + v.night + ' · ' + esc(v.title) + '</div>' +
      '<h1 class="serif">Goodnight, ' + esc(v.child) + '</h1>' +
      '<div class="c">' + esc(v.goodnight) + '</div><div class="c" style="opacity:.8">Tomorrow: ' + esc(v.cliffhanger) + '</div></div>',
      'goodnight', false);
  },
  book(v) {
    let sel = v.chapters.length - 1;
    const draw = () => {
      const c = v.chapters[sel];
      setView(
        '<div class="spread"><div class="left paper"><div class="eyebrow">' + esc(v.child) + "'s saga book</div>" +
        v.chapters.map((ch, i) => '<button class="ch ' + (i === sel ? 'on' : '') + '" data-i="' + i + '"><span class="thumb">' + ch.svg + '</span><span><small>Night ' + ch.night + ' · ' + ch.pages + ' pages</small><b>' + esc(ch.title) + '</b></span></button>').join('') +
        '<div class="eyebrow" style="margin-top:auto">' + esc(v.familyName) + '</div></div>' +
        '<div class="right paper"><div class="art">' + c.svg + '</div><div class="cap"><b class="serif" style="font-size:19px">' + esc(c.title) + '</b><br>' + esc(c.summary) + '</div></div></div>',
        'book', false);
      root.querySelectorAll('.ch').forEach((b) => b.addEventListener('click', () => { sel = Number(b.dataset.i); draw(); }));
    };
    draw();
  },
  checkout(v) {
    setView(
      '<div class="hard"><div class="art">' + v.svg + '</div><div class="title">' + esc(v.child) + "'s Saga</div></div>" +
      '<div class="order"><div class="eyebrow">Keepsake hardcover</div><h1 class="serif">Print the saga so far</h1>' +
      '<div class="row"><span>Chapters</span><span>' + v.order.chapters + '</span></div>' +
      '<div class="row"><span>Illustrated pages</span><span>' + v.order.pages + '</span></div>' +
      '<div class="row"><span>' + esc(v.subscription.plan) + '</span><span>member price</span></div>' +
      '<div style="display:flex;align-items:baseline;justify-content:space-between"><span class="price">$' + v.order.priceUsd.toFixed(2) + '</span><span class="eyebrow">Order ' + esc(v.order.id) + '</span></div>' +
      '<button class="cta" data-testid="confirm-order">🔒 Parent: confirm order</button><div class="fine">Only a parent can confirm. Payments are simulated in this demo.</div></div>',
      'checkout', false);
    const btn = root.querySelector('.cta');
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = 'Confirmed · sending to Saga…';
      await app.sendMessage({ role: 'user', content: [{ type: 'text', text: 'Parent confirmed the keepsake order ' + v.order.id + '. Approval code: ' + v.approvalCode }] });
    });
  },
  receipt(v) {
    setView(
      '<div class="tick"><svg width="46" height="46" viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" stroke="#12163a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
      '<h1 class="serif">Keepsake book ordered</h1><p>' + esc(v.child) + "'s saga · " + v.order.chapters + (v.order.chapters === 1 ? ' chapter' : ' chapters') + ' · $' + v.order.priceUsd.toFixed(2) + '</p>' +
      '<p>Order ' + esc(v.order.id) + ' · arrives ' + esc(v.eta) + '</p><p style="font-size:13px;opacity:.7">Simulated payment · no card was charged</p>',
      'receipt', false);
  },
};

app.ontoolinput = (params) => {
  const name = (params && params._meta && params._meta.toolName) || '';
  pending.querySelector('span').textContent = PENDING[name] || 'Working on it…';
  pending.classList.add('on');
};
app.ontoolresult = (result) => {
  pending.classList.remove('on');
  if (!result || result.isError) return;
  render(result.structuredContent);
};
app.ontoolcancelled = () => pending.classList.remove('on');
app.onerror = (e) => console.error(e);
app.connect().catch((e) => console.error('connect failed', e));
`;

let cached: string | null = null;

export function storybookHtml(): string {
  if (cached) return cached;
  const bundle = EXT_APPS_BUNDLE.replace(/<\/script/gi, "<\\/script");
  cached = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bedtime Saga</title><style>${CSS}</style></head><body>
<div id="root"><div class="view"><div class="empty"><h1 class="serif">Bedtime Saga</h1><p>Say “Let's continue my saga”</p></div></div></div>
<div class="pending" id="pending"><i class="spark"></i><span>Working on it…</span></div>
<script>${bundle}</script><script>${SCRIPT}</script></body></html>`;
  return cached;
}
