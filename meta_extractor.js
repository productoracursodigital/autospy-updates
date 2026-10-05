() => {
  const labelRe = /(Library ID|ID de la biblioteca|Identificador de la biblioteca)/i;
  const idRe = /(?:Library ID|ID de la biblioteca|Identificador de la biblioteca)\s*:?\s*(\d{8,})/i;
  const idEls = [];
  const seenIds = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (!labelRe.test(n.nodeValue)) continue;
    let el = n.parentElement, m = null;
    for (let k = 0; k < 3 && el && !m; k++) {
      m = idRe.exec(el.textContent || '');
      if (!m) el = el.parentElement;
    }
    if (m && !seenIds.has(m[1])) { seenIds.add(m[1]); idEls.push({el: n.parentElement, id: m[1]}); }
  }
  const realUrl = (h) => {
    try {
      const u = new URL(h);
      if (/(^|\.)facebook\.com$/.test(u.hostname) && u.pathname === '/l.php') return u.searchParams.get('u') || '';
      return h;
    } catch (e) { return ''; }
  };
  const isFb = (h) => { try { return /(^|\.)(facebook|instagram|fbcdn|fb)\.(com|net)$/.test(new URL(h).hostname); } catch (e) { return true; } };
  const out = [];
  for (const {el, id} of idEls) {
    let c = el, depth = 0;
    while (c.parentElement && depth < 25) {
      const p = c.parentElement;
      if (idEls.some(x => x.id !== id && p.contains(x.el))) break;
      c = p; depth++;
    }
    c.setAttribute('data-as-id', id);
    const text = c.innerText || '';
    const anchors = Array.from(c.querySelectorAll('a[href]'));

    // Página de Facebook que corre el anuncio
    let pageName = '', pageUrl = '', pageId = '';
    for (const a of anchors) {
      let u; try { u = new URL(a.href); } catch (e) { continue; }
      const mm = /view_all_page_id=(\d+)/.exec(a.href);
      if (mm && !pageId) pageId = mm[1];
      if (!/(^|\.)facebook\.com$/.test(u.hostname)) continue;
      if (u.pathname === '/l.php' || u.pathname.startsWith('/ads/') || u.pathname.startsWith('/help')) continue;
      const nm = (a.innerText || a.getAttribute('aria-label') || '').trim().split('\n')[0];
      if (!nm) continue;
      if (!pageName) {
        pageName = nm;
        pageUrl = u.origin + u.pathname + (u.pathname === '/profile.php' ? u.search : '');
        const pm = /^\/(\d{6,})\/?$/.exec(u.pathname) || /[?&]id=(\d+)/.exec(u.search);
        if (pm && !pageId) pageId = pm[1];
      }
    }

    // Sitio web de destino
    let destino = '';
    for (const a of anchors) {
      const r = realUrl(a.href);
      if (r && /^https?:/.test(r) && !isFb(r)) { destino = r; break; }
    }
    let dominio = '';
    if (destino) { try { dominio = new URL(destino).hostname.replace(/^www\./, ''); } catch (e) {} }
    if (!dominio) {
      const mm = text.split('\n').map(s => s.trim()).find(s => /^[A-Z0-9][A-Z0-9.\-]*\.[A-Z]{2,}(\/\S*)?$/.test(s));
      if (mm) dominio = mm.toLowerCase().split('/')[0];
    }

    // Medios
    const videos = Array.from(c.querySelectorAll('video'));
    let videoUrl = '', poster = '';
    for (const v of videos) {
      const s = v.currentSrc || v.src || (v.querySelector('source') ? v.querySelector('source').src : '');
      if (s && /^https?:/.test(s) && !videoUrl) videoUrl = s;
      if (v.poster && !poster) poster = v.poster;
    }
    const imgs = Array.from(c.querySelectorAll('img')).map(i => {
      const r = i.getBoundingClientRect();
      return {src: i.currentSrc || i.src || '', w: r.width, h: r.height};
    }).filter(i => /^https?:/.test(i.src) && i.w >= 120 && i.h >= 120);
    imgs.sort((a, b) => (b.w * b.h) - (a.w * a.h));
    const imagen = poster || (imgs[0] ? imgs[0].src : '');
    const tipo = videos.length ? 'video' : (imgs.length >= 2 ? 'carrusel' : 'imagen');

    // Texto, fecha, versiones
    let texto = '';
    const body = c.querySelector('div[style*="pre-wrap"]');
    if (body) texto = (body.innerText || '').trim();
    if (!texto) {
      texto = text.split('\n').map(s => s.trim()).filter(s => s.length > 40 && !labelRe.test(s))
                  .sort((a, b) => b.length - a.length)[0] || '';
    }
    const fm = /(?:Started running on|En circulaci[oó]n desde(?: el)?|Se empez[oó] a publicar(?: el)?)\s+([^\n|·]+)/i.exec(text);
    const vm = /(\d+)\s+(?:ads?|anuncios?)\s+(?:use|usan|utilizan)/i.exec(text);
    out.push({
      id, page_name: pageName, page_url: pageUrl, page_id: pageId,
      url_destino: destino, dominio, tipo, video_url: videoUrl, imagen_url: imagen,
      texto: texto.slice(0, 400), fecha_txt: fm ? fm[1].trim() : '', versiones: vm ? parseInt(vm[1]) : 1,
    });
  }
  return out;
}
