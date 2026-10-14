/* つながりノート AI質問画像共有アドオン v1.0
   index.html の既存コードは変更せず、末尾で読み込む。 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const button = document.createElement('button');
  button.id = 'askAIImage';
  button.type = 'button';
  button.textContent = '📸 AIに質問';
  button.style.cssText = 'background:#195c78;color:white;border-color:#195c78;flex:1;font-weight:700';
  const tools = $('readTools');
  if (!tools) return;
  tools.style.flexWrap = 'wrap';
  tools.appendChild(button);

  const wrap = (ctx, text, maxWidth) => {
    const out = [];
    for (const para of String(text || '').split(/\r?\n/)) {
      if (!para) { out.push(''); continue; }
      let line = '';
      for (const ch of Array.from(para)) {
        if (ctx.measureText(line + ch).width > maxWidth && line) {
          out.push(line); line = ch;
        } else line += ch;
      }
      out.push(line);
    }
    return out;
  };
  const image = src => new Promise(resolve => {
    if (!src || !/^data:image\//.test(src)) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  const pngBlob = canvas => new Promise((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('画像生成に失敗しました')), 'image/png')
  );
  const saveFile = (file) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  const safeName = s => String(s || '項目').replace(/[\\/:*?"<>|]/g, '_').slice(0, 45);
  const makeCard = async (node, currentMap) => {
    const related = (currentMap.edges || []).filter(e => e.from === node.id || e.to === node.id)
      .map(e => {
        const otherId = e.from === node.id ? e.to : e.from;
        const other = currentMap.nodes.find(n => n.id === otherId);
        return other ? `・${other.title}${e.label ? '（' + e.label + '）' : ''}` : null;
      }).filter(Boolean).slice(0, 12);
    const W = 900, pad = 62, textW = W - pad * 2;
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    const blocks = [];
    const add = (text, size, color, weight = '400', gap = 8) => {
      ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif`;
      const lines = wrap(ctx, text, textW);
      blocks.push({lines, size, color, weight, gap});
    };
    add('つながりノート  /  AI学習カード', 22, '#4c7387', '600', 30);
    add('マップ：' + currentMap.name, 25, '#355c70', '600', 22);
    add(node.title, 39, '#142e42', '700', 22);
    if (node.kind || node.date) add([node.kind, node.date].filter(Boolean).join('  ·  '), 21, '#557385', '400', 26);
    add('【メモ】', 26, '#17647a', '700', 12);
    add(node.note || 'メモはまだありません。', 25, '#243f4e', '400', 24);
    if (related.length) {
      add('【関連項目】', 26, '#17647a', '700', 12);
      add(related.join('\n'), 23, '#243f4e', '400', 22);
    }
    if (node.url) {
      add('【参考URL】', 26, '#17647a', '700', 10);
      add(node.url, 20, '#315f8c', '400', 18);
    }
    const pic = await image(node.photo);
    let picH = 0;
    if (pic) picH = Math.min(440, Math.round(pic.height * Math.min(textW / pic.width, 440 / pic.height)));
    const textH = blocks.reduce((h, b) => h + b.lines.length * (b.size * 1.55) + b.gap, 0);
    cv.width = W; cv.height = Math.ceil(52 + textH + (pic ? picH + 38 : 0) + 85);
    ctx.fillStyle = '#f4f8fb'; ctx.fillRect(0, 0, W, cv.height);
    ctx.fillStyle = '#dcecf3'; ctx.fillRect(0, 0, W, 15);
    let y = 62;
    for (const b of blocks) {
      ctx.font = `${b.weight} ${b.size}px -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif`;
      ctx.fillStyle = b.color; ctx.textBaseline = 'top';
      for (const line of b.lines) { ctx.fillText(line, pad, y); y += b.size * 1.55; }
      y += b.gap;
    }
    if (pic) {
      y += 5;
      const drawW = Math.round(pic.width * picH / pic.height);
      ctx.drawImage(pic, pad, y, drawW, picH);
      y += picH + 25;
    }
    ctx.fillStyle = '#5b7b8a'; ctx.font = '19px -apple-system, sans-serif';
    ctx.fillText('この内容について、わかりやすく説明してください。', pad, cv.height - 53);
    return cv;
  };
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    const currentMap = typeof map !== 'undefined' ? map : null;
    const currentId = typeof readId !== 'undefined' ? readId : null;
    const node = currentMap?.nodes?.find(n => n.id === currentId);
    if (!node) { alert('質問したい項目を選んでください。'); return; }
    button.disabled = true;
    button.textContent = '画像を作成中…';
    try {
      const card = await makeCard(node, currentMap);
      const blob = await pngBlob(card);
      const file = new File([blob], `つながりノート_${safeName(node.title)}.png`, { type: 'image/png' });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        try {
          await navigator.share({ files: [file], title: `学習メモ：${node.title}` });
          return;
        } catch (e) {
          if (e.name === 'AbortError') return;
          // 共有できなかった場合は画像保存へフォールバック
        }
      }
      saveFile(file);
      alert('質問用画像を保存しました。ChatGPTで画像を添付して質問してください。');
    } catch (e) {
      alert('画像を作成できませんでした：' + e.message);
    } finally {
      button.disabled = false;
      button.textContent = '📸 AIに質問';
    }
  });
})();
