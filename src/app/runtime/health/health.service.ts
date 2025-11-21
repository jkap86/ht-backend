export const getServiceHealth = () => {
  return {
    status: "ok",
    service: "backend",
    timestamp: new Date().toISOString(),
  };
};
