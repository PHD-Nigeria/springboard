-- Extensions
create extension if not exists pgcrypto with schema extensions;

-- Enums
create type public.content_type as enum (
  'EDITOR_NOTE',
  'ARTICLE',
  'COMPANY_NEWS',
  'EVENT',
  'STAFF_SPOTLIGHT',
  'BIRTHDAY',
  'HEALTH_TIP',
  'GALLERY'
);

create type public.content_status as enum (
  'draft',
  'review',
  'scheduled',
  'published',
  'archived'
);

create type public.user_role as enum (
  'admin',
  'editor',
  'contributor',
  'viewer'
);

create type public.media_bucket as enum (
  'public',
  'private'
);
