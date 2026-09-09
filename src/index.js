export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "zyven-license"
      });
    }

    return new Response("Zyven License Server", {
      status: 200
    });
  }
};
