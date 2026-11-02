if (new URLSearchParams(location.search).get('view') === 'plan-c') {
  const { startPlanC } = await import('./plan-c');
  await startPlanC();
} else if (new URLSearchParams(location.search).get('view') === 'model') {
  await import('./model-app');
} else {
  const { startPanoramaTour } = await import('./panorama');
  startPanoramaTour();
}
export {};
