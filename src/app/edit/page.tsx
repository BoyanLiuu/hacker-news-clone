import { notFound, redirect } from "next/navigation";
import { EditForm } from "@/components/edit-form";
import { PageHead, PageShell } from "@/components/page-shell";
import { editWindow } from "@/lib/edit-window";
import { formatMinutesLeft } from "@/lib/format";
import { getPostById } from "@/services/posts";
import { requireViewer } from "@/services/require";
import { getViewerOpts } from "@/services/viewer";

type Search = Promise<{ id?: string }>;

/**
 * Edit your own post, inside the window.
 *
 * Everything is decided in the page body, before the first byte: a `redirect()` or `notFound()`
 * after streaming has begun cannot set a status, and this page's whole job is to decide whether
 * you may be here. No Suspense boundary either, and here that follows rather than being a separate
 * choice — every read this page makes is one a gate already needed, so there is nothing left to
 * stream behind a fallback.
 *
 * The action re-checks ownership and the window. This page decides what to *show*; it is not the
 * permission check, because the action is reachable without it.
 */
export default async function EditPage({ searchParams }: { searchParams: Search }) {
  const [params, viewer, opts] = await Promise.all([searchParams, requireViewer(), getViewerOpts()]);

  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) notFound();

  const post = await getPostById(id, opts);
  if (!post) notFound();

  // Someone else's post, or past the window: back to the thread, which is where the answer is.
  if (post.author !== viewer.user.username) redirect(`/item?id=${id}`);

  const { open, closesAt } = editWindow(post.createdAt);
  if (!open) redirect(`/item?id=${id}`);

  return (
    <PageShell nav="">
      <PageHead title="Edit post" sub={post.title} />
      <EditForm
        postId={post.id}
        title={post.title}
        url={post.url}
        text={post.text}
        closesIn={formatMinutesLeft(closesAt) ?? "shortly"}
      />
    </PageShell>
  );
}
