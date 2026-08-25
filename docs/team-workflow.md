# Springboard Team Workflow

How the Springboard editorial team uses the Admin CMS at `/admin`. This
document is for people, not code — see `docs/development-workflow.md` for
how engineers work with the repository itself.

**The rule this whole document follows:** content lives in the Admin.
Code lives in Git/VS Code. Nothing in here ever requires opening a code
editor.

## Roles

| Role | Can do |
|---|---|
| **Contributor** | Create and edit their own content (draft/review), upload media (starts private), replace their own uploads, view their own contributor profile and article list |
| **Editor** | Everything a Contributor can, plus: publish/unpublish/archive/restore/schedule any content, manage Contributors/Categories/Sections/Publications, view Activity |
| **Admin** | Everything an Editor can, plus: manage Users and roles, manage Site Settings, manage Site Assets, promote/delete media |

If a button in the Admin doesn't do anything for your role, or shows a
permission error, that's expected — the underlying database enforces the
same rule the button represents, so it's not something a workaround fixes.

---

## Editorial team

### Create an article
1. **Content → New content**.
2. Fill in Title, Slug (used in the public URL — lowercase, hyphens only),
   Subtitle, Content type, Summary.
3. Set Author, Category, Publication, Section.
4. Add a cover image (see Media team, below, if you need to upload one first).
5. Build the body with **Content blocks** — Paragraph, Heading, Image,
   Gallery, Quote, Statistic, Video, Callout, Related content. Use **Add
   block** to add each one, the arrows to reorder.
6. **Save draft.**

### Preview
Click **Preview** at any point — this shows exactly what the public page
will look like, without publishing anything. Only you, editors, and admins
can see a preview; the public cannot.

### Submit for review
If you're a Contributor and want an editor to check your work before it
goes live, click **Submit for review** instead of Publish. This is
optional — editors and admins can publish directly.

### Publish
Click **Publish**. The article goes live immediately at its public URL.

### Schedule
Instead of Publish, set a **Publication date/time** and click **Schedule**.
The article stays invisible to the public until that moment, then goes
live automatically — no one needs to be online when it happens. You can
still edit a scheduled article; **Save changes** keeps it scheduled unless
you explicitly click **Cancel schedule**.

### Unpublish
On a published article, click **Unpublish** to pull it down without
deleting it — it becomes a draft again, editable, not publicly visible.

### Archive / Restore
**Archive** removes a piece from active editorial use (also pulls it off
the public site) without deleting it. **Restore** brings an archived piece
back to draft.

---

## Media team

### Upload
**Media → Upload image**. New uploads are always **private** at first —
nothing becomes publicly visible just from uploading.

### Select (in an article)
Wherever you see **Choose image** (cover image, an Image block), it opens
the same Media Library — search existing uploads or upload a new one right
there.

### Promote
A private image must be **promoted** before it can appear on the live
site. In the Media Library, open the image and click **Promote to
Public**. Admin-only — if you're not an admin, ask one to promote it once
it's ready.

### Replace
Open the image in the Media Library and use **Replace** to swap the
underlying file while keeping everything that already uses it pointed at
the same image — no need to re-select it in every article.

### Delete
Admin-only. Before deleting, the Media Library shows what currently uses
the image (a cover, a portrait, an inline image) so nothing gets broken by
accident.

---

## People

### Create a contributor
**Contributors → New contributor.** Name and Slug are required; Title and
Bio are optional but recommended.

### Update a contributor
Open them from the Contributors list, edit, **Save contributor**.

### Add a portrait
Same Media Library flow as any other image — **Choose image**, upload or
select, promote to public so it's visible on their public page.

---

## Taxonomy

### Categories
**Categories → New category.** Name, Slug, optional Description. Deleting
a category that's still used by content shows a warning first — you can
cancel or delete anyway (content simply loses that category label, it
isn't deleted).

### Sections
**Sections → New section**, tied to a Publication, with a **Display
order** number controlling where it appears.

### Publications
**Publications → New publication.** Title, Slug, Subtitle, Status
(draft/published/archived), and a cover image through the same Media
Library flow.

---

## Admin

### Manage users
**Users** (admin-only). Change anyone's role with **Edit role**. The
system won't let you demote the last remaining admin — there must always
be at least one.

### Manage site settings
**Settings.** Default publication (pre-selected on new content), the
homepage's Featured story and Featured contributors, the editorial
banner's title/description, and the site's default title/description for
search engines and social sharing. Leave any of these blank and Springboard
falls back to its normal automatic behavior — nothing here is required.

### Manage site assets
**Settings → Site Assets** (admin-only). The approved PHD logo, Springboard
wordmark, favicon, and default social-share image, each selected through
the same Media Library. Upload the official file, promote it to public,
select it here.

### Inspect activity
**Activity.** Every create/edit/publish/delete/role-change/etc. across the
whole system, who did it, and when. Filter by user, action, entity type,
or date range.

### Restore a revision
Open any article or news piece and scroll to **Revision history** at the
bottom — every past saved version is listed. Click one to expand it, then
**Restore this version** to bring the content fields back to that state.
This doesn't delete anything — restoring itself creates a new revision, so
you can always go back further if needed.
