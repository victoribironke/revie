export const healthCheck = () => {
  return new Response("The server is running", { status: 200 });
};
