// Native CDP touch input exercises real pointer capture and multi-touch routing.
export async function withTouch(client, action) {
  const { cdpUrl } = await client.browser('get', 'cdp-url');
  const url = new URL(cdpUrl);
  if (url.protocol !== 'ws:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Touch checks require a local browser CDP endpoint');
  const socket = new WebSocket(cdpUrl);
  const pending = new Map();
  let next = 0, sessionId, touching = false;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id); clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  });
  const rejectPending = () => {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Touch CDP connection closed')); }
    pending.clear();
  };
  socket.addEventListener('close', rejectPending);
  const send = (method, params = {}, session = sessionId) => new Promise((resolve, reject) => {
    const id = ++next;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Touch CDP timeout: ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(session ? {sessionId:session} : {}) }));
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Touch CDP connection timeout')), 10000);
      socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, {once:true});
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Touch CDP connection failed')); }, {once:true});
    });
    const href = await client.evaluate('location.href');
    const { targetInfos } = await send('Target.getTargets');
    const target = targetInfos.find(target => target.type === 'page' && target.url === href);
    if (!target) throw new Error('Touch CDP page target not found');
    ({ sessionId } = await send('Target.attachToTarget', {targetId:target.targetId,flatten:true}));
    await send('Emulation.setTouchEmulationEnabled', {enabled:true,maxTouchPoints:2});
    await action(async (type, touchPoints) => {
      const result = await send('Input.dispatchTouchEvent', {type,touchPoints});
      touching = touchPoints.length > 0 && type !== 'touchCancel';
      return result;
    });
  } finally {
    if (sessionId && socket.readyState === WebSocket.OPEN) {
      try { if (touching) await send('Input.dispatchTouchEvent', {type:'touchCancel',touchPoints:[]}); }
      finally { try { await send('Emulation.setTouchEmulationEnabled', {enabled:false}); } finally { socket.close(); } }
    } else socket.close();
    rejectPending();
  }
}
