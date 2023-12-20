interface Env {
  tsdocsReflections: any; // Replace 'any' with the actual type of MY_BUCKET if available
  R2_ACCESS_SECRET: any;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const key = url.pathname.slice(1);

    if (request.headers.get("X-CF-WORKERS-KEY") !== env.R2_ACCESS_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }

    switch (request.method) {
      case "PUT":
        await env.tsdocsReflections.put(key, request.body);
        return new Response(`Put ${key} successfully!`);
      case "GET":
        const object = await env.tsdocsReflections.get(key);

        if (object === null) {
          return new Response("Object Not Found", { status: 404 });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);

        return new Response(object.body, {
          headers,
        });
      case "DELETE":
        await env.tsdocsReflections.delete(key);
        return new Response("Deleted!");

      default:
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            Allow: "PUT, GET, DELETE",
          },
        });
    }
  },
};
