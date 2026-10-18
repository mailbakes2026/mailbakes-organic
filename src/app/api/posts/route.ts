import { handle, requireUser } from "@/lib/api";
import { createPost, listPosts } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireUser();
    return Response.json(await listPosts());
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const post = await createPost(user, await request.formData());
    return Response.json(post, { status: 201 });
  });
}
