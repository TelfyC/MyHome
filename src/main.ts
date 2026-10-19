if (new URLSearchParams(location.search).get('view') === 'model') {
  await import('./model-app');
} else {
  const { startPanoramaTour } = await import('./panorama');
  startPanoramaTour();
}
export {};
