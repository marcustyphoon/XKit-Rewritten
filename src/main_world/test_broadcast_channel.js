export default function testBroadcastChannel (id) {
  const mainWorldId = `main world ${id}`;
  const channel = new BroadcastChannel('xkit_test');
  channel.addEventListener('message', (event) => {
    console.log(`${mainWorldId} received message: ${event.data}`);
  });
}
