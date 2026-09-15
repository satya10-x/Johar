export function getHealth(req, res) {
  res.json({
    success: true,
    message: 'JOHAR API is running',
    service: 'johar-backend',
    timestamp: new Date().toISOString(),
  });
}
