export default function testBroadcastChannel (id) {
  const mainWorldId = `main world ${id}`;
  const channel = new BroadcastChannel('xkit_test');
  channel.addEventListener('message', (event) => {
    if (event.data.id === id) return;
    const now = performance.timeOrigin + performance.now();
    console.log(`${mainWorldId} received message: ${event.data.message}. delay: ${now - event.data.now}`);
  });
}
