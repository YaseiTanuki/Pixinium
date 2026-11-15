export const RUFFLE_SCRIPT = 'https://cdn.jsdelivr.net/npm/@ruffle-rs/ruffle@0.7.1/ruffle.js'

export function swfPlayerDocument(url: string) {
  const source = JSON.stringify(url).replace(/</g, '\\u003c')
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Play game</title>
<style>html,body{margin:0;width:100%;height:100%;background:#111;color:#fff;font:16px sans-serif}ruffle-player{width:100%;height:100%;display:block}p{padding:1rem}</style></head>
<body><p id="status" role="alert" hidden></p><script src="${RUFFLE_SCRIPT}" onerror="document.getElementById('status').hidden=false;document.getElementById('status').textContent='The Flash player could not load. You can still download the ZIP.'"></script><script>
(async()=>{try{const ruffle=window.RufflePlayer.newest();const player=ruffle.createPlayer();document.body.appendChild(player);
await player.ruffle().load({url:${source},allowScriptAccess:false,openUrlMode:'allow',allowNetworking:'all',autoplay:'on'});
document.getElementById('status').remove();}catch(error){document.getElementById('status').hidden=false;document.getElementById('status').textContent='This game could not start. You can still download the ZIP.';}})();
</script></body></html>`
}
