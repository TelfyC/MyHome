if (new URLSearchParams(location.search).get('view') === 'model') {
  await import('./model-app');
} else if (new URLSearchParams(location.search).get('scene') === 'panorama') {
  const { startPanoramaTour } = await import('./panorama');
  startPanoramaTour();
} else {
  const { startRoomTour } = await import('./room-tour');
  startRoomTour();
}
export {};
