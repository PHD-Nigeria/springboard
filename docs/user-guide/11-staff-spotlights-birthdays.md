# Staff, Staff Spotlights & Staff News/Birthdays

## 1. What is Staff, and how is it different from Contributors?

**Staff** (Admin menu: **Staff**) is a second people directory, separate
from **Contributors** (see [People / Contributors](06-people-contributors.md)).
It holds a name, a job title, a department, a short bio, and a photo, but
it exists for a different reason: Contributors are bylines on written
pieces (an Article's "by" line), while Staff is the real employee
directory a **Staff Spotlight** or a **Staff News/Birthday** card
actually points at.

The two lists can overlap in who they're about (the same real person can
have both a Contributor record and a Staff record), but they are
different database records, managed on different pages, and one doesn't
create or update the other automatically. If you add someone as Staff,
that alone does not give them a Contributor byline, and vice versa.

## 2. Why is it important?

A **Staff Spotlight** and a **Staff News/Birthday** card both need to show
a real person's photo, name, and title, and both need that to update
everywhere at once if the person's photo or title changes. Keeping Staff
as its own reusable directory, the same reasoning as Contributors, means
you add someone once and then just pick them from a list every time
they're featured again.

## 3. What can I do here?

| Capability | Contributor (role) | Editor | Admin |
|---|:---:|:---:|:---:|
| View the Staff list | ✅ | ✅ | ✅ |
| Create a staff member | ❌ | ✅ | ✅ |
| Edit a staff member | ❌ | ✅ | ✅ |
| Delete a staff member | ❌ | ✅ | ✅ |
| Create a Staff Spotlight or Birthday | ✅ (their own draft) | ✅ | ✅ |

Only Editors and Admins can manage the Staff directory itself. Anyone who
can create content at all can build a Staff Spotlight or Birthday card
from staff already in the directory.

## 4. Add someone to the Staff directory

Go to **Staff** in the Admin menu.

1. Click **New staff member**.
2. Fill in:
   - **Full name** and **Slug**, required. The slug becomes part of their
     public profile address.
   - **Job title** and **Department**, optional.
   - **Bio**, optional.
3. Add a **Photo** using the image picker, the same Media Library flow
   used everywhere else in Springboard (see [Media](07-media.md)).
4. Leave **Active** ticked, unless this person has left and should no
   longer appear in public staff listings.
5. Click **Save staff member**.

Do this before starting a Spotlight or Birthday for someone new; both
builders below only let you pick from staff who already exist here.

## 5. Create a Staff Spotlight

A Staff Spotlight is a set of interview-style questions and answers about
one person, with their photo. Go to **Content → New content**, then click
**Staff Spotlight**.

1. **Title**, the headline of the piece (e.g. "Our Newest Addition to the
   Team"), not the person's name, their name comes from who you pick
   below.
2. **Slug**, the piece's web address.
3. **Who is this about?**, pick the person from the Staff directory.
   Picking someone automatically fills in their directory photo as this
   piece's photo, unless you've already chosen a different one.
4. **Photo**, change it here if the directory photo isn't the one you
   want for this piece specifically.
5. **Questions & answers**: fill in the question and answer for each pair
   already there, and click **Add question** for as many more as you
   need. Click **Remove** on a pair you don't want.
6. Click **Save draft**, or **Publish** once you're ready to go live
   (publishing requires at least one question and answer filled in).

The piece is tagged to the **Staff Spotlight** category automatically, so
it appears on the public **Staff Spotlight** page once published, no
separate step needed.

## 6. Create a Staff News / Birthday card

A Birthday is a single card, one person, their photo, and their birthday
month. Go to **Content → New content**, then click **Staff News /
Birthday**.

1. **Who's the birthday for?**, pick the person from the Staff directory.
   Picking someone fills in their directory photo automatically, unless
   you've already chosen a different one.
2. **Card title**, normally just their name, as it should appear on the
   card.
3. **Slug**, the card's web address.
4. **Month**, a short label shown under their name (e.g. "April").
5. **Photo**, change it here if needed.
6. Click **Save draft**, or **Publish**.

Each person gets their own Birthday card, one piece of content per
person, rather than one piece listing several names. The piece is tagged
to the **Staff News** category automatically, so it appears on the public
**Staff News** page once published.

## 7. Editing an existing Spotlight or Birthday

Open it from the **Content** list like anything else. Springboard
recognizes its type and opens the same dedicated Spotlight or Birthday
form you used to create it, pre-filled, not the general Article/Company
News editor.

## 8. What happens on the public website?

- A published Staff Spotlight appears on the **Staff Spotlight** page and
  at its own web address, showing the person's photo, name, title, and
  every question and answer in order.
- A published Birthday appears on the **Staff News** page as one card
  among the others, their photo, name, and month.
- Both statuses work exactly like any other content: **Draft** and **In
  review** are never visible publicly; **Published** is visible
  immediately; see [Content](05-content.md) for the full status list.

## 9. Important things to know

- **Add the person to Staff first.** Neither builder lets you type a new
  name directly; the person has to exist in the Staff directory before
  you can build a Spotlight or Birthday about them.
- **Deleting a staff member who's used in a Spotlight or Birthday is
  blocked or warned about**, Springboard tells you how many pieces of
  content reference them before you can proceed, the same pattern used
  everywhere else in the Admin.
- **A Spotlight's title is the headline, not the person's name.** The
  person's name is resolved from who you picked and shown separately,
  you don't need to (and shouldn't) repeat their name in the Title field.
- **These two types don't use the block editor.** Unlike Articles and
  Company News, there's no free-form body of paragraphs and images here,
  a Spotlight is its Q&A list, a Birthday is its photo and month.

---

This completes the Springboard Admin & Editorial User Guide. If
something in the Admin doesn't do what this guide describes, or a button
doesn't seem to work for your role, that's very likely the permission
system doing exactly what it's supposed to, not a mistake on your part.
